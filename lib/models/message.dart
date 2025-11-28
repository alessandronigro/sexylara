// For backward compatibility with chat_message.dart
import 'dart:convert';

enum MessageType {
  text,
  image,
  video,
  audio,
  typing,
}

enum MessageStatus {
  sending,
  sent,
  delivered,
  error,
}

class ReplyPreview {
  final String id;
  final String content;
  final String role;

  const ReplyPreview({
    required this.id,
    required this.content,
    required this.role,
  });

  factory ReplyPreview.fromJson(Map<String, dynamic> json) {
    return ReplyPreview(
      id: json['id']?.toString() ?? '',
      content: json['content'] ?? '',
      role: json['role'] ?? 'assistant',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'content': content,
        'role': role,
      };
}

/// Unified Message model for both 1-to-1 and group chats
/// Consolidates message.dart and chat_message.dart functionality
class Message {
  final String id;
  final String role;
  final MessageType type;
  final String content;
  final DateTime timestamp;
  final MessageStatus status;
  final String? serverId;
  final ReplyPreview? replyTo;
  
  // Group chat fields (from chat_message.dart)
  final String? senderId;
  final String? senderName;
  final String? avatarUrl;
  final bool? isAi;

  Message({
    required this.id,
    required this.role,
    required this.type,
    required this.content,
    required this.timestamp,
    this.status = MessageStatus.sent,
    this.serverId,
    this.replyTo,
    this.senderId,
    this.senderName,
    this.avatarUrl,
    this.isAi,
  });

  // Helper getters
  bool get hasReplyPreview => replyTo != null && replyTo!.content.isNotEmpty;
  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';
  bool get isMe => role == 'user';  // Alias for compatibility
  
  // Group chat helpers
  bool get hasAvatar => avatarUrl != null && avatarUrl!.isNotEmpty;
  bool get hasSenderName => senderName != null && senderName!.isNotEmpty;

  factory Message.fromJson(Map<String, dynamic> json) {
    final rawType = (json['type'] ?? json['mediaType'] ?? json['media_type'] ?? '').toString().toLowerCase();
    MessageType type;
    switch (rawType) {
      case 'image':
      case 'photo':
      case 'couple_photo':
      case 'media':
        type = MessageType.image;
        break;
      case 'video':
        type = MessageType.video;
        break;
      case 'audio':
        type = MessageType.audio;
        break;
      case 'typing':
        type = MessageType.typing;
        break;
      default:
        type = MessageType.text;
    }

    final serverId = json['id']?.toString();
    final traceId = json['traceId'] ??
        json['id']?.toString() ??
        DateTime.now().millisecondsSinceEpoch.toString();
    final createdAtValue = json['created_at'] ?? json['createdAt'] ?? json['timestamp'];
    final parsedTimestamp = createdAtValue != null
        ? DateTime.tryParse(createdAtValue.toString())
        : null;
    final timestamp = parsedTimestamp ?? DateTime.now();
    ReplyPreview? replyPreview;
    if (json['reply_preview'] is Map<String, dynamic>) {
      replyPreview =
          ReplyPreview.fromJson(json['reply_preview'] as Map<String, dynamic>);
    }

    return Message(
      id: traceId,
      role: json['role'] ?? 'assistant',
      type: type,
      content: (json['content'] ??
              json['mediaUrl'] ??
              json['media_url'] ??
              '') as String,
      timestamp: timestamp,
      serverId: serverId,
      replyTo: replyPreview,
      // Group chat fields
      senderId: json['sender_id']?.toString(),
      senderName: json['sender_name']?.toString(),
      avatarUrl: json['avatar']?.toString(),
      isAi: json['is_ai'] as bool?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role,
        'type': type.name,
        'content': content,
        'created_at': timestamp.toIso8601String(),
        if (serverId != null) 'serverId': serverId,
        if (replyTo != null) 'reply_preview': replyTo!.toJson(),
        if (senderId != null) 'sender_id': senderId,
        if (senderName != null) 'sender_name': senderName,
        if (avatarUrl != null) 'avatar': avatarUrl,
        if (isAi != null) 'is_ai': isAi,
      };

  Message copyWith({
    String? id,
    String? role,
    MessageType? type,
    String? content,
    DateTime? timestamp,
    MessageStatus? status,
    String? serverId,
    ReplyPreview? replyTo,
    String? senderId,
    String? senderName,
    String? avatarUrl,
    bool? isAi,
  }) {
    return Message(
      id: id ?? this.id,
      role: role ?? this.role,
      type: type ?? this.type,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      status: status ?? this.status,
      serverId: serverId ?? this.serverId,
      replyTo: replyTo ?? this.replyTo,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      isAi: isAi ?? this.isAi,
    );
  }

  // Factory for WebSocket messages (from chat_message.dart)
  factory Message.fromSocket(String raw) {
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return Message.fromJson(decoded);
  }
}


