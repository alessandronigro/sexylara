// Placeholder relationship engine for NPC <-> NPC dynamics inside groups.
// Stores simple affinity scores in-memory; replace with persistence as needed.

const affinities = new Map(); // key `${groupId}:${a}:${b}` -> score -1..1

function key(groupId, a, b) {
  return `${groupId || 'global'}:${a}:${b}`;
}

function updateAffinity(groupId, fromNpc, toNpc, delta = 0.05) {
  if (!fromNpc || !toNpc) return;
  const k = key(groupId, fromNpc, toNpc);
  const current = affinities.get(k) ?? 0;
  const next = Math.max(-1, Math.min(1, current + delta));
  affinities.set(k, next);
  return next;
}

function getAffinity(groupId, fromNpc, toNpc) {
  return affinities.get(key(groupId, fromNpc, toNpc)) ?? 0;
}

module.exports = {
  updateAffinity,
  getAffinity,
};
