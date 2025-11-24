class NpcPost {
  final String id;
  final String npcId;
  final String? caption;
  final String? mediaUrl;
  final String mediaType; // 'image', 'video', 'audio', 'text'
  final int likeCount;
  final int commentCount;
  final DateTime createdAt;

  NpcPost({
    required this.id,
    required this.npcId,
    this.caption,
    this.mediaUrl,
    required this.mediaType,
    required this.likeCount,
    required this.commentCount,
    required this.createdAt,
  });

  factory NpcPost.fromJson(Map<String, dynamic> json) {
    return NpcPost(
      id: json['id'],
      npcId: json['npc_id'],
      caption: json['caption'],
      mediaUrl: json['media_url'],
      mediaType: json['media_type'] ?? 'text',
      likeCount: json['like_count'] ?? 0,
      commentCount: json['comment_count'] ?? 0,
      createdAt: DateTime.parse(json['created_at']),
    );
  }
}
