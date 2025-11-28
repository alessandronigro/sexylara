import 'package:flutter/material.dart';
import '../models/npc_post.dart';
import '../services/npc_feed_service.dart';
import '../services/supabase_service.dart';
import '../widgets/comments_sheet.dart';
import '../widgets/npc_feed_card.dart';

class PublicFeedScreen extends StatefulWidget {
  const PublicFeedScreen({Key? key}) : super(key: key);

  @override
  State<PublicFeedScreen> createState() => _PublicFeedScreenState();
}

class _PublicFeedScreenState extends State<PublicFeedScreen> {
  final List<NpcPost> _posts = [];
  bool _isLoading = true;
  String? _error;
  final Map<String, bool> _likedPosts = {}; // postId -> isLiked

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
      final userId = SupabaseService.getCurrentUserId();
      final posts = await NpcFeedService.getPublicFeed();
      final likes = <String, bool>{};

      if (userId != null) {
        for (final post in posts) {
          final stats = await NpcFeedService.getPostStats(
            postId: post.id,
            userId: userId,
          );
          likes[post.id] = stats['userLiked'] ?? false;
        }
      }

      setState(() {
        _posts
          ..clear()
          ..addAll(posts);
        _likedPosts
          ..clear()
          ..addAll(likes);
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
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Devi effettuare il login')),
      );
      return;
    }

    final currentlyLiked = _likedPosts[post.id] ?? false;
    setState(() {
      _likedPosts[post.id] = !currentlyLiked;
      final index = _posts.indexWhere((p) => p.id == post.id);
      if (index != -1) {
        final oldPost = _posts[index];
        final newLikeCount = currentlyLiked
            ? oldPost.likeCount - 1
            : oldPost.likeCount + 1;
        _posts[index] = NpcPost(
          id: oldPost.id,
          npcId: oldPost.npcId,
          caption: oldPost.caption,
          mediaUrl: oldPost.mediaUrl,
          mediaType: oldPost.mediaType,
          likeCount: newLikeCount,
          commentCount: oldPost.commentCount,
          createdAt: oldPost.createdAt,
          npcName: oldPost.npcName,
          npcAvatarUrl: oldPost.npcAvatarUrl,
          npcGender: oldPost.npcGender,
        );
      }
    });

    try {
      final result = await NpcFeedService.toggleLike(
        postId: post.id,
        userId: userId,
      );
      final index = _posts.indexWhere((p) => p.id == post.id);
      if (index != -1) {
        final oldPost = _posts[index];
        setState(() {
          _likedPosts[post.id] = result['liked'] ?? false;
          _posts[index] = NpcPost(
            id: oldPost.id,
            npcId: oldPost.npcId,
            caption: oldPost.caption,
            mediaUrl: oldPost.mediaUrl,
            mediaType: oldPost.mediaType,
            likeCount: result['totalLikes'] ?? oldPost.likeCount,
            commentCount: oldPost.commentCount,
            createdAt: oldPost.createdAt,
            npcName: oldPost.npcName,
            npcAvatarUrl: oldPost.npcAvatarUrl,
            npcGender: oldPost.npcGender,
          );
        });
      }
    } catch (e) {
      setState(() {
        _likedPosts[post.id] = currentlyLiked;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore: $e')),
      );
    }
  }

  void _handleComment(NpcPost post) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CommentsSheet(postId: post.id),
    ).then((_) {
      _loadFeed();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Feed Pubblico'),
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
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadFeed,
                        child: const Text('Riprova'),
                      ),
                    ],
                  ),
                )
              : _posts.isEmpty
                  ? const Center(
                      child: Text('Nessun post nel feed'),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadFeed,
                      child: ListView.builder(
                        itemCount: _posts.length,
                        itemBuilder: (context, index) {
                          final post = _posts[index];
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
