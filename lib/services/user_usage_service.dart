import 'package:supabase_flutter/supabase_flutter.dart';

class UserUsageService {
  static final _supabase = Supabase.instance.client;

  // Limits for Free Plan
  static const int limitMessages = 100;
  static const int limitImages = 20;
  static const int limitVideo = 5;
  static const int limitAudio = 20;

  static Future<Map<String, int>> getMonthlyUsage(String userId) async {
    final now = DateTime.now();
    final startOfMonth = DateTime(now.year, now.month, 1).toIso8601String();

    try {
      // 1. Count User Messages (Text)
      final messagesCount = await _supabase
          .from('messages')
          .select('*', const FetchOptions(count: CountOption.exact))
          .eq('user_id', userId)
          .eq('role', 'user')
          .gte('created_at', startOfMonth)
          .execute();

      // 2. Count Generated Images
      final imagesCount = await _supabase
          .from('messages')
          .select('*', const FetchOptions(count: CountOption.exact))
          .eq('user_id', userId)
          .eq('role', 'assistant')
          .eq('type', 'image') // or 'photo' depending on backend
          .gte('created_at', startOfMonth)
          .execute();

      // 3. Count Generated Videos
      final videosCount = await _supabase
          .from('messages')
          .select('*', const FetchOptions(count: CountOption.exact))
          .eq('user_id', userId)
          .eq('role', 'assistant')
          .eq('type', 'video')
          .gte('created_at', startOfMonth)
          .execute();

      // 4. Count Generated Audio
      final audioCount = await _supabase
          .from('messages')
          .select('*', const FetchOptions(count: CountOption.exact))
          .eq('user_id', userId)
          .eq('role', 'assistant')
          .eq('type', 'audio') // or 'npc_audio'
          .gte('created_at', startOfMonth)
          .execute();

      return {
        'messages': messagesCount.count ?? 0,
        'images': imagesCount.count ?? 0,
        'video': videosCount.count ?? 0,
        'audio': audioCount.count ?? 0,
      };
    } catch (e) {
      print('Error fetching usage: $e');
      return {
        'messages': 0,
        'images': 0,
        'video': 0,
        'audio': 0,
      };
    }
  }

  static Future<bool> checkLimit(String type) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return false;

    final usage = await getMonthlyUsage(user.id);
    
    switch (type) {
      case 'text':
        return usage['messages']! < limitMessages;
      case 'image':
        return usage['images']! < limitImages;
      case 'video':
        return usage['video']! < limitVideo;
      case 'audio':
        return usage['audio']! < limitAudio;
      default:
        return true;
    }
  }
}
