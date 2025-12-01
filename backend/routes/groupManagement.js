const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { requireGroupPermission, checkPermission } = require('../middleware/permissions');
const SocialEngine = require('../ai/engines/SocialEngine');
const PersonaEngine = require('../ai/engines/PersonaEngine');
const wsNotificationService = require('../services/wsNotificationService'); // New notification service

// POST /group/invite/user
// Invita un utente reale
router.post('/invite/user', requireGroupPermission('invite_user'), async (req, res) => {
    const { groupId, senderId, receiverId } = req.body;

    try {
        // Crea invito pending su group_invites
        const { data, error } = await supabase
            .from('group_invites')
            .insert({
                group_id: groupId,
                invited_by: senderId,
                invited_id: receiverId,
                invited_type: 'user',
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // ✅ Send WebSocket notification to the invited user
        const inviteData = {
            id: data.id,
            group_id: groupId,
            groupName: data.group_name || 'Gruppo', // fallback if not present
            senderName: data.sender_name || 'Admin',
        };
        wsNotificationService.sendInviteNotification(receiverId, inviteData);

        res.json({ success: true, invite: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /group/invite/npc
// Invita un NPC
router.post('/invite/npc', requireGroupPermission('invite_npc'), async (req, res) => {
    const { groupId, senderId, npcId } = req.body;

    try {
        // 1. Recupera dati NPC e Gruppo
        const { data: npc } = await supabase.from('npcs').select('*').eq('id', npcId).single();
        const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single();
        const { data: sender } = await supabase.from('user_profile').select('*').eq('id', senderId).single();
        const { data: members } = await supabase.from('group_members').select('*').eq('group_id', groupId);

        if (!npc || !group) return res.status(404).json({ error: 'NPC or Group not found' });

        // 2. Chiedi all'NPC (SocialEngine)
        // Prima validiamo la persona per avere i tratti
        const validatedNpc = PersonaEngine.validatePersona(npc);
        const decision = SocialEngine.decideInvite(validatedNpc, group, sender, members || []);

        if (decision.needsOwnerApproval) {
            // Crea invito pending per l'owner dell'NPC
            await supabase.from('invites').insert({
                group_id: groupId,
                sender_id: senderId,
                receiver_id: npc.owner_id, // Notifica l'owner
                receiver_type: 'user', // È l'owner che riceve la notifica
                context: `Request to add NPC ${npc.name} to group ${group.name}`,
                status: 'pending'
            });
            // Notify owner about pending invite
            wsNotificationService.sendInviteNotification(npc.owner_id, {
                id: null, // placeholder, real ID could be fetched if needed
                group_id: groupId,
                groupName: group.name,
                senderName: sender.name || 'Admin',
            });
            return res.json({ status: 'pending_approval', reason: decision.reason });
        }

        if (decision.accept) {
            // Aggiungi direttamente al gruppo
            await supabase.from('group_members').insert({
                group_id: groupId,
                member_id: npcId,
                member_type: 'npc',
                role: 'member'
            });
            // Notify all group members about new NPC addition
            const { data: groupMembers } = await supabase.from('group_members').select('member_id').eq('group_id', groupId);
            const memberIds = groupMembers.map(m => m.member_id);
            wsNotificationService.broadcastToGroup(memberIds, {
                notificationType: 'group_update',
                groupId,
                type: 'member_added',
                message: `${npc.name} è stato aggiunto al gruppo ${group.name}`,
            });
            return res.json({ status: 'accepted', reason: decision.reason });
        } else {
            return res.json({ status: 'rejected', reason: decision.reason });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /group/invite/respond
// Accetta/Rifiuta invito (per utenti reali)
router.post('/invite/respond', async (req, res) => {
    const { inviteId, userId, accept } = req.body;

    try {
        const { data: invite } = await supabase.from('group_invites').select('*').eq('id', inviteId).single();

        if (!invite || invite.invited_id !== userId) {
            return res.status(403).json({ error: 'Invalid invite' });
        }

        if (accept) {
            // Aggiungi ai membri
            await supabase.from('group_members').insert({
                group_id: invite.group_id,
                member_id: userId,
                member_type: 'user',
                role: 'member'
            });

            await supabase.from('group_invites').update({ status: 'accepted' }).eq('id', inviteId);
            // Notify group about new member
            const { data: groupMembers } = await supabase.from('group_members').select('member_id').eq('group_id', invite.group_id);
            const memberIds = groupMembers.map(m => m.member_id);
            wsNotificationService.broadcastToGroup(memberIds, {
                notificationType: 'group_update',
                groupId: invite.group_id,
                type: 'member_added',
                message: `Un nuovo membro è entrato nel gruppo`,
            });
        } else {
            await supabase.from('group_invites').update({ status: 'declined' }).eq('id', inviteId);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
