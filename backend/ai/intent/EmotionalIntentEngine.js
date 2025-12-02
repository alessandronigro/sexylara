// ======================================
// EMOTIONAL INTENT ENGINE v2.1
// ======================================
// Gestisce priorità esplicite, contesto familiare e sfoghi emotivi.

const explicitSexualTerms = [
  'troia','puttana','cazzo','pompino','fica','culo','sesso','scopare','scoparti','fottimi','fottere',
  'leccami','sborr','vaffanculo','tette','nuda','nudo','porno','pene','chiappa'
];
const familyTerms = [
  'figlia','figlio','figli','moglie','marito','fidanzata','fidanzato','famiglia','mamma','papà','padre','madre',
  'scuola','lavoro','collega','ex moglie','ex marito'
];

function analyze(perception, intentReport = null) {
  const text = (perception?.text || perception?.textAnalysis?.raw || '').toLowerCase();
  const hasExplicit = explicitSexualTerms.some(t => text.includes(t)) || intentReport?.flags?.userWantsExplicitSexualTone === true;
  const hasFamily = familyTerms.some(t => text.includes(t));
  const hasAggression = (perception?.textAnalysis?.intentHints || []).includes('aggression') || intentReport?.intents?.includes('aggression');

  // Family context: mai erotico, strip aggression/explicit, trattalo come sfogo
  if (hasFamily) {
    return {
      emotionalIntent: 'seek-comfort',
      familyGuard: true,
      stripExplicit: true,
      stripAggression: true,
    };
  }
  if (hasAggression && hasFamily) {
    return {
      emotionalIntent: 'seek-comfort',
      familyGuard: true,
      stripExplicit: true,
      stripAggression: true,
    };
  }

  // Esplicito sessuale
  if (hasExplicit) {
    return {
      emotionalIntent: 'explicit_sexual_request',
      explicitSex: true,
      arousal: 0.9,
      dominance: 0.9,
      valence: 0.3,
    };
  }

  if (intentReport?.flags?.isDominant === true) {
    return {
      emotionalIntent: 'Dominate',
      arousal: 0.8,
      dominance: 0.9,
      valence: 0.4,
    };
  }

  if (intentReport?.flags?.isSubmissive === true) {
    return {
      emotionalIntent: 'Submit',
      arousal: 0.7,
      dominance: 0.2,
      valence: 0.6,
    };
  }

  if (intentReport?.flags?.isDirtyTalk === true) {
    return {
      emotionalIntent: 'Seduce',
      arousal: 0.9,
      dominance: 0.7,
      valence: 0.5,
    };
  }

  // Sentiment generico
  const sentiment = perception?.textAnalysis?.sentiment;
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
