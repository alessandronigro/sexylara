import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/npc_post.dart';

class NpcFeedService {
  static String get baseUrl => '${Config.apiBaseUrl}/api/feed';

  /// Pubblica un NPC nella bacheca pubblica
  static Future<Map<String, dynamic>> publishNpc({
    required String npcId,
    String? message,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/publish-npc'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'npcId': npcId,
          if (message != null) 'message': message,
        }),
      );

        if (response.statusCode == 200) {
          return jsonDecode(response.body);
        } else if (response.statusCode == 303) {
          // Follow redirect to public feed
          final location = response.headers['location'];
          if (location != null) {
            final feedResponse = await http.get(
              Uri.parse(location),
              headers: {'Content-Type': 'application/json'},
            );
            if (feedResponse.statusCode == 200) {
              return jsonDecode(feedResponse.body);
            } else {
              throw Exception('Errore caricamento feed dopo redirect: ${feedResponse.body}');
            }
          } else {
            throw Exception('Redirect senza header Location');
          }
        } else {
          throw Exception('Errore pubblicazione: ${response.body}');
        }
    } catch (e) {
      print('❌ Errore publishNpc: $e');
      rethrow;
    }
  }

  /// Ottiene tutti i post pubblici del feed
  static Future<List<NpcPost>> getPublicFeed({
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/public?limit=$limit&offset=$offset'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final List data = jsonDecode(response.body);
        return data.map((e) => NpcPost.fromJson(e)).toList();
      } else {
        throw Exception('Errore caricamento feed: ${response.body}');
      }
    } catch (e) {
      print('❌ Errore getPublicFeed: $e');
      return [];
    }
  }

  /// Ottiene i post di un NPC specifico
  static Future<List<NpcPost>> getNpcFeed(String npcId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/npc/$npcId'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final List data = jsonDecode(response.body);
        return data.map((e) => NpcPost.fromJson(e)).toList();
      } else {
        throw Exception('Errore caricamento post NPC: ${response.body}');
      }
    } catch (e) {
      print('❌ Errore getNpcFeed: $e');
      return [];
    }
  }

  /// Mette o toglie like a un post
  static Future<Map<String, dynamic>> toggleLike({
    required String postId,
    required String userId,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/like-post'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'postId': postId,
          'userId': userId,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Errore like: ${response.body}');
      }
    } catch (e) {
      print('❌ Errore toggleLike: $e');
      rethrow;
    }
  }

  /// Commenta un post
  static Future<Map<String, dynamic>> commentPost({
    required String postId,
    required String userId,
    required String comment,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/comment-post'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'postId': postId,
          'userId': userId,
          'comment': comment,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Errore commento: ${response.body}');
      }
    } catch (e) {
      print('❌ Errore commentPost: $e');
      rethrow;
    }
  }

  /// Ottiene i commenti di un post
  static Future<List<Map<String, dynamic>>> getPostComments({
    required String postId,
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/post-comments/$postId?limit=$limit&offset=$offset'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final List data = jsonDecode(response.body);
        return data.cast<Map<String, dynamic>>();
      } else {
        throw Exception('Errore caricamento commenti: ${response.body}');
      }
    } catch (e) {
      print('❌ Errore getPostComments: $e');
      return [];
    }
  }

  /// Vota un NPC (1-5 stelle)
  static Future<Map<String, dynamic>> rateNpc({
    required String npcId,
    required String userId,
    required int rating,
  }) async {
    try {
      if (rating < 1 || rating > 5) {
        throw Exception('Il rating deve essere tra 1 e 5');
      }

      final response = await http.post(
        Uri.parse('$baseUrl/rate-npc'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'npcId': npcId,
          'userId': userId,
          'rating': rating,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Errore rating: ${response.body}');
      }
    } catch (e) {
      print('❌ Errore rateNpc: $e');
      rethrow;
    }
  }

  /// Ottiene il rating medio di un NPC
  static Future<Map<String, dynamic>> getNpcRating(String npcId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/npc-rating/$npcId'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Errore caricamento rating: ${response.body}');
      }
    } catch (e) {
      print('❌ Errore getNpcRating: $e');
      return {
        'averageRating': '0.0',
        'totalRatings': 0,
        'ratings': [],
      };
    }
  }

  /// Ottiene le statistiche di un post (like, commenti, userLiked)
  static Future<Map<String, dynamic>> getPostStats({
    required String postId,
    String? userId,
  }) async {
    try {
      final uri = userId != null
          ? Uri.parse('$baseUrl/post-stats/$postId?userId=$userId')
          : Uri.parse('$baseUrl/post-stats/$postId');

      final response = await http.get(
        uri,
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Errore caricamento statistiche: ${response.body}');
      }
    } catch (e) {
      print('❌ Errore getPostStats: $e');
      return {
        'totalLikes': 0,
        'totalComments': 0,
        'userLiked': false,
      };
    }
  }
}
