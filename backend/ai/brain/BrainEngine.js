// =====================================================
// BRAIN ENGINE v2.1 - ThrillMe AI Core
// =====================================================
// Layered pipeline: input → stato → memoria → percezione → motivazione/persona → generazione
// AGGIORNATO: layers ora importati da brain/layers/

const {
  InputLayer,
  StateLayer,
  MemoryLayer,
  PerceptionLayer,
  MotivationLayer,
  PersonaLayer
} = require('./layers');
const { decideMotivation } = MotivationLayer;
const { buildPersonaState } = PersonaLayer;

const IntentDetector = require('../intent/IntentDetector');
const SocialIntentEngine = require('../intent/SocialIntentEngine');
const EmotionalIntentEngine = require('../intent/EmotionalIntentEngine');

const PromptBuilder = require('../generation/PromptBuilder'); // costruzione prompt LLM
const { generate } = require('../generation/LlmClient'); // chiamata al modello
const PostProcessor = require('../generation/PostProcessor'); // rifinitura output/actions

const TraitEvolution = require('../learning/TraitEvolutionEngine'); // micro-evoluzione tratti
const ExperienceEngine = require('../learning/ExperienceEngine'); // XP e livelli
const SocialGraph = require('../learning/SocialGraphEngine'); // relazioni di gruppo
const MemoryConsolidation = require('../learning/MemoryConsolidationEngine'); // long-term summary
const RelationshipEngine = require('../relationship/RelationshipEngine');
const LifeCoreTemporalEngine = require('../learning/LifeCoreTemporalEngine'); // time memory + relationship dynamics

// Supabase storage per il cervello NPC (JSONB in npc_profiles)
const { getNpcProfile, updateNpcProfile } = require('../memory/npcRepository');
const { supabase } = require('../../lib/supabase');
const { detectLanguage } = require('../language/detectLanguage');
const { sanitizeHistoryForLLM } = require('../../utils/sanitizeHistory');

const explicitOverrideTriggers = [
  'più esplicita',
  'molto più volgare',
  'più spinta',
  'hard',
  'estrema',
  'parla sporco',
  'parla sporca',
  'voglio che sei più volgare',
  'voglio che sei piu volgare',
  'ancora più cattiva',
  'ancora piu cattiva',
  'più volgare',
  'piu volgare',
];
const romanticOverrideTriggers = ['parla dolce', 'più sentimentale', 'romantica'];
const softOverrideTriggers = ['calmati', 'less kinky'];

function normalizeToneMode(toneMode) {
  if (!toneMode) return 'soft';
  const lower = (toneMode || '').toLowerCase();
  if (lower === 'extreme') return 'extreme';
  if (lower === 'romantic') return 'romantic';
  if (lower === 'explicit' || lower === 'dirty' || lower === 'nsfw') return 'explicit';
  if (lower === 'flirty' || lower === 'warm_flirty' || lower === 'playful') return 'flirty';
  if (lower === 'soft' || lower === 'serious') return 'soft';
  return 'soft';
}

function applyUserToneOverrideFromMessage(message, npc) {
  const text = (message || '').toLowerCase();
  if (explicitOverrideTriggers.some((k) => text.includes(k))) {
    npc.preferences.tone_mode = 'explicit';
    return;
  }
  if (romanticOverrideTriggers.some((k) => text.includes(k))) {
    npc.preferences.tone_mode = 'romantic';
    return;
  }
  if (softOverrideTriggers.some((k) => text.includes(k))) {
    npc.preferences.tone_mode = 'soft';
  }
}

async function think(context) {
  // 1) Input e stato (carica psiche da Supabase + history recente)
  const npcProfile = await getNpcProfile(context.npcId, context.npcName);
  context.npc = npcProfile.data;
  context.brain = npcProfile.data;
  // Se il profilo proviene dal nuovo /api/npcs/generate, ricava prompt/lifeCore
  if (!context.promptSystem) {
    context.promptSystem = npcProfile.data?.prompt_system || npcProfile.data?.promptSystem || null;
  }
  if (!context.lifeCore && npcProfile.data?.npc_json) {
    context.lifeCore = npcProfile.data.npc_json;
  }
  context.npc.preferences = context.npc.preferences || {};
  context.npc.preferences.tone_mode = normalizeToneMode(context.npc.preferences.tone_mode || 'soft');
  context.mediaData = {
    npcAvatar: context.npc.avatar || context.npc.avatar_url || context.npc.image_reference || context.npc.appearance?.avatar || null,
  };

  // Recupera ultimi 20 messaggi di chat (user/assistant) per contesto
  if (!context.history) {
    const { data: historyRows } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('user_id', context.userId)
      .eq('npc_id', context.npcId)
      .order('created_at', { ascending: false })
      .limit(20);
    context.history = (historyRows || []).reverse();
  }

  // Lingua utente
  const detectedLang = detectLanguage(context.message);
  context.userLanguage = context.userLanguage || context.metadata?.language || detectedLang || 'en';
  await supabase.from('user_profile').update({
    language: context.userLanguage,
    last_language_detected: detectedLang,
  }).eq('id', context.userId);

  const npcJson = context.npc;
  const processedContext = InputLayer.process(context, npcJson.name);
  StateLayer.loadState(npcJson, context.groupId); // state reserved for future use
  const perception = PerceptionLayer.analyze(processedContext);

  // 2) Analisi del testo/media e intenzioni
  const intentReport = IntentDetector.detect(perception, processedContext);
  const socialIntent = SocialIntentEngine.analyze(processedContext, perception);
  // IMPORTANTE: passa intentReport a EmotionalIntentEngine per rilevare contenuti espliciti/familiari
  let emotionalIntent = EmotionalIntentEngine.analyze(perception, intentReport);

  // 2b) Aggiorna LifeCore (time memory, relationship, future events)
  const temporalUpdate = LifeCoreTemporalEngine.updateFromInteraction({
    lifeCore: context.lifeCore || context.npc?.npc_json || context.npc?.lifeCore,
    message: context.message,
    perception,
    intentReport,
    history: context.history,
    now: Date.now(),
  });
  context.lifeCore = temporalUpdate.lifeCore;
  context.npc.npc_json = temporalUpdate.lifeCore;
  context.temporalSignals = temporalUpdate.signals;
  const memory = MemoryLayer.gatherMemory({ ...context, lifeCore: temporalUpdate.lifeCore });

  // Se family guard, pulisci intents aggressivi/espliciti
  if (emotionalIntent?.familyGuard) {
    intentReport.intents = (intentReport.intents || []).filter(
      (i) => !['aggression', 'explicit_sexual_request', 'spicy_request', 'explicit_request'].includes(i)
    );
    intentReport.flags = intentReport.flags || {};
    intentReport.flags.userWantsExplicitSexualTone = false;
    intentReport.flags.userWantsExplicitTone = false;
    processedContext.familyGuard = true;
  }

  let motivation = decideMotivation(intentReport, { wantsMedia: false, type: null }, emotionalIntent);

  const explicitSex = intentReport.flags?.userWantsExplicitSexualTone === true || intentReport.intents.includes('explicit_sexual_request');
  const explicitTone = intentReport.flags?.userWantsExplicitTone === true || intentReport.flags?.userWantsMorePlayfulOrSpicy === true;

  if (!processedContext.familyGuard && (explicitSex || explicitTone)) {
    // Override per richieste esplicite/dominanti
    emotionalIntent = { emotionalIntent: 'Dominate' };
    motivation = {
      primaryIntent: 'explicit_sexual_request',
      secondaryIntents: intentReport.intents,
      motivation: 'esaudire_desiderio',
    };
    processedContext.emotionOverride = { valence: 0.3, arousal: 0.9, dominance: 0.9 };
    processedContext.moodOverride = 'hot';
  }

  const personaState = buildPersonaState(processedContext, motivation, emotionalIntent);
  processedContext.intentFlags = intentReport.flags || {};

  // Media intent gestito esternamente da intentLLM: nessuna gestione locale
  let mediaRequestOverride = null;
  let cachedUserPhoto = null;

  // Aggiorna tone_mode in base ai feedback dell'utente
  if (intentReport.flags?.userWantsExplicitTone) {
    context.npc.preferences.tone_mode = 'explicit';
  } else if (intentReport.flags?.userWantsMorePlayfulOrSpicy) {
    context.npc.preferences.tone_mode = 'flirty';
  } else if (intentReport.flags?.userComplainsRepetition || intentReport.flags?.userComplainsSeriousness) {
    context.npc.preferences.tone_mode = 'flirty';
  }
  applyUserToneOverrideFromMessage(context.message, context.npc);
  context.npc.preferences.tone_mode = normalizeToneMode(context.npc.preferences.tone_mode);

  // 3) Costruisci prompt e genera con LLM
  const promptOverride = context.promptSystem || context.lifeCore?.prompt_system || context.lifeCore?.promptSystem;
  const prompt = promptOverride || PromptBuilder.buildPrompt({
    ...processedContext,
    npc: context.npc,
    lifeCore: context.lifeCore,
    timeContext: context.timeContext,
    worldContext: context.worldContext,
    motivation,
    mediaAnalysis: perception.visionAnalysis || perception.audioAnalysis,
    memory,
    history: context.history || [],
    perception,
    userLanguage: context.userLanguage || 'en',
  });



  const cleanHistory = sanitizeHistoryForLLM(context.history || []);

  const messagesArray = [
    { role: "system", content: prompt },
    ...cleanHistory.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: context.message },
  ];

  // Safety: ensure messagesArray is a valid array of role/content strings
  const safeMessages = Array.isArray(messagesArray) ? messagesArray : [];
  for (const m of safeMessages) {
    if (typeof m.content !== 'string') {
      m.content = m.content ? String(m.content) : '';
    }
  }

  // console.log("---- 🧱 SYSTEM PROMPT ----");
  // console.log(prompt);

  // =============================================================
  // 🔍 SUPER DEBUG – LOG COMPLETO di ciò che VIENE INVIATO a VENICE
  // =============================================================
  // Debug verbose disabilitato per ridurre il rumore nei log

  const explicitMode =
    intentReport.flags?.userWantsExplicitTone === true ||
    intentReport.flags?.userWantsMorePlayfulOrSpicy === true ||
    context.npc.preferences.tone_mode === 'explicit';
  const explicitSexual =
    intentReport.flags?.userWantsExplicitSexualTone === true;

  const llmResponse = await generate(
    safeMessages,
    context.npc?.model_override || null,
    explicitMode || explicitSexual
      ? {
        explicitMode: explicitSexual ? 'sexual' : true,
        explicitSexualTone: explicitSexual,
        userWantsExplicitSexualTone: explicitSexual,
        userMessage: context.message,
      }
      : {}
  );
  console.log("🧠 Venice:", (llmResponse || '').toString().substring(0, 200));
  const processed = PostProcessor.process(llmResponse, {
    perception,
    mediaIntent: { wantsMedia: false, type: null },
    motivation,
    toneMode: context.npc.preferences.tone_mode,
    lastOpenings: memory.lastOpenings || [],
    intentFlags: intentReport.flags || {},
    mediaRequestOverride: null,
  });

  // Se manca la foto utente e la richiesta è di couple_photo, forza testo esplicativo
  if (mediaRequestOverride?.type === 'user_photo_needed') {
    const reason = mediaRequestOverride.reason || '';
    processed.text = `${reason} ${processed.text || ''}`.trim();
  }

  // 4) Aggiorna memoria episodica/media (in RAM, poi salvata su Supabase)
  context.npc.memories = context.npc.memories || { episodic: [], media: [], social_graph: {}, long_term_summary: '' };
  if (context.media) {
    context.npc.memories.media.push({ ...context.media, at: Date.now() });
  }
  if (perception.textAnalysis.sentiment === 'negative') {
    context.npc.memories.episodic.push({
      description: 'Utente ha espresso disagio',
      intensity: 'high',
      at: Date.now(),
    });
  }
  // Aggiungi episodio dell'interazione corrente
  context.npc.memories.episodic.push({
    description: `Interazione: ${processedContext.message?.slice(0, 140) || ''}`,
    intent: motivation.primaryIntent,
    at: Date.now(),
  });

  // ======================================
  // MEMORY ADAPTATION per contenuti espliciti
  // ======================================
  context.npc.memories.user_preferences = context.npc.memories.user_preferences || {};

  if (intentReport.flags?.userWantsExplicitSexualTone === true) {
    // Memorizza che l'utente gradisce dirty talk e dominanza
    context.npc.memories.user_preferences.likes_explicit = true;
    context.npc.memories.user_preferences.explicit_count = (context.npc.memories.user_preferences.explicit_count || 0) + 1;
    context.npc.memories.user_preferences.last_explicit_at = Date.now();

    // Abbassa il threshold per far scattare esplicito in futuro
    // Più l'utente usa linguaggio esplicito, più l'NPC diventa propenso a rispondere esplicitamente
    context.npc.memories.user_preferences.explicit_threshold = Math.max(0.3, 1.0 - (context.npc.memories.user_preferences.explicit_count * 0.1));

    // Memorizza l'episodio esplicito
    context.npc.memories.episodic.push({
      description: 'Utente ha usato linguaggio esplicito/dominante',
      intensity: 'high',
      type: 'explicit_interaction',
      at: Date.now(),
    });
  }

  // Se l'utente usa linguaggio esplicito frequentemente, imposta il tone_mode su explicit di default
  if (context.npc.memories.user_preferences.explicit_count > 3) {
    context.npc.preferences.tone_mode = 'explicit';
  }

  // 5) Micro-evoluzione tratti e XP
  TraitEvolution.evolve(context.npc, {
    mood: personaState.mood,
    focus: motivation.motivation,
    intents: intentReport.intents,
  });

  const xp = ExperienceEngine.awardXp(context.npc, {
    intimacy: 1,
    empathy: perception.textAnalysis.sentiment === 'negative' ? 3 : 1,
    conflict: intentReport.intents.includes('aggression') ? 4 : intentReport.intents.includes('frustration') ? 2 : 0,
    social: socialIntent.groupIntent === 'addressed' ? 2 : 1,
  });

  SocialGraph.update(context.groupId, {
    [context.userId]: {
      weight: xp.xp_total ? xp.xp_total / 100 : xp.total / 100,
    },
  });

  // Relationship vector update (npc <-> user)
  RelationshipEngine.update(context.lifeCore, {
    perception,
    intents: intentReport.intents,
  });
  context.npc.npc_json = context.lifeCore;

  const consolidatedNpc = MemoryConsolidation.consolidate(
    context.npc,
    `Mood: ${personaState.mood}. ${memory.longTerm}`,
  );
  context.npc = consolidatedNpc;
  context.brain = consolidatedNpc;
  context.npc.relationship_with_user = {
    ...(context.npc.relationship_with_user || {}),
    last_interaction: Date.now(),
  };

  // Aggiorna long term summary ogni 10 messaggi circa
  const interactionCount = (context.npc.memories.episodic || []).length;
  if (interactionCount % 10 === 0) {
    context.npc.memories.long_term_summary = `Mood attuale: ${personaState.mood}. Ultime intenzioni: ${intentReport.intents.join(', ')}. XP: ${context.npc.experience.xp_total}`;
  }
  // Aggiorna last openings per anti-ripetizione
  const opening = (processed.text || '').slice(0, 80);
  context.npc.memories.last_openings = [opening, ...(context.npc.memories.last_openings || [])].slice(0, 5);

  // 6) Persisti il cervello NPC aggiornato in Supabase
  await updateNpcProfile(context.npcId, context.brain || context.npc);

  let finalMediaRequest = null;

  const finalActions = [...processed.actions];
  if (!finalActions.includes('PERSONAL_REPLY')) {
    finalActions.push('PERSONAL_REPLY');
  }

  return {
    text: processed.text,
    mediaRequest: finalMediaRequest,
    actions: finalActions,
    updatedState: {
      mood: personaState.mood,
      relationshipSummary: personaState.relationship,
      xpDelta: xp,
      notableEvent: perception.textAnalysis.sentiment === 'negative' ? 'utente in crisi' : null,
      memorySnapshot: context.npc.memories.long_term_summary,
    },
  };
}

// Esempi di utilizzo:
// (1) Chat 1:1 consolante
// await think({
//   npcId: 'npc_123',
//   userId: 'user_1',
//   message: 'Mi sento davvero a pezzi oggi...',
// });
//
// (2) Richiesta implicita di foto
// await think({
//   npcId: 'npc_123',
//   userId: 'user_1',
//   message: 'Voglio vederti... mi manchi.',
// });
//
// (3) Contesto di gruppo con richiesta diretta
// await think({
//   npcId: 'npc_123',
//   userId: 'user_2',
//   groupId: 'group_42',
//   message: 'Luna, cosa ne pensi di quello che ha detto Jason?',
// });

module.exports = {
  think,
};
