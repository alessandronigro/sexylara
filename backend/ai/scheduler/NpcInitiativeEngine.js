const { generateNpcInitiativeMessage } = require('../brainEngine');
const { incrementUnread, persistUnread } = require('../../services/unreadService');
const { sendPushNotification } = require('../../services/pushService');

const userLastInitiative = new Map();
const userDailyCount = new Map();

function withinRateLimit(userId) {
  const now = Date.now();
  const last = userLastInitiative.get(userId) || 0;
  if (now - last < 30 * 60 * 1000) return false; // min 30 minuti

  const today = new Date().toDateString();
  const entry = userDailyCount.get(userId) || { date: today, count: 0 };
  if (entry.date !== today) {
    entry.date = today;
    entry.count = 0;
  }
  if (entry.count >= 4) return false; // max 4 al giorno

  if (Math.random() < 0.4) return false; // 40% chance di saltare

  return true;
}

function markSent(userId) {
  const today = new Date().toDateString();
  const entry = userDailyCount.get(userId) || { date: today, count: 0 };
  if (entry.date !== today) {
    entry.date = today;
    entry.count = 0;
  }
  entry.count += 1;
  userDailyCount.set(userId, entry);
  userLastInitiative.set(userId, Date.now());
}

/**
 * Itera sugli userSockets e, se passa rate limit, fa scrivere l'NPC.
 * @param {Map<string, WebSocket>} userSockets
 */
async function checkForInitiative(userSockets) {
  if (!userSockets || typeof userSockets.entries !== 'function') return;

  for (const [userId, ws] of userSockets.entries()) {
    try {
      if (!ws || ws.readyState !== 1) continue;
      if (!withinRateLimit(userId)) continue;

      // Per semplicità: recupera l'NPC principale associato all'utente (girlfriend)
      // Assumiamo che il client abbia fornito npc_id nella query string di connessione
      const npcId = ws.npc_id || ws.girlfriendId;
      const npcName = ws.girlfriend_name || ws.girlfriendName;
      const npc = { id: npcId, name: npcName };
      if (!npc.id) continue;

      const initiative = await generateNpcInitiativeMessage(npc, { id: userId });
      if (!initiative?.text) continue;

      ws.send(JSON.stringify({
        type: "incoming_message",
        from: "npc",
        text: initiative.text,
        npc_id: npc.id,
        mediaType: null,
        mediaUrl: null,
        proactive: true,
      }));

      console.log(`💬 NPC ${npc.id} sent proactive message to user ${userId}`);
      const unread = incrementUnread(userId, npc.id);
      persistUnread(userId, npc.id);
      sendPushNotification(userId, {
        title: npc.name || 'NPC',
        body: initiative.text,
        npc_id: npc.id,
        type: 'incoming_message',
        proactive: true,
        unread,
      });
      markSent(userId);
    } catch (err) {
      console.error('❌ NpcInitiativeEngine error:', err?.message);
    }
  }
}

module.exports = { checkForInitiative };
