// routes/group.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const storageService = require('../services/supabase-storage');

// Create a new group with a name and initial members (npc IDs)
router.post('/groups', async (req, res) => {
    const { name, memberIds } = req.body; // memberIds: array of npc IDs
    const userId = req.headers['x-user-id']; // assume user ID passed in header after auth
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    if (!name) return res.status(400).json({ error: 'Group name required' });
    try {
        const { data: group, error: grpErr } = await supabase
            .from('groups')
            .insert({ name, user_id: userId })
            .select()
            .single();
        if (grpErr) throw grpErr;
        if (!group || !group.id) {
            throw new Error('Group creation failed: no ID returned');
        }
        // Inserisce l'owner anche in group_members (così compare sempre tra i membri)
        const ownerRow = {
            group_id: group.id,
            member_id: userId,
            member_type: 'user',
            npc_id: null,
            role: 'owner'
        };

        // Inserisce eventuali NPC iniziali
        const npcRows = Array.isArray(memberIds)
            ? memberIds.map(id => ({
                group_id: group.id,
                member_id: id,
                member_type: 'ai', // DB enum expects 'ai' for NPCs
                npc_id: id,
                role: 'member'
            }))
            : [];

        const rowsToInsert = [ownerRow, ...npcRows].filter(Boolean);
        if (rowsToInsert.length) {
            const { error: memErr } = await supabase.from('group_members').insert(rowsToInsert);
            if (memErr) throw memErr;
        }

        res.json({ success: true, group });
    } catch (e) {
        console.error('Error creating group:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get all groups belonging to the authenticated user (owned + joined)
router.get('/groups', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    try {
        // Get owned groups
        const { data: ownedGroups, error: ownedErr } = await supabase
            .from('groups')
            .select('id, name, created_at, user_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (ownedErr) throw ownedErr;

        // Get joined groups (where user is a member)
        const { data: memberRows, error: memberErr } = await supabase
            .from('group_members')
            .select('group_id, groups(id, name, created_at, user_id)')
            .eq('member_id', userId)
            .eq('member_type', 'user');

        if (memberErr) throw memberErr;

        // Mark owned groups
        const owned = (ownedGroups || []).map(g => ({
            ...g,
            isOwner: true
        }));

        // Mark joined groups
        const joined = (memberRows || [])
            .filter(m => m.groups) // Filter out null groups
            .map(m => ({
                ...m.groups,
                isOwner: false
            }));

        // Combine all groups
        const allGroups = [...owned, ...joined];

        res.json({
            groups: allGroups,
            ownedGroups: owned,
            joinedGroups: joined
        });
    } catch (e) {
        console.error('Error fetching groups:', e);
        res.status(500).json({ error: e.message });
    }
});

// Delete a group (and cascade delete members & messages)
router.delete('/groups/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    try {
        // Verify ownership
        const { data: grp, error: fetchErr } = await supabase
            .from('groups')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!grp) return res.status(404).json({ error: 'Group not found or access denied' });

        // Delete group messages (including media files)
        const { data: msgs, error: msgsErr } = await supabase
            .from('group_messages')
            .select('id, type, content')
            .eq('group_id', id);
        if (msgsErr) throw msgsErr;
        for (const m of msgs) {
            if (m.type !== 'text' && m.content?.startsWith('http')) {
                await storageService.delete(m.content);
            }
        }
        await supabase.from('group_messages').delete().eq('group_id', id);

        // Delete members
        await supabase.from('group_members').delete().eq('group_id', id);

        // Delete the group itself
        const { error: delErr } = await supabase.from('groups').delete().eq('id', id);
        if (delErr) throw delErr;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting group:', e);
        res.status(500).json({ error: e.message });
    }
});

// Leave a group (remove self from membership)
router.post('/groups/:id/leave', async (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // Check if user is the owner
        const { data: group, error: groupErr } = await supabase
            .from('groups')
            .select('user_id')
            .eq('id', id)
            .single();

        if (groupErr && groupErr.code !== 'PGRST116') { // PGRST116 = not found
            throw groupErr;
        }

        if (group && group.user_id === userId) {
            return res.status(403).json({
                error: 'Cannot leave a group you own. Delete the group instead.'
            });
        }

        // Remove user from group_members
        const { error: deleteErr } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', id)
            .eq('member_id', userId)
            .eq('member_type', 'user');

        if (deleteErr) throw deleteErr;

        res.json({ success: true, message: 'Successfully left the group' });
    } catch (e) {
        console.error('Error leaving group:', e);
        res.status(500).json({ error: e.message });
    }
});

// Add or remove members (user or npc) from a group
router.post('/groups/:id/members', async (req, res) => {
    const { id } = req.params;
    const { add = [], remove = [] } = req.body; // add/remove: array di { member_id, member_type }
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    try {
        // Verify ownership
        const { data: grp, error: ownErr } = await supabase
            .from('groups')
            .select('id, user_id')
            .eq('id', id)
            .maybeSingle();
        if (ownErr) throw ownErr;
        if (!grp || grp.user_id !== userId) return res.status(404).json({ error: 'Group not found or access denied' });

        // Add members
        if (Array.isArray(add) && add.length) {
            const rows = add
                .map(m => {
                    const incomingType = (m.member_type || m.type || 'npc').toLowerCase();
                    const dbType = incomingType === 'npc' ? 'ai' : incomingType; // enum member_type_enum: user | ai
                    const memberId = m.member_id || m.id;
                    if (!memberId) return null;
                    return {
                        group_id: id,
                        member_id: memberId,
                        member_type: dbType,
                        npc_id: incomingType === 'npc' || incomingType === 'ai' ? memberId : null,
                    };
                })
                .filter(Boolean);
            if (rows.length) {
                const { error: addErr } = await supabase.from('group_members').insert(rows);
                if (addErr) throw addErr;
            }
        }

        // Remove members
        if (Array.isArray(remove) && remove.length) {
            const memberIds = remove.map(m => m.member_id || m.id).filter(Boolean);
            if (memberIds.length) {
                const { error: remErr } = await supabase
                    .from('group_members')
                    .delete()
                    .eq('group_id', id)
                    .in('member_id', memberIds);
                if (remErr) throw remErr;
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('Error updating group members:', e);
        res.status(500).json({ error: e.message });
    }
});

// Post a new message to a group (text or media URL)
router.post('/groups/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { senderId, type = 'text', content } = req.body; // senderId = npc_id
    const userId = req.headers['x-user-id'];
    try {
        // Verify user belongs to the group (owner) or is a member
        const { data: grp, error: grpErr } = await supabase
            .from('groups')
            .select('id, user_id')
            .eq('id', id)
            .maybeSingle();
        if (grpErr) throw grpErr;
        if (!grp) return res.status(404).json({ error: 'Group not found' });
        const isOwner = grp.user_id === userId;
        let isMember = false;
        if (!isOwner) {
            const { data: mem, error: memErr } = await supabase
                .from('group_members')
                .select('npc_id')
                .eq('group_id', id)
                .eq('npc_id', senderId)
                .maybeSingle();
            if (!memErr && mem) isMember = true;
        }
        if (!isOwner && !isMember) {
            return res.status(403).json({ error: 'Not allowed to post in this group' });
        }
        const { data, error } = await supabase.from('group_messages').insert({
            group_id: id,
            sender_id: senderId,
            type,
            content,
        }).single();
        if (error) throw error;
        res.json({ success: true, message: data });
    } catch (e) {
        console.error('Error posting group message:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get messages for a group (paginated)
router.get('/groups/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.headers['x-user-id'];
    try {
        // Verify access (owner or member)
        const { data: grp, error: grpErr } = await supabase
            .from('groups')
            .select('id, user_id')
            .eq('id', id)
            .maybeSingle();
        if (grpErr) throw grpErr;
        if (!grp) return res.status(404).json({ error: 'Group not found' });

        const isOwner = grp.user_id === userId;
        let allowed = isOwner;
        if (!allowed) {
            const { data: mem, error: memErr } = await supabase
                .from('group_members')
                .select('member_id') // Changed from npc_id to member_id
                .eq('group_id', id)
                .eq('member_id', userId); // Check if user is a member

            if (!memErr && mem && mem.length) allowed = true;
        }

        // If still not allowed, check if user is invited (optional, but strict for now)
        if (!allowed) return res.status(403).json({ error: 'Access denied' });

        // 1. Get raw messages
        const { data: messages, error } = await supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', id)
            .order('created_at', { ascending: true }) // Changed to true to get chronological order for chat
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) throw error;

        if (!messages || messages.length === 0) {
            return res.json({ messages: [] });
        }

        // 2. Collect sender IDs
        const senderIds = [...new Set(messages.map(m => m.sender_id))];

        // 3. Fetch details for these senders (Users and AIs)
        // We try to fetch from both tables. IDs are unique (UUIDs), so no collision.

        const { data: users } = await supabase
            .from('user_profile')
            .select('id, username, avatar_url') // Assuming avatar_url exists in user_profile, or use a fallback
            .in('id', senderIds);

        const { data: ais } = await supabase
            .from('npcs')
            .select('id, name, avatar_url')
            .in('id', senderIds);

        // 4. Map details to messages
        const enrichedMessages = messages.map(msg => {
            let senderName = 'Sconosciuto';
            let avatar = null;
            let isAi = false;

            // Check if sender is User
            const user = users?.find(u => u.id === msg.sender_id);
            if (user) {
                senderName = user.username || 'Utente';
                avatar = user.avatar_url;
            } else {
                // Check if sender is AI
                const ai = ais?.find(a => a.id === msg.sender_id);
                if (ai) {
                    senderName = ai.name;
                    avatar = ai.avatar_url;
                    isAi = true;
                }
            }

            return {
                ...msg,
                sender_name: senderName,
                avatar: avatar,
                is_ai: isAi,
                is_user: msg.sender_id === userId
            };
        });

        res.json({ messages: enrichedMessages });
    } catch (e) {
        console.error('Error fetching group messages:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get group details and members (name + npc list)
router.get('/groups/:id/members', async (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    try {
        // Verify access (owner or member)
        const { data: grp, error: grpErr } = await supabase
            .from('groups')
            .select('id, user_id, name')
            .eq('id', id)
            .maybeSingle();
        if (grpErr) throw grpErr;
        if (!grp) return res.status(404).json({ error: 'Group not found' });
        const isOwner = grp.user_id === userId;
        let allowed = isOwner;
        if (!allowed) {
            const { data: mem, error: memErr } = await supabase
                .from('group_members')
                .select('npc_id')
                .eq('group_id', id);
            if (!memErr && mem && mem.length) allowed = true;
        }
        if (!allowed) return res.status(403).json({ error: 'Access denied' });

        // Recupera membri e arricchisci con dati NPC/User senza dipendere da FK
        const { data: memberRows, error: memRowsErr } = await supabase
            .from('group_members')
            .select('member_id, member_type, npc_id, role')
            .eq('group_id', id);
        if (memRowsErr) throw memRowsErr;

        const npcIds = [];
        const userIds = [];
        (memberRows || []).forEach(r => {
            if (r.member_type === 'npc' || r.member_type === 'ai') {
                if (r.npc_id) npcIds.push(r.npc_id);
                if (r.member_id) npcIds.push(r.member_id);
            } else if (r.member_type === 'user' && r.member_id) {
                userIds.push(r.member_id);
            }
        });

        const { data: npcData, error: npcErr } = npcIds.length
            ? await supabase.from('npcs').select('id, name, avatar_url').in('id', npcIds)
            : { data: [], error: null };
        if (npcErr) throw npcErr;
        const npcMap = (npcData || []).reduce((acc, n) => { acc[n.id] = n; return acc; }, {});

        const { data: userData, error: userErr } = userIds.length
            ? await supabase.from('user_profile').select('id, username, name, avatar_url').in('id', userIds)
            : { data: [], error: null };
        if (userErr) throw userErr;
        const userMap = (userData || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});

        const members = (memberRows || []).map(r => {
            const isNpc = r.member_type === 'npc' || r.member_type === 'ai';
            const npc = npcMap[r.npc_id] || npcMap[r.member_id] || {};
            const user = userMap[r.member_id] || {};
            return {
                id: isNpc ? (npc.id || r.npc_id || r.member_id) : (user.id || r.member_id),
                member_type: r.member_type,
                npc_id: npc.id || r.npc_id || null,
                member_id: r.member_id,
                name: isNpc ? (npc.name || 'Thriller') : (user.username || user.name || 'Utente'),
                avatar_url: isNpc ? (npc.avatar_url || null) : (user.avatar_url || null),
                npcs: npc
            };
        });

        res.json({ group: { id: grp.id, name: grp.name }, members });
    } catch (e) {
        console.error('Error fetching group members:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
