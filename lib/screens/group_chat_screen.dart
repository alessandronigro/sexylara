import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:uuid/uuid.dart';
import 'dart:convert';

import '../config.dart';
import '../services/supabase_service.dart';
import '../services/invite_service.dart';
import 'package:thrilme/models/message.dart';
import 'package:thrilme/widgets/unified_message_bubble.dart';
import 'npc_feed_screen.dart';
import 'npc_profile_screen.dart';
import '../services/group_service.dart';
import '../services/npc_service.dart';
import '../services/npc_feed_service.dart'; // Added for feed publishing
import '../models/npc.dart';

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
  String _currentStatus = '';
  final Set<String> _memberIds = {};
  final Set<String> _invitedIds = {}; // Track invited but not yet accepted members
  List<Npc> _availableNpcs = [];
  List<ThrillerContact> _contacts = [];
  bool _addingMembers = false;
  
  // Reply State
  Map<String, dynamic>? _replyingMessage;
  final FocusNode _inputFocusNode = FocusNode();

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
        // Group message received (from AI or other users)
        final userId = SupabaseService.currentUser?.id;
        final senderId = data['sender_id'];
        final isFromCurrentUser = senderId == userId;
        
        // Don't add message if it's from current user (already added optimistically)
        if (isFromCurrentUser) {
          print('⏭️ Skipping own message (already in UI)');
          return;
        }
        
        final groupMessage = {
          'id': data['messageId'],
          'content': data['content'],
          'sender_id': senderId,
          'sender_name': data['sender_name'],
          'avatar': data['avatar'],
          'type': 'text',
          'created_at': data['timestamp'] ?? DateTime.now().toIso8601String(),
          'is_ai': data['role'] == 'assistant', // AI if role is assistant, otherwise user
        };
        
        setState(() {
          _messages.add(groupMessage);
        });
        // Message Filtering: Ensure message belongs to this group
        if (data['group_id'] != widget.groupId && data['groupId'] != widget.groupId) {
          print('🔇 Ignoring message for another group: ${data['group_id']}');
          return;
        }

        final groupMessage = {
          'id': data['messageId'],
          'content': data['content'],
          'sender_id': senderId,
          'sender_name': data['sender_name'],
          'avatar': data['avatar'],
          'type': 'text',
          'created_at': data['timestamp'] ?? DateTime.now().toIso8601String(),
          'is_ai': data['role'] == 'assistant', // AI if role is assistant, otherwise user
          'reply_preview': data['reply_preview'],
        };
        
        setState(() {
          _messages.add(groupMessage);
        });
        _scrollToBottom();
        print('📨 Group message from ${data['sender_name']}: ${data['content']}');
      } else if (data['end'] == true) {
        // Conversation ended
        print('✅ Group conversation completed: ${data['totalResponses']} responses');
      } else if (data['status'] == 'group_thinking') {
        print('🤔 ${data['memberCount']} AI members are thinking...');
        setState(() {
          _currentStatus = '${data['memberCount']} membri stanno pensando...';
        });
      } else if (data['event'] == 'media_generation_started') {
        // Optional: show specific status for media generation if not covered by npc_status
      } else if (data['event'] == 'media_generation_completed') {
        final npcId = data['npcId'];
        final member = _members.firstWhere(
           (m) => (m['npc_id'] == npcId || m['member_id'] == npcId),
           orElse: () => null
         );
        
        final aiMessage = {
          'id': data['messageId'],
          'content': data['finalUrl'],
          'sender_id': npcId,
          'sender_name': member != null ? (member['npcs']?['name'] ?? 'AI Thriller') : 'AI Thriller',
          'avatar': member != null ? (member['npcs']?['avatar_url']) : null,
          'type': data['mediaType'] ?? 'image',
          'created_at': DateTime.now().toIso8601String(),
          'is_ai': true,
        };

        setState(() {
          _messages.add(aiMessage);
          _currentStatus = ''; // Clear status
        });
        _scrollToBottom();
      } else if (data['event'] == 'media_generation_failed') {
        setState(() {
          _currentStatus = ''; // Clear status on failure
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore generazione media: ${data['error']}')),
        );
      } else if (data['event'] == 'npc_status') {
         final status = data['status'] as String?;
         final npcId = data['npcId'];
         // Find NPC name from members if possible
         final member = _members.firstWhere(
           (m) => (m['npc_id'] == npcId || m['member_id'] == npcId),
           orElse: () => null
         );
         final name = member != null 
             ? (member['npcs']?['name'] ?? 'Thriller') 
             : 'Thriller';

         setState(() {
           if (status == 'typing') {
             _currentStatus = '$name sta scrivendo...';
           } else if (status == 'sending_image') {
             _currentStatus = '$name sta inviando una foto...';
           } else if (status == 'sending_video') {
             _currentStatus = '$name sta inviando un video...';
           } else if (status == 'recording_audio') {
             _currentStatus = '$name sta registrando un audio...';
           } else {
             _currentStatus = '';
           }
         });
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
            _memberIds
              ..clear()
              ..addAll(_members.map((m) => (m['id'] ?? m['npc_id'] ?? m['member_id'])?.toString() ?? '').where((e) => e.isNotEmpty));
          });
        }
      }
    } catch (e) {
      print('Error loading group info: $e');
    }
  }

  Future<void> _removeMember(String npcId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;
    try {
      final resp = await http.post(
        Uri.parse('${Config.apiBaseUrl}/api/groups/${widget.groupId}/members'),
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: jsonEncode({
          'add': [],
          'remove': [npcId],
        }),
      );
      if (resp.statusCode == 200) {
        setState(() {
          _members = _members.where((m) => (m['id'] ?? m['npc_id']) != npcId).toList();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Membro rimosso dal gruppo')),
        );
      } else {
        throw Exception('Errore rimozione membro (${resp.statusCode})');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Impossibile rimuovere il membro: $e')),
      );
    }
  }

  void _showMembersSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A1A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                height: 4,
                width: 48,
                decoration: BoxDecoration(
                  color: Colors.grey[700],
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text('Membri del gruppo', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  TextButton.icon(
                    onPressed: _showAddMembersSheet,
                    icon: const Icon(Icons.person_add_alt, color: Colors.pinkAccent),
                    label: const Text('Aggiungi', style: TextStyle(color: Colors.pinkAccent)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_members.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text('Nessun membro trovato', style: TextStyle(color: Colors.white70)),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: _members.length,
                    separatorBuilder: (_, __) => const Divider(color: Colors.white12, height: 1),
                    itemBuilder: (_, idx) {
                      final m = _members[idx];
                      final id = m['id'] ?? m['npc_id'] ?? m['member_id'];
                      final name = m['name'] ??
                          m['username'] ??
                          m['npcs']?['name'] ??
                          'Thriller';
                      final avatar = m['avatar'] ??
                          m['avatar_url'] ??
                          m['npcs']?['avatar_url'];
                      final isNpc = (m['member_type'] ?? m['type'] ?? 'npc') == 'npc';
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: Colors.grey[800],
                          backgroundImage: avatar != null ? NetworkImage(avatar) : null,
                          child: avatar == null
                              ? Icon(isNpc ? Icons.smart_toy : Icons.person, color: Colors.white)
                              : null,
                        ),
                        title: Text(name, style: const TextStyle(color: Colors.white)),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete, color: Colors.redAccent),
                          onPressed: () {
                            Navigator.pop(context);
                            _removeMember(id);
                          },
                        ),
                      );
                    },
                  ),
                ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  Future<void> _loadAvailableNpcs() async {
    if (_availableNpcs.isNotEmpty) return;
    try {
      final list = await NpcService().getNpcs();
      setState(() => _availableNpcs = list);
    } catch (e) {
      // Silently ignore in UI
      debugPrint('Errore caricamento NPC: $e');
    }
  }

  Future<void> _loadContacts() async {
    if (_contacts.isNotEmpty) return;
    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) return;
      final inviteService = ref.read(inviteServiceProvider);
      final list = await inviteService.fetchContacts();
      setState(() => _contacts = list);
    } catch (e) {
      debugPrint('Errore caricamento contatti: $e');
    }
  }

  Future<void> _addContactToGroup(ThrillerContact c) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;
    if (_memberIds.contains(c.id) || _invitedIds.contains(c.id)) return;
    setState(() {
      _addingMembers = true;
      _invitedIds.add(c.id); // Mark as invited immediately for UI feedback
    });
    try {
      final groupService = GroupService(userId: userId);
      if (c.type == 'user') {
        await groupService.inviteUser(groupId: widget.groupId, receiverId: c.id);
      } else {
        await groupService.inviteNpc(groupId: widget.groupId, npcId: c.id);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${c.name} invitato al gruppo')),
      );
      await _loadGroupInfo();
    } catch (e) {
      // Remove from invited if error occurred
      setState(() => _invitedIds.remove(c.id));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore invito: $e')),
      );
    } finally {
      if (mounted) setState(() => _addingMembers = false);
    }
  }

  Future<void> _addNpcToGroup(String npcId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null || npcId.isEmpty) return;
    if (_memberIds.contains(npcId) || _invitedIds.contains(npcId)) return;
    setState(() {
      _addingMembers = true;
      _invitedIds.add(npcId); // Mark as invited immediately for UI feedback
    });
    try {
      final groupService = GroupService(userId: userId);
      await groupService.inviteNpc(groupId: widget.groupId, npcId: npcId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thriller aggiunto al gruppo')),
      );
      await _loadGroupInfo();
    } catch (e) {
      // Remove from invited if error occurred
      setState(() => _invitedIds.remove(npcId));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore invito Thriller: $e')),
      );
    } finally {
      if (mounted) setState(() => _addingMembers = false);
    }
  }

  void _showAddMembersSheet() async {
    await _loadContacts();
    await _loadAvailableNpcs();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A1A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Aggiungi partecipanti', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('I miei contatti', style: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 200,
                  child: _contacts.isEmpty
                      ? const Center(child: Text('Nessun contatto', style: TextStyle(color: Colors.white70)))
                      : ListView.builder(
                          itemCount: _contacts.length,
                          itemBuilder: (_, idx) {
                            final c = _contacts[idx];
                            final already = _memberIds.contains(c.id);
                            final invited = _invitedIds.contains(c.id);
                            final isNpc = c.type == 'npc';
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: Colors.grey[800],
                                backgroundImage: c.avatar != null ? NetworkImage(c.avatar!) : null,
                                child: c.avatar == null ? Icon(isNpc ? Icons.smart_toy : Icons.person, color: Colors.white) : null,
                              ),
                              title: Text(c.name, style: const TextStyle(color: Colors.white)),
                              subtitle: Text(
                                invited ? 'Invitato' : (isNpc ? 'Thriller' : 'Utente'),
                                style: TextStyle(color: invited ? Colors.orangeAccent : Colors.grey[600]),
                              ),
                              trailing: IconButton(
                                icon: Icon(
                                  already ? Icons.check : (invited ? Icons.schedule : Icons.person_add_alt),
                                  color: already ? Colors.greenAccent : (invited ? Colors.orangeAccent : Colors.pinkAccent),
                                ),
                                onPressed: already || invited || _addingMembers ? null : () => _addContactToGroup(c),
                              ),
                            );
                          },
                        ),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('I miei Thriller', style: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 220,
                  child: _availableNpcs.isEmpty
                      ? const Center(child: Text('Nessun Thriller disponibile', style: TextStyle(color: Colors.white70)))
                      : ListView.builder(
                          itemCount: _availableNpcs.length,
                          itemBuilder: (_, idx) {
                            final npc = _availableNpcs[idx];
                            final already = _memberIds.contains(npc.id);
                            final invited = _invitedIds.contains(npc.id);
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: Colors.grey[800],
                                backgroundImage: npc.avatarUrl != null ? NetworkImage(npc.avatarUrl!) : null,
                                child: npc.avatarUrl == null ? const Icon(Icons.smart_toy, color: Colors.white) : null,
                              ),
                              title: Text(npc.name, style: const TextStyle(color: Colors.white)),
                              subtitle: Text(
                                invited ? 'Invitato' : npc.displayDescription,
                                style: TextStyle(color: invited ? Colors.orangeAccent : Colors.grey[600]),
                              ),
                              trailing: IconButton(
                                icon: Icon(
                                  already ? Icons.check : (invited ? Icons.schedule : Icons.person_add_alt),
                                  color: already ? Colors.greenAccent : (invited ? Colors.orangeAccent : Colors.pinkAccent),
                                ),
                                onPressed: already || invited || _addingMembers ? null : () => _addNpcToGroup(npc.id),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
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
      if (_replyingMessage != null) 'reply_preview': {
        'id': _replyingMessage!['id'],
        'content': _replyingMessage!['content'],
        'role': _replyingMessage!['is_ai'] == true ? 'assistant' : 'user',
      },
    };

    setState(() {
      _messages.add(tempMsg);
    });
    _scrollToBottom();

    try {
      // Send via WebSocket with group_id
      final traceId = const Uuid().v4();
      final messagePayload = {
        'text': text,
        'traceId': traceId,
        'group_id': widget.groupId,
        if (_replyingMessage != null) 'reply_preview': {
          'id': _replyingMessage!['id'],
          'content': _replyingMessage!['content'],
          'role': _replyingMessage!['is_ai'] == true ? 'assistant' : 'user',
        }
      };
      
      final message = jsonEncode(messagePayload);

      print('📤 Sending group message via WebSocket: $text');
      _channel!.sink.add(message);
      
      // Clear reply state
      _cancelReply();
    } catch (e) {
      print('📤 Sending group message via WebSocket: $text');
      _channel!.sink.add(message);
    } catch (e) {
      print('Error sending message: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore invio messaggio: $e')),
      );
    }
  }

  Future<void> _publishToFeed(Map<String, dynamic> message) async {
    final senderId = message['sender_id'];
    // Validazione: deve essere un NPC (o almeno proviamo a pubblicare come se lo fosse)
    // Se fallisce, il servizio/backend restituirà errore.
    // In un gruppo, sender_id dovrebbe essere l'ID dell'NPC se è_ai=true.
    
    String? mediaUrl;
    String content = message['content'] ?? '';
    
    // Extract image URL
    if (content.startsWith('http')) {
       mediaUrl = content;
    } else {
       final urlRegExp = RegExp(r'(https?://[^\s]+)', caseSensitive: false);
       final match = urlRegExp.firstMatch(content);
       if (match != null) {
         mediaUrl = match.group(0);
       }
    }
    
    if (mediaUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nessuna immagine trovata')),
      );
      return;
    }

    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pubblicazione in corso...')),
      );
      
      await NpcFeedService.publishNpc(
        npcId: senderId,
        message: 'Foto dal gruppo ${_groupName}',
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
          SnackBar(content: Text('Errore (forse l\'autore non è un NPC?): $e')),
        );
      }
    }
  }

  void _showPublishConfirmation(Map<String, dynamic> message) {
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

  void _showMessageOptions(Map<String, dynamic> message) {
    showModalBottomSheet(
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
                  leading: const Icon(Icons.reply, color: Colors.pinkAccent),
                  title: const Text('Rispondi', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _replyingMessage = message;
                    });
                    FocusScope.of(context).requestFocus(_inputFocusNode);
                  },
                ),
                if (message['is_ai'] != true && (message['sender_id'] == SupabaseService.currentUser?.id || message['is_user'] == true))
                  ListTile(
                    leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
                    title: const Text('Elimina messaggio', style: TextStyle(color: Colors.white)),
                    onTap: () {
                      Navigator.pop(context);
                      // TODO: Implement delete API call when available
                      // For now just remove locally if it's a temp message
                      if (message['id'].toString().startsWith('temp-')) {
                         setState(() {
                           _messages.removeWhere((m) => m['id'] == message['id']);
                         });
                      } else {
                         ScaffoldMessenger.of(context).showSnackBar(
                           const SnackBar(content: Text('Eliminazione non ancora disponibile per messaggi inviati')),
                         );
                      }
                    },
                  ),
                if (message['is_ai'] == true && (message['icon'] != null || (message['type'] == 'image' || message['is_image'] == true || message['content'].toString().startsWith('http'))))
                  ListTile(
                    leading: const Icon(Icons.public, color: Colors.blueAccent),
                    title: const Text('Pubblica nel Feed', style: TextStyle(color: Colors.white)),
                    onTap: () {
                      Navigator.pop(context);
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

  void _cancelReply() {
    setState(() {
      _replyingMessage = null;
    });
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_groupName),
            if (_currentStatus.isNotEmpty)
              Text(
                _currentStatus,
                style: const TextStyle(fontSize: 12, color: Colors.pinkAccent),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.groups),
            onPressed: _showMembersSheet,
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
                    itemCount: _messages.length + (_currentStatus.isNotEmpty ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _messages.length) {
                        if (_currentStatus.isNotEmpty) {
                          return const TypingIndicator();
                        }
                        return const SizedBox.shrink();
                      }
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
                          if (match != null) {
                            imageUrl = match.group(0);
                            content = content.replaceFirst(imageUrl!, '').trim();
                          }
                       }
                       
                       // Parse reply preview if existing
                       ReplyPreview? replyPreview;
                       if (msg['reply_preview'] != null) {
                         try {
                           replyPreview = ReplyPreview.fromJson(msg['reply_preview']);
                         } catch (_) {}
                       }

                       return GestureDetector(
                         onLongPress: () => _showMessageOptions(msg),
                         child: UnifiedMessageBubble(
                           content: content,
                           type: imageUrl != null ? MessageType.image : MessageType.text,
                           mediaUrl: imageUrl,
                           senderName: !isMe ? (msg['sender_name'] ?? 'AI') : null,
                           avatarUrl: !isMe ? msg['avatar'] : null,
                           isMe: isMe,
                           timestamp: msg['created_at'] != null
                               ? DateTime.tryParse(msg['created_at'])
                               : null,
                           replyTo: replyPreview,
                           onAvatarTap: !isMe
                               ? () => _navigateToProfile(
                                     msg['sender_id'],
                                     msg['sender_name'] ?? 'Utente',
                                     msg['avatar'],
                                     isAi,
                                   )
                               : null,
                         ),
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
              child: Column(
                children: [
                   if (_replyingMessage != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white10,
                        borderRadius: BorderRadius.circular(8),
                        border: Border(left: BorderSide(color: Colors.pinkAccent, width: 3)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _replyingMessage!['sender_name'] ?? 'Utente',
                                  style: const TextStyle(color: Colors.pinkAccent, fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _replyingMessage!['content'] ?? '',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 16, color: Colors.white54),
                            onPressed: _cancelReply,
                          ),
                        ],
                      ),
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _textController,
                          focusNode: _inputFocusNode,
                          style: const TextStyle(color: Colors.white),
                          textCapitalization: TextCapitalization.sentences,
                          autocorrect: true,
                          enableSuggestions: true,
                          minLines: 1,
                          maxLines: 5,
                          keyboardType: TextInputType.multiline,
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
                          // onSubmitted removed for multiline support
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
                ],
              ),
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
      // Let's try context.push assuming the route exists, otherwise we might need to import NpcProfileScreen.
      // Checking previous context, likely '/chat/profile' is for 'my' npcs. 
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
                  'AI Thriller',
                  style: TextStyle(color: Colors.pinkAccent),
                ),
                const SizedBox(height: 24),
Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    Column(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.feed, color: Colors.deepPurple, size: 32),
                          onPressed: () {
                            Navigator.pop(context);
                            Navigator.push(context, MaterialPageRoute(builder: (_) => NpcFeedScreen(npcId: id)));
                          },
                        ),
                        const Text('Bacheca', style: TextStyle(color: Colors.white70)),
                      ],
                    ),
                    Column(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.share, color: Colors.teal, size: 32),
                          onPressed: () {
                            Navigator.pop(context);
                            Navigator.push(context, MaterialPageRoute(builder: (_) => NpcProfileScreen(npcId: id)));
                          },
                        ),
                        const Text('Condividi', style: TextStyle(color: Colors.white70)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => NpcProfileScreen(npcId: id)));
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
