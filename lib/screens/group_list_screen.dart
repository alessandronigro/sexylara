import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../config.dart';
import '../services/supabase_service.dart';
import '../services/group_service.dart';

class GroupListScreen extends ConsumerStatefulWidget {
  const GroupListScreen({super.key});

  @override
  ConsumerState<GroupListScreen> createState() => _GroupListScreenState();
}

class _GroupListScreenState extends ConsumerState<GroupListScreen> {
  List<dynamic> _groups = [];
  List<dynamic> _invites = [];
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

      // Load groups
      final respGroups = await http.get(
        Uri.parse('${Config.apiBaseUrl}/api/groups'),
        headers: {'x-user-id': userId},
      );

      // Load pending invites
      final groupService = ref.read(groupServiceProvider);
      List<dynamic> invites = [];
      try {
        invites = await groupService.fetchPendingInvites();
      } catch (e) {
        print('Error fetching invites: $e');
      }

      if (mounted) {
        setState(() {
          if (respGroups.statusCode == 200) {
            final data = jsonDecode(respGroups.body);
            _groups = data['groups'] ?? [];
          }
          _invites = invites;
          _loading = false;
        });
      }
    } catch (e) {
      print('Error loading data: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleInvite(String inviteId, bool accept) async {
    try {
      final groupService = ref.read(groupServiceProvider);
      await groupService.respondToInvite(inviteId, accept);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(accept ? 'Invito accettato!' : 'Invito rifiutato.')),
        );
      }
      
      // Reload data
      _loadData();
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
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Gruppi'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: Colors.pinkAccent),
            tooltip: 'Crea Gruppo',
            onPressed: () async {
              await context.push('/groups/create');
              _loadData(); // Reload on return
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // --- INVITES SECTION ---
                  if (_invites.isNotEmpty) ...[
                    const Text(
                      'Inviti in sospeso',
                      style: TextStyle(
                        color: Colors.pinkAccent,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ..._invites.map((invite) {
                      final groupName = invite['groups']?['name'] ?? 'Gruppo sconosciuto';
                      return Card(
                        color: const Color(0xFF2A2A2A),
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Sei stato invitato a "$groupName"',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if (invite['message'] != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(
                                    invite['message'],
                                    style: TextStyle(color: Colors.grey[400], fontStyle: FontStyle.italic),
                                  ),
                                ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton(
                                    onPressed: () => _handleInvite(invite['id'].toString(), false),
                                    child: const Text('Rifiuta', style: TextStyle(color: Colors.grey)),
                                  ),
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    onPressed: () => _handleInvite(invite['id'].toString(), true),
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
                    const Divider(color: Colors.grey),
                    const SizedBox(height: 16),
                  ],

                  // --- GROUPS SECTION ---
                  if (_groups.isEmpty && _invites.isEmpty)
                    Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 64),
                          Icon(Icons.group_off, size: 64, color: Colors.grey[800]),
                          const SizedBox(height: 16),
                          Text(
                            'Nessun gruppo creato',
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
                    )
                  else ...[
                    const Text(
                      'I tuoi gruppi',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ..._groups.map((g) {
                      return Card(
                        color: const Color(0xFF1E1E1E),
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Colors.grey[800],
                            child: const Icon(Icons.group, color: Colors.white),
                          ),
                          title: Text(g['name'] ?? 'Senza nome',
                              style: const TextStyle(color: Colors.white)),
                          subtitle: Text(
                            'Creato il: ${g['created_at']?.substring(0, 10) ?? ''}',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                          trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                          onTap: () async {
                            await context.push('/groups/${g['id']}');
                            _loadData(); // Reload when returning
                          },
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
    );
  }
}
