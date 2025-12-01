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

        // Recupera le proprie girlfriends
        const { data: myGirlfriends, error: gfErr } = await supabase
            .from('npcs')
            .select('id, name, avatar_url, personality_type, tone, age, gender, is_public, user_id')
            .eq('user_id', userId);

        if (gfErr) throw gfErr;

        // Recupera girlfriends pubbliche di altri utenti
        const { data: publicGirlfriends, error: pubGfErr } = await supabase
            .from('npcs')
            .select('id, name, avatar_url, personality_type, tone, age, gender, is_public, user_id')
            .eq('is_public', true)
            .neq('user_id', userId);

        if (pubGfErr) throw pubGfErr;

        // Recupera utenti pubblici (reali) per aggiungerli ai contatti
        const { data: publicUsers, error: usersErr } = await supabase
            .from('user_profile')
            .select('id, username, avatar_url, is_public')
            .eq('is_public', true)
            .neq('id', userId);

        if (usersErr) throw usersErr;

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
            ...myGirlfriends.map(gf => ({
                id: gf.id,
                name: gf.name,
                avatar: gf.avatar_url,
                personality: gf.personality_type,
                tone: gf.tone,
                age: gf.age,
                gender: gf.gender,
                isPublic: gf.is_public || false,
                isOwned: true,
                type: 'girlfriend'
            })),
            ...publicGirlfriends.map(gf => ({
                id: gf.id,
                name: gf.name,
                avatar: gf.avatar_url,
                personality: gf.personality_type,
                tone: gf.tone,
                age: gf.age,
                gender: gf.gender,
                isPublic: true,
                isOwned: false,
                type: 'girlfriend'
            })),
            ...(publicUsers || []).map(u => ({
                id: u.id,
                name: u.username || (u.email ? u.email.split('@')[0] : 'Utente'),
                avatar: u.avatar_url || null,
                personality: null,
                tone: null,
                age: null,
                gender: null,
                isPublic: true,
                isOwned: false,
                type: 'user'
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

const { generateNpcVoiceMaster } = require('../services/voiceGenerator');

router.post('/ai/create', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const {
        name, avatar, personality, style, tone, age, gender, isPublic, description,
        energy, speaking_speed, shyness, confidence, accent // Additional fields
    } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    try {
        const aiId = crypto.randomUUID();

        // Prepare NPC object for voice generation
        const npcData = {
            name,
            age: age || 25,
            gender: gender || 'female',
            tone_mode: tone || 'soft', // Map tone to tone_mode
            energy: energy || 'medium',
            speaking_speed: speaking_speed || 'normal',
            shyness: shyness || 0.5,
            confidence: confidence || 0.5,
            accent: accent || 'italian',
            character_traits: personality || []
        };

        // Generate Voice Master
        let voiceData = {};
        try {
            voiceData = await generateNpcVoiceMaster(npcData);
            console.log('✅ Voice Master generated:', voiceData.voiceUrl);
        } catch (voiceError) {
            console.error('⚠️ Failed to generate voice master:', voiceError);
            // Continue without voice or set default?
        }

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
                description: description || null,
                // Voice fields
                voice_master_url: voiceData.voiceUrl || null,
                voice_profile: voiceData.voiceProfile ? JSON.stringify(voiceData.voiceProfile) : null,
                voice_engine: voiceData.voiceEngine || null
            })
            .select()
            .single();

        if (error) throw error;

        // Initialize Brain Profile with Safe Mode
        try {
            const initialProfile = {
                id: aiId,
                name,
                preferences: { mode: 'safe' }
            };
            // We use updateNpcProfile which handles upsert logic
            // But first we might need to ensure getNpcProfile can find it.
            // Since we just inserted into ai_contacts, getNpcProfile might not find it if it looks in girlfriends.
            // So we force an insert into npc_profiles directly or use updateNpcProfile if it supports partial updates.
            // Actually updateNpcProfile does an upsert on npc_profiles.
            await updateNpcProfile(aiId, initialProfile);
            console.log('✅ Initialized NPC Brain Profile with Safe Mode');
        } catch (brainError) {
            console.warn('⚠️ Failed to initialize NPC Brain Profile:', brainError);
        }

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

const { updateNpcProfile, getNpcProfile } = require('../ai/memory/npcRepository');

// ... existing routes ...

// ===============================================================
// PATCH /api/ai/:id/mode
// Cambia la modalità (safe/uncensored)
// ===============================================================
router.patch('/api/ai/:id/mode', async (req, res) => {
    const { id } = req.params;
    const { mode } = req.body; // "safe" | "uncensored"
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!['safe', 'uncensored'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Use "safe" or "uncensored".' });
    }

    try {
        // 1. Verifica ownership (su ai_contacts o girlfriends)
        // Proviamo prima ai_contacts
        let { data: ai, error: fetchErr } = await supabase
            .from('ai_contacts')
            .select('id')
            .eq('id', id)
            .eq('owner_id', userId)
            .single();

        if (!ai) {
            // Prova girlfriends
            const { data: gf, error: gfErr } = await supabase
                .from('npcs')
                .select('id')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (gf) ai = gf;
        }

        if (!ai) {
            return res.status(404).json({ error: 'AI not found or not owned by you' });
        }

        // 2. Aggiorna il profilo cerebrale (npc_profiles)
        const profile = await getNpcProfile(id, 'NPC');
        const npcData = profile.data;

        npcData.preferences = npcData.preferences || {};
        npcData.preferences.mode = mode;

        await updateNpcProfile(id, npcData);

        // 3. Opzionale: prova ad aggiornare anche la tabella girlfriends se ha una colonna prefs/mode
        // (Ignoriamo errori qui se la colonna non esiste)
        try {
            await supabase
                .from('npcs')
                .update({ mode: mode }) // Se esiste la colonna mode
                .eq('id', id);
        } catch (e) {
            // ignore
        }

        res.json({ success: true, mode });
    } catch (error) {
        console.error('Error updating AI mode:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
