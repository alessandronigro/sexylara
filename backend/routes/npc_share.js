const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

/**
 * POST /api/npc/share
 * Body: { npcId: string, targetUserId?: string, targetGroupId?: string }
 */
router.post('/share', async (req, res) => {
    const { npcId, targetUserId, targetGroupId } = req.body || {};

    if (!npcId) {
        return res.status(400).json({ error: 'npcId è obbligatorio' });
    }

    try {
        // 1. Condivisione a un utente (Aggiungi ai preferiti / contatti)
        if (targetUserId) {
            // Verifica se esiste già
            const { data: existing } = await supabase
                .from('user_favorites')
                .select('*')
                .eq('user_id', targetUserId)
                .eq('npc_id', npcId)
                .single();

            if (!existing) {
                const { error } = await supabase
                    .from('user_favorites')
                    .insert({ user_id: targetUserId, npc_id: npcId });

                if (error) {
                    // Se la tabella non esiste, potremmo fallire silenziosamente o loggare
                    console.warn("Tabella user_favorites potrebbe non esistere o errore insert:", error);
                }
            }
            return res.json({ success: true, message: 'NPC condiviso con l\'utente' });
        }

        // 2. Condivisione a un gruppo (Crea un invito)
        if (targetGroupId) {
            // Verifica se l'NPC è già nel gruppo
            const { data: existingMember } = await supabase
                .from('group_members')
                .select('*')
                .eq('group_id', targetGroupId)
                .eq('npc_id', npcId)
                .single();

            if (existingMember) {
                return res.json({ success: false, message: 'NPC già presente nel gruppo' });
            }

            const { data, error } = await supabase
                .from('group_invites') // Usa la tabella standard degli inviti o quella specifica se creata
                .insert({
                    group_id: targetGroupId,
                    npc_id: npcId,
                    invited_by: req.user ? req.user.id : null, // Se abbiamo l'auth middleware
                    status: 'pending'
                })
                .select()
                .single();

            if (error) {
                console.error("Errore invito gruppo:", error);
                throw error;
            }
            return res.json({ success: true, invite: data });
        }

        return res.status(400).json({ error: 'Specificare targetUserId o targetGroupId' });
    } catch (err) {
        console.error('❌ Errore condivisione NPC:', err);
        res.status(500).json({ error: 'Impossibile condividere l\'NPC' });
    }
});

module.exports = router;
