const memoryFlush = require('./memoryFlush');
const { checkForInitiative } = require('./NpcInitiativeEngine');
const { evaluateGroupInitiative } = require('../group/GroupInitiativeEngine');
const { getGroupState, addGossip } = require('../group/GroupMemoryStore');
const { getNpcProfile } = require('../memory/npcRepository');
const { supabase } = require('../../lib/supabase');

let initiativeInterval = null;
let groupInterval = null;

/**
 * Avvia lo scheduler globale:
 * - flush memoria periodico (già gestito da memoryFlush)
 * - iniziativa NPC (future events / silence / world trigger)
 * @param {Map<string, WebSocket>} userSockets
 * @param {number} initiativeMs
 */
function start(userSockets, initiativeMs = 60 * 1000, groupMs = 120 * 1000) {
  if (!memoryFlush.isRunning()) {
    memoryFlush.start(5000);
  }

  if (initiativeInterval) {
    clearInterval(initiativeInterval);
    initiativeInterval = null;
  }
  initiativeInterval = setInterval(async () => {
    try {
      await checkForInitiative(userSockets);
    } catch (err) {
      console.error('❌ GlobalScheduler initiative error:', err?.message);
    }
  }, initiativeMs);

  if (groupInterval) {
    clearInterval(groupInterval);
    groupInterval = null;
  }
  groupInterval = setInterval(async () => {
    try {
      await runGroupInitiative(userSockets);
    } catch (err) {
      console.error('❌ GlobalScheduler group initiative error:', err?.message);
    }
  }, groupMs);

  console.log(`🗓️ Global scheduler started (initiative every ${initiativeMs}ms, group every ${groupMs}ms)`);
}

function stop() {
  if (initiativeInterval) {
    clearInterval(initiativeInterval);
    initiativeInterval = null;
  }
  if (groupInterval) {
    clearInterval(groupInterval);
    groupInterval = null;
  }
  memoryFlush.stop();
  console.log('🗓️ Global scheduler stopped');
}

async function runGroupInitiative(userSocketsMap) {
  // Carica gruppi attivi (best-effort)
  const { data: groups } = await supabase
    .from('groups')
    .select('id')
    .limit(10);
  if (!groups || !groups.length) return;

  for (const g of groups) {
    try {
      const { data: members } = await supabase
        .from('group_members')
        .select('member_id, member_type')
        .eq('group_id', g.id);
      const npcMembers = (members || []).filter((m) => m.member_type === 'npc');
      const userMembers = (members || []).filter((m) => m.member_type === 'user').map((m) => m.member_id);
      if (!npcMembers.length) continue;

      // Carica profili NPC (lifeCore) per il contesto minimo
      const npcProfiles = [];
      for (const m of npcMembers) {
        const prof = await getNpcProfile(m.member_id);
        if (prof?.data) npcProfiles.push(prof.data);
      }

      const context = {
        groupId: g.id,
        members: npcMembers,
        npcs: npcProfiles,
        history: [],
        message: '[GROUP INITIATIVE]',
        userLanguage: 'it',
        timeContext: { now: new Date().toISOString() },
        worldContext: {},
      };

      const initiative = await evaluateGroupInitiative(context);
      if (initiative.gossip && initiative.gossip.length) {
        initiative.gossip.forEach((gossip) => addGossip(g.id, gossip));
      }
      if (initiative.responses && initiative.responses.length && userSocketsMap) {
        for (const userId of userMembers) {
          const ws = userSocketsMap.get(userId);
          if (ws && ws.readyState === 1) {
            initiative.responses.forEach((resp) => {
              try {
                ws.send(JSON.stringify({
                  type: 'group_initiative',
                  group_id: g.id,
                  npc_id: resp.npcId || null,
                  text: resp.text,
                  proactive: true,
                }));
              } catch (_) {
                // ignore send errors
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('⚠️ Group initiative loop error:', err?.message);
    }
  }
}

module.exports = {
  start,
  stop,
  runGroupInitiative,
};
