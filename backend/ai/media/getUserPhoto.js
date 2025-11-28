const { supabase } = require('../../lib/supabase');

async function getUserPhoto(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('user_profile_media')
    .select('image_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data?.image_url || null;
}

module.exports = { getUserPhoto };
