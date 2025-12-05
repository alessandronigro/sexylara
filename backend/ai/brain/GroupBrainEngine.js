const PromptBuilder = require('../generation/PromptBuilder');
const { generate } = require('../generation/LlmClient');
const PostProcessor = require('../generation/PostProcessor');
const { sanitizeHistoryForLLM } = require('../../utils/sanitizeHistory');
const { buildSceneContext } = require('./SceneEngine');
const { selectResponders } = require('./GroupTurnEngine');
const { evaluateGroupInitiative } = require('../group/GroupInitiativeEngine');
const { addGossip } = require('../group/GroupMemoryStore');
const GroupLogContext = require('../../utils/GroupLogContext');

function normalizeHistory(history = [], npcId) {
  return history.map((h) => {
    if (h.role) return h;
    const senderId = h.sender_id || h.senderId;
    const role = senderId && senderId === npcId ? 'assistant' : 'user';
    return { role, content: h.content || '' };
  });
}

async function generateForNpc(npc, context, scene) {
  const userLanguage = context.userLanguage || context.lifeCore?.identity?.language || 'it';
  const safeHistory = normalizeHistory(context.history || [], npc.id);
  const prompt = PromptBuilder.buildPrompt({
    ...context,
    sceneContext: scene,
    groupMeta: scene?.groupMeta || context.groupMeta,
    npc,
    userLanguage,
    history: safeHistory,
    mediaAnalysis: context.mediaAnalysis,
    timeContext: context.timeContext,
    worldContext: context.worldContext,
  });

  const messagesArray = [
    { role: 'system', content: prompt },
    ...sanitizeHistoryForLLM(safeHistory || []).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: context.message },
  ];

  const llmResponse = await generate(messagesArray, npc?.model_override || null);
  const processed = PostProcessor.process(llmResponse, {
    perception: context.perception || {},
    mediaIntent: { wantsMedia: false, type: null },
    motivation: { primaryIntent: scene.topic || 'group', secondaryIntents: [] },
    toneMode: npc.preferences?.tone_mode || 'soft',
    lastOpenings: [],
    intentFlags: {},
    mediaRequestOverride: null,
  });

  return {
    npcId: npc.id,
    text: processed.text,
    mediaRequest: processed.mediaRequest || null,
  };
}

async function think(context) {
  const scene = buildSceneContext(context);
  const responders = selectResponders(context, scene);

  console.log('[GroupBrainEngine] think called with:', {
    npcMembersCount: context.npcMembers?.length || 0,
    respondersCount: responders.length,
    responderIds: responders.selected.map(r => r.id || r.name), // updated to responders.selected
    reason: responders.reason
  });

  const logPrefix = GroupLogContext.get(context.groupId, context.userId, 'BRAIN');
  const selectedResponders = responders.selected || [];

  // Only warn if there are AI members but no responders selected (should not happen with new logic)
  if (!selectedResponders.length && context.npcMembers && context.npcMembers.length > 0) {
    console.warn(`${logPrefix} [GroupBrainEngine] No responders selected despite having AI members (Reason: ${responders.reason})`);
  }

  const replies = [];

  // Generate replies for each responder
  for (const npc of selectedResponders) {
    console.log(`${logPrefix} [GroupBrainEngine] Generating reply for NPC: ${npc.name} (${npc.id})`);
    const reply = await generateForNpc(npc, context, scene);
    console.log(`${logPrefix} [GroupBrainEngine] Generated reply:`, { npcId: npc.id, hasText: !!reply?.text, textLen: reply?.text?.length, textPreview: reply?.text?.substring(0, 50) });
    if (reply && reply.text) replies.push(reply);
  }

  // Group initiative/gossip scaffold
  const initiative = await evaluateGroupInitiative({ ...context, scene });
  if (initiative.gossip && initiative.gossip.length && context.groupId) {
    initiative.gossip.forEach((g) => addGossip(context.groupId, g));
  }
  if (initiative.responses && initiative.responses.length) {
    replies.push(...initiative.responses);
  }

  // Only warn if we expected replies but got none
  if (!replies.length && responders.length > 0) {
    console.warn('[GroupBrainEngine] No replies generated despite having responders');
  }

  console.log('[GroupBrainEngine] Returning replies:', { count: replies.length, replies: replies.map(r => ({ npcId: r.npcId, hasText: !!r.text })) });
  return replies;
}

module.exports = { think };
