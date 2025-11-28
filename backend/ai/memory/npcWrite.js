const { supabase } = require('../../lib/supabase');

async function updateNpcProfile(npcId, data) {
  const { data: updated, error } = await supabase
    .from('npc_profiles')
    .update({ data, name: data.name || null, updated_at: new Date().toISOString() })
    .eq('id', npcId)
    .select('data')
    .single();

  if (error && error.code === 'PGRST116') {
    const { data: inserted, error: insertError } = await supabase
      .from('npc_profiles')
      .insert({ id: npcId, name: data.name, data })
      .select('data')
      .single();
    if (insertError) throw insertError;
    return inserted;
  }

  if (error) throw error;
  return updated.data;
}

module.exports = updateNpcProfile;
