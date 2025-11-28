const { supabase } = require('../../lib/supabase');

async function addMedia(npcId, media) {
  try {
    // Fetch current media memory
    const { data } = await supabase.from('npcs').select('media_memory').eq('id', npcId).single();
    const currentMemory = data?.media_memory || [];

    const newEntry = {
      ...media,
      recalledAt: Date.now(),
    };

    const updatedMemory = [...currentMemory, newEntry];

    await supabase.from('npcs').update({
      media_memory: updatedMemory
    }).eq('id', npcId);

  } catch (err) {
    console.error('[MediaMemoryStore] Error adding media:', err);
  }
}

async function listMedia(npcId) {
  try {
    const { data } = await supabase.from('npcs').select('media_memory').eq('id', npcId).single();
    return data?.media_memory || [];
  } catch (err) {
    console.error('[MediaMemoryStore] Error listing media:', err);
    return [];
  }
}

module.exports = {
  addMedia,
  listMedia,
};
