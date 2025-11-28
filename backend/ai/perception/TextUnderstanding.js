function analyze(message) {
  const lower = (message || '').toLowerCase();
  const positive = ['grazie', 'amo', 'felice', 'adoro', 'bello'];
  const negative = ['triste', 'male', 'odio', 'sola', 'piango', 'pezzi', 'stronza', 'schifo', 'deludendo'];
  const containsPositive = positive.some((word) => lower.includes(word));
  const containsNegative = negative.some((word) => lower.includes(word));

  const sentiment = containsPositive ? 'positive' : containsNegative ? 'negative' : 'neutral';
  const style = lower.includes('??') ? 'playful' : 'warm';
  const intentHints = [];
  if (lower.includes('voglio') || lower.includes('vederti') || lower.includes('foto')) {
    intentHints.push('richiesta_media');
  }
  if (lower.includes('sono') && lower.includes('triste')) {
    intentHints.push('sfogo_emotivo');
  }
  if (lower.includes('perché') || lower.includes('cosa intendi') || lower.includes('spiegati meglio')) {
    intentHints.push('question');
  }
  if (lower.includes('ti voglio') || lower.includes('mi manchi') || lower.includes('baciamoci')) {
    intentHints.push('intimacy');
  }
  if (lower.includes('stronza') || lower.includes('fai schifo') || lower.includes('pezzo di merda')) {
    intentHints.push('aggression');
  }

  return {
    sentiment,
    tone: style,
    intentHints,
    length: message?.length ?? 0,
  };
}

module.exports = {
  analyze,
};
