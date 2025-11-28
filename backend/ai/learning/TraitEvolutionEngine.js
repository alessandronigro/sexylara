function evolve(npcJson, adjustments) {
  npcJson.current_state = npcJson.current_state || {};
  npcJson.current_state.mood = adjustments.mood || npcJson.current_state.mood;
  npcJson.core_personality = npcJson.core_personality || {};
  npcJson.core_personality.custom_traits = npcJson.core_personality.custom_traits || {};

  const traits = npcJson.core_personality.custom_traits;
  const intents = adjustments.intents || [];

  if (adjustments.focus === 'consolare' || intents.includes('sfogo_emotivo')) {
    traits.vulnerability = Math.min(1, (traits.vulnerability ?? 0.5) + 0.02);
    traits.playfulness = Math.max(0, (traits.playfulness ?? 0.5) - 0.01);
  }

  if (intents.includes('aggression') || intents.includes('frustration')) {
    traits.jealousy = Math.min(1, (traits.jealousy ?? 0.3) + 0.02);
    traits.irony = Math.min(1, (traits.irony ?? 0.3) + 0.01);
  }

  if (intents.includes('intimacy')) {
    traits.playfulness = Math.min(1, (traits.playfulness ?? 0.5) + 0.02);
    traits.vulnerability = Math.min(1, (traits.vulnerability ?? 0.5) + 0.01);
  }

  if (adjustments.focus === 'stabilizzare_il_gruppo') {
    traits.jealousy = Math.max(0, (traits.jealousy ?? 0.3) - 0.01);
  }

  return npcJson;
}

module.exports = {
  evolve,
};
