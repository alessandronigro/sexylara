const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/check-preferences/:userId
router.get('/check-preferences/:userId', async (req, res) => {
    const { userId } = req.params;

    const { data, error } = await supabase
        .from('user_profile')
        .select('tone')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Errore Supabase:', error.message);
        return res.status(500).json({ error: 'Errore Supabase' });
    }

    if (!data?.tone) {
        return res.json({ hasPreference: false });
    }

    return res.json({ hasPreference: true });
});

module.exports = router;
