const { supabase } = require('../../lib/supabase');
const DEFAULT_NPC_TEMPLATE = require('./npcTemplate');

async function getNpcProfile(npcId, fallbackName) {
  const { data, error } = await supabase
    .from('npc_profiles')
    .select('data')
    .eq('id', npcId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (data && data.data) {
    return { data: data.data };
  }

  let resolvedName = fallbackName;
  if (!resolvedName) {
    const { data: gf, error: gfErr } = await supabase
      .from('npcs')
      .select('name')
      .eq('id', npcId)
      .single();
    resolvedName = gf?.name || DEFAULT_NPC_TEMPLATE.name;
  }

  const seeded = { ...DEFAULT_NPC_TEMPLATE, id: npcId, name: resolvedName };
  const { error: insertError } = await supabase
    .from('npc_profiles')
    .insert({
      id: npcId,
      name: resolvedName,
      data: seeded,
    });
  if (insertError) throw insertError;
  return { data: seeded };
}

module.exports = getNpcProfile;
