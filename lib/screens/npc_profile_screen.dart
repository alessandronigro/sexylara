import 'package:flutter/material.dart';
import '../config.dart';
import 'npc_feed_screen.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class NpcProfileScreen extends StatelessWidget {
  final String npcId;
  const NpcProfileScreen({Key? key, required this.npcId}) : super(key: key);

  // Funzione per pubblicare l'NPC nella bacheca
  Future<void> _publishToFeed(BuildContext ctx) async {
    try {
      final resp = await http.post(
        Uri.parse('${Config.apiBaseUrl}/feed/publish-npc'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'npcId': npcId}),
      );

      if (resp.statusCode == 200) {
        ScaffoldMessenger.of(ctx).showSnackBar(
            const SnackBar(content: Text('NPC pubblicato nella bacheca!')));
      } else {
        ScaffoldMessenger.of(ctx).showSnackBar(
            SnackBar(content: Text('Errore: ${resp.body}')));
      }
    } catch (e) {
      ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text('Errore di rete: $e')));
    }
  }

  // Funzione di condivisione (chiama l'API backend)
  Future<void> _shareNpc(BuildContext ctx) async {
    final result = await showDialog<Map<String, String>>(
      context: ctx,
      builder: (_) => _ShareDialog(),
    );

    if (result == null) return; // utente ha annullato

    final body = {
      'npcId': npcId,
      if (result['userId'] != null) 'targetUserId': result['userId']!,
      if (result['groupId'] != null) 'targetGroupId': result['groupId']!,
    };

    try {
      final resp = await http.post(
        Uri.parse('${Config.apiBaseUrl}/npc/share'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      if (resp.statusCode == 200) {
        ScaffoldMessenger.of(ctx)
            .showSnackBar(const SnackBar(content: Text('NPC condiviso!')));
      } else {
        ScaffoldMessenger.of(ctx).showSnackBar(
            SnackBar(content: Text('Errore: ${resp.body}')));
      }
    } catch (e) {
       ScaffoldMessenger.of(ctx).showSnackBar(
            SnackBar(content: Text('Errore di rete: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profilo NPC')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircleAvatar(radius: 60, child: Icon(Icons.person, size: 60)),
            const SizedBox(height: 20),
            Text('NPC ID: $npcId', style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 40),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // 1. Icona Feed
                Column(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.feed, size: 40, color: Colors.deepPurple),
                      tooltip: 'Vedi la bacheca dell\'NPC',
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => NpcFeedScreen(npcId: npcId),
                        ),
                      ),
                    ),
                    const Text("Feed"),
                  ],
                ),
                const SizedBox(width: 40),
                // 2. Icona Pubblica
                Column(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.public, size: 40, color: Colors.green),
                      tooltip: 'Pubblica nella Bacheca',
                      onPressed: () => _publishToFeed(context),
                    ),
                    const Text("Pubblica"),
                  ],
                ),
                const SizedBox(width: 40),
                // 3. Icona Condividi
                Column(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.share, size: 40, color: Colors.teal),
                      tooltip: 'Condividi NPC',
                      onPressed: () => _shareNpc(context),
                    ),
                    const Text("Condividi"),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// Dialog per scegliere a chi condividere
class _ShareDialog extends StatefulWidget {
  @override
  State<_ShareDialog> createState() => _ShareDialogState();
}

class _ShareDialogState extends State<_ShareDialog> {
  String? _targetUserId;
  String? _targetGroupId;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Condividi NPC'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            decoration: const InputDecoration(labelText: 'User ID (opzionale)'),
            onChanged: (v) => setState(() => _targetUserId = v.isEmpty ? null : v),
          ),
          TextField(
            decoration: const InputDecoration(labelText: 'Group ID (opzionale)'),
            onChanged: (v) => setState(() => _targetGroupId = v.isEmpty ? null : v),
          ),
          const SizedBox(height: 8),
          const Text(
            'Compila almeno uno dei due campi.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annulla')),
        ElevatedButton(
          onPressed: (_targetUserId != null || _targetGroupId != null)
              ? () => Navigator.pop(context, {
                    'userId': _targetUserId,
                    'groupId': _targetGroupId,
                  })
              : null,
          child: const Text('Condividi'),
        ),
      ],
    );
  }
}
