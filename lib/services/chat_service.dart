import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:uuid/uuid.dart';

import '../models/message.dart';
import 'supabase_service.dart';
import 'notification_service.dart';
import '../config.dart';

class ChatService {
  final _uuid = const Uuid();
  final _notificationService = NotificationService();
  WebSocketChannel? _channel;
  final _controller = StreamController<Message>.broadcast();
  final _statusController = StreamController<String>.broadcast();
  final _ackController = StreamController<Map<String, String>>.broadcast();
  final _mediaEventController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _npcStatusController =
      StreamController<Map<String, dynamic>>.broadcast();
  final Map<String, String> _lastTypingStatus = {};

  String? _activeNpcId;
  String? _activeNpcName;

  Stream<Message> get messages => _controller.stream;
  Stream<String> get status => _statusController.stream;
  Stream<Map<String, String>> get messageAcks => _ackController.stream;
  Stream<Map<String, dynamic>> get mediaEvents => _mediaEventController.stream;
  Stream<Map<String, dynamic>> get npcStatus => _npcStatusController.stream;

  void setActiveChat(String? npcId, String? npcName) {
    _activeNpcId = npcId;
    _activeNpcName = npcName;
  }

  void connect() {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;

    final uri = Uri.parse('${Config.wsBaseUrl}/ws?user_id=$userId');
    _channel = WebSocketChannel.connect(uri);
    _channel!.stream.listen(
      (event) {
        try {
          final data = jsonDecode(event.toString());

          if (data['event'] != null) {
            // npc_status events (typing / sending media)
            if (data['event'] == 'npc_status') {
              _npcStatusController.add(Map<String, dynamic>.from(data));
              // Mantieni compatibilità con status stream per mostrare indicatori
              if (data['status'] != null) {
                _statusController.add(data['status'].toString());
              }
              return;
            }
            _mediaEventController.add(Map<String, dynamic>.from(data));
            return;
          }

          if (data['type'] == 'ack' &&
              data['traceId'] != null &&
              data['serverId'] != null) {
            _ackController.add({
              'traceId': data['traceId'],
              'serverId': data['serverId'].toString(),
            });
            return;
          }

          // Handle legacy status updates
          if (data['status'] != null) {
            _statusController.add(data['status']);
            // Clear on end marker handled below
            return;
          }

          // Handle end marker
          if (data['end'] == true) {
            _statusController.add('');
            _npcStatusController.add({'status': ''});
            return;
          }

          // Handle message
          if (data['content'] != null) {
            final message = Message.fromJson(data);
            _controller.add(message);

            // Show notification if user is not in this chat
            final npcId = data['npc_id'] ?? data['npc_id'];
            if (message.role == 'assistant' &&
                npcId != null &&
                npcId != _activeNpcId) {
              final npcName = _activeNpcName ?? 'Thriller';

              if (message.type == MessageType.text) {
                _notificationService.showMessageNotification(
                  npcName: npcName,
                  message: message.content,
                  npcId: npcId,
                );
              } else {
                _notificationService.showMediaNotification(
                  npcName: npcName,
                  mediaType: message.type.name,
                  npcId: npcId,
                );
              }
            }
          }
        } catch (error) {
          print('Error parsing message: $error');
          _controller.addError(error);
        }
      },
      onError: (error) {
        print('WebSocket error: $error');
        _controller.addError(error);
      },
    );
  }

  Future<List<Message>> fetchChatHistory(String npcId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return [];

    try {
      final response = await http.get(
        Uri.parse(
            '${Config.apiBaseUrl}/api/chat-history/$userId/$npcId?limit=50'),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => Message.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load chat history');
      }
    } catch (e) {
      print('Error fetching history: $e');
      return [];
    }
  }

  void sendMessage(
    String text, {
    String? npcId,
    ReplyPreview? replyTo,
    String? mediaType,
    String? mediaUrl,
  }) {
    if (_channel == null) return;

    final traceId = _uuid.v4();
    MessageType resolvedType = MessageType.text;
    if (mediaType != null) {
      final lower = mediaType.toLowerCase();
      if (lower == 'photo' || lower == 'image' || lower == 'couple_photo' || lower == 'media') {
        resolvedType = MessageType.image;
      } else if (lower == 'video') {
        resolvedType = MessageType.video;
      } else if (lower == 'audio') {
        resolvedType = MessageType.audio;
      }
    }

    final payloadMap = {
      'text': text,
      'traceId': traceId,
      if (npcId != null) 'npc_id': npcId,
      if (replyTo != null) 'reply_preview': replyTo.toJson(),
      if (mediaType != null) 'mediaType': mediaType,
      if (mediaUrl != null) 'mediaUrl': mediaUrl,
    };
    final payload = jsonEncode(payloadMap);
    _channel!.sink.add(payload);

    _controller.add(Message(
        id: traceId,
        role: 'user',
        type: resolvedType,
        content: mediaUrl ?? text,
        timestamp: DateTime.now(),
        status: MessageStatus.sent,
        replyTo: replyTo,
        senderId: SupabaseService.currentUser?.id));
  }

  void sendTypingStatus(String npcId, {String status = 'typing'}) {
    if (_channel == null) return;
    final last = _lastTypingStatus[npcId];
    if (last == status) return;
    _lastTypingStatus[npcId] = status;
    final payload = jsonEncode({
      'event': 'typing',
      'npc_id': npcId,
      'status': status,
    });
    _channel!.sink.add(payload);
  }

  void dispose() {
    _channel?.sink.close();
    if (!_controller.isClosed) {
      _controller.close();
    }
    if (!_statusController.isClosed) {
      _statusController.close();
    }
    if (!_ackController.isClosed) {
      _ackController.close();
    }
    if (!_mediaEventController.isClosed) {
      _mediaEventController.close();
    }
    if (!_npcStatusController.isClosed) {
      _npcStatusController.close();
    }
  }

  Future<void> deleteMessage(String messageId) async {
    final uri = Uri.parse('${Config.apiBaseUrl}/api/messages/$messageId');
    final response = await http.delete(uri);
    if (response.statusCode != 200) {
      throw Exception(
          'Impossibile eliminare il messaggio (${response.statusCode})');
    }
  }
}
