const { generateNpcInitiativeMessage } = require('../brainEngine');
const { getNpcProfile, updateNpcProfile } = require('../memory/npcRepository');
const { ensureLifeCoreStructure } = require('../learning/LifeCoreTemporalEngine');
const { sendPushNotification } = require('../../services/pushService');
const { incrementUnread, persistUnread } = require('../../services/unreadService');
const { supabase } = require('../../lib/supabase');
const WorldContextAdapter = require('../world/WorldContextAdapter');

const userLastInitiative = new Map();
const userDailyCount = new Map();

function withinRateLimit(userId, minMinutes = 30) {
  const now = Date.now();
  const last = userLastInitiative.get(userId) || 0;
  if (now - last < minMinutes * 60 * 1000) return false;

  const today = new Date().toDateString();
  const entry = userDailyCount.get(userId) || { date: today, count: 0 };
  if (entry.date !== today) {
    entry.date = today;
    entry.count = 0;
  }
  if (entry.count >= 4) return false; // max 4 al giorno

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

async function getLastUserMessageAt(userId, npcId) {
  const { data } = await supabase
    .from('messages')
    .select('created_at')
    .eq('user_id', userId)
    .eq('npc_id', npcId)
    .order('created_at', { ascending: false })
    .limit(1);
  const last = data?.[0]?.created_at;
  return last ? new Date(last).getTime() : null;
}

function hoursSince(ts) {
  if (!ts) return Infinity;
  return (Date.now() - ts) / (60 * 60 * 1000);
}

function matchesRoutine(lifeCore) {
  const routine = lifeCore?.routine_readiness || {};
  const patterns = lifeCore?.timePatterns || {};
  const timeContext = (() => {
    const now = new Date();
    const hour = now.getHours();
    const partOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return { hour, partOfDay };
  })();

  const hour = new Date().getHours();
  const dayIdx = new Date().getDay(); // 0 Sunday
  const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = daysMap[dayIdx];

  const busy = (routine.busy_days || []).map((d) => d.toLowerCase());
  if (busy.includes(dayName)) return false;

  const preferred = (routine.preferred_hours || []).map((h) => h.toLowerCase());
  if (preferred.includes('morning') && hour >= 6 && hour < 12) return true;
  if (preferred.includes('afternoon') && hour >= 12 && hour < 18) return true;
  if (preferred.includes('evening') && hour >= 18 && hour < 23) return true;
  if (preferred.includes(timeContext.partOfDay)) return true;
  if (patterns[`${timeContext.partOfDay}_energy`] && patterns[`${timeContext.partOfDay}_energy`] > 0.7) return true;
  if (!preferred.length) return true;

  return false;
}

function socialUrgeTrigger(lifeCore) {
  const urges = lifeCore?.socialUrges || {};
  const now = new Date();
  const hour = now.getHours();
  const partOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const peaks = urges.peaks_at || [];
  const baseline = Number(urges.baseline || 0);
  const peakHit = peaks.includes(partOfDay);
  const roll = Math.random();
  const threshold = peakHit ? baseline + 0.3 : baseline;
  return roll < threshold;
}

function pickDueFutureEvent(lifeCore) {
  const futureEvents = lifeCore?.time_memory?.future_events || [];
  const now = Date.now();
  const due = futureEvents
    .filter((ev) => ev && ev.executed !== true && ev.scheduled_at_timestamp && ev.scheduled_at_timestamp <= now)
    .sort((a, b) => a.scheduled_at_timestamp - b.scheduled_at_timestamp);
  return due[0] || null;
}

function buildSilenceTrigger(hours, lifeCore) {
  if (!Number.isFinite(hours)) return null;
  const conf = lifeCore.relationship?.confidence_level || 0;
  if (hours >= 168) return { type: 'silence', level: 'strong', prompt: 'manca da una settimana', tone: conf >= 3 ? 'personal' : 'gentle' };
  if (hours >= 72) return { type: 'silence', level: 'mid', prompt: 'nessun messaggio da 72 ore', tone: conf >= 3 ? 'warm' : 'light' };
  if (hours >= 24) return { type: 'silence', level: 'light', prompt: 'nessun messaggio da 24 ore', tone: 'light' };
  return null;
}

function buildEmotionalFollowUp(lifeCore) {
  const present = lifeCore.time_memory?.present_context || {};
  if (present.emotional_climate === 'negative') {
    return { type: 'emotional_followup', prompt: 'ultimo messaggio era triste, offri supporto', tone: 'supportive' };
  }
  return null;
}

function buildConfidencePing(lifeCore) {
  const confidence = lifeCore.relationship?.confidence_level || 0;
  if (confidence >= 4) {
    return { type: 'confidence_ping', prompt: 'saluto spontaneo confidenza alta', tone: 'intimate' };
  }
  if (confidence >= 3) {
    return { type: 'confidence_ping', prompt: 'check-in spontaneo', tone: 'warm' };
  }
  return null;
}

async function buildWorldTrigger() {
  try {
    const [weather, festivities] = await Promise.all([
      WorldContextAdapter.getWeather(null).catch(() => null),
      WorldContextAdapter.getFestivities().catch(() => []),
    ]);
    if (festivities && festivities.length) {
      return { type: 'world_event', prompt: `festività: ${festivities.join(', ')}`, tone: 'warm' };
    }
    if (weather && weather.condition) {
      return { type: 'world_event', prompt: `meteo: ${weather.condition}`, tone: weather.condition.includes('rain') ? 'cozy' : 'bright' };
    }
  } catch (_) {
    return null;
  }
  return null;
}

async function persistNpcMessage(userId, npcId, text) {
  if (!text) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({
      user_id: userId,
      npc_id: npcId,
      role: 'assistant',
      type: 'text',
      content: text,
    })
    .select()
    .single();
  if (error) {
    console.error('❌ Failed to persist NPC initiative message:', error);
    return null;
  }
  return data;
}

async function dispatchProactive({ userId, npc, text, ws, proactiveType }) {
  if (!text) return;
  await persistNpcMessage(userId, npc.id, text);

  if (ws && ws.readyState === 1) {
    ws.send(
      JSON.stringify({
        type: 'incoming_message',
        from: 'npc',
        text,
        npc_id: npc.id,
        mediaType: null,
        mediaUrl: null,
        proactive: true,
        proactiveType,
      })
    );
  }

  const unread = incrementUnread(userId, npc.id);
  persistUnread(userId, npc.id);
  sendPushNotification(userId, {
    title: npc.name || 'NPC',
    body: text,
    npc_id: npc.id,
    type: 'incoming_message',
    proactive: true,
    unread,
    proactiveType,
  });
}

async function handleUserSocket(userId, ws) {
  const npcId = ws?.npc_id || ws?.girlfriendId || ws?.girlfriend_id;
  const npcName = ws?.girlfriend_name || ws?.girlfriendName || ws?.npc_name;
  if (!npcId) return;

  if (!withinRateLimit(userId)) return;

  const profile = await getNpcProfile(npcId, npcName);
  const npc = profile.data || { id: npcId, name: npcName };

  // Throttling: 1 hour
  const lastCheck = npc.lastInitiativeCheckAt ? new Date(npc.lastInitiativeCheckAt).getTime() : 0;
  if (Date.now() - lastCheck < 60 * 60 * 1000) return;

  // Update timestamp and persist to avoid loops
  npc.lastInitiativeCheckAt = new Date().toISOString();
  await updateNpcProfile(npcId, npc);

  const lifeCore = profile.lifeCore || npc.npc_json || {};

  const dueFuture = pickDueFutureEvent(lifeCore);
  const worldTrigger = await buildWorldTrigger();
  const lastUserTs = await getLastUserMessageAt(userId, npcId);
  const silence = buildSilenceTrigger(hoursSince(lastUserTs), lifeCore);
  const emotional = buildEmotionalFollowUp(lifeCore);
  const confidence = buildConfidencePing(lifeCore);
  const urgePing = socialUrgeTrigger(lifeCore) ? { type: 'urge', prompt: 'saluto per urgenza sociale', tone: 'warm' } : null;

  // Priority: future event > emotional follow-up > silence > confidence ping
  const chosen =
    dueFuture ||
    emotional ||
    (matchesRoutine(lifeCore) ? silence : null) ||
    (matchesRoutine(lifeCore) ? confidence : null) ||
    (matchesRoutine(lifeCore) ? urgePing : null) ||
    (matchesRoutine(lifeCore) ? worldTrigger : null);

  if (!chosen) return;

  let reason = 'initiative';
  let tone = 'warm';
  let futureEvent = null;
  if (dueFuture) {
    reason = 'future_event';
    futureEvent = dueFuture;
    tone = 'supportive';
    dueFuture.executed = true;
  } else if (emotional) {
    reason = emotional.type;
    tone = emotional.tone;
  } else if (silence) {
    reason = silence.type;
    tone = silence.tone;
  } else if (confidence) {
    reason = confidence.type;
    tone = confidence.tone;
  } else if (urgePing) {
    reason = urgePing.type;
    tone = urgePing.tone;
  } else if (worldTrigger) {
    reason = worldTrigger.type;
    tone = worldTrigger.tone;
  }

  const initiative = await generateNpcInitiativeMessage(npc, { id: userId }, { reason, futureEvent, tone });
  if (!initiative?.text) return;

  console.log(`💬 NPC ${npc.id} initiative (${reason}) -> user ${userId}`);
  await dispatchProactive({
    userId,
    npc,
    text: initiative.text,
    ws,
    proactiveType: reason,
  });
  markSent(userId);

  // Persist LifeCore updates (mark executed future events + present context)
  npc.npc_json = ensureLifeCoreStructure({
    ...(lifeCore || {}),
    time_memory: {
      ...(lifeCore.time_memory || {}),
      future_events: (lifeCore.time_memory?.future_events || []).map((ev) =>
        futureEvent && ev.event_id === futureEvent.event_id ? { ...ev, executed: true } : ev
      ),
    },
  });
  await updateNpcProfile(npcId, npc);
}

async function checkOfflineFutureEvents() {
  const { data: profiles } = await supabase
    .from('npc_profiles')
    .select('id, owner_id, name, data')
    .limit(200);
  if (!profiles || !profiles.length) return;

  for (const profile of profiles) {
    try {
      const userId = profile.owner_id;
      if (!userId || !withinRateLimit(userId)) continue;

      const npcData = profile.data || {};

      // Throttling: 1 hour
      const lastCheck = npcData.lastInitiativeCheckAt ? new Date(npcData.lastInitiativeCheckAt).getTime() : 0;
      if (Date.now() - lastCheck < 60 * 60 * 1000) continue;

      npcData.lastInitiativeCheckAt = new Date().toISOString();
      await updateNpcProfile(profile.id, npcData);

      const lifeCore = npcData.npc_json || {};
      const dueFuture = pickDueFutureEvent(lifeCore);
      if (!dueFuture) continue;

      const npc = {
        ...npcData,
        id: profile.id,
        name: profile.name || npcData.name,
        npc_json: lifeCore,
      };

      const initiative = await generateNpcInitiativeMessage(npc, { id: userId }, { reason: 'future_event', futureEvent: dueFuture, tone: 'supportive' });
      if (!initiative?.text) continue;

      console.log(`💬 NPC ${npc.id} offline initiative (future_event) -> user ${userId}`);
      await dispatchProactive({
        userId,
        npc,
        text: initiative.text,
        ws: null,
        proactiveType: 'future_event',
      });
      markSent(userId);

      npc.npc_json.time_memory.future_events = (lifeCore.time_memory?.future_events || []).map((ev) =>
        ev.event_id === dueFuture.event_id ? { ...ev, executed: true } : ev
      );
      await updateNpcProfile(npc.id, npc);
    } catch (err) {
      console.error('❌ Offline initiative error:', err?.message);
    }
  }
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
      await handleUserSocket(userId, ws);
    } catch (err) {
      console.error('❌ NpcInitiativeEngine error:', err?.message);
    }
  }

  // Gestione utenti offline (future events programmati)
  try {
    await checkOfflineFutureEvents();
  } catch (err) {
    console.error('❌ Offline future-event scheduler error:', err?.message);
  }
}

module.exports = { checkForInitiative };
