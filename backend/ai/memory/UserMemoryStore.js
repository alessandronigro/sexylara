const { supabase } = require('../../lib/supabase');

async function getUserSummary(userId, npcId) {
  try {
    // Parallel fetch: Global memory, Relationship memory, Recent messages
    const [userMemResult, aiUserMemResult, messagesResult] = await Promise.all([
      supabase.from('user_memory').select('*').eq('user_id', userId).single(),
      supabase.from('ai_user_memory').select('*').eq('user_id', userId).eq('ai_id', npcId).single(),
      supabase.from('messages')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .eq('npc_id', npcId)
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    const globalMem = userMemResult.data || {};
    const relationMem = aiUserMemResult.data || {};
    const recentMessages = (messagesResult.data || []).reverse().map(m => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.created_at).getTime()
    }));

    // Default summary if no relationship memory
    const summary = relationMem.user_preferences_learned
      ? JSON.stringify(relationMem.user_preferences_learned)
      : 'Nuova conoscenza. Nessun dato storico rilevante.';

    return {
      id: userId,
      name: globalMem.name || 'Utente', // Fallback
      preferences: globalMem.preferences || {},
      personality: globalMem.personality_traits || {},

      // Relationship specific
      relationship: {
        level: relationMem.relationship_level || 0,
        trust: relationMem.trust_level || 50,
        affection: relationMem.affection_level || 50,
      },

      conversations: recentMessages,
      summary,
    };
  } catch (err) {
    console.error('[UserMemoryStore] Error fetching user summary:', err);
    return {
      id: userId,
      conversations: [],
      summary: 'Errore recupero memoria.',
      relationship: { level: 0, trust: 50, affection: 50 }
    };
  }
}

async function pushConversation(userId, snippet) {
  // Messages are saved by server-ws.js directly to 'messages' table.
  // We might want to update 'ai_user_memory' last_interaction here?
  // Or just leave it as is.
  // For now, this function is a no-op or can be used for in-memory caching if we add it later.
}

module.exports = {
  getUserSummary,
  pushConversation,
};
