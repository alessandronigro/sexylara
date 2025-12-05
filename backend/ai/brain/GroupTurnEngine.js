// Select which NPCs should respond in a group turn.
function selectResponders(context, scene) {
  const { npcMembers = [], invokedNpcId } = context;

  console.log('[GroupTurnEngine] selectResponders called with:', {
    npcMembersCount: npcMembers.length,
    npcMemberIds: npcMembers.map(n => n.id || n.name),
    invokedNpcId
  });

  if (!npcMembers.length) return [];

  // RULE: if invokedNpcId is present, only that NPC replies
  const invokedNpc = invokedNpcId
    ? npcMembers.find((n) => n.id === invokedNpcId)
    : null;
  const responders = invokedNpc
    ? [invokedNpc]
    : [npcMembers[0]]; // Default to the first NPC to guarantee a responder

  console.log('[GroupTurnEngine] responders', responders.map(r => r.id || r.name));
  return responders;
}

module.exports = { selectResponders };
