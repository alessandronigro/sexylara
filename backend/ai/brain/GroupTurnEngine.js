// Select which NPCs should respond in a group turn.
function selectResponders(context, scene) {
  const { npcMembers = [], invokedNpcId } = context;

  console.log('[GroupTurnEngine] selectResponders called with:', {
    npcMembersCount: npcMembers.length,
    npcMemberIds: npcMembers.map(n => n.id || n.name),
    invokedNpcId
  });

  if (!npcMembers.length) return [];

  const scores = npcMembers.map((npc) => {
    const invoked = invokedNpcId && npc.id === invokedNpcId ? 0.6 : 0;
    const talkFreq = npc.group_behavior?.talkFrequency || npc.groupBehavior?.talkFrequency || 0.25;
    const sceneAffinity =
      scene.topic && (npc.personality_type || '').toLowerCase().includes(scene.topic) ? 0.2 : 0;
    const jitter = Math.random() * 0.2;
    return { npc, score: invoked + talkFreq * 0.3 + sceneAffinity + jitter };
  });

  const threshold = 0.15;
  const filtered = scores.filter((s) => s.score >= threshold);
  filtered.sort((a, b) => b.score - a.score);
  const picked = filtered.length ? filtered : scores; // if none above threshold, fallback to all
  let responders = picked.slice(0, 2).map((s) => s.npc);

  // ENSURE AT LEAST ONE RESPONDER: If no responders selected but AI members exist
  if (responders.length === 0 && npcMembers.length > 0) {
    // Try to use the invoked NPC first
    if (invokedNpcId) {
      const invokedNpc = npcMembers.find(npc => npc.id === invokedNpcId);
      if (invokedNpc) {
        responders = [invokedNpc];
        console.log('[GroupTurnEngine] No responders selected, using invoked NPC:', invokedNpcId);
      }
    }

    // If still no responder, use the first NPC as default
    if (responders.length === 0) {
      responders = [npcMembers[0]];
      console.log('[GroupTurnEngine] No responders selected, using default NPC:', npcMembers[0].id);
    }
  }

  console.log('[GroupTurnEngine] responders', responders.map(r => r.id || r.name));
  return responders;
}

module.exports = { selectResponders };
