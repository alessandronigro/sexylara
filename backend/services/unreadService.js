const { supabase } = require('../lib/supabase');

/**
 * In-memory cache for unread counts; optionally persisted to Supabase if table exists.
 * Structure: Map<userId, Map<npcId, count>>
 */
const unreadCache = new Map();

function getCount(userId, npcId) {
  const userMap = unreadCache.get(userId);
  if (!userMap) return 0;
  return userMap.get(npcId) || 0;
}

function setCount(userId, npcId, count) {
  let userMap = unreadCache.get(userId);
  if (!userMap) {
    userMap = new Map();
    unreadCache.set(userId, userMap);
  }
  userMap.set(npcId, count);
}

function incrementUnread(userId, npcId) {
  const next = getCount(userId, npcId) + 1;
  setCount(userId, npcId, next);
  return next;
}

function resetUnread(userId, npcId) {
  setCount(userId, npcId, 0);
  return 0;
}

async function persistUnread(userId, npcId) {
  // Optional: if you have a table unread_counts(user_id, npc_id, count)
  try {
    const count = getCount(userId, npcId);
    await supabase
      .from('unread_counts')
      .upsert({ user_id: userId, npc_id: npcId, count });
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
