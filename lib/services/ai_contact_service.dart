import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/session_provider.dart';

final aiContactServiceProvider = Provider<AiContactService>((ref) {
  final session = ref.watch(sessionProvider);
  final userId = session.userId ?? '';
  return AiContactService(userId: userId);
});

class AiContactService {
  final String userId;
  AiContactService({required this.userId});

  String get _base => const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:4000/api');

  // Ottiene la lista di tutti gli AI disponibili (propri + pubblici)
  Future<List<AiContact>> fetchAiContacts() async {
    final resp = await http.get(
      Uri.parse('$_base/ai/list'),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      final List<dynamic> list = data['ai'] ?? [];
      return list.map((json) => AiContact.fromJson(json)).toList();
    }
    throw Exception('Failed to load AI contacts');
  }

  // Ottiene la directory pubblica degli AI
  Future<List<AiContact>> fetchPublicAi({String sortBy = 'rating'}) async {
    final resp = await http.get(
      Uri.parse('$_base/ai/public?sortBy=$sortBy'),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      final List<dynamic> list = data['ai'] ?? [];
      return list.map((json) => AiContact.fromJson(json)).toList();
    }
    throw Exception('Failed to load public AI');
  }
}

class AiContact {
  final String id;
  final String name;
  final String? avatar;
  final String? personality;
  final String? tone;
  final bool isPublic;
  final bool isOwned;
  final String type; // 'ai_contact' or 'npc'
  final double rating;
  final String? description;

  AiContact({
    required this.id,
    required this.name,
    this.avatar,
    this.personality,
    this.tone,
    required this.isPublic,
    required this.isOwned,
    required this.type,
    this.rating = 0.0,
    this.description,
  });

  factory AiContact.fromJson(Map<String, dynamic> json) {
    return AiContact(
      id: json['id'],
      name: json['name'],
      avatar: json['avatar'],
      personality: json['personality'],
      tone: json['tone'],
      isPublic: json['isPublic'] ?? false,
      isOwned: json['isOwned'] ?? false,
      type: json['type'] ?? 'ai_contact',
      rating: (json['rating'] is int) 
          ? (json['rating'] as int).toDouble() 
          : (json['rating'] ?? 0.0),
      description: json['description'],
    );
  }
}
