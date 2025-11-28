function analyze(perception) {
  const sentiment = perception.textAnalysis.sentiment;
  if (sentiment === 'negative') {
    return {
      emotionalIntent: 'seek-comfort',
    };
  }
  if (sentiment === 'positive') {
    return {
      emotionalIntent: 'share-joy',
    };
  }
  return {
    emotionalIntent: 'Maintain',
  };
}

module.exports = {
  analyze,
};
