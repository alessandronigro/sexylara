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
        // 1. PRIORITY: Check if user is the group owner
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select('user_id')
            .eq('id', groupId)
            .single();

        if (!groupError && group && group.user_id === userId) {
            // Owner always has all permissions
            return true;
        }

        // 2. FALLBACK: Check role-based permissions
        const { data, error } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('member_id', userId)
            .single();

        if (error || !data) {
            console.log(`Permission denied: User ${userId} not in group ${groupId}`);
            return false;
        }

        const userRole = data.role;

        // 3. Verifica se il ruolo ha il permesso
        const allowedActions = ROLE_PERMISSIONS[userRole] || [];

        // Eccezione: Admin non può rimuovere Owner
        if (action === 'remove_member') {
            // Qui servirebbe sapere CHI si sta rimuovendo, ma per ora controlliamo solo il diritto generico
            // La logica specifica (admin vs owner) va nel controller
        }

        return allowedActions.includes(action);

    } catch (err) {
        console.error('Error checking permissions:', err);
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

        const hasPermission = await checkPermission(userId, groupId, action);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

module.exports = { checkPermission, requireGroupPermission, ROLE_PERMISSIONS };
