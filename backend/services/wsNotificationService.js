/**
 * WebSocket Notification Service
 * Gestisce l'invio di notifiche real-time agli utenti connessi
 */

// Map to store user connections: userId -> WebSocket
const userConnections = new Map();

/**
 * Register a user connection
 * @param {string} userId - User ID
 * @param {WebSocket} ws - WebSocket connection
 */
function registerConnection(userId, ws) {
    if (!userId) return;

    // Store connection
    userConnections.set(userId, ws);

    console.log(`✅ User ${userId} connected. Total connections: ${userConnections.size}`);

    // Clean up on disconnect
    ws.on('close', () => {
        userConnections.delete(userId);
        console.log(`❌ User ${userId} disconnected. Total connections: ${userConnections.size}`);
    });
}

/**
 * Send notification to a specific user
 * @param {string} userId - Target user ID
 * @param {object} notification - Notification payload
 * @returns {boolean} - True if sent successfully
 */
function sendNotification(userId, notification) {
    const ws = userConnections.get(userId);

    if (!ws || ws.readyState !== 1) { // 1 = OPEN
        console.log(`⚠️ User ${userId} not connected or connection not ready`);
        return false;
    }

    try {
        ws.send(JSON.stringify({
            type: 'notification',
            ...notification
        }));
        console.log(`📨 Notification sent to user ${userId}:`, notification.notificationType);
        return true;
    } catch (error) {
        console.error(`❌ Error sending notification to user ${userId}:`, error);
        return false;
    }
}

/**
 * Send group invite notification
 * @param {string} userId - Target user ID
 * @param {object} inviteData - Invite details
 */
function sendInviteNotification(userId, inviteData) {
    return sendNotification(userId, {
        notificationType: 'group_invite',
        inviteId: inviteData.id,
        groupId: inviteData.group_id,
        groupName: inviteData.groupName,
        senderName: inviteData.senderName,
        message: `${inviteData.senderName} ti ha invitato a ${inviteData.groupName}`,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Send group update notification
 * @param {string} userId - Target user ID
 * @param {object} updateData - Update details
 */
function sendGroupUpdateNotification(userId, updateData) {
    return sendNotification(userId, {
        notificationType: 'group_update',
        groupId: updateData.groupId,
        updateType: updateData.type, // 'member_added', 'member_removed', 'role_changed', etc.
        message: updateData.message,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Broadcast to all members of a group
 * @param {Array<string>} memberIds - Array of user IDs
 * @param {object} notification - Notification payload
 */
function broadcastToGroup(memberIds, notification) {
    let sentCount = 0;

    memberIds.forEach(userId => {
        if (sendNotification(userId, notification)) {
            sentCount++;
        }
    });

    console.log(`📢 Broadcast to group: ${sentCount}/${memberIds.length} notifications sent`);
    return sentCount;
}

/**
 * Get connection status for a user
 * @param {string} userId - User ID
 * @returns {boolean} - True if user is connected
 */
function isUserOnline(userId) {
    const ws = userConnections.get(userId);
    return ws && ws.readyState === 1;
}

/**
 * Get total connected users count
 * @returns {number} - Number of connected users
 */
function getConnectedUsersCount() {
    return userConnections.size;
}

module.exports = {
    registerConnection,
    sendNotification,
    sendInviteNotification,
    sendGroupUpdateNotification,
    broadcastToGroup,
    isUserOnline,
    getConnectedUsersCount,
};
