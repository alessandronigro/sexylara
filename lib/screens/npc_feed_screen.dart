import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../models/npc_post.dart';
import '../config.dart';
import '../widgets/npc_feed_card.dart';

class NpcFeedScreen extends StatefulWidget {
  final String npcId;
  const NpcFeedScreen({Key? key, required this.npcId}) : super(key: key);

  @override
  State<NpcFeedScreen> createState() => _NpcFeedScreenState();
}

class _NpcFeedScreenState extends State<NpcFeedScreen> {
  late Future<List<NpcPost>> _futurePosts;

  @override
  void initState() {
    super.initState();
    _futurePosts = _fetchNpcFeed();
  }

  Future<List<NpcPost>> _fetchNpcFeed() async {
    try {
      final resp = await http.get(
        Uri.parse('${Config.apiBaseUrl}/feed/npc/${widget.npcId}'),
        headers: {'Content-Type': 'application/json'},
      );
      if (resp.statusCode != 200) {
         // Se l'endpoint non esiste o errore, ritorna lista vuota per ora
         print('Feed error: ${resp.body}');
         return [];
      }
      final List data = jsonDecode(resp.body);
      return data.map((e) => NpcPost.fromJson(e)).toList();
    } catch (e) {
      print('Error fetching feed: $e');
      return [];
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bacheca NPC')),
      body: FutureBuilder<List<NpcPost>>(
        future: _futurePosts,
        builder: (c, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return Center(child: Text('Errore: ${snap.error}'));
          
          final posts = snap.data ?? [];
          if (posts.isEmpty) {
            return const Center(child: Text('Nessun post ancora.'));
          }

          return ListView.builder(
            itemCount: posts.length,
            itemBuilder: (_, i) => NpcFeedCard(post: posts[i]),
          );
        },
      ),
    );
  }
}
