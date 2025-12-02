// ======================================
// MOTIVATION LAYER v2.0
// ======================================
// Blocca COMPLETAMENTE fallback a "giocare" o toni "tender" quando esplicito.

function decideMotivation(intentReport, mediaIntent, emotionalIntent) {
  const { intents } = intentReport;

  // ======================================
  // Media richiesto
  // ======================================
  if (mediaIntent.wantsMedia) {
    return {
      primaryIntent: 'richiesta_media',
      secondaryIntents: intents,
      motivation: 'sedurre',
    };
  }

  // ======================================
  // Supporto emotivo
  // ======================================
  if (intents.includes('sfogo_emotivo') || intents.includes('richiesta_supporto') || emotionalIntent.emotionalIntent === 'seek-comfort') {
    return {
      primaryIntent: 'richiesta_supporto',
      secondaryIntents: intents,
      motivation: 'consolare',
    };
  }

  // ======================================
  // PRIORITÀ MASSIMA: Esplicito/dominante/sessuale SOLO se non c'è sfogo
  // ======================================
  if (intents.includes('explicit_sexual_request') || intentReport.flags?.userWantsExplicitSexualTone) {
    return {
      primaryIntent: 'explicit_sexual_request',
      secondaryIntents: intents,
      motivation: 'esaudire_desiderio',
      tone: 'aggressive',
      explicitMode: true,
    };
  }

  if (intentReport.flags?.userWantsExplicitTone || intentReport.flags?.userWantsMorePlayfulOrSpicy) {
    return {
      primaryIntent: 'explicit_request',
      secondaryIntents: intents,
      motivation: 'esaudire_desiderio',
      tone: 'aggressive',
      explicitMode: true,
    };
  }

  // ======================================
  // Gruppo
  // ======================================
  if (intents.includes('interazione_gruppo')) {
    return {
      primaryIntent: 'interazione_gruppo',
      secondaryIntents: intents,
      motivation: 'stabilizzare_il_gruppo',
    };
  }

  // ======================================
  // Intimacy (NON esplicito)
  // ======================================
  if (intents.includes('intimacy')) {
    // BLOCCO: NON usare "giocare" se c'è anche hint di esplicito
    const hasExplicitHint =
      intentReport.flags?.userWantsExplicitTone ||
      intentReport.flags?.userWantsMorePlayfulOrSpicy ||
      intentReport.flags?.isDominant ||
      intentReport.flags?.isDirtyTalk;

    return {
      primaryIntent: 'intimacy',
      secondaryIntents: intents,
      motivation: hasExplicitHint ? 'sedurre' : 'connettersi',
    };
  }

  // ======================================
  // DEFAULT: solo se NON c'è alcun hint esplicito
  // ======================================
  return {
    primaryIntent: intents[0] || 'osservare',
    secondaryIntents: intents.slice(1),
    motivation: 'osservare',
  };
}

module.exports = {
  decideMotivation,
};
