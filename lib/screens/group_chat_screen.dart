import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:uuid/uuid.dart';
import 'dart:convert';

import '../config.dart';
import '../services/supabase_service.dart';
import '../widgets/chat_message_bubble.dart'; 
import 'group_invite_screen.dart'; // ← Import aggiunto

class GroupChatScreen extends ConsumerStatefulWidget {
  final String groupId;
  const GroupChatScreen({super.key, required this.groupId});

  @override
  ConsumerState<GroupChatScreen> createState() => _GroupChatScreenState();
}

class _GroupChatScreenState extends ConsumerState<GroupChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<dynamic> _messages = [];
  List<dynamic> _members = [];
  bool _loading = true;
  String _groupName = 'Gruppo';
  WebSocketChannel? _channel;
  bool _isConnected = false;

  @override
  void initState() {
    super.initState();
    _connectWebSocket();
    _loadGroupInfo();
    _loadMessages();
  }

  void _connectWebSocket() {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;

    try {
      final wsUrl = '${Config.wsBaseUrl}/ws?user_id=$userId';
      print('🔌 Connecting to WebSocket: $wsUrl');
      
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      
      _channel!.stream.listen(
        (message) {
          _handleWebSocketMessage(message);
        },
        onError: (error) {
          print('❌ WebSocket error: $error');
          setState(() => _isConnected = false);
        },
        onDone: () {
          print('🔌 WebSocket disconnected');
          setState(() => _isConnected = false);
        },
      );
      
      setState(() => _isConnected = true);
      print('✅ WebSocket connected');
    } catch (e) {
      print('❌ WebSocket connection failed: $e');
    }
  }

  void _handleWebSocketMessage(dynamic message) {
    try {
      final data = jsonDecode(message);
      print('📨 WebSocket message: ${data['type']}');

      if (data['type'] == 'ack' && data['isGroup'] == true) {
        // Message acknowledged
        print('✅ Group message acknowledged');
      } else if (data['type'] == 'group_message') {
        // AI response received
        final aiMessage = {
          'id': data['messageId'],
          'content': data['content'],
          'sender_id': data['sender_id'],
          'sender_name': data['sender_name'],
          'avatar': data['avatar'], // ← Avatar aggiunto
          'type': 'text',
          'created_at': DateTime.now().toIso8601String(),
          'is_ai': true,
        };
        
        setState(() {
          _messages.add(aiMessage);
        });
        _scrollToBottom();
        print('🤖 AI response from ${data['sender_name']}: ${data['content']}');
      } else if (data['end'] == true) {
        // Conversation ended
        print('✅ Group conversation completed: ${data['totalResponses']} responses');
      } else if (data['status'] == 'group_thinking') {
        print('🤔 ${data['memberCount']} AI members are thinking...');
      }
    } catch (e) {
      print('❌ Error handling WebSocket message: $e');
    }
  }

  Future<void> _loadGroupInfo() async {
    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) return;
      // Fetch group name and members
      final resp = await http.get(
        Uri.parse('${Config.apiBaseUrl}/api/groups/${widget.groupId}/members'),
        headers: {'x-user-id': userId},
      );
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        if (mounted) {
          setState(() {
            _groupName = data['group']?['name'] ?? 'Gruppo';
            _members = data['members'] ?? [];
          });
        }
      }
    } catch (e) {
      print('Error loading group info: $e');
    }
  }

  Future<void> _loadMessages() async {
    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) return;

      // Load messages
      final resp = await http.get(
        Uri.parse('${Config.apiBaseUrl}/api/groups/${widget.groupId}/messages'),
        headers: {'x-user-id': userId},
      );
      
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        if (mounted) {
          setState(() {
            _messages = data['messages'] ?? [];
            _loading = false;
          });
          _scrollToBottom();
        }
      }

      // Load group info (name) - Optimization: could be passed as argument or separate call
      // For now, we assume we might need to fetch it if not passed. 
      // Since the API doesn't return group details in messages endpoint, we might need another call or pass it.
      // Let's just use 'Gruppo' for now or fetch it if needed.
    } catch (e) {
      print('Error loading messages: $e');
      if (mounted) setState(() => _loading = false);
    }
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

  Future<void> _sendMessage() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    if (_channel == null || !_isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('WebSocket non connesso')),
      );
      return;
    }

    _textController.clear();
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;

    // Optimistic update - add user message to UI
    final tempMsg = {
      'id': 'temp-${DateTime.now().millisecondsSinceEpoch}',
      'type': 'text',
      'content': text,
      'sender_id': userId,
      'created_at': DateTime.now().toIso8601String(),
      'is_user': true,
    };

    setState(() {
      _messages.add(tempMsg);
    });
    _scrollToBottom();

    try {
      // Send via WebSocket with group_id
      final traceId = const Uuid().v4();
      final message = jsonEncode({
        'text': text,
        'traceId': traceId,
        'group_id': widget.groupId,  // ← This triggers group chat!
      });

      print('📤 Sending group message via WebSocket: $text');
      _channel!.sink.add(message);
    } catch (e) {
      print('Error sending message: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore invio messaggio: $e')),
      );
    }
  }

  @override
  void dispose() {
    _channel?.sink.close();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        title: Text(_groupName),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => GroupInviteScreen(
                    groupId: widget.groupId,
                    groupName: _groupName,
                  ),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            onPressed: () {
              showModalBottomSheet(
                context: context,
                backgroundColor: const Color(0xFF1A1A1A),
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                builder: (context) => SafeArea(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(height: 8),
                      Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[800],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ListTile(
                        leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
                        title: const Text(
                          'Elimina Gruppo',
                          style: TextStyle(
                            color: Colors.redAccent,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        onTap: () {
                          Navigator.pop(context);
                          _confirmDeleteGroup();
                        },
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      final userId = SupabaseService.currentUser?.id;
                      final isMe = msg['sender_id'] == userId || msg['is_user'] == true;
                      
                      final isAi = msg['is_ai'] == true;

                      String content = msg['content'] ?? '';
                      String? imageUrl;
                      
                      // Check for explicit image type or parse URL
                      if (msg['type'] == 'image' || msg['is_image'] == true) {
                         // If explicit type, content is likely the image URL
                         if (content.startsWith('http')) {
                           imageUrl = content;
                           content = ''; // Clear content since it's just the URL
                         } else {
                           // Try to extract URL from content
                           final urlRegExp = RegExp(r'(https?://[^\s]+)', caseSensitive: false);
                           final match = urlRegExp.firstMatch(content);
                           if (match != null) {
                             imageUrl = match.group(0);
                             content = content.replaceFirst(imageUrl!, '').trim();
                           }
                         }
                      } else {
                         // Auto-detect image in text (for backward compatibility)
                         final urlRegExp = RegExp(r'(https?://[^\s]+\.(?:png|jpg|jpeg|gif|webp))', caseSensitive: false);
                         final match = urlRegExp.firstMatch(content);
                         if (match != null) {
                           imageUrl = match.group(0);
                           content = content.replaceFirst(imageUrl!, '').trim();
                         }
                      }

                      return ChatMessageBubble(
                        content: content,
                        imageUrl: imageUrl,
                        senderName: !isMe ? (msg['sender_name'] ?? 'AI') : null,
                        avatarUrl: !isMe ? msg['avatar'] : null,
                        isMe: isMe,
                        timestamp: msg['created_at'] != null
                            ? DateTime.tryParse(msg['created_at'])
                            : null,
                        onAvatarTap: !isMe
                            ? () => _navigateToProfile(
                                  msg['sender_id'],
                                  msg['sender_name'] ?? 'Utente',
                                  msg['avatar'],
                                  isAi,
                                )
                            : null,
                      );
                    },
                  ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFF1A1A1A),
                border: Border(top: BorderSide(color: Colors.grey, width: 0.2)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
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
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  CircleAvatar(
                    backgroundColor: Colors.pinkAccent,
                    child: IconButton(
                      icon: const Icon(Icons.send, color: Colors.white, size: 20),
                      onPressed: _sendMessage,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _navigateToProfile(String id, String name, String? avatarUrl, bool isAi) {
    if (isAi) {
      // Navigate to AI Profile
      // Assuming route /chat/profile/:id exists and handles AI profiles
      // If not, we might need to check routes. But usually it's /chat/profile
      // Or we can push the screen directly if we have the widget imported.
      // Let's try context.push assuming the route exists, otherwise we might need to import GirlfriendProfileScreen.
      // Checking previous context, likely '/chat/profile' is for 'my' girlfriends. 
      // Public AI might need a different route or just reuse it if it fetches by ID.
      // Let's use a safe approach: show a bottom sheet with details and action.
      
      print('🔍 Opening profile for $name. Avatar URL: $avatarUrl'); // DEBUG

      showModalBottomSheet(
        context: context,
        backgroundColor: const Color(0xFF1A1A1A),
        isScrollControlled: true, // Permette al bottom sheet di adattarsi meglio
        builder: (context) => SafeArea( // FIX: SafeArea per evitare sovrapposizione
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircleAvatar(
                radius: 40,
                backgroundColor: Colors.grey[800],
                backgroundImage: (avatarUrl != null && avatarUrl.length > 20)
                    ? NetworkImage(avatarUrl)
                    : NetworkImage('https://ui-avatars.com/api/?name=${Uri.encodeComponent(name)}&background=random'),
                onBackgroundImageError: (_, __) {},
              ),
                const SizedBox(height: 16),
                Text(
                  name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'AI Companion',
                  style: TextStyle(color: Colors.pinkAccent),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    // Navigate to full profile if available
                    // context.push('/chat/profile/$id'); 
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.pinkAccent,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 48),
                  ),
                  child: const Text('Visualizza Profilo Completo'),
                ),
                const SizedBox(height: 16), // Extra padding bottom
              ],
            ),
          ),
        ),
      );
    } else {
      // User Profile Dialog
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: const Color(0xFF2A2A2A),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(
                radius: 50,
                backgroundColor: Colors.grey[800],
                backgroundImage: (avatarUrl != null && avatarUrl.length > 20)
                    ? NetworkImage(avatarUrl)
                    : NetworkImage('https://ui-avatars.com/api/?name=${Uri.encodeComponent(name)}&background=random'),
                onBackgroundImageError: (_, __) {},
              ),
              const SizedBox(height: 16),
              Text(
                name,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Membro del gruppo',
                style: TextStyle(color: Colors.grey[400]),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Chiudi'),
            ),
          ],
        ),
      );
    }
  }

  void _confirmDeleteGroup() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Elimina Gruppo', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Sei sicuro di voler eliminare questo gruppo? Tutti i messaggi verranno persi.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annulla', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _deleteGroup();
            },
            child: const Text('Elimina', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteGroup() async {
    setState(() => _loading = true);
    try {
      final token = SupabaseService.client.auth.currentSession?.accessToken;
      if (token == null) throw Exception('Utente non autenticato');

      final response = await http.delete(
        Uri.parse('${Config.apiBaseUrl}/api/groups/${widget.groupId}'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
          'x-user-id': SupabaseService.currentUser!.id,
        },
      );

      if (response.statusCode != 200) {
        throw Exception('Errore durante l\'eliminazione: ${response.body}');
      }

      if (mounted) {
        Navigator.pop(context); // Torna alla lista chat
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore: $e')),
        );
        setState(() => _loading = false);
      }
    }
  }
}
