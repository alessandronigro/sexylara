import '../models/conversation.dart';
import 'supabase_service.dart';

class ConversationService {
  static final _supabase = SupabaseService.client;

  /// Watch conversations for current user
  Stream<List<Conversation>> watchConversations() {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) {
      return Stream.value([]);
    }

    return _supabase
        .from('conversations')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .order('last_message_at', ascending: false)
        .map((data) {
          return data.map((json) => Conversation.fromJson(json)).toList();
        });
  }

  /// Get conversations list (one-time fetch)
  Future<List<Conversation>> getConversations() async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return [];

    final response = await _supabase
        .from('conversations')
        .select('*, girlfriends(*)')
        .eq('user_id', userId)
        .order('last_message_at', ascending: false);

    return (response as List)
        .map((json) => Conversation.fromJson(json))
        .toList();
  }

  /// Mark conversation as read
  Future<void> markAsRead(String girlfriendId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;

    await _supabase
        .from('conversations')
        .update({'unread_count': 0})
        .eq('user_id', userId)
        .eq('girlfriend_id', girlfriendId);
  }

  /// Get or create conversation for girlfriend
  Future<Conversation?> getOrCreateConversation(String girlfriendId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return null;

    try {
      // Try to get existing conversation
      final response = await _supabase
          .from('conversations')
          .select('*, girlfriends(*)')
          .eq('user_id', userId)
          .eq('girlfriend_id', girlfriendId)
          .single();

      return Conversation.fromJson(response);
    } catch (e) {
      // Create new conversation if doesn't exist
      final newConv = await _supabase
          .from('conversations')
          .insert({
            'user_id': userId,
            'girlfriend_id': girlfriendId,
            'last_message_at': DateTime.now().toIso8601String(),
          })
          .select('*, girlfriends(*)')
          .single();

      return Conversation.fromJson(newConv);
    }
  }
}
