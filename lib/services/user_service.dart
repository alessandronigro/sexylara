import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/session_provider.dart';
import '../config.dart';

final userServiceProvider = Provider<UserService>((ref) {
  final session = ref.watch(sessionProvider);
  final userId = session.userId ?? '';
  return UserService(userId: userId);
});

class UserService {
  final String userId;
  UserService({required this.userId});

  String get _base => Config.apiBaseUrl;

  Future<Map<String, dynamic>> fetchUserProfile() async {
    final resp = await http.get(
      Uri.parse('$_base/api/users/me'),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['user'] ?? {};
    }
    throw Exception('Failed to load user profile');
  }

  Future<Map<String, dynamic>?> getUserProfileById(String id) async {
    try {
      final resp = await http.get(
        Uri.parse('$_base/api/users/$id/profile'),
        headers: {'x-user-id': userId},
      );

      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        return data['user'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<List<dynamic>> fetchPublicUsers({String? query}) async {
    String url = '$_base/api/users/public';
    if (query != null && query.isNotEmpty) {
      url += '?search=${Uri.encodeComponent(query)}';
    }

    final resp = await http.get(
      Uri.parse(url),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['users'] ?? [];
    }
    throw Exception('Failed to load users');
  }

  Future<void> updateUserPrivacy(bool isPublic) async {
    final resp = await http.put(
      Uri.parse('$_base/api/users/settings/privacy'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'isPublic': isPublic}),
    );

    if (resp.statusCode != 200) {
      throw Exception('Failed to update privacy');
    }
  }

  Future<void> updateUserProfile({
    required String displayName,
    bool? isPublic,
  }) async {
    final resp = await http.put(
      Uri.parse('$_base/api/users/settings/profile'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'displayName': displayName, if (isPublic != null) 'isPublic': isPublic}),
    );

    if (resp.statusCode != 200) {
      final data = jsonDecode(resp.body);
      throw Exception(data['error'] ?? 'Failed to update profile');
    }
  }

  Future<String> updateUserAvatar(String base64Image) async {
    final resp = await http.put(
      Uri.parse('$_base/api/users/settings/avatar'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'imageBase64': base64Image}),
    );

    if (resp.statusCode != 200) {
      final data = jsonDecode(resp.body);
      throw Exception(data['error'] ?? 'Failed to update avatar');
    }

    final data = jsonDecode(resp.body);
    return data['avatarUrl'];
  }

  Future<void> updateNpcPrivacy(String npcId, bool isPublic) async {
    final resp = await http.patch(
      Uri.parse('$_base/api/npcs/$npcId/privacy'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'isPublic': isPublic}),
    );

    if (resp.statusCode != 200) {
      throw Exception('Failed to update npc privacy');
    }
  }
}
