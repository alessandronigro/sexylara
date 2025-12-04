// RelationshipEngine - aggiorna vettori relazionali NPC↔utente in modo leggero.
// Placeholder numerico: confidenza, fiducia, intimità, conflitto, simpatia.

function clamp(v, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

function update(lifeCore = {}, signals = {}) {
  const rel = lifeCore.relationship || {};
  const perception = signals.perception || {};
  const intents = signals.intents || [];
  const sentiment = perception?.textAnalysis?.sentiment || 'neutral';

  const trust = clamp((rel.trust ?? 0.4) + (sentiment === 'positive' ? 0.05 : sentiment === 'negative' ? -0.02 : 0));
  const intimacy = clamp((rel.intimacy ?? 0.3) + (intents.includes('intimacy') ? 0.08 : 0));
  const conflict = clamp((rel.conflict ?? 0.1) + (intents.includes('aggression') ? 0.1 : 0));
  const sympathy = clamp((rel.sympathy ?? 0.5) + (sentiment === 'positive' ? 0.05 : 0));

  lifeCore.relationship = {
    ...rel,
    trust,
    intimacy,
    conflict,
    sympathy,
  };

  return lifeCore.relationship;
}

module.exports = { update };
