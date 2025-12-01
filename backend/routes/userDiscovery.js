const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const wsNotificationService = require('../services/wsNotificationService');

const parseInviteContext = (raw) => {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.warn('Unable to parse invite context', err);
        return {};
    }
};

const dedupeById = (arr = []) => {
    const seen = new Set();
    return arr.filter(item => {
        if (!item || !item.id) return false;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
};

// GET /api/users/me
// Get current user profile
router.get('/me', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { data, error } = await supabase
            .from('user_profile')
            .select('id, username, name, avatar_url, is_public')
            .eq('id', userId)
            .single();

        if (error) throw error;
        res.json({ user: data });
    } catch (error) {
        console.error('Error fetching me:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/:id/profile
// Profilo utente singolo, accessibile se pubblico, owner o contatto accettato
router.get('/:id/profile', async (req, res) => {
    const requesterId = req.headers['x-user-id'];
    const { id } = req.params;

    console.log('🔍 GET /api/users/:id/profile - requesterId:', requesterId, 'id:', id);

    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });
    if (!id) return res.status(400).json({ error: 'Missing user id' });

    try {
        const { data: profile, error } = await supabase
            .from('user_profile')
            .select('id, username, name, avatar_url, is_public')
            .eq('id', id)
            .single();

        console.log('📦 Profile data:', profile, 'error:', error);

        if (error || !profile) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Access rules
        let allowed = profile.is_public === true || requesterId === id;
        if (!allowed) {
            // Check accepted invites between requester and target
            const { data: invite } = await supabase
                .from('invites')
                .select('id, status')
                .eq('status', 'accepted')
                .or(`sender_id.eq.${requesterId},receiver_id.eq.${requesterId}`)
                .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
                .maybeSingle();
            if (invite) allowed = true;
        }

        if (!allowed) {
            return res.status(403).json({ error: 'Access denied' });
        }

        console.log('✅ Returning profile:', profile);
        res.json({ user: profile });
    } catch (err) {
        console.error('Error fetching user profile by id:', err);
        res.status(500).json({ error: err.message });
    }
});



// GET /api/users/thrillers
// Elenco unificato di utenti pubblici e NPC pubblici (frontend non usa tab)
router.get('/thrillers', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { search, gender, ethnicity, hair_color, eye_color } = req.query;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const searchFilter = search && search.trim() ? `%${search.trim()}%` : null;

        let userQuery = supabase
            .from('user_profile')
            .select('id, username, avatar_url')
            .eq('is_public', true)
            .neq('id', userId);
        if (searchFilter) {
            userQuery = userQuery.ilike('username', searchFilter);
        }

        let npcQuery = supabase
            .from('npcs')
            .select('id, name, avatar_url, user_id, gender, ethnicity, hair_color, eye_color')
            .eq('is_public', true)
            .neq('user_id', userId);

        if (searchFilter) {
            npcQuery = npcQuery.ilike('name', searchFilter);
        }
        if (gender) npcQuery = npcQuery.eq('gender', gender);
        if (ethnicity) npcQuery = npcQuery.eq('ethnicity', ethnicity);
        if (hair_color) npcQuery = npcQuery.eq('hair_color', hair_color);
        if (eye_color) npcQuery = npcQuery.eq('eye_color', eye_color);

        // Stato inviti pendenti inviati dall'utente
        const { data: pendingInvites, error: pendingErr } = await supabase
            .from('invites')
            .select('context, status')
            .eq('sender_id', userId)
            .eq('status', 'pending');
        if (pendingErr) throw pendingErr;

        const pendingSet = new Set();
        (pendingInvites || []).forEach(inv => {
            const ctx = parseInviteContext(inv.context);
            if (ctx.type === 'contact' && ctx.targetType && ctx.targetId) {
                pendingSet.add(`${ctx.targetType}:${ctx.targetId}`);
            }
        });

        // Contatti già accettati (inviti accepted dove l'utente è sender o receiver)
        const { data: acceptedInvites, error: acceptedErr } = await supabase
            .from('invites')
            .select('context, status, sender_id, receiver_id')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .eq('status', 'accepted');
        if (acceptedErr) throw acceptedErr;

        const acceptedUsers = new Set();
        const acceptedNpcs = new Set();
        (acceptedInvites || []).forEach(inv => {
            const ctx = parseInviteContext(inv.context);
            if (ctx.type !== 'contact') return;
            if (ctx.targetType === 'npc' && ctx.targetId) {
                acceptedNpcs.add(ctx.targetId);
            }
            if (ctx.targetType === 'user') {
                const otherUser = inv.sender_id === userId ? inv.receiver_id : inv.sender_id;
                if (otherUser) acceptedUsers.add(otherUser);
            }
        });

        const [userResp, npcResp] = await Promise.all([userQuery, npcQuery]);

        if (userResp.error) throw userResp.error;
        if (npcResp.error) throw npcResp.error;

        const thrillers = [
            ...(userResp.data || []).map(u => {
                const key = `user:${u.id}`;
                const status = acceptedUsers.has(u.id)
                    ? 'accepted'
                    : pendingSet.has(key)
                        ? 'invited'
                        : 'invite';
                return {
                    id: u.id,
                    name: u.username || 'Thriller',
                    avatar: u.avatar_url || null,
                    type: 'user',
                    status
                };
            }),
            ...(npcResp.data || []).map(n => {
                const key = `npc:${n.id}`;
                const status = acceptedNpcs.has(n.id)
                    ? 'accepted'
                    : pendingSet.has(key)
                        ? 'invited'
                        : 'invite';
                return {
                    id: n.id,
                    name: n.name || 'Thriller',
                    avatar: n.avatar_url || null,
                    type: 'npc',
                    ownerId: n.user_id,
                    status
                };
            })
        ];

        res.json({ thrillers });
    } catch (error) {
        console.error('Error fetching thrillers:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/users/invite
// Invia un invito per aggiungere un utente o un NPC ai contatti
router.post('/invite', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { targetId, targetType, message } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!targetId || !targetType) return res.status(400).json({ error: 'targetId e targetType sono obbligatori' });
    if (!['user', 'npc'].includes(targetType)) return res.status(400).json({ error: 'targetType deve essere user o npc' });

    try {
        let receiverId = targetId;
        const context = { type: 'contact', targetType, targetId, message: message || null };

        if (targetType === 'npc') {
            const { data: npc, error: npcErr } = await supabase
                .from('npcs')
                .select('id, user_id, name, avatar_url')
                .eq('id', targetId)
                .single();

            if (npcErr || !npc) return res.status(404).json({ error: 'NPC non trovato' });
            receiverId = npc.user_id;
            context.npcName = npc.name || 'NPC';
            context.npcAvatar = npc.avatar_url || null;
        }

        if (receiverId === userId) {
            return res.status(400).json({ error: 'Non puoi invitare te stesso' });
        }

        // Evita duplicati pendenti verso lo stesso destinatario
        const { data: existing, error: existingErr } = await supabase
            .from('invites')
            .select('id')
            .eq('sender_id', userId)
            .eq('receiver_id', receiverId)
            .eq('status', 'pending')
            .limit(1);

        if (existingErr) throw existingErr;
        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'Hai già un invito in sospeso per questo contatto' });
        }

        const { data: invite, error: inviteErr } = await supabase
            .from('invites')
            .insert({
                sender_id: userId,
                receiver_id: receiverId,
                receiver_type: 'user',
                status: 'pending',
                context: JSON.stringify(context)
            })
            .select()
            .single();

        if (inviteErr) throw inviteErr;

        res.json({ success: true, invite });
    } catch (error) {
        console.error('Error creating contact invite:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/contacts
// Restituisce la lista dei contatti (thrillers) ottenuti da inviti accettati
router.get('/contacts', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { data: invites, error } = await supabase
            .from('invites')
            .select('*')
            .eq('status', 'accepted')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

        if (error) throw error;

        const otherUserIds = new Set();
        const npcIds = new Set();

        (invites || []).forEach(inv => {
            const ctx = parseInviteContext(inv.context);
            if (ctx.type !== 'contact') return;
            const otherUserId = inv.sender_id === userId ? inv.receiver_id : inv.sender_id;

            if (ctx.targetType === 'npc' && ctx.targetId) {
                npcIds.add(ctx.targetId);
            }

            if (ctx.targetType === 'user' && otherUserId) {
                otherUserIds.add(otherUserId);
            }
        });

        const { data: users, error: usersErr } = otherUserIds.size
            ? await supabase
                .from('user_profile')
                .select('id, username, avatar_url')
                .in('id', Array.from(otherUserIds))
            : { data: [], error: null };
        if (usersErr) throw usersErr;

        const { data: invitedNpcs, error: invitedNpcsErr } = npcIds.size
            ? await supabase
                .from('npcs')
                .select('id, name, avatar_url, user_id')
                .in('id', Array.from(npcIds))
            : { data: [], error: null };
        if (invitedNpcsErr) throw invitedNpcsErr;

        // Only include NPCs that were explicitly invited (invitedNpcs), NOT all NPCs owned by connected users.
        const allNpcs = dedupeById([...(invitedNpcs || [])]).filter(n => n.user_id !== userId);

        const contacts = [
            ...(users || []).map(u => ({
                id: u.id,
                type: 'user',
                name: u.username || 'Thriller',
                avatar: u.avatar_url || null
            })),
            ...allNpcs.map(n => ({
                id: n.id,
                type: 'npc',
                name: n.name || 'Thriller',
                avatar: n.avatar_url || null,
                ownerId: n.user_id
            }))
        ];

        res.json({ contacts });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/invites/pending
// Inviti in sospeso per l'utente corrente
router.get('/invites/pending', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { data: invites, error } = await supabase
            .from('invites')
            .select('*')
            .eq('receiver_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const parsed = (invites || []).map(inv => ({
            invite: inv,
            ctx: parseInviteContext(inv.context)
        })).filter(item => item.ctx.type === 'contact');

        const senderIds = [...new Set(parsed.map(i => i.invite.sender_id).filter(Boolean))];
        const npcIds = [];

        parsed.forEach(item => {
            if (item.ctx.targetType === 'npc' && item.ctx.targetId) npcIds.push(item.ctx.targetId);
        });

        const [{ data: senderProfiles }, { data: npcData }] = await Promise.all([
            senderIds.length
                ? supabase.from('user_profile').select('id, username, avatar_url').in('id', senderIds)
                : Promise.resolve({ data: [] }),
            npcIds.length
                ? supabase.from('npcs').select('id, name, avatar_url').in('id', npcIds)
                : Promise.resolve({ data: [] })
        ]);

        const senderMap = {};
        (senderProfiles || []).forEach(p => {
            senderMap[p.id] = p;
        });

        const npcMap = {};
        (npcData || []).forEach(n => {
            npcMap[n.id] = n;
        });

        const payload = parsed.map(({ invite: inv, ctx }) => {
            const senderProfile = senderMap[inv.sender_id] || {};
            const npcInfo = ctx.targetType === 'npc' && ctx.targetId ? npcMap[ctx.targetId] : null;

            return {
                id: inv.id,
                status: inv.status,
                targetType: ctx.targetType || 'user',
                targetId: ctx.targetId || null,
                targetName: ctx.targetType === 'npc'
                    ? (ctx.npcName || npcInfo?.name || 'NPC')
                    : (ctx.targetName || 'Utente'),
                message: ctx.message || null,
                senderId: inv.sender_id,
                senderName: senderProfile.username || 'Utente',
                senderAvatar: senderProfile.avatar_url || null,
                createdAt: inv.created_at
            };
        });

        res.json({ invites: payload });
    } catch (error) {
        console.error('Error fetching pending invites:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/users/invites/:id/respond
// Accetta o rifiuta un invito
router.post('/invites/:id/respond', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    const { accept } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (typeof accept !== 'boolean') {
        return res.status(400).json({ error: 'Campo accept è obbligatorio' });
    }

    try {
        const { data: invite, error } = await supabase
            .from('invites')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !invite) {
            return res.status(404).json({ error: 'Invito non trovato' });
        }

        if (invite.receiver_id !== userId) {
            return res.status(403).json({ error: 'Non puoi gestire questo invito' });
        }

        if (invite.status !== 'pending') {
            return res.status(400).json({ error: 'Questo invito è già stato gestito' });
        }

        const nextStatus = accept ? 'accepted' : 'rejected';
        const { error: updateErr } = await supabase
            .from('invites')
            .update({ status: nextStatus })
            .eq('id', id);

        if (updateErr) throw updateErr;

        if (accept) {
            const ctx = parseInviteContext(invite.context);
            if (ctx.targetType === 'npc' && ctx.targetId) {
                // Aggiunge l'NPC ai preferiti del mittente (best-effort)
                try {
                    // Insert into contacts (New System)
                    await supabase.from('contacts').upsert({
                        owner_user_id: invite.sender_id,
                        target_id: ctx.targetId,
                        target_type: 'npc'
                    }, { onConflict: 'owner_user_id, target_id' });

                    // Legacy favorites
                    const { data: existing } = await supabase
                        .from('user_favorites')
                        .select('id')
                        .eq('user_id', invite.sender_id)
                        .eq('npc_id', ctx.targetId)
                        .limit(1);

                    if (!existing || existing.length === 0) {
                        const { error: favErr } = await supabase
                            .from('user_favorites')
                            .insert({ user_id: invite.sender_id, npc_id: ctx.targetId });

                        if (favErr && !favErr.message?.includes('duplicate')) {
                            console.warn('Impossibile aggiungere ai preferiti:', favErr);
                        }
                    }
                } catch (favErr) {
                    console.warn('user_favorites/contacts insert failed:', favErr);
                }
            } else if (ctx.targetType === 'user' && ctx.targetId) {
                // User-to-User contact
                try {
                    // Sender adds Receiver
                    await supabase.from('contacts').upsert({
                        owner_user_id: invite.sender_id,
                        target_id: ctx.targetId, // Receiver
                        target_type: 'user'
                    }, { onConflict: 'owner_user_id, target_id' });

                    // Receiver adds Sender
                    await supabase.from('contacts').upsert({
                        owner_user_id: invite.receiver_id,
                        target_id: invite.sender_id,
                        target_type: 'user'
                    }, { onConflict: 'owner_user_id, target_id' });
                } catch (contactErr) {
                    console.warn('contacts insert failed:', contactErr);
                }
            }

            // Notifica al mittente che l'invito è stato accettato
            try {
                const { data: receiverProfile } = await supabase
                    .from('user_profile')
                    .select('id, username, avatar_url')
                    .eq('id', userId)
                    .single();

                wsNotificationService.sendNotification(invite.sender_id, {
                    notificationType: 'contact_invite',
                    status: 'accepted',
                    receiverId: userId,
                    receiverName: receiverProfile?.username || 'Thriller',
                    receiverAvatar: receiverProfile?.avatar_url || null,
                    targetType: ctx.targetType,
                    targetId: ctx.targetId,
                    message: `${receiverProfile?.username || 'Un utente'} ha accettato il tuo invito`,
                    timestamp: new Date().toISOString(),
                });
            } catch (notifyErr) {
                console.warn('Unable to send acceptance notification:', notifyErr?.message || notifyErr);
            }
        }

        res.json({ success: true, status: nextStatus });
    } catch (error) {
        console.error('Error responding to invite:', error);
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
            .from('user_profile')
            .select('id, username, avatar_url, is_public')
            .neq('id', userId);

        if (search) {
            query = query.ilike('username', `%${search}%`);
        }

        // Prefer filter on is_public if column exists; fallback otherwise
        let data;
        let error;
        ({ data, error } = await query.eq('is_public', true).limit(50));
        if (error && error.code === '42703') {
            // Column is_public missing: retry without filter
            ({ data, error } = await supabase
                .from('user_profile')
                .select('id, username, avatar_url')
                .neq('id', userId)
                .ilike(search ? 'username' : 'id', search ? `%${search}%` : '%')
                .limit(50));
        }
        if (error) throw error;

        const publicUsers = (data || []).map(u => ({
            id: u.id,
            name: u.username || 'User',
            avatar: u.avatar_url || null
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
            .from('user_profile')
            .update({ is_public: isPublic })
            .eq('id', userId);

        if (error) throw error;

        res.json({ success: true, isPublic });
    } catch (error) {
        console.error('Error updating privacy:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/users/settings/profile
// Update user display name and optionally searchability
router.put('/settings/profile', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { displayName, isPublic } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!displayName || !displayName.trim()) return res.status(400).json({ error: 'displayName is required' });

    try {
        const profilePayload = {
            id: userId,
            username: displayName.trim(),
            name: displayName.trim()
        };
        if (typeof isPublic === 'boolean') {
            profilePayload.is_public = isPublic;
        }

        const { error: profileErr } = await supabase
            .from('user_profile')
            .upsert(profilePayload);
        if (profileErr) throw profileErr;

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating profile settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/users/settings/avatar
// Update user avatar
router.put('/settings/avatar', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { imageBase64 } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    try {
        const buffer = Buffer.from(imageBase64, 'base64');
        const filename = `${userId}_${Date.now()}.png`;

        // Upload to 'avatars' bucket using Supabase Storage directly (or via service if available)
        // We'll use the supabase client directly here for simplicity as we have it imported
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filename, buffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filename);

        // Update user profile
        const { error: updateErr } = await supabase
            .from('user_profile')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);

        if (updateErr) throw updateErr;

        res.json({ success: true, avatarUrl: publicUrl });
    } catch (error) {
        console.error('Error updating avatar:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/girlfriends/:id/privacy (legacy) + /api/npcs/:id/privacy
const updateNpcPrivacy = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    const { isPublic } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { error } = await supabase
            .from('npcs')
            .update({ is_public: isPublic })
            .eq('id', id)
            .eq('user_id', userId); // Ensure ownership

        if (error) throw error;

        res.json({ success: true, isPublic });
    } catch (error) {
        console.error('Error updating girlfriend privacy:', error);
        res.status(500).json({ error: error.message });
    }
};

router.put('/girlfriends/:id/privacy', updateNpcPrivacy); // legacy
router.put('/npcs/:id/privacy', updateNpcPrivacy);

module.exports = router;
