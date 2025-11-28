// Layered pipeline: input → stato → memoria → percezione → motivazione/persona → generazione
const InputLayer = require('./InputLayer'); // normalizza testo e arricchisce metadati
const StateLayer = require('./StateLayer'); // stato sintetico NPC
const MemoryLayer = require('./MemoryLayer'); // memorie rilevanti
const PerceptionLayer = require('./PerceptionLayer'); // analisi del messaggio/media
const { decideMotivation } = require('./MotivationLayer'); // motivazione dominante
const { buildPersonaState } = require('./PersonaLayer'); // mood/persona/relazione

const IntentDetector = require('../intent/IntentDetector');
const MediaIntentEngine = require('../intent/MediaIntentEngine');
const SocialIntentEngine = require('../intent/SocialIntentEngine');
const EmotionalIntentEngine = require('../intent/EmotionalIntentEngine');

const PromptBuilder = require('../generation/PromptBuilder'); // costruzione prompt LLM
const { generate } = require('../generation/LlmClient'); // chiamata al modello
const PostProcessor = require('../generation/PostProcessor'); // rifinitura output/actions

const TraitEvolution = require('../learning/TraitEvolutionEngine'); // micro-evoluzione tratti
const ExperienceEngine = require('../learning/ExperienceEngine'); // XP e livelli
const SocialGraph = require('../learning/SocialGraphEngine'); // relazioni di gruppo
const MemoryConsolidation = require('../learning/MemoryConsolidationEngine'); // long-term summary

// Supabase storage per il cervello NPC (JSONB in npc_profiles)
const { getNpcProfile, updateNpcProfile } = require('../memory/npcRepository');
const { supabase } = require('../../lib/supabase');
const { detectLanguage } = require('../language/detectLanguage');
const { getUserPhoto } = require('../media/getUserPhoto');
const { saveUserPhoto } = require('../media/saveUserPhoto');
const { askPhoto } = require('../language/translations');
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
  await supabase.from('users').update({
    language: context.userLanguage,
    last_language_detected: detectedLang,
  }).eq('id', context.userId);

  const npcJson = context.npc;
  const processedContext = InputLayer.process(context, npcJson.name);
  StateLayer.loadState(npcJson, context.groupId); // state reserved for future use
  const memory = MemoryLayer.gatherMemory(context);
  const perception = PerceptionLayer.analyze(processedContext);

  // 2) Analisi del testo/media e intenzioni
  const intentReport = IntentDetector.detect(perception, processedContext);
  const mediaIntent = await MediaIntentEngine.analyze(processedContext, perception);
  const socialIntent = SocialIntentEngine.analyze(processedContext, perception);
  const emotionalIntent = EmotionalIntentEngine.analyze(perception);
  const motivation = decideMotivation(intentReport, mediaIntent, emotionalIntent);
  const personaState = buildPersonaState(processedContext, motivation, emotionalIntent);
  processedContext.intentFlags = intentReport.flags || {};

  // Se l'utente ha inviato un'immagine, salvala come foto profilo (priorità per couple photo)
  if (context.media?.type === 'image' && context.media?.url) {
    await saveUserPhoto(context.userId, context.media.url);
  }

  // Gestione richiesta couple photo → verifica presenza foto utente
  let mediaRequestOverride = null;
  let cachedUserPhoto = null;
  if (mediaIntent.type === 'couple_photo') {
    cachedUserPhoto = await getUserPhoto(context.userId);
    if (!cachedUserPhoto) {
      mediaRequestOverride = {
        type: 'user_photo_needed',
        requireConfirmation: false,
        reason: askPhoto[context.userLanguage] || askPhoto.it || 'Per fare la foto insieme ho bisogno di una tua foto.',
      };
    }
  }

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
  const prompt = PromptBuilder.buildPrompt({
    ...processedContext,
    npc: context.npc,
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

  console.log("---- 🧱 SYSTEM PROMPT ----");
  console.log(prompt);

  // =============================================================
  // 🔍 SUPER DEBUG – LOG COMPLETO di ciò che VIENE INVIATO a VENICE
  // =============================================================
  if (process.env.NODE_ENV !== "production") {
    console.log("\n\n===================== 🔍 VENICE DEBUG DUMP =====================");

    console.log("📌 MODEL:", process.env.MODEL_VENICE);
    console.log("👤 NPC:", context.npc?.name);
    console.log("💋 ToneMode:", context.npc?.preferences?.tone_mode);
    console.log("🌍 Language:", context.userLanguage);
    console.log("🧠 User Intent Flags:", intentReport?.flags || {});

    console.log("\n---- 🧱 SYSTEM PROMPT ----");
    console.log(prompt);

    console.log("\n---- 📨 MESSAGES ARRAY (LLM Input) ----");
    try {
      console.log(JSON.stringify(messagesArray, null, 2));
    } catch (err) {
      console.log("⚠ ERROR PRINTING messagesArray:", err);
    }

    console.log("================================================================\n\n");
  }

  const llmResponse = await generate(messagesArray, context.npc?.model_override || null);
  console.log("\n==================== VENICE RAW RESPONSE ====================");
  console.log(llmResponse);
  console.log("=============================================================\n");
  const processed = PostProcessor.process(llmResponse, {
    perception,
    mediaIntent,
    motivation,
    toneMode: context.npc.preferences.tone_mode,
    lastOpenings: memory.lastOpenings || [],
    intentFlags: intentReport.flags || {},
    mediaRequestOverride,
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

  // 5) Micro-evoluzione tratti e XP
  TraitEvolution.evolve(context.npc, {
    mood: personaState.mood,
    focus: motivation.motivation,
    intents: intentReport.intents,
  });

  const xp = ExperienceEngine.awardXp(context.npc, {
    intimacy: mediaIntent.wantsMedia ? 3 : 1,
    empathy: perception.textAnalysis.sentiment === 'negative' ? 3 : 1,
    conflict: intentReport.intents.includes('aggression') ? 4 : intentReport.intents.includes('frustration') ? 2 : 0,
    social: socialIntent.groupIntent === 'addressed' ? 2 : 1,
  });

  SocialGraph.update(context.groupId, {
    [context.userId]: {
      weight: xp.xp_total ? xp.xp_total / 100 : xp.total / 100,
    },
  });

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

  let finalMediaRequest = mediaRequestOverride
    || processed.mediaRequest
    || (mediaIntent.type === 'couple_photo'
      ? { type: 'couple_photo', requireConfirmation: true, reason: 'User is asking for a couple selfie' }
      : undefined);

  if (!finalMediaRequest && mediaIntent.wantsMedia) {
    finalMediaRequest = {
      type: mediaIntent.type,
      requireConfirmation: true,
      details: mediaIntent.details,
    };
  } else if (finalMediaRequest && mediaIntent.details && !finalMediaRequest.details) {
    finalMediaRequest = { ...finalMediaRequest, details: mediaIntent.details };
  }

  const finalActions = [...processed.actions];
  if (mediaRequestOverride?.type === 'user_photo_needed') {
    finalActions.push('ASK_USER_FOR_PHOTO');
  }
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
