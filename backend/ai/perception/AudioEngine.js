function analyze(audioUrl) {
  if (!audioUrl) return null;
  return {
    rhythm: 'soft',
    energy: 'medium',
    cues: ['voice trembling', 'slow pace'],
    description: 'Audio pacato con accenti emotivi.',
  };
}

module.exports = {
  analyze,
};
