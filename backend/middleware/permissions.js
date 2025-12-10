const { supabase } = require('../lib/supabase');

/**
 * Mappa dei permessi per ruolo
 */
const ROLE_PERMISSIONS = {
    owner: [
        'invite_user', 'invite_npc', 'remove_member',
        'promote_admin', 'demote_admin', 'set_group_settings',
        'moderate_messages', 'delete_group'
    ],
    admin: [
        'invite_user', 'invite_npc', 'remove_member',
        'moderate_messages'
    ],
    member: [
        'leave_group'
        // 'invite_npc' (solo richiesta, gestita separatamente)
    ]
};

/**
 * Verifica se un utente ha il permesso per un'azione in un gruppo
 */
async function checkPermission(userId, groupId, action) {
    try {
        console.log(`[Permission Check] userId=${userId}, groupId=${groupId}, action=${action}`);

        // 1. PRIORITY: Check if user is the group owner
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select('user_id, allow_member_invite')
            .eq('id', groupId)
            .single();

        if (groupError) {
            console.log(`[Permission Check] Error fetching group:`, groupError);
        }

        console.log(`[Permission Check] Group data:`, {
            groupUserId: group?.user_id,
            requestUserId: userId,
            groupUserIdType: typeof group?.user_id,
            requestUserIdType: typeof userId,
            allowMemberInvite: group?.allow_member_invite
        });

        const isOwner = !groupError && group && group.user_id === userId;
        const allowMemberInvite = !!group?.allow_member_invite;

        console.log(`[Permission Check] User is group owner: ${isOwner}`);

        if (isOwner) {
            console.log(`[Permission Check] Result: true (owner bypass)`);
            return true; // Owner always allowed
        }

        // 2. FALLBACK: Check role-based permissions
        const { data, error } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('member_id', userId)
            .single();

        if (error || !data) {
            console.log(`[Permission Check] User ${userId} not in group ${groupId} as member`);
            console.log(`[Permission Check] Result: false (not a member)`);
            return false;
        }

        const userRole = data.role;
        console.log(`[Permission Check] User role: ${userRole}`);

        // Restrict invites for standard members when allow_member_invite is false
        if ((action === 'invite_user' || action === 'invite_npc') && !allowMemberInvite && userRole !== 'admin') {
            console.log(`[Permission Check] Result: false (member invites not allowed)`);
            return false;
        }

        // 3. Verifica se il ruolo ha il permesso
        const allowedActions = ROLE_PERMISSIONS[userRole] || [];

        // Eccezione: Admin non può rimuovere Owner
        if (action === 'remove_member') {
            // Qui servirebbe sapere CHI si sta rimuovendo, ma per ora controlliamo solo il diritto generico
            // La logica specifica (admin vs owner) va nel controller
        }

        const hasPermission = allowedActions.includes(action);
        console.log(`[Permission Check] Result: ${hasPermission} (role-based, allowed actions: ${allowedActions.join(', ')})`);
        return hasPermission;

    } catch (err) {
        console.error('[Permission Check] Error checking permissions:', err);
        return false;
    }
}

/**
 * Middleware Express per proteggere le rotte
 */
const requireGroupPermission = (action) => {
    return async (req, res, next) => {
        // Extract User ID from various possible sources
        const userId = req.user?.id ||
            req.headers['x-user-id'] ||
            req.body.userId ||
            req.body.senderId;

        const groupId = req.params.groupId || req.body.groupId;

        if (!userId || !groupId) {
            return res.status(400).json({ error: 'Missing userId or groupId' });
        }

        // Attach userId to request for convenience
        req.userId = userId;

        // OWNER BYPASS: Owner always has invite permissions
        if (action === 'invite_user' || action === 'invite_npc') {
            try {
                const { data: group, error: groupError } = await supabase
                    .from('groups')
                    .select('user_id')
                    .eq('id', groupId)
                    .single();

                if (!groupError && group && group.user_id === userId) {
                    // Owner has permission, skip role check
                    return next();
                }
            } catch (err) {
                console.error('Error checking group ownership:', err);
            }
        }

        // Standard permission check for non-owners or other actions
        const hasPermission = await checkPermission(userId, groupId, action);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

module.exports = { checkPermission, requireGroupPermission, ROLE_PERMISSIONS };
