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

class Message {
  final String id;
  final String role;
  final MessageType type;
  final String content;
  final DateTime timestamp;
  final MessageStatus status;
  final String? serverId;
  final ReplyPreview? replyTo;

  Message({
    required this.id,
    required this.role,
    required this.type,
    required this.content,
    required this.timestamp,
    this.status = MessageStatus.sent,
    this.serverId,
    this.replyTo,
  });

  bool get hasReplyPreview => replyTo != null && replyTo!.content.isNotEmpty;

  factory Message.fromJson(Map<String, dynamic> json) {
    MessageType type;
    switch (json['type']) {
      case 'image':
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
    final createdAtValue = json['created_at'] ?? json['createdAt'];
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
      content: json['content'] ?? '',
      timestamp: timestamp,
      serverId: serverId,
      replyTo: replyPreview,
    );
  }

  Message copyWith({
    String? id,
    String? role,
    MessageType? type,
    String? content,
    DateTime? timestamp,
    MessageStatus? status,
    String? serverId,
    ReplyPreview? replyTo,
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
    );
  }

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';
}
