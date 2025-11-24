import 'package:flutter/material.dart';
import '../models/npc_post.dart';
import 'package:cached_network_image/cached_network_image.dart';

class NpcFeedCard extends StatelessWidget {
  final NpcPost post;
  const NpcFeedCard({Key? key, required this.post}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (post.mediaUrl != null && post.mediaType == 'image')
            CachedNetworkImage(
              imageUrl: post.mediaUrl!,
              fit: BoxFit.cover,
              width: double.infinity,
              height: 300,
              placeholder: (context, url) => const Center(child: CircularProgressIndicator()),
              errorWidget: (context, url, error) => const Icon(Icons.error),
            ),
          if (post.mediaUrl != null && post.mediaType == 'audio')
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.grey[200],
              child: const Row(
                children: [
                  Icon(Icons.audiotrack),
                  SizedBox(width: 8),
                  Text('Messaggio Audio'),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (post.caption != null)
                  Text(post.caption!, style: const TextStyle(fontSize: 16)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.favorite_border, size: 20),
                    const SizedBox(width: 4),
                    Text('${post.likeCount}'),
                    const SizedBox(width: 16),
                    const Icon(Icons.comment_outlined, size: 20),
                    const SizedBox(width: 4),
                    Text('${post.commentCount}'),
                    const Spacer(),
                    Text(
                      '${post.createdAt.day}/${post.createdAt.month}/${post.createdAt.year}',
                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
