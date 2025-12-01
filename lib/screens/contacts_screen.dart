import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../models/npc.dart';
import '../models/message.dart';
import '../services/npc_service.dart';
import '../services/supabase_service.dart';
import '../services/invite_service.dart';
import '../widgets/npc_avatar.dart';
import '../widgets/main_top_bar.dart';

class ContactsScreen extends ConsumerStatefulWidget {
  const ContactsScreen({super.key});

  @override
  ConsumerState<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends ConsumerState<ContactsScreen> {
  final _npcService = NpcService();
  List<Npc> _npcs = [];
  List<ContactInvite> _pendingInvites = [];
  List<ThrillerContact> _contacts = [];
  bool _loading = true;
  final Map<String, Message> _lastMessages = {};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final list = await _npcService.getNpcs();
      final inviteService = ref.read(inviteServiceProvider);
      List<ContactInvite> invites = [];
      List<ThrillerContact> contacts = [];

      try {
        invites = await inviteService.fetchPendingInvites();
        contacts = await inviteService.fetchContacts();
      } catch (e) {
        debugPrint('Unable to load invites: $e');
      }

      final targetIds = {
        ...list.map((gf) => gf.id),
        ...contacts.map((c) => c.id),
      }.where((id) => id.isNotEmpty).toList();
      final last = await _fetchLastMessages(targetIds);
      if (!mounted) return;
      setState(() {
        _npcs = list;
        _pendingInvites = invites;
        _contacts = contacts;
        _lastMessages
          ..clear()
          ..addAll(last);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore caricamento: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: const MainTopBar(active: MainTopBarSection.thrillers),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Colors.pinkAccent))
          : (_npcs.isEmpty && _pendingInvites.isEmpty && _contacts.isEmpty)
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: _loadData,
                  color: Colors.pinkAccent,
                  child: ListView(
                    children: [
                      if (_pendingInvites.isNotEmpty) ...[
                        const Padding(
                          padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                          child: Text(
                            'Inviti in sospeso',
                            style: TextStyle(
                              color: Colors.pinkAccent,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        ..._pendingInvites.map(_buildInviteCard),
                        Divider(height: 1, color: Colors.grey[900]),
                      ],
                      if (_contacts.isNotEmpty) ...[
                        const Padding(
                          padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                          child: Text(
                            'Contatti (Thrillers)',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        ..._contacts.asMap().entries.map((entry) {
                          final c = entry.value;
                          final lastMessage = _lastMessages[c.id];
                          final subtitleText = _buildPreviewText(lastMessage);
                          final timeText = lastMessage != null
                              ? DateFormat('HH:mm').format(lastMessage.timestamp)
                              : null;
                          final typeLabel = c.type == 'npc'
                              ? 'Thriller (NPC)'
                              : 'Thriller (Utente)';
                          return Column(
                            children: [
                              ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: Colors.grey[800],
                                  backgroundImage: c.avatar != null ? NetworkImage(c.avatar!) : null,
                                  child: c.avatar == null
                                      ? Icon(
                                          c.type == 'npc' ? Icons.smart_toy : Icons.person,
                                          color: Colors.white,
                                        )
                                      : null,
                                ),
                                title: Text(
                                  c.name,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      typeLabel,
                                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      subtitleText,
                                      style: const TextStyle(color: Colors.grey),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (timeText != null)
                                      Text(
                                        timeText,
                                        style: const TextStyle(
                                          color: Colors.white60,
                                          fontSize: 12,
                                        ),
                                      ),
                                    const SizedBox(width: 8),
                                    IconButton(
                                      icon: const Icon(Icons.person_remove, color: Colors.grey, size: 20),
                                      onPressed: () => _confirmRemoveContact(c),
                                    ),
                                  ],
                                ),
                                onTap: () => context.go('/chat/${c.id}'),
                              ),
                              if (entry.key != _contacts.length - 1)
                                Divider(height: 1, color: Colors.grey[900], indent: 72),
                            ],
                          );
                        }),
                        Divider(height: 1, color: Colors.grey[900]),
                      ],
                      if (_npcs.isNotEmpty) ...[
                        const Padding(
                          padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                          child: Text(
                            'I tuoi Thrillers',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        ..._npcs.asMap().entries.map((entry) {
                          final gf = entry.value;
                          final lastMessage = _lastMessages[gf.id];
                          final subtitleText = _buildPreviewText(lastMessage);
                          final timeText = lastMessage != null
                              ? DateFormat('HH:mm').format(lastMessage.timestamp)
                              : null;
                          return Column(
                            children: [
                              ListTile(
                                leading: NpcAvatar(npc: gf, radius: 25),
                                title: Text(
                                  gf.name,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                subtitle: Text(
                                  subtitleText,
                                  style: const TextStyle(color: Colors.grey),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (timeText != null)
                                      Text(
                                        timeText,
                                        style: const TextStyle(
                                          color: Colors.white60,
                                          fontSize: 12,
                                        ),
                                      ),
                                    const SizedBox(width: 8),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                      onPressed: () => _confirmDeleteNpc(gf),
                                    ),
                                  ],
                                ),
                                onTap: () => context.go('/chat/${gf.id}'),
                              ),
                              if (entry.key != _npcs.length - 1)
                                Divider(height: 1, color: Colors.grey[900], indent: 72),
                            ],
                          );
                        }),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _buildInviteCard(ContactInvite invite) {
    return Card(
      color: const Color(0xFF1E1E1E),
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: Colors.grey[800],
                  backgroundImage: invite.senderAvatar != null
                      ? NetworkImage(invite.senderAvatar!)
                      : null,
                  child: invite.senderAvatar == null
                      ? const Icon(Icons.person, color: Colors.white)
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '${invite.senderName} vuole aggiungere ${invite.targetType == 'npc' ? 'il tuo Thriller' : 'te'} ai contatti',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            if (invite.targetName != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  invite.targetName!,
                  style: const TextStyle(color: Colors.grey),
                ),
              ),
            if (invite.message != null && invite.message!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  invite.message!,
                  style: const TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
                ),
              ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => _respondInvite(invite.id, false),
                  child: const Text('Rifiuta', style: TextStyle(color: Colors.grey)),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () => _respondInvite(invite.id, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.pinkAccent,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Accetta'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _respondInvite(String inviteId, bool accept) async {
    try {
      final inviteService = ref.read(inviteServiceProvider);
      await inviteService.respondToInvite(inviteId: inviteId, accept: accept);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(accept ? 'Invito accettato!' : 'Invito rifiutato.')),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore: $e')),
        );
      }
    }
  }

  Future<Map<String, Message>> _fetchLastMessages(
      List<String> targetIds) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null || targetIds.isEmpty) return {};

    final ids = targetIds.where((id) => id.isNotEmpty).toSet().toList();
    if (ids.isEmpty) return {};

    final fetchLimit = (ids.length * 3).clamp(50, 300).toInt();
    final supabase = SupabaseService.client;

    final futures = await Future.wait([
      supabase
          .from('messages')
          .select('*')
          .eq('user_id', userId)
          .in_('npc_id', ids)
          .order('created_at', ascending: false)
          .limit(fetchLimit),
      // User-to-user: messages sent by me
      supabase
          .from('messages')
          .select('*')
          .eq('user_id', userId)
          .in_('recipient_user_id', ids)
          .order('created_at', ascending: false)
          .limit(fetchLimit),
      // User-to-user: messages received by me
      supabase
          .from('messages')
          .select('*')
          .in_('user_id', ids)
          .eq('recipient_user_id', userId)
          .order('created_at', ascending: false)
          .limit(fetchLimit),
    ]);

    final allRows = <Map<String, dynamic>>[];
    for (final data in futures) {
      if (data is List) {
        allRows.addAll(
            data.map((e) => Map<String, dynamic>.from(e as Map<String, dynamic>)));
      }
    }

    // Sort by newest first across all sources
    allRows.sort((a, b) {
      final aTime = DateTime.tryParse(a['created_at']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0);
      final bTime = DateTime.tryParse(b['created_at']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0);
      return bTime.compareTo(aTime);
    });

    final result = <String, Message>{};
    for (final raw in allRows) {
      String? targetKey;
      if (raw['npc_id'] != null && raw['npc_id'].toString().isNotEmpty) {
        targetKey = raw['npc_id'].toString();
      } else if (raw['recipient_user_id']?.toString() == userId &&
          raw['user_id'] != null) {
        targetKey = raw['user_id'].toString();
      } else if (raw['user_id']?.toString() == userId &&
          raw['recipient_user_id'] != null) {
        targetKey = raw['recipient_user_id'].toString();
      }

      if (targetKey == null || targetKey.isEmpty || result.containsKey(targetKey)) {
        continue;
      }

      result[targetKey] = Message.fromJson(raw);
    }

    return result;
  }

  String _buildPreviewText(Message? message) {
    if (message == null) return 'Clicca per chattare';
    final currentUserId = SupabaseService.currentUser?.id;
    final isMine = message.senderId != null && currentUserId != null
        ? message.senderId == currentUserId
        : message.role == 'user';
    final prefix = isMine ? 'Tu: ' : '';
    final body = () {
      switch (message.type) {
        case MessageType.image:
          return 'Foto';
        case MessageType.video:
          return 'Video';
        case MessageType.audio:
          return 'Audio';
        default:
          return message.content;
      }
    }();
    return '$prefix$body';
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.smart_toy_outlined, size: 80, color: Colors.grey),
          const SizedBox(height: 24),
          const Text('Nessun Thriller ancora',
              style: TextStyle(
                  fontSize: 20,
                  color: Colors.grey,
                  fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          const Text('Invita o crea il tuo primo Thriller',
              style: TextStyle(fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 32),
          ElevatedButton.icon(
            onPressed: _showAddMenu,
            icon: const Icon(Icons.add),
            label: const Text('Crea Thriller'),
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.pinkAccent,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 16)),
          ),
        ],
      ),
    );
  }

  void _showAddMenu() {
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
              ListTile(
                leading: const Icon(Icons.add, color: Colors.pinkAccent),
                title: const Text('Crea nuovo Thriller', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/create-npc');
                },
              ),
              ListTile(
                leading: const Icon(Icons.smart_toy, color: Colors.blueAccent),
                title: const Text('Invita Thrillers', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  context.push('/discover-contacts');
                },
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }
  Future<void> _confirmRemoveContact(ThrillerContact contact) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Rimuovi contatto', style: TextStyle(color: Colors.white)),
        content: Text('Vuoi rimuovere ${contact.name} dai contatti?', style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annulla')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Rimuovi'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _removeContactApi(contact.id);
        
        setState(() {
          _contacts.remove(contact);
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Contatto rimosso')));
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Errore: $e')));
      }
    }
  }

  Future<void> _confirmDeleteNpc(Npc npc) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Elimina Thriller', style: TextStyle(color: Colors.white)),
        content: Text('Vuoi eliminare definitivamente ${npc.name}?\nQuesta azione è irreversibile.', style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annulla')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Elimina'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _npcService.deleteNpc(npc.id);
        setState(() {
          _npcs.remove(npc);
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Thriller eliminato')));
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Errore: $e')));
      }
    }
  }

  Future<void> _removeContactApi(String targetId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;
    
    await SupabaseService.client
        .from('contacts')
        .delete()
        .eq('owner_user_id', userId)
        .eq('target_id', targetId);
  }
}
