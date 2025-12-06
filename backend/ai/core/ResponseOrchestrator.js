// ResponseOrchestrator (ThrillMe AI Core v2 - scaffolding).
// Coordinates the current legacy engines; deeper layering will be added later.
const { brainEngine } = require('../brainEngine');
const { think: thinkGroup } = require('../engines/GroupBrainEngine');

async function orchestrate(ctx = {}) {
  const {
    npc,
    npcId,
    npcProfile,
    user,
    userId,
    message,
    history,
    groupId,
    invokedNpcId,
    generateChatReply,
    options,
  } = ctx;

  if (groupId) {
    return thinkGroup({
      ...ctx,
      npcId: npcId || npc?.id,
      userMessage: ctx.rawMessage || message,
      userId: userId || user?.id,
    });
  }

  return brainEngine.generateIntelligentResponse(
    npc,
    user || { id: userId },
    message,
    null,
    history,
    generateChatReply,
    {
      ...options,
      npcProfile,
      promptSystem: npcProfile?.promptSystem,
      lifeCore: npcProfile?.lifeCore,
    },
  );
}

module.exports = {
  orchestrate,
};
