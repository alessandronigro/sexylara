import 'package:flutter/material.dart';
import '../models/npc_post.dart';
import '../services/npc_feed_service.dart';
import '../services/supabase_service.dart';
import '../widgets/npc_feed_card.dart';

class NpcFeedScreen extends StatefulWidget {
  final String npcId;
  const NpcFeedScreen({Key? key, required this.npcId}) : super(key: key);

  @override
  State<NpcFeedScreen> createState() => _NpcFeedScreenState();
}

class _NpcFeedScreenState extends State<NpcFeedScreen> {
  List<NpcPost> _posts = [];
  bool _isLoading = true;
  String? _error;
  final Map<String, bool> _likedPosts = {};

  @override
  void initState() {
    super.initState();
    _loadFeed();
  }

  Future<void> _loadFeed() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final posts = await NpcFeedService.getNpcFeed(widget.npcId);
      
      // Carica lo stato dei like per ogni post
      final userId = SupabaseService.getCurrentUserId();
      if (userId != null) {
        for (final post in posts) {
          final stats = await NpcFeedService.getPostStats(
            postId: post.id,
            userId: userId,
          );
          _likedPosts[post.id] = stats['userLiked'] ?? false;
        }
      }

      setState(() {
        _posts = posts;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Errore caricamento feed: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLike(NpcPost post) async {
    final userId = SupabaseService.getCurrentUserId();
    if (userId == null) return;

    try {
      await NpcFeedService.toggleLike(postId: post.id, userId: userId);
      _loadFeed(); // Ricarica per aggiornare i contatori
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore: $e')),
      );
    }
  }

  Future<void> _handleComment(NpcPost post) async {
    final userId = SupabaseService.getCurrentUserId();
    if (userId == null) return;

    final TextEditingController controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Aggiungi un commento'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Scrivi il tuo commento...',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annulla'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Invia'),
          ),
        ],
      ),
    );

    if (result != null && result.trim().isNotEmpty) {
      try {
        await NpcFeedService.commentPost(
          postId: post.id,
          userId: userId,
          comment: result.trim(),
        );
        _loadFeed();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bacheca NPC'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadFeed,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _posts.isEmpty
                  ? const Center(child: Text('Nessun post ancora.'))
                  : RefreshIndicator(
                      onRefresh: _loadFeed,
                      child: ListView.builder(
                        itemCount: _posts.length,
                        itemBuilder: (_, i) {
                          final post = _posts[i];
                          return NpcFeedCard(
                            post: post,
                            isLiked: _likedPosts[post.id] ?? false,
                            onLike: () => _handleLike(post),
                            onComment: () => _handleComment(post),
                          );
                        },
                      ),
                    ),
    );
  }
}
