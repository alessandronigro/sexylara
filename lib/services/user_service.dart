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
      Uri.parse('$_base/users/me'),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['user'] ?? {};
    }
    throw Exception('Failed to load user profile');
  }

  Future<List<dynamic>> fetchPublicUsers({String? query}) async {
    String url = '$_base/users/public';
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
      Uri.parse('$_base/users/settings/privacy'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'isPublic': isPublic}),
    );

    if (resp.statusCode != 200) {
      throw Exception('Failed to update privacy');
    }
  }

  Future<void> updateGirlfriendPrivacy(String gfId, bool isPublic) async {
    final resp = await http.put(
      Uri.parse('$_base/users/girlfriends/$gfId/privacy'),
      headers: {'Content-Type': 'application/json', 'x-user-id': userId},
      body: jsonEncode({'isPublic': isPublic}),
    );

    if (resp.statusCode != 200) {
      throw Exception('Failed to update girlfriend privacy');
    }
  }
}
