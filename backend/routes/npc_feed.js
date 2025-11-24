const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

/**
 * POST /api/feed/publish-npc
 * Pubblica un NPC nella bacheca con foto, caratteristiche e messaggio di presentazione
 * Body: { npcId: string, message?: string }
 */
router.post('/publish-npc', async (req, res) => {
    const { npcId, message } = req.body || {};

    if (!npcId) {
        return res.status(400).json({ error: 'npcId è obbligatorio' });
    }

    try {
        // 1. Recupera i dati completi dell'NPC
        const { data: npc, error: npcError } = await supabase
            .from('ai_girlfriends')
            .select('*')
            .eq('id', npcId)
            .single();

        if (npcError || !npc) {
            return res.status(404).json({ error: 'NPC non trovato' });
        }

        // 2. Genera il messaggio di presentazione se non fornito
        let postCaption = message;
        if (!postCaption) {
            const traits = [];
            if (npc.name) traits.push(`Ciao, sono ${npc.name}!`);
            if (npc.age) traits.push(`${npc.age} anni`);
            if (npc.ethnicity) traits.push(npc.ethnicity);
            if (npc.personality) traits.push(`Personalità: ${npc.personality}`);
            if (npc.occupation) traits.push(`Lavoro: ${npc.occupation}`);
            if (npc.interests) traits.push(`Interessi: ${npc.interests}`);

            postCaption = traits.join(' • ');
        }

        // 3. Crea il post nella bacheca
        const { data: post, error: postError } = await supabase
            .from('npc_posts')
            .insert({
                npc_id: npcId,
                caption: postCaption,
                media_url: npc.avatar_url || npc.profile_image_url,
                media_type: 'image',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (postError) {
            console.error('❌ Errore creazione post:', postError);
            throw postError;
        }

        console.log(`✅ NPC ${npc.name} pubblicato nella bacheca: post ${post.id}`);

        res.json({
            success: true,
            post: post,
            message: 'NPC pubblicato con successo nella bacheca'
        });

    } catch (err) {
        console.error('❌ Errore pubblicazione NPC:', err);
        res.status(500).json({ error: 'Impossibile pubblicare l\'NPC' });
    }
});

/**
 * GET /api/feed/npc/:npcId
 * Ottiene tutti i post di un NPC specifico
 */
router.get('/npc/:npcId', async (req, res) => {
    const { npcId } = req.params;

    try {
        const { data: posts, error } = await supabase
            .from('npc_posts')
            .select('*')
            .eq('npc_id', npcId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(posts || []);
    } catch (err) {
        console.error('❌ Errore recupero feed NPC:', err);
        res.status(500).json({ error: 'Impossibile recuperare il feed' });
    }
});

/**
 * GET /api/feed/public
 * Ottiene tutti i post pubblici della bacheca
 */
router.get('/public', async (req, res) => {
    const { limit = 50, offset = 0 } = req.query;

    try {
        const { data: posts, error } = await supabase
            .from('npc_posts')
            .select(`
        *,
        npc:ai_girlfriends(id, name, avatar_url, gender)
      `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json(posts || []);
    } catch (err) {
        console.error('❌ Errore recupero feed pubblico:', err);
        res.status(500).json({ error: 'Impossibile recuperare il feed pubblico' });
    }
});

module.exports = router;
