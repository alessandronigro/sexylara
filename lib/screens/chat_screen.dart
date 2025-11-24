import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../config.dart' as app_config;
import '../models/message.dart';
import '../models/girlfriend.dart';
import '../services/chat_service.dart';
import '../services/girlfriend_service.dart';
import '../services/conversation_service.dart';
import '../services/supabase_service.dart';
import '../widgets/unified_message_bubble.dart';
import '../widgets/girlfriend_avatar.dart';
import '../widgets/recording_button.dart';
import '../services/audio_recorder_service.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String girlfriendId;

  const ChatScreen({super.key, required this.girlfriendId});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _chatService = ChatService();
  final _girlfriendService = GirlfriendService();
  final _conversationService = ConversationService();
  final _controller = TextEditingController();
  final _inputFocusNode = FocusNode();
  final _scrollController = ScrollController();
  final List<Message> _messages = [];
  StreamSubscription<Message>? _messageSubscription;
  StreamSubscription<String>? _statusSubscription;
  StreamSubscription<Map<String, String>>? _ackSubscription;
  bool _sending = false;
  bool _showEmojiPicker = false;
  String _currentStatus = '';
  Girlfriend? _girlfriend;
  Message? _replyingMessage;
  bool _photoUploading = false;
  final _audioRecorder = AudioRecorderService();
  bool _isRecording = false;

  @override
  void initState() {
    super.initState();
    _loadGirlfriend();
    _loadHistory();
    _chatService.connect();

    _messageSubscription = _chatService.messages.listen((message) {
      setState(() {
        _messages.add(message);
      });
      _scrollToBottom();
    });
    _statusSubscription = _chatService.status.listen((status) {
      setState(() {
        _currentStatus = status;
      });
    });
    _ackSubscription = _chatService.messageAcks.listen((ack) {
      if (!mounted) return;
      final traceId = ack['traceId'];
      final serverId = ack['serverId'];
      if (traceId == null || serverId == null) return;

      final index = _messages.indexWhere((m) => m.id == traceId);
      if (index != -1) {
        setState(() {
          _messages[index] = _messages[index].copyWith(serverId: serverId);
        });
      }
    });
  }

  Future<void> _loadGirlfriend() async {
    try {
      final gf =
          await _girlfriendService.getGirlfriendById(widget.girlfriendId);
      setState(() {
        _girlfriend = gf;
      });
      // Set active chat to prevent notifications for this conversation
      _chatService.setActiveChat(widget.girlfriendId, gf?.name);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore caricamento girlfriend: $e')),
        );
      }
    }
  }

  Future<void> _loadHistory() async {
    try {
      final history = await _chatService.fetchChatHistory(widget.girlfriendId);
      if (mounted) {
        setState(() {
          _messages.addAll(history);
        });
        _scrollToBottom();
      }
    } catch (e) {
      print('Error loading history: $e');
    }
  }

  @override
  void dispose() {
    // Clear active chat when leaving
    _chatService.setActiveChat(null, null);
    _messageSubscription?.cancel();
    _statusSubscription?.cancel();
    _ackSubscription?.cancel();
    _chatService.dispose();
    _controller.dispose();
    _inputFocusNode.dispose();
    _scrollController.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _showMessageOptions(Message message) {
    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (buildContext) {
        return Container(
          decoration: const BoxDecoration(
            color: Color(0xFF141414),
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.reply, color: Colors.pinkAccent),
                  title: const Text('Rispondi', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(buildContext);
                    _setReplyingMessage(message);
                  },
                ),
                ListTile(
                  leading: Icon(
                    Icons.delete_outline,
                    color: message.serverId != null
                        ? Colors.redAccent
                        : Colors.grey,
                  ),
                  title: const Text('Elimina messaggio',
                      style: TextStyle(color: Colors.white)),
                  enabled: message.serverId != null,
                  subtitle: message.serverId == null
                      ? const Text('Il messaggio viene sincronizzato...')
                      : null,
                  onTap: message.serverId != null
                      ? () {
                          Navigator.pop(buildContext);
                          _deleteMessage(message);
                        }
                      : null,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _setReplyingMessage(Message message) {
    setState(() {
      _replyingMessage = message;
    });
    FocusScope.of(context).requestFocus(_inputFocusNode);
  }

  void _clearReplyingMessage() {
    if (_replyingMessage == null) return;
    setState(() {
      _replyingMessage = null;
    });
  }

  Future<void> _deleteMessage(Message message) async {
    if (message.serverId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Attendi qualche secondo prima di eliminare')),
        );
      }
      return;
    }

    try {
      await _chatService.deleteMessage(message.serverId!);
      if (!mounted) return;
      setState(() {
        _messages.removeWhere(
            (m) => m.id == message.id || m.serverId == message.serverId);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Messaggio eliminato')),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore eliminazione: $error')),
        );
      }
    }
  }

  // ===== AUDIO RECORDING METHODS =====
  
  Future<void> _startRecording() async {
    final success = await _audioRecorder.startRecording();
    if (success) {
      setState(() {
        _isRecording = true;
      });
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Impossibile avviare la registrazione. Controlla i permessi del microfono.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _stopRecordingAndSend() async {
    final audioPath = await _audioRecorder.stopRecording();
    setState(() {
      _isRecording = false;
    });

    if (audioPath != null) {
      await _sendAudioMessage(audioPath);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Errore durante il salvataggio della registrazione'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _cancelRecording() async {
    await _audioRecorder.cancelRecording();
    setState(() {
      _isRecording = false;
    });
  }

  Future<void> _sendAudioMessage(String audioPath) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;

    // Create optimistic message
    final tempId = DateTime.now().millisecondsSinceEpoch.toString();
    final tempMessage = Message(
      id: tempId,
      role: 'user',
      type: MessageType.audio,
      content: audioPath,
      timestamp: DateTime.now(),
      status: MessageStatus.sending,
    );

    setState(() {
      _messages.add(tempMessage);
    });
    _scrollToBottom();

    try {
      // Read audio file and encode to base64
      final file = File(audioPath);
      final bytes = await file.readAsBytes();
      final audioBase64 = base64Encode(bytes);

      // Upload to backend
      final payload = jsonEncode({
        'userId': userId,
        'girlfriendId': widget.girlfriendId,
        'filename': 'audio_${DateTime.now().millisecondsSinceEpoch}.m4a',
        'audioBase64': audioBase64,
      });

      final response = await http.post(
        Uri.parse('${app_config.Config.apiBaseUrl}/api/audio/upload'),
        headers: {'Content-Type': 'application/json'},
        body: payload,
      );

      if (response.statusCode != 200) {
        throw Exception('Errore ${response.statusCode}');
      }

      final data = jsonDecode(response.body);
      final audioUrl = data['url'];

      // Send via WebSocket with mediaType and mediaUrl
      _chatService.sendMessage(
        '🎤 Messaggio vocale',
        girlfriendId: widget.girlfriendId,
        mediaType: 'audio',
        mediaUrl: audioUrl,
      );

      // Update message status
      setState(() {
        final index = _messages.indexWhere((m) => m.id == tempId);
        if (index != -1) {
          _messages[index] = tempMessage.copyWith(
            status: MessageStatus.sent,
            content: audioUrl,
          );
        }
      });

      // Delete temporary file
      await file.delete();

    } catch (e) {
      debugPrint('❌ Error sending audio: $e');
      
      // Update message status to error
      setState(() {
        final index = _messages.indexWhere((m) => m.id == tempId);
        if (index != -1) {
          _messages[index] = tempMessage.copyWith(
            status: MessageStatus.error,
          );
        }
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Errore invio audio: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _sendMessage() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    final replyPreview = _replyingMessage == null
        ? null
        : ReplyPreview(
            id: _replyingMessage!.serverId ?? _replyingMessage!.id,
            content: _replyingMessage!.content,
            role: _replyingMessage!.role,
          );

    setState(() {
      _sending = true;
      _showEmojiPicker = false;
    });

    _chatService.sendMessage(
      text,
      girlfriendId: widget.girlfriendId,
      replyTo: replyPreview,
    );
    _controller.clear();
    _scrollToBottom();
    _clearReplyingMessage();

    setState(() => _sending = false);
  }

  Future<void> _showPhotoSourceOptions() async {
    if (!mounted) return;
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Color(0xFF141414),
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.photo, color: Colors.pinkAccent),
                  title: const Text('Libreria'),
                  onTap: () => Navigator.pop(context, ImageSource.gallery),
                ),
                ListTile(
                  leading:
                      const Icon(Icons.camera_alt, color: Colors.pinkAccent),
                  title: const Text('Fotocamera'),
                  onTap: () => Navigator.pop(context, ImageSource.camera),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (source != null) {
      await _pickPhoto(source);
    }
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: source,
      maxWidth: 1400,
      maxHeight: 1400,
      imageQuality: 80,
    );
    if (file == null) return;

    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;

    // Create optimistic message
    final tempId = DateTime.now().millisecondsSinceEpoch.toString();
    final tempMessage = Message(
      id: tempId,
      role: 'user',
      type: MessageType.image,
      content: file.path,
      timestamp: DateTime.now(),
      status: MessageStatus.sending,
    );

    setState(() {
      _messages.add(tempMessage);
      _photoUploading = true;
    });
    _scrollToBottom();

    try {
      final bytes = await file.readAsBytes();
      final payload = jsonEncode({
        'userId': userId,
        'girlfriendId': widget.girlfriendId,
        'filename': file.name,
        'imageBase64': base64Encode(bytes),
      });

      final response = await http.post(
        Uri.parse('${app_config.Config.apiBaseUrl}/api/photos/comment'),
        headers: {'Content-Type': 'application/json'},
        body: payload,
      );

      if (response.statusCode != 200) {
        throw Exception('Errore ${response.statusCode}');
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final userMessage =
          Message.fromJson(body['userMessage'] as Map<String, dynamic>);
      final assistantMessage =
          Message.fromJson(body['assistantMessage'] as Map<String, dynamic>);

      if (!mounted) return;
      setState(() {
        // Replace temp message with server message
        final index = _messages.indexWhere((m) => m.id == tempId);
        if (index != -1) {
          _messages[index] = userMessage;
        } else {
          _messages.add(userMessage);
        }
        _messages.add(assistantMessage);
      });
      _scrollToBottom();
    } catch (error) {
      if (mounted) {
        setState(() {
          // Mark as error or remove
          final index = _messages.indexWhere((m) => m.id == tempId);
          if (index != -1) {
            _messages.removeAt(index); // Or mark as error
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore caricamento foto: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _photoUploading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        automaticallyImplyLeading:
            false, // Disable default back button to use custom one
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/'); // Fallback to home if no history
            }
          },
        ),
        title: GestureDetector(
          onTap: () => context.push('/profile/${widget.girlfriendId}'),
          child: Row(
            children: [
              GirlfriendAvatar(
                girlfriend: _girlfriend,
                radius: 18,
                showOnlineIndicator: true,
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _girlfriend?.name ?? 'Sexy Lara',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  if (_currentStatus.isNotEmpty)
                    Text(
                      _getStatusText(_currentStatus),
                      style: const TextStyle(
                          fontSize: 12, color: Colors.pinkAccent),
                    ),
                ],
              ),
            ],
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.photo_library),
            tooltip: 'Gallery',
            onPressed: () => context.push('/gallery/${widget.girlfriendId}'),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.go('/create-girlfriend'),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(vertical: 12),
              itemCount: _messages.length + (_currentStatus.isNotEmpty ? 1 : 0),
              itemBuilder: (_, index) {
                if (index == _messages.length && _currentStatus.isNotEmpty) {
                  return const TypingIndicator();
                }
                final msg = _messages[index];
                return GestureDetector(
                  onLongPress: () => _showMessageOptions(msg),
                  child: UnifiedMessageBubble(
                    content: msg.content,
                    type: msg.type == MessageType.text ? MessageType.text :
                          msg.type == MessageType.image ? MessageType.image :
                          msg.type == MessageType.video ? MessageType.video :
                          msg.type == MessageType.audio ? MessageType.audio : MessageType.text,
                    isMe: msg.isUser,
                    timestamp: msg.timestamp,
                    mediaUrl: msg.type != MessageType.text ? msg.content : null,
                  ),
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A1A),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.3),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  if (_replyingMessage != null)
                    Container(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white10,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _replyingMessage!.role == 'user'
                                      ? 'Tu'
                                      : _girlfriend?.name ?? 'Lara',
                                  style: const TextStyle(
                                    color: Colors.pinkAccent,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _replyingMessage!.content,
                                  style: const TextStyle(color: Colors.white70),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon:
                                const Icon(Icons.close, color: Colors.white60),
                            onPressed: _clearReplyingMessage,
                          ),
                        ],
                      ),
                    ),
                  if (_photoUploading)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Row(
                        children: const [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              color: Colors.pinkAccent,
                              strokeWidth: 2,
                            ),
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Caricamento foto...',
                              style: TextStyle(
                                  color: Colors.white70, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (_showEmojiPicker)
                    SizedBox(
                      height: 250,
                      child: EmojiPicker(
                        onEmojiSelected: (category, emoji) {
                          _controller.text += emoji.emoji;
                        },
                        config: const Config(),
                      ),
                    ),
                  // Input row (moved inside SafeArea/Column)
                  // Show recording UI when recording, otherwise show normal input
                  if (_isRecording)
                    RecordingButton(
                      isRecording: _isRecording,
                      onStartRecording: _startRecording,
                      onStopRecording: _stopRecordingAndSend,
                      onCancelRecording: _cancelRecording,
                    )
                  else
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.photo_camera, color: Colors.pinkAccent),
                          onPressed: _photoUploading ? null : _showPhotoSourceOptions,
                        ),
                        Expanded(
                          child: TextField(
                            controller: _controller,
                            focusNode: _inputFocusNode,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              hintText: 'Scrivi un messaggio...',
                              hintStyle: TextStyle(color: Colors.grey[600]),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(24),
                                borderSide: BorderSide.none,
                              ),
                              filled: true,
                              fillColor: Colors.grey[900],
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 20, vertical: 10),
                            ),
                            onSubmitted: (_) => _sendMessage(),
                          ),
                        ),
                        // Mic button (replaces emoji button when not recording)
                        IconButton(
                          icon: const Icon(Icons.mic, color: Colors.pinkAccent),
                          onPressed: _startRecording,
                        ),
                        IconButton(
                          icon: Icon(
                              _showEmojiPicker
                                  ? Icons.keyboard
                                  : Icons.emoji_emotions_outlined,
                              color: Colors.pinkAccent),
                          onPressed: () {
                            setState(() {
                              _showEmojiPicker = !_showEmojiPicker;
                            });
                          },
                        ),
                        const SizedBox(width: 8),
                        CircleAvatar(
                          backgroundColor: Colors.pinkAccent,
                          child: IconButton(
                            icon: _sending || _photoUploading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.send, color: Colors.white),
                            onPressed: (_sending || _photoUploading) ? null : _sendMessage,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'rendering_image':
        return 'Generando immagine...';
      case 'rendering_video':
        return 'Generando video...';
      case 'recording_audio':
        return 'Registrando audio...';
      default:
        return 'Sta scrivendo...';
    }
  }
}
