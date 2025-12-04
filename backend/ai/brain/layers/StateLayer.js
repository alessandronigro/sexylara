function loadState(npcJson, groupId = null) {
  const lifeCore = npcJson?.npc_json || npcJson?.lifeCore || {};
  const groupState = groupId
    ? { id: groupId, harmony: 0.7, tensions: [] }
    : null;

  return {
    npcProfile: npcJson,
    groupState,
    mood: npcJson?.current_state?.mood ?? 'neutral',
    socialEnergy: npcJson?.current_state?.social_energy ?? 0.5,
    emotionVector: npcJson?.current_state?.emotion_vector ?? {
      valence: 0.5,
      arousal: 0.5,
      dominance: 0.5,
    },
    relationship: lifeCore.relationship || npcJson?.relationship_with_user || {},
  };
}

module.exports = {
  loadState,
};
