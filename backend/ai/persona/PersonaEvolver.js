function evolve(persona, delta) {
  const nextPersona = { ...persona };
  const { corePersonality } = nextPersona;
  if (corePersonality && delta) {
    const focus = delta.focus || 'empathy';
    if (focus === 'empathy' && corePersonality.customTraits) {
      corePersonality.customTraits.vulnerability = Math.min(1, (corePersonality.customTraits.vulnerability ?? 0.5) + 0.01);
    }
    if (focus === 'conflict') {
      corePersonality.customTraits.jealousy = Math.min(1, (corePersonality.customTraits.jealousy ?? 0.3) + 0.01);
    }
  }
  return nextPersona;
}

module.exports = {
  evolve,
};
