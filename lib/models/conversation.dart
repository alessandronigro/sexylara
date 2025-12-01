import 'npc.dart';

class Conversation {
  final String id;
  final String userId;
  final String npcId;
  final Npc? npc;
  final DateTime lastMessageAt;
  final String? lastMessagePreview;
  final int unreadCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  Conversation({
    required this.id,
    required this.userId,
    required this.npcId,
    this.npc,
    required this.lastMessageAt,
    this.lastMessagePreview,
    this.unreadCount = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'],
      userId: json['user_id'],
      npcId: json['npc_id'] ?? json['npc_id'] ?? '',
      npc: json['npcs'] != null
          ? Npc.fromJson(json['npcs'])
          : json['girlfriends'] != null
              ? Npc.fromJson(json['girlfriends'])
              : null,
      lastMessageAt: DateTime.parse(json['last_message_at']),
      lastMessagePreview: json['last_message_preview'],
      unreadCount: json['unread_count'] ?? 0,
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: DateTime.parse(json['updated_at']),
    );
  }

  Conversation copyWith({
    String? id,
    String? userId,
    String? npcId,
    Npc? npc,
    DateTime? lastMessageAt,
    String? lastMessagePreview,
    int? unreadCount,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Conversation(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      npcId: npcId ?? this.npcId,
      npc: npc ?? this.npc,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      unreadCount: unreadCount ?? this.unreadCount,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
