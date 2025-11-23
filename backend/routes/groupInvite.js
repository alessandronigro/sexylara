// ===============================================================
// API ROUTES PER GESTIONE INVITI AI GRUPPI
// ===============================================================
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// ===============================================================
// POST /api/group/invite
// Invia un invito a un utente o AI per unirsi a un gruppo
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

  try {
    // Verifica che l'utente abbia i permessi per invitare
    const { data: membership, error: memberErr } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('member_id', invitedBy)
      .eq('member_type', 'user')
      .single();

    if (memberErr || !membership) {
      // Verifica se è il proprietario del gruppo
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .select('user_id')
        .eq('id', groupId)
        .single();

      if (groupErr || group.user_id !== invitedBy) {
        return res.status(403).json({ 
          error: 'You do not have permission to invite members to this group' 
        });
      }
    } else if (membership.role !== 'owner' && membership.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Only owners and admins can invite members' 
      });
    }

    // Verifica che l'invitato non sia già nel gruppo
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('member_id', invitedId)
      .eq('member_type', invitedType)
      .single();

    if (existingMember) {
      return res.status(400).json({ 
        error: 'This member is already in the group' 
      });
    }

    // Crea l'invito
    const { data: invite, error: inviteErr } = await supabase
      .from('group_invites')
      .insert({
        group_id: groupId,
        invited_id: invitedId,
        invited_type: invitedType,
        invited_by: invitedBy,
        message: message || null
      })
      .select()
      .single();

    if (inviteErr) throw inviteErr;

    // Se l'invitato è un AI, accetta automaticamente
    if (invitedType === 'ai') {
      await acceptInvite(invite.id);
      return res.json({ 
        success: true, 
        invite, 
        autoAccepted: true,
        message: 'AI contact added to group automatically' 
      });
    }

    // TODO: Invia notifica push all'utente invitato
    res.json({ success: true, invite });

  } catch (error) {
    console.error('Error creating invite:', error);
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
    const { data: invites, error } = await supabase
      .from('group_invites')
      .select(`
        *,
        groups (
          id,
          name,
          created_at
        )
      `)
      .eq('invited_id', userId)
      .eq('invited_type', 'user')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ invites });
  } catch (error) {
    console.error('Error fetching pending invites:', error);
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
  const { error: memberErr } = await supabase
    .from('group_members')
    .insert({
      group_id: invite.group_id,
      member_id: invite.invited_id,
      member_type: invite.invited_type,
      role: 'member'
    });

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

  // Se è un AI, inizializza la memoria
  if (invite.invited_type === 'ai') {
    await initializeAiInGroup(invite.invited_id, invite.group_id);
  }
}

// ===============================================================
// HELPER FUNCTION: Inizializza un AI nel gruppo
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

  console.log(`✅ AI ${aiId} inizializzato nel gruppo ${groupId}`);
}

module.exports = router;
