const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

/**
 * POST /api/feed/publish-npc
 * Pubblica un NPC nella bacheca con foto, caratteristiche e messaggio di presentazione
 * Body: { npcId: string, message?: string }
 */
router.post('/publish-npc', async (req, res) => {
    const { npcId, message, mediaUrl, mediaType, groupId } = req.body || {};

    if (!npcId) {
        return res.status(400).json({ error: 'npcId è obbligatorio' });
    }

    try {
        console.log('🔎 Attempting to fetch NPC with id:', npcId);
        const { data: npc, error: npcError } = await supabase
            .from('npcs')
            .select('*')
            .eq('id', npcId)
            .single();
        console.log('Supabase fetch result:', { npc, npcError });
        if (npcError) console.error('Supabase error fetching NPC:', npcError);
        if (!npc) {
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
                media_url: req.body.mediaUrl || npc.avatar_url || npc.profile_image_url,
                media_type: req.body.mediaType || 'image',
                group_id: groupId || null,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (postError) throw postError;

        res.json({
            success: true,
            post
        });

    } catch (err) {
        console.error('❌ Errore pubblicazione NPC nel feed:', err);
        res.status(500).json({ error: 'Impossibile pubblicare nel feed' });
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
            .select('id, npc_id, caption, media_url, media_type, created_at')
            .eq('npc_id', npcId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const postIds = (posts || []).map(p => p.id);
        let likeCounts = {};
        let commentCounts = {};
        if (postIds.length > 0) {
            const { data: likes } = await supabase
                .from('post_likes')
                .select('post_id')
                .in('post_id', postIds);
            (likes || []).forEach(l => {
                likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
            });

            const { data: comments } = await supabase
                .from('post_comments')
                .select('post_id')
                .in('post_id', postIds);
            (comments || []).forEach(c => {
                commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
            });
        }

        const enriched = (posts || []).map(p => ({
            ...p,
            like_count: likeCounts[p.id] || 0,
            comment_count: commentCounts[p.id] || 0
        }));

        res.json(enriched);
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
        const { data: posts, error: postsError } = await supabase
            .from('npc_posts')
            .select('id, npc_id, caption, media_url, media_type, created_at')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (postsError) throw postsError;

        const npcIds = Array.from(new Set((posts || []).map(p => p.npc_id).filter(Boolean)));
        let npcMap = {};
        if (npcIds.length > 0) {
            const { data: npcs, error: npcError } = await supabase
                .from('npcs')
                .select('id, name, avatar_url, gender')
                .in('id', npcIds);
            if (npcError) throw npcError;
            npcMap = (npcs || []).reduce((acc, n) => {
                acc[n.id] = n;
                return acc;
            }, {});
        }

        const postIds = (posts || []).map(p => p.id);
        let likeCounts = {};
        let commentCounts = {};
        if (postIds.length > 0) {
            const { data: likes } = await supabase
                .from('post_likes')
                .select('post_id')
                .in('post_id', postIds);
            (likes || []).forEach(l => {
                likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
            });

            const { data: comments } = await supabase
                .from('post_comments')
                .select('post_id')
                .in('post_id', postIds);
            (comments || []).forEach(c => {
                commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
            });
        }

        const enriched = (posts || []).map(p => ({
            ...p,
            npc: npcMap[p.npc_id] || null,
            like_count: likeCounts[p.id] || 0,
            comment_count: commentCounts[p.id] || 0
        }));

        res.json(enriched);
    } catch (err) {
        console.error('❌ Errore recupero feed pubblico:', err);
        res.status(500).json({ error: 'Impossibile recuperare il feed pubblico' });
    }
});

/**
 * Assicura che l'utente esista nella tabella user_profile
 * Se non esiste, prova a crearlo (usando auth.users se possibile, o placeholder)
 */
async function ensureUserProfileExists(userId) {
    console.log(`⚙️ ensureUserProfileExists called for userId: ${userId}`);
    try {
        // Controlla se esiste
        const { data: profile } = await supabase
            .from('user_profile')
            .select('id')
            .eq('id', userId)
            .single();

        if (profile) return true;

        console.log(`⚠️ User profile ${userId} not found. Creating placeholder...`);

        // Se non esiste, prova a crearlo
        // Nota: idealmente dovremmo prendere i dati da auth.users, ma qui usiamo placeholder
        const { error } = await supabase
            .from('user_profile')
            .insert({
                id: userId,
                name: 'Utente', // Placeholder
                // Aggiungi altri campi obbligatori se necessario
            });

        if (error) {
            console.error('❌ Error creating user profile placeholder:', error);
            return false;
        } else {
            console.log(`✅ Created placeholder profile for userId: ${userId}`);
            return true;
        }
    } catch (err) {
        console.error('❌ Error ensuring user profile:', err);
        return false;
    }
}

/**
 * POST /api/feed/rate-npc
 * Vota un NPC (1-5 stelle)
 * Body: { npcId: string, userId: string, rating: number }
 */
router.post('/rate-npc', async (req, res) => {
    const { npcId, userId, rating } = req.body || {};

    if (!npcId || !userId || !rating) {
        return res.status(400).json({ error: 'npcId, userId e rating sono obbligatori' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Il rating deve essere tra 1 e 5' });
    }

    try {
        // Assicura che l'utente esista
        await ensureUserProfileExists(userId);

        // Upsert del rating (crea o aggiorna)
        const { data, error } = await supabase
            .from('npc_ratings')
            .upsert({
                npc_id: npcId,
                user_id: userId,
                rating: rating,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'npc_id,user_id'
            })
            .select()
            .single();

        if (error) throw error;

        // Calcola la media dei rating per questo NPC
        const { data: avgData } = await supabase
            .from('npc_ratings')
            .select('rating')
            .eq('npc_id', npcId);

        const avgRating = avgData && avgData.length > 0
            ? avgData.reduce((sum, r) => sum + r.rating, 0) / avgData.length
            : 0;

        res.json({
            success: true,
            rating: data,
            averageRating: avgRating.toFixed(1),
            totalRatings: avgData?.length || 0
        });

    } catch (err) {
        console.error('❌ Errore salvataggio rating:', err);
        res.status(500).json({ error: 'Impossibile salvare il rating' });
    }
});

/**
 * GET /api/feed/npc-rating/:npcId
 * Ottiene il rating medio di un NPC
 */
router.get('/npc-rating/:npcId', async (req, res) => {
    const { npcId } = req.params;

    try {
        const { data: ratings, error } = await supabase
            .from('npc_ratings')
            .select('rating, user_id')
            .eq('npc_id', npcId);

        if (error) throw error;

        const avgRating = ratings && ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : 0;

        res.json({
            averageRating: avgRating.toFixed(1),
            totalRatings: ratings?.length || 0,
            ratings: ratings || []
        });

    } catch (err) {
        console.error('❌ Errore recupero rating:', err);
        res.status(500).json({ error: 'Impossibile recuperare il rating' });
    }
});

/**
 * POST /api/feed/like-post
 * Mette o toglie like a un post
 * Body: { postId: string, userId: string }
 */
router.post('/like-post', async (req, res) => {
    const { postId, userId } = req.body || {};

    if (!postId || !userId) {
        return res.status(400).json({ error: 'postId e userId sono obbligatori' });
    }

    try {
        // Assicura che l'utente esista
        await ensureUserProfileExists(userId);

        // Controlla se l'utente ha già messo like
        const { data: existingLike } = await supabase
            .from('post_likes')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .single();

        if (existingLike) {
            // Rimuovi like
            await supabase
                .from('post_likes')
                .delete()
                .eq('post_id', postId)
                .eq('user_id', userId);

            // Conta i like rimanenti
            const { count } = await supabase
                .from('post_likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', postId);

            // Notifica l'utente della rimozione del like
            console.log(`🔔 Notifica: like rimosso da post ${postId} da utente ${userId}`);
            return res.json({
                success: true,
                liked: false,
                totalLikes: count || 0
            });
        } else {
            // Aggiungi like
            await supabase
                .from('post_likes')
                .insert({
                    post_id: postId,
                    user_id: userId,
                    created_at: new Date().toISOString()
                });

            // Conta i like totali
            const { count } = await supabase
                .from('post_likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', postId);

            // Notifica l'utente dell'aggiunta del like
            console.log(`🔔 Notifica: like aggiunto a post ${postId} da utente ${userId}`);
            return res.json({
                success: true,
                liked: true,
                totalLikes: count || 0
            });
        }

    } catch (err) {
        console.error('❌ Errore gestione like:', err);
        res.status(500).json({ error: 'Impossibile gestire il like' });
    }
});

/**
 * POST /api/feed/comment-post
 * Commenta un post
 * Body: { postId: string, userId: string, comment: string }
 */
router.post('/comment-post', async (req, res) => {
    const { postId, userId, comment } = req.body || {};

    if (!postId || !userId || !comment) {
        return res.status(400).json({ error: 'postId, userId e comment sono obbligatori' });
    }

    if (comment.trim().length === 0) {
        return res.status(400).json({ error: 'Il commento non può essere vuoto' });
    }

    try {
        // Assicura che l'utente esista
        await ensureUserProfileExists(userId);

        const { data, error } = await supabase
            .from('post_comments')
            .insert({
                post_id: postId,
                user_id: userId,
                comment: comment.trim(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Conta i commenti totali
        const { count } = await supabase
            .from('post_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

        res.json({
            success: true,
            comment: data,
            totalComments: count || 0
        });

    } catch (err) {
        console.error('❌ Errore salvataggio commento:', err);
        res.status(500).json({ error: 'Impossibile salvare il commento' });
    }
});

/**
 * GET /api/feed/post-comments/:postId
 * Ottiene tutti i commenti di un post
 */
router.get('/post-comments/:postId', async (req, res) => {
    const { postId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    try {
        const { data: comments, error } = await supabase
            .from('post_comments')
            .select('id, post_id, user_id, comment, created_at')
            .eq('post_id', postId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json(comments || []);

    } catch (err) {
        console.error('❌ Errore recupero commenti:', err);
        res.status(500).json({ error: 'Impossibile recuperare i commenti' });
    }
});

/**
 * GET /api/feed/post-stats/:postId
 * Ottiene statistiche di un post (like, commenti)
 */
router.get('/post-stats/:postId', async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.query;

    try {
        // Conta like
        const { count: likesCount } = await supabase
            .from('post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

        // Conta commenti
        const { count: commentsCount } = await supabase
            .from('post_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

        // Verifica se l'utente ha messo like
        let userLiked = false;
        if (userId) {
            const { data: userLike } = await supabase
                .from('post_likes')
                .select('*')
                .eq('post_id', postId)
                .eq('user_id', userId)
                .single();

            userLiked = !!userLike;
        }

        res.json({
            totalLikes: likesCount || 0,
            totalComments: commentsCount || 0,
            userLiked: userLiked
        });

    } catch (err) {
        console.error('❌ Errore recupero statistiche:', err);
        res.status(500).json({ error: 'Impossibile recuperare le statistiche' });
    }
});

module.exports = router;
