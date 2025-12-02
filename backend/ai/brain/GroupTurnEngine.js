// Select which NPCs should respond in a group turn.
function selectResponders(context, scene) {
  const { npcMembers = [], invokedNpcId } = context;
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
  const responders = picked.slice(0, 2).map((s) => s.npc);
  console.log('[GroupTurnEngine] responders', responders.map(r => r.id));
  return responders;
}

module.exports = { selectResponders };
