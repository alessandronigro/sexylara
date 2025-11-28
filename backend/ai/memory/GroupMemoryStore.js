const { supabase } = require('../../lib/supabase');

async function getGroupSummary(groupId) {
  try {
    const { data, error } = await supabase.from('group_memory').select('*').eq('group_id', groupId).single();

    if (error || !data) {
      return {
        socialGraph: {},
        summary: 'Gruppo appena formato.',
      };
    }

    return {
      socialGraph: data.dynamics || {},
      summary: data.summary || 'Dinamiche di gruppo in evoluzione.',
    };
  } catch (err) {
    console.error('[GroupMemoryStore] Error:', err);
    return { socialGraph: {}, summary: 'Errore memoria gruppo.' };
  }
}

async function updateGroupGraph(groupId, entry) {
  try {
    // Fetch current dynamics first? Or just merge in DB?
    // Supabase doesn't support deep merge easily in update.
    // We'll fetch, merge, update.

    const { data } = await supabase.from('group_memory').select('dynamics').eq('group_id', groupId).single();
    const currentDynamics = data?.dynamics || {};

    const newDynamics = {
      ...currentDynamics,
      ...entry
    };

    await supabase.from('group_memory').upsert({
      group_id: groupId,
      dynamics: newDynamics,
      updated_at: new Date().toISOString()
    });

  } catch (err) {
    console.error('[GroupMemoryStore] Error updating graph:', err);
  }
}

module.exports = {
  getGroupSummary,
  updateGroupGraph,
};
