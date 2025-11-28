function analyze(imageUrl) {
  if (!imageUrl) return null;
  return {
    mood: 'soothing',
    objects: ['silhouette', 'soft light'],
    colors: ['lavender', 'gold'],
    description: 'Una foto con tonica calda e suggerimenti romantici.',
  };
}

module.exports = {
  analyze,
};
