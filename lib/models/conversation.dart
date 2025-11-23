import 'girlfriend.dart';

class Conversation {
  final String id;
  final String userId;
  final String girlfriendId;
  final Girlfriend? girlfriend;
  final DateTime lastMessageAt;
  final String? lastMessagePreview;
  final int unreadCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  Conversation({
    required this.id,
    required this.userId,
    required this.girlfriendId,
    this.girlfriend,
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
      girlfriendId: json['girlfriend_id'],
      girlfriend: json['girlfriends'] != null
          ? Girlfriend.fromJson(json['girlfriends'])
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
    String? girlfriendId,
    Girlfriend? girlfriend,
    DateTime? lastMessageAt,
    String? lastMessagePreview,
    int? unreadCount,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Conversation(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      girlfriendId: girlfriendId ?? this.girlfriendId,
      girlfriend: girlfriend ?? this.girlfriend,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      unreadCount: unreadCount ?? this.unreadCount,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
