import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../config.dart';
import '../services/supabase_service.dart';
import '../services/group_service.dart';
import '../widgets/main_top_bar.dart';

class GroupListScreen extends ConsumerStatefulWidget {
  const GroupListScreen({super.key});

  @override
  ConsumerState<GroupListScreen> createState() => _GroupListScreenState();
}

class _GroupListScreenState extends ConsumerState<GroupListScreen> {
  List<dynamic> _ownedGroups = [];
  List<dynamic> _joinedGroups = [];
  List<dynamic> _pendingInvites = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) return;

      // Load groups (owned + joined)
      final respGroups = await http.get(
        Uri.parse('${Config.apiBaseUrl}/api/groups'),
        headers: {'x-user-id': userId},
      );

      // Load pending invites
      final respInvites = await http.get(
        Uri.parse('${Config.apiBaseUrl}/api/group/invites/pending'),
        headers: {'x-user-id': userId},
      );

      if (mounted) {
        setState(() {
          if (respGroups.statusCode == 200) {
            final data = jsonDecode(respGroups.body);
            _ownedGroups = data['ownedGroups'] ?? [];
            _joinedGroups = data['joinedGroups'] ?? [];
          }
          if (respInvites.statusCode == 200) {
            final data = jsonDecode(respInvites.body);
            _pendingInvites = data['invites'] ?? [];
          }
          _loading = false;
        });
      }
    } catch (e) {
      print('Error loading data: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _respondToInvite(String inviteId, bool accept) async {
    try {
      final groupService = ref.read(groupServiceProvider);
      await groupService.respondToInvite(inviteId, accept);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(accept ? 'Invito accettato!' : 'Invito rifiutato')),
        );
        _loadData(); // Reload to update the list
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasAnyContent = _ownedGroups.isNotEmpty || _joinedGroups.isNotEmpty || _pendingInvites.isNotEmpty;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: const MainTopBar(active: MainTopBarSection.groups),
      floatingActionButton: FloatingActionButton(
        backgroundColor: Colors.pinkAccent,
        foregroundColor: Colors.white,
        onPressed: () async {
          await context.push('/groups/create');
          _loadData();
        },
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // --- PENDING INVITES SECTION ---
                  if (_pendingInvites.isNotEmpty) ...[ 
                    const Text(
                      'Inviti in sospeso',
                      style: TextStyle(
                        color: Colors.pinkAccent,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ..._pendingInvites.map((invite) {
                      final groupName = invite['groups']?['name'] ?? 'Gruppo';
                      return Card(
                        color: const Color(0xFF1E1E1E),
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    backgroundColor: Colors.pinkAccent.withOpacity(0.2),
                                    child: const Icon(Icons.group, color: Colors.pinkAccent),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Invito a: $groupName',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        if (invite['message'] != null && invite['message'].toString().isNotEmpty)
                                          Text(
                                            invite['message'],
                                            style: const TextStyle(color: Colors.grey, fontSize: 12),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton(
                                    onPressed: () => _respondToInvite(invite['id'], false),
                                    child: const Text('Rifiuta', style: TextStyle(color: Colors.grey)),
                                  ),
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    onPressed: () => _respondToInvite(invite['id'], true),
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
                    }),
                    const SizedBox(height: 24),
                  ],

                  // --- OWNED GROUPS SECTION ---
                  if (_ownedGroups.isNotEmpty) ...[ 
                    const Text(
                      'I miei gruppi',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ..._ownedGroups.map((g) => _buildGroupCard(g, isOwner: true)),
                    const SizedBox(height: 24),
                  ],

                  // --- JOINED GROUPS SECTION ---
                  if (_joinedGroups.isNotEmpty) ...[ 
                    const Text(
                      'Gruppi a cui partecipo',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ..._joinedGroups.map((g) => _buildGroupCard(g, isOwner: false)),
                  ],

                  // --- EMPTY STATE ---
                  if (!hasAnyContent)
                    Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 64),
                          Icon(Icons.group_off, size: 64, color: Colors.grey[800]),
                          const SizedBox(height: 16),
                          Text(
                            'Nessun gruppo',
                            style: TextStyle(color: Colors.grey[600], fontSize: 16),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: () async {
                              await context.push('/groups/create');
                              _loadData();
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.pinkAccent,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Crea il primo gruppo'),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _buildGroupCard(dynamic group, {required bool isOwner}) {
    return Card(
      color: const Color(0xFF1E1E1E),
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isOwner ? Colors.pinkAccent.withOpacity(0.2) : Colors.blueAccent.withOpacity(0.2),
          child: Icon(
            Icons.group,
            color: isOwner ? Colors.pinkAccent : Colors.blueAccent,
          ),
        ),
        title: Text(
          group['name'] ?? 'Senza nome',
          style: const TextStyle(color: Colors.white),
        ),
        subtitle: Text(
          isOwner 
            ? 'Creato da te • ${group['created_at']?.substring(0, 10) ?? ''}'
            : 'Gruppo condiviso • ${group['created_at']?.substring(0, 10) ?? ''}',
          style: TextStyle(color: Colors.grey[600]),
        ),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
        onTap: () async {
          await context.push('/groups/${group['id']}');
          _loadData();
        },
      ),
    );
  }
}
