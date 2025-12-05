function extractTopic(history = []) {
  const last = history.slice(-5).map((h) => h.content || '').join(' ').toLowerCase();
  if (!last) return null;
  if (last.includes('foto') || last.includes('immagine')) return 'media';
  if (last.includes('lavoro')) return 'lavoro';
  if (last.includes('famiglia')) return 'famiglia';
  if (last.includes('amore')) return 'amore';
  return null;
}

function detectTone(history = []) {
  const last = history.slice(-5).map((h) => h.content || '').join(' ').toLowerCase();
  if (last.includes('triste')) return 'soft';
  if (last.includes('arrabbiato')) return 'calm';
  return 'warm';
}

function computeEnergy(history = []) {
  const len = history.slice(-5).reduce((acc, h) => acc + (h.content || '').length, 0);
  if (len > 400) return 'low';
  if (len > 200) return 'mid';
  return 'high';
}

function buildSceneContext(context) {
  const topic = extractTopic(context.history || []);
  const tone = detectTone(context.history || []);
  const energy = computeEnergy(context.history || []);
  return {
    topic,
    tone,
    energy,
    groupMeta: context.groupMeta || null,
  };
}

module.exports = { buildSceneContext };
