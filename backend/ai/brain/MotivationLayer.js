function decideMotivation(intentReport, mediaIntent, emotionalIntent) {
  const { intents } = intentReport;
  if (mediaIntent.wantsMedia) {
    return {
      primaryIntent: 'richiesta_media',
      secondaryIntents: intents,
      motivation: 'sedurre',
    };
  }

  if (intents.includes('richiesta_supporto') || emotionalIntent.emotionalIntent === 'seek-comfort') {
    return {
      primaryIntent: 'richiesta_supporto',
      secondaryIntents: intents,
      motivation: 'consolare',
    };
  }

  if (intents.includes('interazione_gruppo')) {
    return {
      primaryIntent: 'interazione_gruppo',
      secondaryIntents: intents,
      motivation: 'stabilizzare_il_gruppo',
    };
  }

  if (intents.includes('intimacy') || intentReport.flags?.userWantsMorePlayfulOrSpicy) {
    return {
      primaryIntent: 'intimacy',
      secondaryIntents: intents,
      motivation: 'giocare',
    };
  }

  return {
    primaryIntent: intents[0] || 'osservare',
    secondaryIntents: intents.slice(1),
    motivation: 'giocare',
  };
}

module.exports = {
  decideMotivation,
};
