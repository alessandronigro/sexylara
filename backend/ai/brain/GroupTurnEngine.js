const { detectInvokedNpcId } = require("../engines/GroupBrainEngine");
const GroupLogContext = require('../../utils/GroupLogContext');

// Select which NPCs should respond in a group turn.
function selectResponders(context, scene) {
  const { npcMembers = [], groupLogContext } = context;
  const logPrefix = groupLogContext ? groupLogContext.getLogPrefix() : '[GroupTurnEngine]';

  console.log(`${logPrefix} selectResponders called with:`, {
    npcMembersCount: npcMembers.length,
    npcMemberIds: npcMembers.map(n => n.id || n.name),
    // invokedNpcId will be detected inside
  });

  if (!npcMembers.length) {
    console.log(`${logPrefix} No NPC members, returning empty.`);
    return { selected: [], reason: 'no_members' };
  }

  // RULE: if invokedNpcId is present, only that NPC replies
  const invokedNpcId = detectInvokedNpcId(context);
  if (invokedNpcId) {
    const target = npcMembers.find((n) => n.id === invokedNpcId);
    if (target) {
      console.log(`${logPrefix} Invoked NPC found: ${target.name} (${target.id}). Selecting only this NPC.`);
      return {
        selected: [target],
        reason: 'direct_invocation'
      };
    } else {
      console.warn(`${logPrefix} Invoked NPC ID (${invokedNpcId}) found but NPC not in current members. Proceeding with general selection.`);
    }
  }

  // LOGIC for selecting responders... (omitted for brevity)
  // For now simple all-respond or random logic

  // Default to the first NPC to guarantee a responder if no other logic applies
  const responders = [npcMembers[0]];
  console.log(`${logPrefix} 🎲 GroupTurnEngine: Selection logic result`, {
    selectedCount: responders.length,
    selectedNames: responders.map(n => n.name)
  });

  return {
    selected: responders,
    reason: 'default_first_npc'
  };
}

module.exports = { selectResponders };
