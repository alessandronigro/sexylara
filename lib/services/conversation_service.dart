import '../models/conversation.dart';
import '../models/npc.dart';
import 'supabase_service.dart';

class ConversationService {
  static final _supabase = SupabaseService.client;

  /// Watch conversations for current user
  Stream<List<Conversation>> watchConversations() {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) {
      return Stream.value([]);
    }

    // Preload npc/NPC records for this user to enrich the stream rows.
    Future<Map<String, Npc>> loadNpcMap() async {
      final list = await _supabase
          .from('npcs')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true);
      return {
        for (final row in (list as List))
          row['id'] as String: Npc.fromJson(row)
      };
    }

    Map<String, Npc>? npcCache;

    return _supabase
        .from('conversations')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .order('last_message_at', ascending: false)
        .asyncMap((data) async {
          npcCache ??= await loadNpcMap();
          return data.map((json) {
            final gf = npcCache?[json['npc_id'] ?? json['girlfriend_id']];
            if (gf != null) {
              return Conversation.fromJson({
                ...json,
                'npcs': gf.toJson(),
              });
            }
            return Conversation.fromJson(json);
          }).toList();
        });
  }

  /// Get conversations list (one-time fetch)
  Future<List<Conversation>> getConversations() async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return [];

    final response = await _supabase
        .from('conversations')
        .select('*, npcs(*)')
        .eq('user_id', userId)
        .order('last_message_at', ascending: false);

    return (response as List)
        .map((json) => Conversation.fromJson(json))
        .toList();
  }

  /// Mark conversation as read
  Future<void> markAsRead(String npcId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return;

    await _supabase
        .from('conversations')
        .update({'unread_count': 0})
        .eq('user_id', userId)
        .eq('npc_id', npcId);
  }

  /// Get or create conversation for npc
  Future<Conversation?> getOrCreateConversation(String npcId) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return null;

    try {
      // Try to get existing conversation
      final response = await _supabase
          .from('conversations')
          .select('*, npcs(*)')
          .eq('user_id', userId)
          .eq('npc_id', npcId)
          .single();

      return Conversation.fromJson(response);
    } catch (e) {
      // Create new conversation if doesn't exist
      final newConv = await _supabase
          .from('conversations')
          .insert({
            'user_id': userId,
            'npc_id': npcId,
            'last_message_at': DateTime.now().toIso8601String(),
          })
          .select('*, npcs(*)')
          .single();

      return Conversation.fromJson(newConv);
    }
  }
}
