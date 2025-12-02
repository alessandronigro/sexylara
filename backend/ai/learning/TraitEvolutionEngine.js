function clamp01(v) {
  if (Number.isNaN(Number(v))) return 0;
  return Math.max(0, Math.min(1, Number(v)));
}

function applyDelta(base, delta) {
  return clamp01((base ?? 0.5) + delta);
}

// Legacy custom traits evolution (kept for backward compatibility)
function evolve(npcJson, adjustments) {
  npcJson.current_state = npcJson.current_state || {};
  npcJson.current_state.mood = adjustments.mood || npcJson.current_state.mood;
  npcJson.core_personality = npcJson.core_personality || {};
  npcJson.core_personality.custom_traits = npcJson.core_personality.custom_traits || {};

  const traits = npcJson.core_personality.custom_traits;
  const intents = adjustments.intents || [];

  if (adjustments.focus === 'consolare' || intents.includes('sfogo_emotivo')) {
    traits.vulnerability = applyDelta(traits.vulnerability ?? 0.5, +0.02);
    traits.playfulness = applyDelta(traits.playfulness ?? 0.5, -0.01);
  }

  if (intents.includes('aggression') || intents.includes('frustration')) {
    traits.jealousy = applyDelta(traits.jealousy ?? 0.3, +0.02);
    traits.irony = applyDelta(traits.irony ?? 0.3, +0.01);
  }

  if (intents.includes('intimacy')) {
    traits.playfulness = applyDelta(traits.playfulness ?? 0.5, +0.02);
    traits.vulnerability = applyDelta(traits.vulnerability ?? 0.5, +0.01);
  }

  if (adjustments.focus === 'stabilizzare_il_gruppo') {
    traits.jealousy = applyDelta(traits.jealousy ?? 0.3, -0.01);
  }

  return npcJson;
}

// New evolution aligned to LifeCore Italian traits (calore, estroversione, intelletto, sensualità, caos)
function evolveTraits(lifeCore = {}, interaction = {}) {
  if (!lifeCore.personality) lifeCore.personality = {};
  const p = lifeCore.personality;

  const kindness = interaction.kindnessScore || 0;
  const provocation = interaction.provocationScore || 0;
  const depth = interaction.depthScore || 0;
  const intimacy = interaction.intimacy || 0;
  const arcXp = interaction.arcXp || 0;

  // Soft increments; never abrupt
  if (kindness > 0.4) p.calore = applyDelta(p.calore, +0.01 * kindness);
  if (provocation > 0.4) p.estroversione = applyDelta(p.estroversione, +0.01 * provocation);
  if (depth > 0.4) p.intelletto = applyDelta(p.intelletto, +0.01 * depth);
  if (intimacy > 0.3) p.sensualità = applyDelta(p.sensualità, +0.005 * intimacy);

  // Keep chaos within range; decrease if stable chats
  if (interaction.stabilize === true) p.caos = applyDelta(p.caos, -0.01);

  // Arc evolution (level/xp)
  lifeCore.arc = lifeCore.arc || {};
  lifeCore.arc.xp = (lifeCore.arc.xp || 0) + arcXp;
  const LEVEL_STEP = 100;
  lifeCore.arc.level = Math.floor((lifeCore.arc.xp || 0) / LEVEL_STEP);

  return lifeCore;
}

module.exports = {
  evolve,
  evolveTraits,
};
