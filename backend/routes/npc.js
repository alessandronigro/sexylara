// routes/npc.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const storageService = require('../services/supabase-storage');

// Delete NPC (legacy path + new path)
const deleteNpc = async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch avatar URL (if any) before deletion
        const { data: gf, error: fetchErr } = await supabase
            .from('npcs')
            .select('avatar_url')
            .eq('id', id)
            .single();
        if (fetchErr) throw fetchErr;

        // Delete avatar from Supabase Storage if it exists and is a public URL
        if (gf?.avatar_url && gf.avatar_url.startsWith('http')) {
            await storageService.delete(gf.avatar_url);
        }

        // Delete the girlfriend record
        const { error: delErr } = await supabase.from('npcs').delete().eq('id', id);
        if (delErr) throw delErr;

        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting girlfriend:', e);
        res.status(500).json({ error: e.message });
    }
};

router.delete('/girlfriends/:id', deleteNpc); // legacy
router.delete('/npcs/:id', deleteNpc);

module.exports = router;
