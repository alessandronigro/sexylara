// ======================================
// EMOTIONAL INTENT ENGINE v2.1
// ======================================
// Gestisce priorità esplicite, contesto familiare e sfoghi emotivi.

const explicitSexualTerms = [
  'troia', 'puttana', 'cazzo', 'pompino', 'fica', 'culo', 'sesso', 'scopare', 'scoparti', 'fottimi', 'fottere',
  'leccami', 'sborr', 'vaffanculo', 'tette', 'nuda', 'nudo', 'porno', 'pene', 'chiappa'
];
const familyTerms = [
  'figlia', 'figlio', 'figli', 'moglie', 'marito', 'fidanzata', 'fidanzato', 'famiglia', 'mamma', 'papà', 'padre', 'madre',
  'scuola', 'lavoro', 'collega', 'ex moglie', 'ex marito'
];

function analyze(perception, intentReport = null) {
  const text = (perception?.text || perception?.textAnalysis?.raw || '').toLowerCase();
  const hasExplicit = explicitSexualTerms.some(t => text.includes(t)) || intentReport?.flags?.userWantsExplicitSexualTone === true;
  const hasFamily = familyTerms.some(t => text.includes(t));
  const hasAggression = (perception?.textAnalysis?.intentHints || []).includes('aggression') || intentReport?.intents?.includes('aggression');

  let result;

  // Family context: mai erotico, strip aggression/explicit, trattalo come sfogo
  if (hasFamily) {
    result = {
      emotionalIntent: 'seek-comfort',
      familyGuard: true,
      stripExplicit: true,
      stripAggression: true,
    };
  } else if (hasAggression && hasFamily) { // Actually condition above covers this, but logic is same
    result = {
      emotionalIntent: 'seek-comfort',
      familyGuard: true,
      stripExplicit: true,
      stripAggression: true,
    };
  } else if (hasExplicit) {
    result = {
      emotionalIntent: 'explicit_sexual_request',
      explicitSex: true,
      arousal: 0.9,
      dominance: 0.9,
      valence: 0.3,
    };
  } else if (intentReport?.flags?.isDominant === true) {
    result = {
      emotionalIntent: 'Dominate',
      arousal: 0.8,
      dominance: 0.9,
      valence: 0.4,
    };
  } else if (intentReport?.flags?.isSubmissive === true) {
    result = {
      emotionalIntent: 'Submit',
      arousal: 0.7,
      dominance: 0.2,
      valence: 0.6,
    };
  } else if (intentReport?.flags?.isDirtyTalk === true) {
    result = {
      emotionalIntent: 'Seduce',
      arousal: 0.9,
      dominance: 0.7,
      valence: 0.5,
    };
  } else {
    // Sentiment generico
    const sentiment = perception?.textAnalysis?.sentiment;
    if (sentiment === 'negative') {
      result = { emotionalIntent: 'seek-comfort' };
    } else if (sentiment === 'positive') {
      result = { emotionalIntent: 'share-joy' };
    } else {
      result = { emotionalIntent: 'Maintain' };
    }
  }

  // Riduci intensità se non richiesto esplicitamente
  if (
    !intentReport?.flags?.userWantsMorePlayfulOrSpicy &&
    !intentReport?.flags?.userWantsExplicitTone &&
    !intentReport?.flags?.userWantsExplicitSexualTone &&
    result?.emotionalIntent !== 'explicit_sexual_request'
  ) {
    result.emotionalIntent = 'Maintain';
  }

  console.log('[TRACE][PIPELINE]', JSON.stringify({
    stage: 'EmotionalIntentEngine',
    result: result?.emotionalIntent,
    fullResult: result
  }, null, 2));

  return result;
}

module.exports = {
  analyze,
};
