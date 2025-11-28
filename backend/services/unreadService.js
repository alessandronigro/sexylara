const { supabase } = require('../lib/supabase');

/**
 * In-memory cache for unread counts; optionally persisted to Supabase if table exists.
 * Structure: Map<userId, Map<girlfriendId, count>>
 */
const unreadCache = new Map();

function getCount(userId, girlfriendId) {
  const userMap = unreadCache.get(userId);
  if (!userMap) return 0;
  return userMap.get(girlfriendId) || 0;
}

function setCount(userId, girlfriendId, count) {
  let userMap = unreadCache.get(userId);
  if (!userMap) {
    userMap = new Map();
    unreadCache.set(userId, userMap);
  }
  userMap.set(girlfriendId, count);
}

function incrementUnread(userId, girlfriendId) {
  const next = getCount(userId, girlfriendId) + 1;
  setCount(userId, girlfriendId, next);
  return next;
}

function resetUnread(userId, girlfriendId) {
  setCount(userId, girlfriendId, 0);
  return 0;
}

async function persistUnread(userId, girlfriendId) {
  // Optional: if you have a table unread_counts(user_id, npc_id, count)
  try {
    const count = getCount(userId, girlfriendId);
    await supabase
      .from('unread_counts')
      .upsert({ user_id: userId, npc_id: girlfriendId, count });
  } catch (err) {
    console.warn('⚠️ Persist unread failed:', err?.message);
  }
}

module.exports = {
  getCount,
  incrementUnread,
  resetUnread,
  persistUnread,
};
