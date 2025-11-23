import 'dart:convert';

enum ChatRole { user, assistant, system }

class ChatMessage {
  final String id;
  final ChatRole role;
  final String content;
  final String type;

  ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.type = 'chat',
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final role = (json['role'] as String?)?.toLowerCase();
    return ChatMessage(
      id: json['id'] as String? ?? json['traceId'] as String? ?? '',
      role: {
        'user': ChatRole.user,
        'assistant': ChatRole.assistant,
        'system': ChatRole.system,
      }[role] ?? ChatRole.assistant,
      content: json['content'] as String? ?? '',
      type: json['type'] as String? ?? 'chat',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role.name,
        'content': content,
        'type': type,
      };

  static ChatMessage fromSocket(String raw) {
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return ChatMessage.fromJson(decoded);
  }
}
