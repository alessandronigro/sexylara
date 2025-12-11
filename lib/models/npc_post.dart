class NpcPost {
  final String id;
  final String npcId;
  final String? caption;
  final String? mediaUrl;
  final String mediaType; // 'image', 'video', 'audio', 'text'
  final int likeCount;
  final int commentCount;
  final DateTime createdAt;
  
  // Informazioni sull'NPC (dal join)
  final String? npcName;
  final String? npcAvatarUrl;
  final String? npcGender;
  final String? groupId;

  NpcPost({
    required this.id,
    required this.npcId,
    this.caption,
    this.mediaUrl,
    required this.mediaType,
    required this.likeCount,
    required this.commentCount,
    required this.createdAt,
    this.npcName,
    this.npcAvatarUrl,
    this.npcGender,
    this.groupId,
  });

  factory NpcPost.fromJson(Map<String, dynamic> json) {
    // Gestisce il join con la tabella npcs
    final npc = json['npc'] as Map<String, dynamic>?;
    
    return NpcPost(
      id: json['id'],
      npcId: json['npc_id'],
      caption: json['caption'],
      mediaUrl: json['media_url'],
      mediaType: json['media_type'] ?? 'text',
      likeCount: json['like_count'] ?? 0,
      commentCount: json['comment_count'] ?? 0,
      createdAt: DateTime.parse(json['created_at']),
      npcName: npc?['name'],
      npcAvatarUrl: npc?['avatar_url'],
      npcGender: npc?['gender'],
      groupId: json['group_id'],
    );
  }
}
