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

  String? _activeGirlfriendId;
  String? _activeGirlfriendName;

  Stream<Message> get messages => _controller.stream;
  Stream<String> get status => _statusController.stream;
  Stream<Map<String, String>> get messageAcks => _ackController.stream;

  void setActiveChat(String? girlfriendId, String? girlfriendName) {
    _activeGirlfriendId = girlfriendId;
    _activeGirlfriendName = girlfriendName;
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

          if (data['type'] == 'ack' &&
              data['traceId'] != null &&
              data['serverId'] != null) {
            _ackController.add({
              'traceId': data['traceId'],
              'serverId': data['serverId'].toString(),
            });
            return;
          }

          // Handle status updates (rendering_image, rendering_video, etc.)
          if (data['status'] != null) {
            _statusController.add(data['status']);
            return;
          }

          // Handle end marker
          if (data['end'] == true) {
            _statusController.add('');
            return;
          }

          // Handle message
          if (data['content'] != null) {
            final message = Message.fromJson(data);
            _controller.add(message);

            // Show notification if user is not in this chat
            if (message.role == 'assistant' &&
                data['girlfriend_id'] != null &&
                data['girlfriend_id'] != _activeGirlfriendId) {
              final girlfriendName = _activeGirlfriendName ?? 'Girlfriend';

              if (message.type == MessageType.text) {
                _notificationService.showMessageNotification(
                  girlfriendName: girlfriendName,
                  message: message.content,
                  girlfriendId: data['girlfriend_id'],
                );
              } else {
                _notificationService.showMediaNotification(
                  girlfriendName: girlfriendName,
                  mediaType: message.type.name,
                  girlfriendId: data['girlfriend_id'],
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

  Future<List<Message>> fetchChatHistory(String girlfriendId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return [];

    try {
      final response = await http.get(
        Uri.parse(
            '${Config.apiBaseUrl}/api/chat-history/$userId/$girlfriendId?limit=50'),
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
    String? girlfriendId,
    ReplyPreview? replyTo,
    String? mediaType,
    String? mediaUrl,
  }) {
    if (_channel == null) return;

    final traceId = _uuid.v4();
    final payloadMap = {
      'text': text,
      'traceId': traceId,
      if (girlfriendId != null) 'girlfriend_id': girlfriendId,
      if (replyTo != null) 'reply_preview': replyTo.toJson(),
      if (mediaType != null) 'mediaType': mediaType,
      if (mediaUrl != null) 'mediaUrl': mediaUrl,
    };
    final payload = jsonEncode(payloadMap);
    _channel!.sink.add(payload);

    _controller.add(Message(
      id: traceId,
      role: 'user',
      type: MessageType.text,
      content: text,
      timestamp: DateTime.now(),
      status: MessageStatus.sent,
      replyTo: replyTo,
    ));
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
