// lib/services/group_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/session_provider.dart';

final groupServiceProvider = Provider<GroupService>((ref) {
  final session = ref.watch(sessionProvider);
  final userId = session.userId ?? '';
  return GroupService(userId: userId);
});

class GroupService {
  final String userId;
  GroupService({required this.userId});

  String get _base => const String.fromEnvironment('API_BASE_URL');

  Future<List<dynamic>> fetchGroups() async {
    final resp = await http.get(Uri.parse('$_base/groups'), headers: {'x-user-id': userId});
    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['groups'] ?? [];
    }
    throw Exception('Failed to load groups');
  }

  Future<Map<String, dynamic>> createGroup(String name, List<String> memberIds) async {
    final resp = await http.post(
      Uri.parse('$_base/groups'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'name': name, 'memberIds': memberIds}),
    );
    if (resp.statusCode == 200) {
      return jsonDecode(resp.body);
    }
    throw Exception('Failed to create group');
  }

  Future<List<dynamic>> fetchMessages(String groupId, {int limit = 50, int offset = 0}) async {
    final resp = await http.get(
      Uri.parse('$_base/groups/$groupId/messages?limit=$limit&offset=$offset'),
      headers: {'x-user-id': userId},
    );
    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['messages'] ?? [];
    }
    throw Exception('Failed to load messages');
  }

  Future<void> sendMessage(String groupId, String senderId, String content, {String type = 'text'}) async {
    final resp = await http.post(
      Uri.parse('$_base/groups/$groupId/messages'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({
        'senderId': senderId,
        'type': type,
        'content': content,
      }),
    );
    if (resp.statusCode != 200) {
      throw Exception('Failed to send message');
    }
  }

  // --- INVITE METHODS ---

  Future<void> inviteMember({
    required String groupId,
    required String invitedId,
    required String invitedType, // 'user' or 'ai'
    String? message,
  }) async {
    final resp = await http.post(
      Uri.parse('$_base/group/invite'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({
        'groupId': groupId,
        'invitedId': invitedId,
        'invitedType': invitedType,
        'message': message,
      }),
    );

    if (resp.statusCode != 200) {
      final err = jsonDecode(resp.body);
      throw Exception(err['error'] ?? 'Failed to invite member');
    }
  }

  Future<void> acceptInvite(String inviteId) async {
    final resp = await http.post(
      Uri.parse('$_base/group/invite/accept'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'inviteId': inviteId}),
    );

    if (resp.statusCode != 200) {
      throw Exception('Failed to accept invite');
    }
  }

  Future<void> declineInvite(String inviteId) async {
    final resp = await http.post(
      Uri.parse('$_base/group/invite/decline'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'inviteId': inviteId}),
    );

    if (resp.statusCode != 200) {
      throw Exception('Failed to decline invite');
    }
  }

  Future<List<dynamic>> fetchPendingInvites() async {
    final resp = await http.get(
      Uri.parse('$_base/group/invites/pending'),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['invites'] ?? [];
    }
    throw Exception('Failed to load invites');
  }
}
