const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/debug/npc/all  - returns all NPC records for debugging
router.get('/all', async (req, res) => {
    try {
        const { data, error } = await supabase.from('npcs').select('*');
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('🔎 Debug NPC error:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
