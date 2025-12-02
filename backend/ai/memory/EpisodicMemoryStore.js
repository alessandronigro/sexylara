const { supabase } = require('../../lib/supabase');

const MAX_EPISODES = 20;
const EMOTIVE_EVENTS = ['emotivo', 'media', 'milestone'];

function sanitizeDescription(desc) {
  if (!desc) return null;
  return desc.toString().trim().slice(0, 180);
}

function shouldStoreEpisode(event = {}) {
  // Basic heuristic: allow if explicitly marked, or if impact high/medium
  if (event.force === true) return true;
  if (EMOTIVE_EVENTS.includes(event.type)) return true;
  if (['high', 'medium'].includes((event.impact || '').toLowerCase())) return true;
  if (event.score && event.score >= 0.6) return true;
  return false;
}

async function pruneEpisodes(npcId, userId) {
  try {
    const { data } = await supabase.from('significant_events')
      .select('id')
      .eq('ai_id', npcId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(MAX_EPISODES, 200); // fetch older than cap

    const obsoleteIds = (data || []).map(r => r.id);
    if (obsoleteIds.length) {
      await supabase.from('significant_events').delete().in('id', obsoleteIds);
    }
  } catch (err) {
    console.warn('[EpisodicMemoryStore] prune episodes failed:', err?.message || err);
  }
}

async function recordEpisode(npcId, event) {
  try {
    if (!event?.userId || !event?.description) return;
    if (!shouldStoreEpisode(event)) return;

    const description = sanitizeDescription(event.description);
    if (!description) return;

    await supabase.from('significant_events').insert({
      ai_id: npcId,
      user_id: event.userId,
      event_type: event.type || 'interaction',
      description,
      emotional_impact: (event.impact || 'medium').toLowerCase(),
      created_at: new Date().toISOString()
    });

    await pruneEpisodes(npcId, event.userId);
  } catch (err) {
    console.error('[EpisodicMemoryStore] Error recording episode:', err);
  }
}

async function getEpisodes(npcId) {
  try {
    const { data } = await supabase.from('significant_events')
      .select('*')
      .eq('ai_id', npcId)
      .order('created_at', { ascending: false })
      .limit(20);

    return data || [];
  } catch (err) {
    console.error('[EpisodicMemoryStore] Error fetching episodes:', err);
    return [];
  }
}

module.exports = {
  recordEpisode,
  getEpisodes,
};
