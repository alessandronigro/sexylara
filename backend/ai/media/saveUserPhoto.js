const { supabase } = require('../../lib/supabase');

async function saveUserPhoto(userId, imageUrl) {
  if (!userId || !imageUrl) return null;

  const { error } = await supabase
    .from('user_profile_media')
    .insert({
      user_id: userId,
      image_url: imageUrl,
    });

  if (error) {
    console.error('❌ Error saving user photo:', error);
    return null;
  }

  const { data } = await supabase
    .from('user_profile_media')
    .select('image_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.image_url || imageUrl;
}

module.exports = { saveUserPhoto };
