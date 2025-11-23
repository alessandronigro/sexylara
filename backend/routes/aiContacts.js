// ===============================================================
// API ROUTES PER GESTIONE AI CONTACTS CONDIVISIBILI
// ===============================================================
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// ===============================================================
// GET /api/ai/list
// Lista tutti gli AI disponibili (propri + pubblici)
// ===============================================================
router.get('/ai/list', async (req, res) => {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // Recupera AI contacts (propri + pubblici)
        const { data: aiContacts, error: aiErr } = await supabase
            .from('ai_contacts')
            .select('*')
            .or(`owner_id.eq.${userId},is_public.eq.true`)
            .order('rating', { ascending: false });

        if (aiErr) throw aiErr;

        // Recupera anche le girlfriends dell'utente (per compatibilità)
        const { data: girlfriends, error: gfErr } = await supabase
            .from('girlfriends')
            .select('id, name, avatar_url, personality_type, tone, age, gender')
            .eq('user_id', userId);

        if (gfErr) throw gfErr;

        // Combina i risultati
        const allAi = [
            ...aiContacts.map(ai => ({
                id: ai.id,
                name: ai.name,
                avatar: ai.avatar,
                personality: ai.personality,
                tone: ai.tone,
                age: ai.age,
                gender: ai.gender,
                isPublic: ai.is_public,
                isOwned: ai.owner_id === userId,
                type: 'ai_contact',
                rating: ai.rating,
                description: ai.description
            })),
            ...girlfriends.map(gf => ({
                id: gf.id,
                name: gf.name,
                avatar: gf.avatar_url,
                personality: gf.personality_type,
                tone: gf.tone,
                age: gf.age,
                gender: gf.gender,
                isPublic: false,
                isOwned: true,
                type: 'girlfriend'
            }))
        ];

        res.json({ ai: allAi });
    } catch (error) {
        console.error('Error fetching AI list:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================================================
// GET /api/ai/public
// Lista solo gli AI pubblici (directory globale)
// ===============================================================
router.get('/ai/public', async (req, res) => {
    const { limit = 50, offset = 0, sortBy = 'rating' } = req.query;

    try {
        let query = supabase
            .from('ai_contacts')
            .select('*')
            .eq('is_public', true)
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        // Ordinamento
        if (sortBy === 'rating') {
            query = query.order('rating', { ascending: false });
        } else if (sortBy === 'popular') {
            query = query.order('usage_count', { ascending: false });
        } else if (sortBy === 'recent') {
            query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ ai: data });
    } catch (error) {
        console.error('Error fetching public AI:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================================================
// POST /api/ai/create
// Crea un nuovo AI contact
// ===============================================================
const crypto = require('crypto');

router.post('/ai/create', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { name, avatar, personality, style, tone, age, gender, isPublic, description } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    try {
        const aiId = crypto.randomUUID();

        const { data, error } = await supabase
            .from('ai_contacts')
            .insert({
                id: aiId,
                owner_id: userId,
                name,
                avatar: avatar || null,
                personality: personality || 'friendly',
                style: style || 'casual',
                tone: tone || 'warm',
                age: age || 25,
                gender: gender || 'female',
                is_public: isPublic || false,
                description: description || null
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, ai: data });
    } catch (error) {
        console.error('Error creating AI contact:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================================================
// PUT /api/ai/:id/publish
// Rende pubblico un AI contact
// ===============================================================
router.put('/ai/:id/publish', async (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const { description } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // Verifica proprietà
        const { data: ai, error: fetchErr } = await supabase
            .from('ai_contacts')
            .select('*')
            .eq('id', id)
            .eq('owner_id', userId)
            .single();

        if (fetchErr || !ai) {
            return res.status(404).json({ error: 'AI contact not found or not owned by you' });
        }

        // Aggiorna
        const { error: updateErr } = await supabase
            .from('ai_contacts')
            .update({
                is_public: true,
                description: description || ai.description
            })
            .eq('id', id);

        if (updateErr) throw updateErr;

        res.json({ success: true, message: 'AI contact is now public' });
    } catch (error) {
        console.error('Error publishing AI contact:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================================================
// PUT /api/ai/:id/unpublish
// Rende privato un AI contact
// ===============================================================
router.put('/ai/:id/unpublish', async (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        const { error } = await supabase
            .from('ai_contacts')
            .update({ is_public: false })
            .eq('id', id)
            .eq('owner_id', userId);

        if (error) throw error;

        res.json({ success: true, message: 'AI contact is now private' });
    } catch (error) {
        console.error('Error unpublishing AI contact:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================================================
// POST /api/ai/:id/rate
// Valuta un AI contact pubblico
// ===============================================================
router.post('/ai/:id/rate', async (req, res) => {
    const { id } = req.params;
    const { rating } = req.body; // 1-5
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        // Recupera AI
        const { data: ai, error: fetchErr } = await supabase
            .from('ai_contacts')
            .select('rating, usage_count')
            .eq('id', id)
            .single();

        if (fetchErr || !ai) {
            return res.status(404).json({ error: 'AI contact not found' });
        }

        // Calcola nuovo rating (media semplice)
        const currentRating = ai.rating || 0;
        const currentCount = ai.usage_count || 0;
        const newRating = ((currentRating * currentCount) + rating) / (currentCount + 1);

        // Aggiorna
        const { error: updateErr } = await supabase
            .from('ai_contacts')
            .update({
                rating: newRating,
                usage_count: currentCount + 1
            })
            .eq('id', id);

        if (updateErr) throw updateErr;

        res.json({ success: true, newRating });
    } catch (error) {
        console.error('Error rating AI contact:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================================================
// DELETE /api/ai/:id
// Elimina un AI contact (solo se proprietario)
// ===============================================================
router.delete('/ai/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        const { error } = await supabase
            .from('ai_contacts')
            .delete()
            .eq('id', id)
            .eq('owner_id', userId);

        if (error) throw error;

        res.json({ success: true, message: 'AI contact deleted' });
    } catch (error) {
        console.error('Error deleting AI contact:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
