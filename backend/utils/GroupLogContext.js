/**
 * GroupLogContext - Utility to generate consistent log prefixes for group events
 */
class GroupLogContext {
    /**
     * Generates a standardized log prefix
     * @param {string} groupId - The group ID
     * @param {string} senderId - The sender ID (optional)
     * @param {string} turnId - The turn or trace ID (optional)
     * @returns {string} - The formatted prefix e.g. [GROUP groupId=... sender=... turn=...]
     */
    static get(groupId, senderId = 'N/A', turnId = 'N/A') {
        return `[GROUP groupId=${groupId} sender=${senderId} turnId=${turnId}]`;
    }
}

module.exports = GroupLogContext;
