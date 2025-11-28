const { getPersona } = require('../persona/PersonaModel');
const { computeMood } = require('../persona/MoodEngine');
const { updateRelationship } = require('../persona/RelationshipEngine');

function buildPersonaState(context, intentReport, emotionalIntent) {
  const persona = getPersona(context.npc);
  const rel = context.npc.relationship_with_user || {};
  const mood = computeMood(rel, persona.currentState.emotion_vector || persona.currentState.emotionVector || {});
  const updatedRelationship = updateRelationship(rel, emotionalIntent);
  context.npc.relationship_with_user = updatedRelationship;

  return {
    persona,
    mood,
    relationship: updatedRelationship,
    internalConflicts: ['yearning', 'attachment'],
    desires: ['vicinanza', 'autonomia'],
    fears: ['abbandono', 'incomprensione'],
  };
}

module.exports = {
  buildPersonaState,
};
