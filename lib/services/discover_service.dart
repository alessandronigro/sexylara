import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../services/supabase_service.dart';

class DiscoverService {
  final String userId;
  DiscoverService({required this.userId});

  String get _base => Config.apiBaseUrl;

  Future<List<dynamic>> fetchPublicNpcs({String? query}) async {
    if (userId.isEmpty) {
      throw Exception('Effettua il login per scoprire i Thrillers pubblici');
    }

    var url = '$_base/api/group/discover/npcs';
    if (query != null && query.isNotEmpty) {
      url += '?search=${Uri.encodeComponent(query)}';
    }

    final resp = await http.get(
      Uri.parse(url),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['npcs'] ?? [];
    }
    throw Exception('Failed to load Thrillers (code ${resp.statusCode})');
  }

  Future<List<dynamic>> fetchThrillers({String? query, Map<String, String>? filters}) async {
    if (userId.isEmpty) {
      throw Exception('Effettua il login per scoprire i Thrillers');
    }

    var url = '$_base/api/users/thrillers';
    final queryParams = <String>[];
    if (query != null && query.isNotEmpty) {
      queryParams.add('search=${Uri.encodeComponent(query)}');
    }
    if (filters != null) {
      filters.forEach((key, value) {
        if (value.isNotEmpty) {
          queryParams.add('$key=${Uri.encodeComponent(value)}');
        }
      });
    }

    if (queryParams.isNotEmpty) {
      url += '?${queryParams.join('&')}';
    }

    final resp = await http.get(
      Uri.parse(url),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      return data['thrillers'] ?? [];
    }
    throw Exception('Failed to load Thrillers (code ${resp.statusCode})');
  }
}

DiscoverService discoverServiceForCurrent() {
  final userId = SupabaseService.getCurrentUserId() ?? '';
  return DiscoverService(userId: userId);
}
