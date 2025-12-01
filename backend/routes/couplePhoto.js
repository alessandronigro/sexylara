const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { generateCouplePhoto } = require('../ai/media/generateCouplePhoto');
const { v4: uuidv4 } = require('uuid');

router.post('/couple-photo', async (req, res) => {
  const { userId, npcId: bodyNpcId, userImageUrl, npcImageUrl } = req.body || {};
  const npcId = bodyNpcId || req.body.girlfriendId;
  if (!userId || !npcId || !userImageUrl || !npcImageUrl) {
    return res.status(400).json({ error: 'Missing userId, npcId, userImageUrl or npcImageUrl' });
  }

  try {
    const { data: npc, error: npcErr } = await supabase
      .from('npcs')
      .select('id, name')
      .eq('id', npcId)
      .single();

    if (npcErr || !npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    const { baseImageUrl, finalImageUrl } = await generateCouplePhoto({
      userImageUrl,
      npcImageUrl,
      npcName: npc.name,
    });

    const row = {
      id: uuidv4(),
      user_id: userId,
      npc_id: npcId,
      media_type: 'couple_photo',
      base_url: baseImageUrl,
      final_url: finalImageUrl,
      created_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase
      .from('npc_media_feed')
      .insert(row);
    if (insertErr) {
      return res.status(500).json({ error: insertErr.message });
    }

    return res.json({
      status: 'success',
      image: finalImageUrl,
    });
  } catch (error) {
    console.error('❌ Couple photo error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate couple photo' });
  }
});

module.exports = router;
