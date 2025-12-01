import 'package:flutter/material.dart';
import '../models/npc_post.dart';
import 'package:cached_network_image/cached_network_image.dart';

class NpcFeedCard extends StatefulWidget {
  final NpcPost post;
  final VoidCallback? onLike;
  final VoidCallback? onComment;
  final bool isLiked;

  const NpcFeedCard({
    Key? key,
    required this.post,
    this.onLike,
    this.onComment,
    this.isLiked = false,
  }) : super(key: key);

  @override
  State<NpcFeedCard> createState() => _NpcFeedCardState();
}

class _NpcFeedCardState extends State<NpcFeedCard> {
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header con avatar e nome NPC
          if (widget.post.npcName != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
              child: Row(
                children: [
                  // Avatar NPC
                  CircleAvatar(
                    radius: 20,
                    backgroundImage: widget.post.npcAvatarUrl != null
                        ? CachedNetworkImageProvider(widget.post.npcAvatarUrl!)
                        : null,
                    child: widget.post.npcAvatarUrl == null
                        ? Icon(
                            widget.post.npcGender == 'female'
                                ? Icons.face_3
                                : Icons.face,
                            size: 24,
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  // Nome NPC
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.post.npcName!,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          '${widget.post.createdAt.day}/${widget.post.createdAt.month}/${widget.post.createdAt.year}',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // Media (immagine o audio)
          if (widget.post.mediaUrl != null && widget.post.mediaType == 'image')
            AspectRatio(
              aspectRatio: 3 / 4,
              child: ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(0),
                  topRight: Radius.circular(0),
                ),
                child: CachedNetworkImage(
                  imageUrl: widget.post.mediaUrl!,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  placeholder: (context, url) => Container(
                    color: Colors.black,
                    child: const Center(child: CircularProgressIndicator()),
                  ),
                  errorWidget: (context, url, error) => Container(
                    color: Colors.black,
                    child: const Icon(Icons.error, size: 48, color: Colors.white),
                  ),
                ),
              ),
            ),
          
          if (widget.post.mediaUrl != null && widget.post.mediaType == 'audio')
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.grey[200],
              child: const Row(
                children: [
                  Icon(Icons.audiotrack, color: Colors.deepPurple),
                  SizedBox(width: 12),
                  Text(
                    'Messaggio Audio',
                    style: TextStyle(fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),

          // Caption
          if (widget.post.caption != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
              child: Text(
                widget.post.caption!,
                style: const TextStyle(fontSize: 15),
              ),
            ),

          // Azioni (Like, Commenti)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: [
                // Like button
                InkWell(
                  onTap: widget.onLike,
                  borderRadius: BorderRadius.circular(20),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          widget.isLiked ? Icons.favorite : Icons.favorite_border,
                          size: 22,
                          color: widget.isLiked ? Colors.red : Colors.grey[700],
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${widget.post.likeCount}',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[700],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                // Comment button
                InkWell(
                  onTap: widget.onComment,
                  borderRadius: BorderRadius.circular(20),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.comment_outlined,
                          size: 22,
                          color: Colors.grey[700],
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${widget.post.commentCount}',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[700],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
