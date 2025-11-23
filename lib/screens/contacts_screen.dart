import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../models/girlfriend.dart';
import '../models/message.dart';
import '../services/girlfriend_service.dart';
import '../services/supabase_service.dart';
import '../widgets/girlfriend_avatar.dart';

class ContactsScreen extends ConsumerStatefulWidget {
  const ContactsScreen({super.key});

  @override
  ConsumerState<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends ConsumerState<ContactsScreen> {
  final _girlfriendService = GirlfriendService();
  List<Girlfriend> _girlfriends = [];
  bool _loading = true;
  final Map<String, Message> _lastMessages = {};

  @override
  void initState() {
    super.initState();
    _loadGirlfriends();
  }

  Future<void> _loadGirlfriends() async {
    setState(() => _loading = true);
    try {
      final list = await _girlfriendService.getGirlfriends();
      final last = await _fetchLastMessages(list);
      if (!mounted) return;
      setState(() {
        _girlfriends = list;
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
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('ThrilMe',
            style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.group),
            onPressed: () => context.push('/groups'),
            tooltip: 'Gruppi',
          ),
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () => context.push('/user-profile'),
            tooltip: 'Profilo',
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.go('/create-girlfriend'),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Colors.pinkAccent))
          : _girlfriends.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: _loadGirlfriends,
                  color: Colors.pinkAccent,
                  child: ListView.separated(
                    itemCount: _girlfriends.length,
                    separatorBuilder: (context, index) =>
                        Divider(height: 1, color: Colors.grey[900], indent: 72),
                    itemBuilder: (context, index) {
                      final gf = _girlfriends[index];
                      final lastMessage = _lastMessages[gf.id];
                      final subtitleText = _buildPreviewText(lastMessage);
                      final timeText = lastMessage != null
                          ? DateFormat('HH:mm').format(lastMessage.timestamp)
                          : null;

                      return ListTile(
                        leading: GirlfriendAvatar(girlfriend: gf, radius: 25),
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
                        trailing: timeText != null
                            ? Text(
                                timeText,
                                style: const TextStyle(
                                  color: Colors.white60,
                                  fontSize: 12,
                                ),
                              )
                            : null,
                        onTap: () => context.go('/chat/${gf.id}'),
                      );
                    },
                  ),
                ),
    );
  }

  Future<Map<String, Message>> _fetchLastMessages(
      List<Girlfriend> girlfriends) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null || girlfriends.isEmpty) return {};

    final girlfriendIds = girlfriends.map((gf) => gf.id).toList();
    final data = await SupabaseService.client
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .in_('girlfriend_id', girlfriendIds)
        .order('created_at', ascending: false)
        .limit(200);

    final result = <String, Message>{};
    if (data is! List) return result;

    for (final raw in data) {
      final gfId = raw['girlfriend_id']?.toString();
      if (gfId == null || gfId.isEmpty) continue;
      if (result.containsKey(gfId)) continue;
      result[gfId] = Message.fromJson(
          Map<String, dynamic>.from(raw as Map<String, dynamic>));
    }

    return result;
  }

  String _buildPreviewText(Message? message) {
    if (message == null) return 'Clicca per chattare';
    final prefix = message.role == 'user' ? 'Tu: ' : '';
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
          const Icon(Icons.favorite_border, size: 80, color: Colors.grey),
          const SizedBox(height: 24),
          const Text('Nessun contatto ancora',
              style: TextStyle(
                  fontSize: 20,
                  color: Colors.grey,
                  fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          const Text('Crea il tuo primo AI companion',
              style: TextStyle(fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 32),
          ElevatedButton.icon(
            onPressed: () => context.go('/create-girlfriend'),
            icon: const Icon(Icons.add),
            label: const Text('Crea Companion'),
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
}
