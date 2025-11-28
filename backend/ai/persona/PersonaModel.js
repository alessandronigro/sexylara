function getPersona(npcJson) {
  return {
    name: npcJson.name,
    corePersonality: npcJson.core_personality,
    currentState: npcJson.current_state,
    experience: npcJson.experience,
  };
}

module.exports = {
  getPersona,
};
