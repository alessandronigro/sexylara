const moodScale = ['hurt', 'tender', 'warm', 'hot'];

function clampMood(prevMood, targetMood) {
  if (!prevMood) return targetMood;
  const prevIdx = moodScale.indexOf(prevMood);
  const targetIdx = moodScale.indexOf(targetMood);
  if (prevIdx === -1 || targetIdx === -1) return targetMood;
  const diff = targetIdx - prevIdx;
  if (Math.abs(diff) <= 1) return targetMood;
  const clampedIdx = prevIdx + (diff > 0 ? 1 : -1);
  return moodScale[clampedIdx] || targetMood;
}

function computeMood(relationship, emotionVector, prevMood = null) {
  const valence = emotionVector.valence ?? 0.5;
  let target = 'tender';
  if (valence > 0.75) target = 'hot';
  else if (valence > 0.6) target = 'warm';
  else if (valence < 0.4) target = 'hurt';
  const mood = clampMood(prevMood, target);

  console.log('[TRACE][PIPELINE]', JSON.stringify({
    stage: 'MoodEngine',
    prevMood,
    target,
    finalMood: mood,
    valence
  }, null, 2));

  return mood;
}

module.exports = {
  computeMood,
};
