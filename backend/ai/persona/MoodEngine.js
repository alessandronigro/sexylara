function computeMood(relationship, emotionVector) {
  const valence = emotionVector.valence ?? 0.5;
  if (valence > 0.7) return 'playful';
  if (valence < 0.4) return 'hurt';
  return 'tender';
}

module.exports = {
  computeMood,
};
