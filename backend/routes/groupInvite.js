// ===============================================================
// API ROUTES PER GESTIONE INVITI AI GRUPPI
// ===============================================================
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { checkPermission } = require('../middleware/permissions');

// ===============================================================
// GET /api/group/discover/users
// Elenco utenti invitabili in base alle impostazioni di privacy (is_public = true)
// search opzionale per filtrare per email/username/name
// ===============================================================
router.get('/group/discover/users', async (req, res) => {
  const requesterId = req.headers['x-user-id'];
  const { search } = req.query;
  if (!requesterId) return res.status(401).json({ error: 'User not authenticated' });

  try {
    let query = supabase
      .from('user_profile')
      .select('id, username, avatar_url, is_public')
      .eq('is_public', true)
      .neq('id', requesterId)
      .limit(50);

    if (search && search.trim()) {
      query = query.ilike('username', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const users = (data || []).map(u => ({
      id: u.id,
      name: u.username || 'Utente',
      avatar: u.avatar_url || null
    }));

    res.json({ users });
  } catch (err) {
    console.error('Error discovering users:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================================================
// GET /api/group/discover/npcs
// Elenco NPC invitabili (is_public = true)
// search opzionale per filtrare per nome
// ===============================================================
router.get('/group/discover/npcs', async (req, res) => {
  const requesterId = req.headers['x-user-id'];
  const { search } = req.query;
  if (!requesterId) return res.status(401).json({ error: 'User not authenticated' });

  try {
    let query = supabase
      .from('npcs')
      .select('id, name, avatar_url, is_public')
      .eq('is_public', true)
      .limit(50);

    if (search && search.trim()) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const npcs = (data || []).map(n => ({
      id: n.id,
      name: n.name || 'NPC',
      avatar: n.avatar_url || null
    }));

    res.json({ npcs });
  } catch (err) {
    console.error('Error discovering NPCs:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================================================
// POST /api/group/invite
// Invia un invito a un utente o NPC per unirsi a un gruppo
// ===============================================================
router.post('/group/invite', async (req, res) => {
  const { groupId, invitedId, invitedType, message } = req.body;
  const invitedBy = req.headers['x-user-id'];

  if (!invitedBy) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!groupId || !invitedId || !invitedType) {
    return res.status(400).json({
      error: 'Missing required fields: groupId, invitedId, invitedType'
    });
  }

  // Validate invitedType (support both 'ai' and 'npc' for backward compatibility)
  if (!['npc', 'user', 'ai'].includes(invitedType)) {
    return res.status(400).json({ error: 'Invalid invitedType. Must be "npc", "user", or "ai"' });
  }

  // Normalize: accept 'npc' from client but DB enum uses 'ai'
  const normalizedType = invitedType === 'ai' ? 'npc' : invitedType;
  const dbMemberType = normalizedType === 'npc' ? 'ai' : normalizedType;

  try {
    // Check permissions using middleware logic (owner always has permission)
    const action = normalizedType === 'npc' ? 'invite_npc' : 'invite_user';
    console.log(`[POST /api/group/invite] Checking permission for userId=${invitedBy}, groupId=${groupId}, action=${action}`);
    const hasPermission = await checkPermission(invitedBy, groupId, action);
    console.log(`[POST /api/group/invite] Permission check result: ${hasPermission}`);

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions. Only group owners and admins can invite members.'
      });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('member_id', invitedId)
      .eq('member_type', dbMemberType)
      .single();

    if (existingMember) {
      return res.status(409).json({
        error: normalizedType === 'npc' ? 'NPC already in group' : 'User already in group'
      });
    }

    // NPC-specific handling
    if (normalizedType === 'npc') {
      // Validate NPC exists and belongs to inviter
      const { data: npc, error: npcError } = await supabase
        .from('npcs')
        .select('id, user_id, name')
        .eq('id', invitedId)
        .single();

      if (npcError || !npc) {
        return res.status(404).json({ error: 'NPC not found' });
      }

      if (npc.user_id !== invitedBy) {
        return res.status(403).json({ error: 'You can only invite your own NPCs to groups' });
      }

      // Add NPC directly to group (no pending invite)
      const { error: memberErr } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          member_id: invitedId,
          member_type: dbMemberType, // 'ai' for NPCs in DB enum
          npc_id: invitedId,
          role: 'member'
        });

      if (memberErr) {
        console.error('Error adding NPC to group:', memberErr);
        throw memberErr;
      }

      // Initialize NPC in group
      await initializeAiInGroup(invitedId, groupId);

      return res.json({
        success: true,
        added: 'npc',
        npcId: invitedId,
        npcName: npc.name
      });
    }


    // Create pending invite for NPC (auto-accepted)

    // Create pending invite
    const { data: invite, error: inviteErr } = await supabase
      .from('group_invites')
      .insert({
        group_id: groupId,
        invited_id: invitedId,
        invited_type: 'user',
        invited_by: invitedBy,
        message: message || null,
        status: 'pending'
      })
      .select()
      .single();

    if (inviteErr) throw inviteErr;

    // TODO: Send push notification to invited user

    res.json({
      success: true,
      invited: 'user',
      userId: invitedId,
      status: 'pending',
      inviteId: invite.id
    });

  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// POST /api/group/invite/user
// Frontend-compatible endpoint for inviting users
// ===============================================================
router.post('/group/invite/user', async (req, res) => {
  const { groupId, receiverId } = req.body;
  const senderId = req.headers['x-user-id'];

  if (!senderId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!groupId || !receiverId) {
    return res.status(400).json({ error: 'Missing groupId or receiverId' });
  }

  try {
    // Check permissions
    console.log(`[POST /api/group/invite/user] Checking permission for userId=${senderId}, groupId=${groupId}, action=invite_user`);
    const hasPermission = await checkPermission(senderId, groupId, 'invite_user');
    console.log(`[POST /api/group/invite/user] Permission check result: ${hasPermission}`);

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions. Only group owners and admins can invite users.'
      });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('member_id', receiverId)
      .eq('member_type', 'user')
      .single();

    if (existingMember) {
      return res.status(409).json({ error: 'already_in_group', code: 'USER_ALREADY_MEMBER' });
    }


    // Check for existing invite (comprehensive check below handles all cases)

    // Check for existing invite
    const { data: existingInvite } = await supabase
      .from('group_invites')
      .select('*')
      .eq('group_id', groupId)
      .eq('invited_id', receiverId)
      .eq('invited_type', 'user')
      .single();

    let invite;

    if (existingInvite) {
      if (existingInvite.status === 'pending') {
        return res.status(409).json({
          error: 'already_invited',
          code: 'INVITE_ALREADY_PENDING',
          message: 'Questo utente ha già un invito pendente per questo gruppo'
        });
      }

      if (existingInvite.status === 'declined') {
        // Update existing declined invite to pending
        const { data: updatedInvite, error: updateErr } = await supabase
          .from('group_invites')
          .update({
            status: 'pending',
            invited_by: senderId,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingInvite.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        invite = updatedInvite;
      } else if (existingInvite.status === 'accepted') {
        return res.status(409).json({
          error: 'User already in group',
          message: 'Questo utente è già membro del gruppo'
        });
      }
    } else {
      // Create new invite
      const { data: newInvite, error: inviteErr } = await supabase
        .from('group_invites')
        .insert({
          group_id: groupId,
          invited_id: receiverId,
          invited_type: 'user',
          invited_by: senderId,
          status: 'pending'
        })
        .select()
        .single();

      if (inviteErr) throw inviteErr;
      invite = newInvite;
    }

    // Send WebSocket notification to invited user
    const wsNotificationService = require('../services/wsNotificationService');
    const { data: group } = await supabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .single();

    const { data: inviterProfile } = await supabase
      .from('user_profile')
      .select('username')
      .eq('id', senderId)
      .single();

    wsNotificationService.sendInviteNotification(receiverId, {
      id: invite.id,
      group_id: groupId,
      groupName: group?.name || 'un gruppo',
      senderName: inviterProfile?.username || 'Un utente'
    });

    res.json({
      success: true,
      invited: 'user',
      userId: receiverId,
      status: 'pending',
      inviteId: invite.id,
      wasReInvite: !!existingInvite
    });

  } catch (error) {
    console.error('Error inviting user:', error);

    // Handle duplicate invite
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Invite already exists',
        message: 'Questo utente è già stato invitato a questo gruppo'
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// POST /api/group/invite/npc
// Frontend-compatible endpoint for inviting NPCs
// ===============================================================
router.post('/group/invite/npc', async (req, res) => {
  const { groupId, npcId } = req.body;
  const senderId = req.headers['x-user-id'];

  if (!senderId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Check permissions
    const action = 'invite_npc';
    console.log(`[POST /api/group/invite/npc] Checking permission for userId=${senderId}, groupId=${groupId}, action=${action}`);
    const hasPermission = await checkPermission(senderId, groupId, action);
    console.log(`[POST /api/group/invite/npc] Permission check result: ${hasPermission}`);

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions. Only group owners and admins can invite NPCs.'
      });
    }

    // Validate NPC exists and belongs to inviter
    const { data: npc, error: npcError } = await supabase
      .from('npcs')
      .select('id, user_id, name')
      .eq('id', npcId)
      .single();

    if (npcError || !npc) {
      return res.status(404).json({ error: 'NPC not found', code: 'NPC_NOT_FOUND' });
    }

    if (npc.user_id !== senderId) {
      return res.status(403).json({ error: 'forbidden', code: 'NPC_NOT_OWNED' });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('member_id', npcId)
      .in('member_type', ['ai', 'npc']) // accept legacy rows
      .single();

    if (existingMember) {
      return res.status(409).json({ error: 'already_in_group', code: 'NPC_ALREADY_MEMBER' });
    }

    // Add NPC directly to group
    const { error: memberErr } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        member_id: npcId,
        member_type: 'ai', // enum expects 'ai' for NPCs
        npc_id: npcId,
        role: 'member'
      });

    if (memberErr) {
      console.error('Error adding NPC to group:', memberErr);
      throw memberErr;
    }

    // Initialize NPC in group
    await initializeAiInGroup(npcId, groupId);

    return res.json({
      success: true,
      added: 'npc',
      npcId: npcId,
      npcName: npc.name
    });

  } catch (error) {
    console.error('Error inviting NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// POST /api/group/invite/respond
// Frontend-compatible endpoint for responding to invites
// ===============================================================
router.post('/group/invite/respond', async (req, res) => {
  const { inviteId, accept } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    if (accept) {
      // Get invite details before accepting
      const { data: invite } = await supabase
        .from('group_invites')
        .select('*, groups(name)')
        .eq('id', inviteId)
        .single();

      await acceptInvite(inviteId, userId);

      // Send notification to the user who sent the invite
      if (invite && invite.invited_by) {
        const wsNotificationService = require('../services/wsNotificationService');
        const { data: acceptingUser } = await supabase
          .from('user_profile')
          .select('username')
          .eq('id', userId)
          .single();

        wsNotificationService.sendGroupUpdateNotification(invite.invited_by, {
          groupId: invite.group_id,
          type: 'invite_accepted',
          message: `${acceptingUser?.username || 'Un utente'} ha accettato il tuo invito a ${invite.groups?.name || 'il gruppo'}`,
          acceptedBy: userId,
          acceptedByName: acceptingUser?.username
        });
      }

      res.json({ success: true, message: 'Invite accepted' });
    } else {
      // Decline logic
      const { data: invite, error: fetchErr } = await supabase
        .from('group_invites')
        .select('*')
        .eq('id', inviteId)
        .eq('invited_id', userId)
        .eq('invited_type', 'user')
        .single();

      if (fetchErr || !invite) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      const { error: updateErr } = await supabase
        .from('group_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId);

      if (updateErr) throw updateErr;

      res.json({ success: true, message: 'Invite declined' });
    }
  } catch (error) {
    console.error('Error responding to invite:', error);
    res.status(500).json({ error: error.message });
  }
});


// ===============================================================
// POST /api/group/invite/accept
// Accetta un invito a un gruppo
// ===============================================================
router.post('/group/invite/accept', async (req, res) => {
  const { inviteId } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    await acceptInvite(inviteId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// POST /api/group/invite/decline
// Rifiuta un invito a un gruppo
// ===============================================================
router.post('/group/invite/decline', async (req, res) => {
  const { inviteId } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Verifica che l'invito appartenga all'utente
    const { data: invite, error: fetchErr } = await supabase
      .from('group_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('invited_id', userId)
      .eq('invited_type', 'user')
      .single();

    if (fetchErr || !invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Aggiorna lo stato
    const { error: updateErr } = await supabase
      .from('group_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);

    if (updateErr) throw updateErr;

    res.json({ success: true });
  } catch (error) {
    console.error('Error declining invite:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// GET /api/group/invites/pending
// Ottiene tutti gli inviti pendenti per l'utente corrente
// ===============================================================
router.get('/group/invites/pending', async (req, res) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Fetch invites
    const { data: invites, error } = await supabase
      .from('group_invites')
      .select('*')
      .eq('invited_id', userId)
      .eq('invited_type', 'user')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch group details for each invite
    if (invites && invites.length > 0) {
      const groupIds = [...new Set(invites.map(inv => inv.group_id))];
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, created_at')
        .in('id', groupIds);

      // Map groups to invites
      const groupMap = (groups || []).reduce((acc, g) => {
        acc[g.id] = g;
        return acc;
      }, {});

      const enrichedInvites = invites.map(inv => ({
        ...inv,
        groups: groupMap[inv.group_id] || null
      }));

      return res.json({ invites: enrichedInvites });
    }

    res.json({ invites: [] });
  } catch (error) {
    console.error('Error fetching pending invites:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// GET /api/groups/:groupId/invites
// Ottiene gli inviti pendenti (outgoing) per un gruppo specifico
// ===============================================================
router.get('/groups/:groupId/invites', async (req, res) => {
  const { groupId } = req.params;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Check permissions (member or owner)
    const hasPermission = await checkPermission(userId, groupId, 'view_group');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: invites, error } = await supabase
      .from('group_invites')
      .select('invited_id')
      .eq('group_id', groupId)
      .eq('status', 'pending');

    if (error) throw error;

    res.json({ invites: invites || [] });
  } catch (error) {
    console.error('Error fetching group outgoing invites:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// HELPER FUNCTION: Accetta un invito
// ===============================================================
async function acceptInvite(inviteId, userId = null) {
  // Recupera l'invito
  const { data: invite, error: fetchErr } = await supabase
    .from('group_invites')
    .select('*')
    .eq('id', inviteId)
    .single();

  if (fetchErr || !invite) {
    throw new Error('Invite not found');
  }

  // Se userId è fornito, verifica che corrisponda
  if (userId && invite.invited_type === 'user' && invite.invited_id !== userId) {
    throw new Error('This invite does not belong to you');
  }

  // Aggiungi al gruppo
  const memberData = {
    group_id: invite.group_id,
    member_id: invite.invited_id,
    member_type: invite.invited_type === 'npc' ? 'ai' : invite.invited_type,
    role: 'member'
  };

  // Set npc_id ONLY for ai/npc types
  if (invite.invited_type === 'ai' || invite.invited_type === 'npc') {
    memberData.npc_id = invite.invited_id;
  }
  // For user type, npc_id will be NULL (which should be allowed after schema migration)

  const { error: memberErr } = await supabase
    .from('group_members')
    .insert(memberData);

  if (memberErr) {
    // Se l'errore è per duplicato, ignora
    if (!memberErr.message.includes('duplicate')) {
      throw memberErr;
    }
  }

  // Aggiorna lo stato dell'invito
  const { error: updateErr } = await supabase
    .from('group_invites')
    .update({ status: 'accepted' })
    .eq('id', inviteId);

  if (updateErr) throw updateErr;

  // Se è un AI/NPC, inizializza la memoria
  if (invite.invited_type === 'ai' || invite.invited_type === 'npc') {
    await initializeAiInGroup(invite.invited_id, invite.group_id);
  }
}

// ===============================================================
// HELPER FUNCTION: Inizializza un AI/NPC nel gruppo
// ===============================================================
async function initializeAiInGroup(aiId, groupId) {
  // Verifica se esiste già una memoria di gruppo
  const { data: existingMemory } = await supabase
    .from('group_memory')
    .select('*')
    .eq('group_id', groupId)
    .single();

  if (!existingMemory) {
    // Crea memoria di gruppo base
    await supabase
      .from('group_memory')
      .insert({
        group_id: groupId,
        summary: 'Il gruppo è stato creato.',
        dynamics: {
          topics: [],
          mood: 'neutro',
          relationships: {}
        }
      });
  }

  console.log(`✅ AI/NPC ${aiId} inizializzato nel gruppo ${groupId}`);
}

module.exports = router;
