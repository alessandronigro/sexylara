import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../config.dart';
import '../models/npc.dart';
import '../services/npc_service.dart';
import '../services/supabase_service.dart';
import '../widgets/npc_avatar.dart';

class CreateGroupScreen extends ConsumerStatefulWidget {
  const CreateGroupScreen({super.key});

  @override
  ConsumerState<CreateGroupScreen> createState() => _CreateGroupScreenState();
}

class _CreateGroupScreenState extends ConsumerState<CreateGroupScreen> {
  final _npcService = NpcService();
  final _nameController = TextEditingController();
  List<Npc> _npcs = [];
  final Set<String> _selectedIds = {};
  bool _loading = true;
  bool _creating = false;

  @override
  void initState() {
    super.initState();
    _loadNpcs();
  }

  Future<void> _loadNpcs() async {
    try {
      final list = await _npcService.getNpcs();
      if (mounted) {
        setState(() {
          _npcs = list;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore caricamento contatti: $e')),
        );
      }
    }
  }

  Future<void> _createGroup() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Inserisci un nome per il gruppo')),
      );
      return;
    }
    if (_selectedIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Seleziona almeno un contatto')),
      );
      return;
    }

    setState(() => _creating = true);

    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final response = await http.post(
        Uri.parse('${Config.apiBaseUrl}/api/groups'),
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: jsonEncode({
          'name': name,
          'memberIds': _selectedIds.toList(),
        }),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to create group: ${response.body}');
      }

      if (mounted) {
        context.pop(); // Go back to group list
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore creazione gruppo: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _creating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Nuovo Gruppo'),
        actions: [
          TextButton(
            onPressed: _creating ? null : _createGroup,
            child: _creating
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.pinkAccent),
                  )
                : const Text('Crea',
                    style: TextStyle(
                        color: Colors.pinkAccent, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _nameController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Nome Gruppo',
                labelStyle: const TextStyle(color: Colors.grey),
                filled: true,
                fillColor: Colors.grey[900],
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                prefixIcon: const Icon(Icons.group, color: Colors.grey),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Partecipanti',
                style: TextStyle(
                    color: Colors.grey,
                    fontSize: 14,
                    fontWeight: FontWeight.bold),
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.pinkAccent))
                : ListView.builder(
                    itemCount: _npcs.length,
                    itemBuilder: (context, index) {
                      final gf = _npcs[index];
                      final isSelected = _selectedIds.contains(gf.id);
                      return ListTile(
                        leading: NpcAvatar(npc: gf, radius: 24),
                        title: Text(gf.name,
                            style: const TextStyle(color: Colors.white)),
                        subtitle: Text(gf.displayDescription,
                            style: TextStyle(color: Colors.grey[600])),
                        trailing: Checkbox(
                          value: isSelected,
                          activeColor: Colors.pinkAccent,
                          checkColor: Colors.white,
                          side: BorderSide(color: Colors.grey[600]!),
                          onChanged: (value) {
                            setState(() {
                              if (value == true) {
                                _selectedIds.add(gf.id);
                              } else {
                                _selectedIds.remove(gf.id);
                              }
                            });
                          },
                        ),
                        onTap: () {
                          setState(() {
                            if (isSelected) {
                              _selectedIds.remove(gf.id);
                            } else {
                              _selectedIds.add(gf.id);
                            }
                          });
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
