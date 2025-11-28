function localize(npcProfile, language) {
  // For now, just attach the chosen language; personality remains the same.
  return {
    ...npcProfile,
    preferences: {
      ...(npcProfile.preferences || {}),
      language: language || 'en',
    },
  };
}

module.exports = { localize };
