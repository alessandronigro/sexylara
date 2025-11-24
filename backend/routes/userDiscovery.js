const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/users/me
// Get current user profile
router.get('/me', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, is_public')
            .eq('id', userId)
            .single();

        if (error) throw error;
        res.json({ user: data });
    } catch (error) {
        console.error('Error fetching me:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/public
// List public users for invitation
router.get('/public', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { search } = req.query;

    try {
        let query = supabase
            .from('users')
            .select('id, email, created_at') // Adjust fields based on your users table (e.g. username, avatar_url)
            .eq('is_public', true)
            .neq('id', userId); // Exclude self

        if (search) {
            // Assuming there's a name or email field to search
            query = query.ilike('email', `%${search}%`);
        }

        const { data, error } = await query.limit(50);

        if (error) throw error;

        // Map to safe public profile
        const publicUsers = data.map(u => ({
            id: u.id,
            name: u.email ? u.email.split('@')[0] : 'User', // Fallback name logic
            avatar: null // Add avatar_url if available in schema
        }));

        res.json({ users: publicUsers });
    } catch (error) {
        console.error('Error fetching public users:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/users/settings/privacy
// Update user privacy settings
router.put('/settings/privacy', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { isPublic } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { error } = await supabase
            .from('users')
            .update({ is_public: isPublic })
            .eq('id', userId);

        if (error) throw error;

        res.json({ success: true, isPublic });
    } catch (error) {
        console.error('Error updating privacy:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/girlfriends/:id/privacy
// Update girlfriend privacy settings
router.put('/girlfriends/:id/privacy', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    const { isPublic } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { error } = await supabase
            .from('girlfriends')
            .update({ is_public: isPublic })
            .eq('id', id)
            .eq('user_id', userId); // Ensure ownership

        if (error) throw error;

        res.json({ success: true, isPublic });
    } catch (error) {
        console.error('Error updating girlfriend privacy:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
