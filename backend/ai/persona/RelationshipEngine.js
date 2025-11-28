function updateRelationship(relationshipState, emotionalIntent) {
  const updated = { ...relationshipState };
  updated.trust = Math.min(1, (updated.trust ?? 0.5) + (emotionalIntent.emotionalIntent === 'seek-comfort' ? 0.01 : 0));
  updated.attachment = Math.min(1, (updated.attachment ?? 0.5) + 0.005);
  updated.jealousy = Math.max(0, (updated.jealousy ?? 0.2) + (emotionalIntent.emotionalIntent === 'share-joy' ? -0.01 : 0.01));
  updated.comfort = Math.min(1, (updated.comfort ?? 0.5) + 0.01);
  updated.importance = Math.max(0, (updated.importance ?? 0.6));
  return updated;
}

module.exports = {
  updateRelationship,
};
