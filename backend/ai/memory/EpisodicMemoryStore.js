const { supabase } = require('../../lib/supabase');

async function recordEpisode(npcId, event) {
  try {
    // Ensure we have minimal required fields
    if (!event.userId || !event.description) {
      // console.warn('Skipping episode record: missing userId or description');
      return;
    }

    await supabase.from('significant_events').insert({
      ai_id: npcId,
      user_id: event.userId,
      event_type: event.type || 'interaction',
      description: event.description,
      emotional_impact: event.impact || 'low',
      created_at: new Date().toISOString()
    });
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
