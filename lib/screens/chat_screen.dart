import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import '../config.dart' as app_config;
import '../models/message.dart';
import '../models/npc.dart';
import '../models/pending_media.dart';
import '../services/chat_service.dart';
import '../services/npc_service.dart';
import '../services/conversation_service.dart';
import '../services/conversation_service.dart';
import '../services/supabase_service.dart';
import '../services/user_service.dart';
import '../widgets/unified_message_bubble.dart';
import '../widgets/npc_avatar.dart';
import '../widgets/recording_button.dart';
import '../services/audio_recorder_service.dart';
import '../widgets/pending_media_bubble.dart';
import '../services/npc_feed_service.dart'; // Added import for feed service

class ChatScreen extends ConsumerStatefulWidget {
  final String npcId;

  const ChatScreen({super.key, required this.npcId});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _chatService = ChatService();
  final _npcService = NpcService();
  final _conversationService = ConversationService();
  final _controller = TextEditingController();
  final _inputFocusNode = FocusNode();
  final _scrollController = ScrollController();
  final List<Message> _messages = [];
  final List<Message> _incomingQueue = [];
  final Map<String, PendingMedia> _pendingMedia = {};
  StreamSubscription<Message>? _messageSubscription;
  StreamSubscription<String>? _statusSubscription;
  StreamSubscription<Map<String, dynamic>>? _npcStatusSubscription;
  StreamSubscription<Map<String, String>>? _ackSubscription;
  StreamSubscription<Map<String, dynamic>>? _mediaEventSubscription;
  bool _sending = false;
  bool _showEmojiPicker = false;
  String _currentStatus = '';
  Npc? _npc;
  Message? _replyingMessage;
  bool _photoUploading = false;
  final _audioRecorder = AudioRecorderService();
  bool _isRecording = false;
  String? _pendingStatusMessageId;
  Timer? _typingStatusTimer;
  Timer? _queueTimer;
  bool _queueProcessing = false;

  void _enqueueIncoming(Message message) {
    // Limit NPC text length
    if (message.role == 'assistant' &&
        message.type == MessageType.text &&
        message.content.length > 50) {
      message = message.copyWith(content: message.content.substring(0, 50));
    }
    _incomingQueue.add(message);
    if (!_queueProcessing) {
      _processQueue();
    }
  }

  void _processQueue() {
    if (!mounted) return;
    if (_incomingQueue.isEmpty) {
      _queueProcessing = false;
      return;
    }
    _queueProcessing = true;
    final next = _incomingQueue.removeAt(0);
    setState(() {
      _messages.add(next);
    });
    _scrollToBottom();
    _queueTimer?.cancel();
    _queueTimer = Timer(const Duration(milliseconds: 1200), _processQueue);
  }

  @override
  void initState() {
    super.initState();
    _loadNpc();
    _loadHistory();
    _chatService.connect();

    _messageSubscription = _chatService.messages.listen((message) {
      _enqueueIncoming(message);
    });
    _statusSubscription = _chatService.status.listen((status) {
      setState(() {
        _currentStatus = status;
        _handleStatusMessage(status);
      });
    });
    _npcStatusSubscription = _chatService.npcStatus.listen((data) {
      _handleNpcStatus(data);
    });
    _mediaEventSubscription = _chatService.mediaEvents.listen((data) {
      _handleMediaEvent(data);
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

  Future<void> _loadNpc() async {
    try {
      // Try loading as NPC
      var gf = await _npcService.getNpcById(widget.npcId);
      
      if (gf == null) {
        // Try loading as User
        debugPrint('🔍 Loading user profile for ID: ${widget.npcId}');
        final userService = ref.read(userServiceProvider);
        final userProfile = await userService.getUserProfileById(widget.npcId);
        
        debugPrint('📦 User profile data: $userProfile');
        
        if (userProfile != null) {
          // Create a dummy NPC object for the UI using fromJson to handle date parsing
          gf = Npc.fromJson({
            'id': userProfile['id'],
            'user_id': userProfile['id'], 
            'name': userProfile['username'] ?? 'Utente',
            'avatar_url': userProfile['avatar_url'],
            'gender': 'female',
            'is_public': true,
            'is_active': true,
            'tone': 'friendly',
            'created_at': DateTime.now().toIso8601String(),
            'updated_at': DateTime.now().toIso8601String(),
          });
          debugPrint('✅ Created NPC object: name=${gf.name}, avatar=${gf.avatarUrl}');
        } else {
          debugPrint('❌ User profile is null');
        }
      } else {
        debugPrint('✅ Loaded as NPC: name=${gf.name}, avatar=${gf.avatarUrl}');
      }

      if (gf == null) {
        // Neither NPC nor User found
        debugPrint('❌ No NPC or User found with ID: ${widget.npcId}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Thriller non trovato o non più disponibile'),
              backgroundColor: Colors.red,
            ),
          );
          // Navigate back to home
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/');
          }
        }
        return;
      }

      if (mounted) {
        setState(() {
          _npc = gf;
        });
        if (gf != null) {
            _chatService.setActiveChat(widget.npcId, gf.name);
        }
      }
    } catch (e) {
      debugPrint('❌ Error loading NPC/User: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore caricamento Thriller: $e')),
        );
        // Navigate back on error
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/');
        }
      }
    }
  }

  Future<void> _loadHistory() async {
    try {
      final history = await _chatService.fetchChatHistory(widget.npcId);
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

  void _handleStatusMessage(String status) {
    // Mantieni solo lo stato per header e pallini, senza inserire messaggi fittizi
    _currentStatus = status;
  }

  void _handleNpcStatus(Map<String, dynamic> data) {
    final npcId = data['npcId']?.toString();
    if (npcId == null || npcId != widget.npcId) return;

    final status = data['status']?.toString() ?? '';
    if (!mounted) return;

    setState(() {
      if (status == 'idle' || status.isEmpty) {
        _currentStatus = '';
      } else {
        _currentStatus = status;
      }
    });
  }

  @override
  void dispose() {
    // Clear active chat when leaving
    _chatService.setActiveChat(null, null);
    _messageSubscription?.cancel();
    _statusSubscription?.cancel();
    _npcStatusSubscription?.cancel();
    _ackSubscription?.cancel();
    _mediaEventSubscription?.cancel();
    _typingStatusTimer?.cancel();
    _queueTimer?.cancel();
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
          _scrollController.position.minScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _scrollPendingToBottom() {
    Future.delayed(const Duration(milliseconds: 30), () {
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.position.minScrollExtent);
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
                if (message.type == MessageType.image)
                  ListTile(
                    leading: const Icon(Icons.public, color: Colors.blueAccent),
                    title: const Text('Pubblica nel Feed', style: TextStyle(color: Colors.white)),
                    onTap: () {
                      Navigator.pop(buildContext);
                      _showPublishConfirmation(message);
                    },
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showPublishConfirmation(Message message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Pubblica foto', style: TextStyle(color: Colors.white)),
        content: const Text('Vuoi pubblicare questa foto nella bacheca pubblica?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annulla', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _publishToFeed(message);
            },
            child: const Text('Pubblica', style: TextStyle(color: Colors.pinkAccent)),
          ),
        ],
      ),
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
  }

  Future<void> _publishToFeed(Message message) async {
    // Determine the media URL - support both content URL and mediaUrl field if we had one
    // In chat_screen, imageUrl is usually in content if type is image
    String? mediaUrl;
    if (message.type == MessageType.image) {
       // Similar extraction logic as in build method
       if (message.content.startsWith('http')) {
         mediaUrl = message.content;
       } else {
         final urlRegExp = RegExp(r'(https?://[^\s]+)', caseSensitive: false);
         final match = urlRegExp.firstMatch(message.content);
         if (match != null) {
           mediaUrl = match.group(0);
         }
       }
    }
    
    if (mediaUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nessuna immagine da pubblicare')),
      );
      return;
    }

    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pubblicazione in corso...')),
      );
      
      // Use the sender ID as NPC ID. If it's the user publishing their own photo, 
      // we might want to handle that, but typically this is for publishing NPC photos.
      // If the message is from the user, maybe we shouldn't allow it?
      // The user asked "publish photos... to feed". 
      // If I publish a photo I sent, it should probably appear as "User's photo".
      // But the endpoint is publish-npc. 
      // Let's assume we publish it associated with the current NPC conversation if it's 1-to-1,
      // OR if it's the user's photo, we might need to adjust the backend to support user posts.
      // For now, let's use the message sender ID if it's an NPC, or the current chat NPC ID?
      // Actually, if it's a 1-to-1 chat with an NPC, we should probably publish it to THAT NPC's feed.
      
      await NpcFeedService.publishNpc(
        npcId: widget.npcId, // Associate with this NPC context
        message: 'Foto dalla chat',
        mediaUrl: mediaUrl,
        mediaType: 'image',
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Foto pubblicata nel feed! 📸')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore pubblicazione: $e')),
        );
      }
    }
  }

  void addPendingMedia(PendingMedia media) {
    setState(() {
      _pendingMedia[media.tempId] = media;
    });
    _scrollPendingToBottom();
  }

  void completePendingMedia(String tempId) {
    setState(() {
      _pendingMedia.remove(tempId);
    });
    _scrollPendingToBottom();
  }

  void failPendingMedia(String tempId) {
    if (_pendingMedia.containsKey(tempId)) {
      setState(() {
        _pendingMedia[tempId]!.status = 'failed';
      });
      _scrollPendingToBottom();
    }
  }

  void _handleMediaEvent(Map<String, dynamic> data) {
    switch (data['event']) {
      case 'media_generation_started':
        addPendingMedia(
          PendingMedia(
            tempId: data['tempId']?.toString() ?? '',
            npcId: data['npcId']?.toString() ?? widget.npcId,
            mediaType: data['mediaType']?.toString() ?? 'image',
          ),
        );
        break;
      case 'media_generation_completed':
        completePendingMedia(data['tempId']?.toString() ?? '');
        final mediaType = (data['mediaType'] ?? 'image').toString();
        final msg = Message(
          id: data['messageId']?.toString() ??
              DateTime.now().millisecondsSinceEpoch.toString(),
          role: 'assistant',
          type: _messageTypeFromString(mediaType),
          content: data['finalUrl']?.toString() ?? '',
          timestamp: DateTime.now(),
        );
        setState(() {
          _messages.add(msg);
        });
        _scrollToBottom();
        break;
      case 'media_generation_failed':
        failPendingMedia(data['tempId']?.toString() ?? '');
        break;
      default:
        break;
    }
  }

  MessageType _messageTypeFromString(String raw) {
    switch (raw.toLowerCase()) {
      case 'image':
      case 'photo':
      case 'couple_photo':
      case 'media':
        return MessageType.image;
      case 'video':
        return MessageType.video;
      case 'audio':
        return MessageType.audio;
      default:
        return MessageType.text;
    }
  }

  // ===== AUDIO RECORDING METHODS =====
  
  Future<void> _startRecording() async {
    // Forza la richiesta permessi prima di iniziare
    final permissionGranted = await _audioRecorder.requestPermission();
    if (!permissionGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'Permesso microfono necessario per registrare audio.',
              style: TextStyle(color: Colors.white),
            ),
            backgroundColor: Colors.redAccent,
            action: SnackBarAction(
              label: 'Impostazioni',
              textColor: Colors.white,
              onPressed: openAppSettings,
            ),
          ),
        );
      }
      return;
    }

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
        'npcId': widget.npcId,
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
        npcId: widget.npcId,
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
      npcId: widget.npcId,
      replyTo: replyPreview,
    );
    _controller.clear();
    _scrollToBottom();
    _clearReplyingMessage();

    setState(() => _sending = false);
  }

  void _onTextChanged(String value) {
    _typingStatusTimer?.cancel();
    final status = value.trim().isEmpty ? '' : 'typing';
    if (status.isNotEmpty) {
      _chatService.sendTypingStatus(widget.npcId, status: status);
      _typingStatusTimer = Timer(const Duration(seconds: 3), () {
        _chatService.sendTypingStatus(widget.npcId, status: '');
      });
    }
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
                  title: const Text(
                    'Libreria',
                    style: TextStyle(color: Colors.white),
                  ),
                  onTap: () => Navigator.pop(context, ImageSource.gallery),
                ),
                ListTile(
                  leading:
                      const Icon(Icons.camera_alt, color: Colors.pinkAccent),
                  title: const Text(
                    'Fotocamera',
                    style: TextStyle(color: Colors.white),
                  ),
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
        'npcId': widget.npcId,
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
          onTap: () => context.push('/profile/${widget.npcId}'),
          child: Row(
            children: [
              NpcAvatar(
                npc: _npc,
                radius: 18,
                showOnlineIndicator: true,
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _npc?.name ?? 'Sexy Lara',
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
            onPressed: () => context.push('/gallery/${widget.npcId}'),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.go('/create-npc'),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Builder(builder: (context) {
              final displayMessages = _messages.reversed.toList();
              final displayPending = _pendingMedia.values.toList().reversed.toList();
              final showStatus = _currentStatus.isNotEmpty;
              final List<dynamic> items = [];
              if (showStatus) items.add('status');
              items.addAll(displayPending);
              items.addAll(displayMessages);

              return ListView.builder(
                controller: _scrollController,
                reverse: true,
                padding: const EdgeInsets.symmetric(vertical: 12),
                itemCount: items.length,
                itemBuilder: (_, index) {
                  final currentUserId = SupabaseService.currentUser?.id;
                  final item = items[index];
                  if (item is String && item == 'status') {
                    return TypingIndicator(avatarUrl: _npc?.avatarUrl);
                  }
                  if (item is PendingMedia) {
                    return PendingMediaBubble(item);
                  }
                  final msg = item as Message;
                  final isAssistant = msg.role == 'assistant';
                  final isMine = msg.senderId != null && currentUserId != null
                      ? msg.senderId == currentUserId
                      : msg.isUser;
                  final bubbleAvatar = isMine
                      ? null
                      : (msg.avatarUrl ?? _npc?.avatarUrl);
                  final senderName = isMine
                      ? null
                      : (msg.senderName ?? _npc?.name);
                  return GestureDetector(
                    onLongPress: () => _showMessageOptions(msg),
                    child: UnifiedMessageBubble(
                      content: msg.content,
                      type: msg.type == MessageType.text
                          ? MessageType.text
                          : msg.type == MessageType.image
                              ? MessageType.image
                              : msg.type == MessageType.video
                                  ? MessageType.video
                                  : msg.type == MessageType.audio
                          ? MessageType.audio
                          : MessageType.text,
                      isMe: isMine,
                      timestamp: msg.timestamp,
                      mediaUrl: msg.type != MessageType.text ? msg.content : null,
                      avatarUrl: bubbleAvatar,
                      senderName: senderName,
                      replyTo: msg.replyTo,
                    ),
                  );
                },
              );
            }),
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
                                      : _npc?.name ?? 'Lara',
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
                            onChanged: _onTextChanged,
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
      case 'typing':
        return '${_npc?.name ?? 'Thriller'} sta scrivendo...';
      case 'sending_image':
      case 'rendering_image':
        return '${_npc?.name ?? 'Thriller'} sta inviando un\'immagine...';
      case 'sending_video':
      case 'rendering_video':
        return '${_npc?.name ?? 'Thriller'} sta inviando un video...';
      case 'sending_audio':
      case 'recording_audio':
        return '${_npc?.name ?? 'Thriller'} sta registrando un audio...';
      default:
        return '${_npc?.name ?? 'Thriller'} sta scrivendo...';
    }
  }
}
