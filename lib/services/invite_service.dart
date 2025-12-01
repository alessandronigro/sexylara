import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../providers/session_provider.dart';

final inviteServiceProvider = Provider<ContactInviteService>((ref) {
  final session = ref.watch(sessionProvider);
  final userId = session.userId ?? '';
  return ContactInviteService(userId: userId);
});

class ContactInviteService {
  final String userId;
  ContactInviteService({required this.userId});

  String get _base => Config.apiBaseUrl;

  Future<void> sendInvite({
    required String targetId,
    required String targetType, // 'user' | 'npc'
    String? message,
  }) async {
    final resp = await http.post(
      Uri.parse('$_base/api/users/invite'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: jsonEncode({
        'targetId': targetId,
        'targetType': targetType,
        if (message != null) 'message': message,
      }),
    );

    if (resp.statusCode != 200) {
      try {
        final data = jsonDecode(resp.body);
        throw Exception(data['error'] ?? 'Impossibile inviare l\'invito');
      } catch (_) {
        throw Exception('Impossibile inviare l\'invito');
      }
    }
  }

  Future<List<ContactInvite>> fetchPendingInvites() async {
    final resp = await http.get(
      Uri.parse('$_base/api/users/invites/pending'),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode != 200) {
      throw Exception('Impossibile caricare gli inviti');
    }

    final data = jsonDecode(resp.body);
    final List<dynamic> list = data['invites'] ?? [];
    return list.map((json) => ContactInvite.fromJson(json)).toList();
  }

  Future<void> respondToInvite({
    required String inviteId,
    required bool accept,
  }) async {
    final resp = await http.post(
      Uri.parse('$_base/api/users/invites/$inviteId/respond'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: jsonEncode({'accept': accept}),
    );

    if (resp.statusCode != 200) {
      final data = jsonDecode(resp.body);
      throw Exception(data['error'] ?? 'Impossibile aggiornare l\'invito');
    }
  }

  Future<List<ThrillerContact>> fetchContacts() async {
    final resp = await http.get(
      Uri.parse('$_base/api/users/contacts'),
      headers: {'x-user-id': userId},
    );

    if (resp.statusCode != 200) {
      throw Exception('Impossibile caricare i contatti');
    }

    final data = jsonDecode(resp.body);
    final List<dynamic> list = data['contacts'] ?? [];
    return list.map((json) => ThrillerContact.fromJson(json)).toList();
  }
}

class ContactInvite {
  final String id;
  final String senderName;
  final String? senderAvatar;
  final String targetType;
  final String? targetName;
  final String? message;

  ContactInvite({
    required this.id,
    required this.senderName,
    this.senderAvatar,
    required this.targetType,
    this.targetName,
    this.message,
  });

  factory ContactInvite.fromJson(Map<String, dynamic> json) {
    return ContactInvite(
      id: json['id'].toString(),
      senderName: json['senderName'] ?? 'Utente',
      senderAvatar: json['senderAvatar'],
      targetType: json['targetType'] ?? 'user',
      targetName: json['targetName'],
      message: json['message'],
    );
  }
}

class ThrillerContact {
  final String id;
  final String type; // 'user' | 'npc'
  final String name;
  final String? avatar;
  final String? ownerId;

  ThrillerContact({
    required this.id,
    required this.type,
    required this.name,
    this.avatar,
    this.ownerId,
  });

  factory ThrillerContact.fromJson(Map<String, dynamic> json) {
    return ThrillerContact(
      id: json['id'].toString(),
      type: json['type'] ?? 'user',
      name: json['name'] ?? 'Thriller',
      avatar: json['avatar'],
      ownerId: json['ownerId']?.toString(),
    );
  }
}
