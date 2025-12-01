const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// POST /api/contacts
// Add a new contact (NPC or User)
router.post('/contacts', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { targetId, targetType } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!targetId || !targetType) {
        return res.status(400).json({ error: 'Missing targetId or targetType' });
    }

    if (!['npc', 'user'].includes(targetType)) {
        return res.status(400).json({ error: 'Invalid targetType' });
    }

    try {
        const { data, error } = await supabase
            .from('contacts')
            .insert({
                owner_user_id: userId,
                target_id: targetId,
                target_type: targetType
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                return res.status(409).json({ error: 'Contact already exists' });
            }
            throw error;
        }

        res.json({ success: true, contact: data });
    } catch (error) {
        console.error('Error adding contact:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/contacts
// List all contacts for the user
router.get('/contacts', async (req, res) => {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        const { data: contacts, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('owner_user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with details
        const enriched = await Promise.all(contacts.map(async (c) => {
            let details = {};
            try {
                if (c.target_type === 'npc') {
                    const { data: npc } = await supabase
                        .from('npcs')
                        .select('name, avatar_url')
                        .eq('id', c.target_id)
                        .single();
                    if (npc) details = { name: npc.name, avatar_url: npc.avatar_url };
                } else if (c.target_type === 'user') {
                    const { data: user } = await supabase
                        .from('user_profile')
                        .select('username, avatar_url')
                        .eq('id', c.target_id)
                        .single();
                    if (user) details = { name: user.username, avatar_url: user.avatar_url };
                }
            } catch (e) {
                console.warn(`Failed to fetch details for contact ${c.id}:`, e);
            }
            return { ...c, ...details };
        }));

        res.json({ contacts: enriched });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/contacts/:targetId
// Remove a contact
router.delete('/contacts/:targetId', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { targetId } = req.params;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('owner_user_id', userId)
            .eq('target_id', targetId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
