const { getPersona } = require('../../persona/PersonaModel');
const { computeMood } = require('../../persona/MoodEngine');
const { updateRelationship } = require('../../persona/RelationshipEngine');

function buildPersonaState(context, intentReport, emotionalIntent) {
  const persona = getPersona(context.npc) || {};
  const rel = context.npc?.relationship_with_user || {};
  const currentState = persona.currentState || {};

  // ======================================
  // FORZA MODO ESPLICITO se rilevato
  // ======================================
  const isExplicit =
    intentReport?.flags?.userWantsExplicitSexualTone === true ||
    intentReport?.primaryIntent === 'explicit_sexual_request' ||
    intentReport?.explicitMode === true;

  let emotionVectorOverride = context.emotionOverride;
  let moodOverride = context.moodOverride;

  if (isExplicit) {
    // BLOCCO COMPLETO del fallback a "tender" o "warm"
    emotionVectorOverride = {
      valence: 0.3,
      arousal: 0.9,
      dominance: 0.9
    };
    moodOverride = 'hot';
  }

  const emotionVector = emotionVectorOverride || currentState.emotion_vector || currentState.emotionVector || { valence: 0.5, arousal: 0.5, dominance: 0.5 };
  const prevMood = currentState.mood || null;
  let mood = moodOverride || computeMood(rel, emotionVector, prevMood);
  // Se familyGuard attivo o richieste non sessuali, riduci hot/dominante
  if (context.familyGuard && mood === 'hot') {
    mood = 'warm';
  }
  if (!intentReport.intents?.includes('intimacy') && !intentReport.intents?.includes('explicit_sexual_request')) {
    if (mood === 'hot') mood = 'warm';
  }
  const updatedRelationship = updateRelationship(rel, emotionalIntent);

  if (context.npc) {
    context.npc.relationship_with_user = updatedRelationship;
  }

  return {
    persona,
    mood,
    relationship: updatedRelationship,
    internalConflicts: isExplicit ? ['desiderio', 'dominanza'] : ['yearning', 'attachment'],
    desires: isExplicit ? ['soddisfazione', 'controllo'] : ['vicinanza', 'autonomia'],
    fears: isExplicit ? [] : ['abbandono', 'incomprensione'],
  };
}

module.exports = {
  buildPersonaState,
};
