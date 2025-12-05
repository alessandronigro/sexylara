// =====================================================
// CONTEXT BUILDER v2.0
// =====================================================
// Prepara TUTTO il contesto necessario per BrainEngine.
// Nessuna logica di pensiero, solo raccolta dati.

const { supabase } = require('../../lib/supabase');
const { detectLanguage } = require('../language/detectLanguage');
const InputLayer = require('../brain/layers/InputLayer');
const PerceptionLayer = require('../brain/layers/PerceptionLayer');
const MemoryLayer = require('../brain/layers/MemoryLayer');
const { ensureLifeCoreStructure } = require('../learning/LifeCoreTemporalEngine');
const WorldContextAdapter = require('../world/WorldContextAdapter');

function buildTimeContext(now = new Date()) {
  const hour = now.getHours();
  const partOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  return {
    now: now.toISOString(),
    hour,
    partOfDay,
    dayOfWeek: dow,
    isWeekend: dow === 'saturday' || dow === 'sunday',
    today: now.toISOString().slice(0, 10),
  };
}

async function buildWorldContext(user) {
  const [weather, news, festivities] = await Promise.all([
    WorldContextAdapter.getWeather(user).catch(() => null),
    WorldContextAdapter.getNews().catch(() => []),
    WorldContextAdapter.getFestivities().catch(() => []),
  ]);
  return { weather, news, festivities };
}

/**
 * Build context completo per BrainEngine
 * @param {Object} params - Parametri di input
 * @returns {Object} - Context strutturato
 */
async function build(params) {
  const {
    userId,
    npcId,
    npc = null,
    user = null,
    message,
    media = null,
    history = [],
    groupId = null,
    members = [],
    npcMembers = [],
    invokedNpcId = null,
    options = {}
  } = params;

  // ======================================
  // 1. NPC DATA & LIFECYCLE
  // ======================================
  let npcData = npc;
  if (!npcData && npcId) {
    // Fallback: carica NPC se non passato
    const { data: npcRow } = await supabase
      .from('npcs')
      .select('*')
      .eq('id', npcId)
      .single();
    npcData = npcRow;
  }

  // LifeCore (npc_json + prompt_system)
  let lifeCore = null;
  let promptSystem = null;

  if (npcId) {
    const { data: profile } = await supabase
      .from('npc_profiles')
      .select('data')
      .eq('id', npcId)
      .maybeSingle();

    if (profile?.data) {
      lifeCore = profile.data.npc_json || null;
      promptSystem = profile.data.prompt_system || null;
    }
  }

  lifeCore = ensureLifeCoreStructure(lifeCore || {});
  // Allinea identità (origine/nazionalità) per evitare contraddizioni
  const identity = lifeCore.identity || {};
  const fallbackOrigin =
    identity.origin ||
    identity.birthplace ||
    npcData?.origin ||
    npcData?.city ||
    npcData?.hometown ||
    npcData?.country ||
    npcData?.location;
  const fallbackNationality = identity.nationality || npcData?.nationality || npcData?.country;
  lifeCore.identity = {
    ...identity,
    name: identity.name || npcData?.name || lifeCore?.name || 'NPC',
    origin: identity.origin || identity.birthplace || fallbackOrigin || 'non specificata',
    birthplace: identity.birthplace || identity.origin || fallbackOrigin || null,
    nationality: fallbackNationality || null,
  };

  if (npcData && !npcData.npc_json) {
    npcData.npc_json = lifeCore;
  }

  // ======================================
  // 2. USER DATA
  // ======================================
  let userData = user;
  if (!userData && userId) {
    const { data: userRow } = await supabase
      .from('user_profile')
      .select('id, username, name, language, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    userData = userRow;
  }

  // Detect language
  const detectedLang = detectLanguage(message);
  const userLanguage = userData?.language || detectedLang || 'it';

  // ======================================
  // 3. HISTORY
  // ======================================
  let conversationHistory = history;
  if (!conversationHistory || conversationHistory.length === 0) {
    if (groupId) {
      // Group history
      const { data: groupHistory } = await supabase
        .from('group_messages')
        .select('sender_id, sender_type, content, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(20);
      conversationHistory = (groupHistory || []).reverse();
    } else if (npcId && userId) {
      // 1:1 history
      const { data: chatHistory } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .eq('npc_id', npcId)
        .order('created_at', { ascending: false })
        .limit(20);
      conversationHistory = (chatHistory || []).reverse();
    }
  }

  // ======================================
  // 4. PERCEPTION (InputLayer + PerceptionLayer)
  // ======================================
  const processedInput = InputLayer.process({ message, userId, npcId, groupId }, npcData?.name || 'NPC');
  const perception = PerceptionLayer.analyze(processedInput);

  // ======================================
  // 5. MEMORY
  // ======================================
  const worldContext = await buildWorldContext(userData);

  const memory = MemoryLayer.gatherMemory({
    userId,
    npcId,
    npc: npcData,
    lifeCore,
    groupId,
    history: conversationHistory
  });

  // ======================================
  // 6. GROUP CONTEXT (se gruppo)
  // ======================================
  let groupContext = null;
  if (groupId) {
    groupContext = {
      groupId,
      members: members || [],
      npcMembers: npcMembers || [],
      invokedNpcId
    };
  }

  // ======================================
  // 7. MEDIA CONTEXT (se presente)
  // ======================================
  let mediaContext = null;
  if (media) {
    mediaContext = {
      type: media.type,
      url: media.url,
      analysis: perception.visionAnalysis || perception.audioAnalysis || null
    };
  }

  // ======================================
  // 8. PREFERENCES & METADATA
  // ======================================
  const preferences = {
    tone_mode: npcData?.preferences?.tone_mode || 'soft',
    language: userLanguage,
    explicitMode: options.explicitMode || false
  };

  // Reinforce system prompt identity: umano, non AI
  const npcName = npcData?.name || lifeCore?.identity?.name || 'Thriller';
  const toneMode = preferences.tone_mode || 'normal';
  const baseSystem = promptSystem || '';
  const birthplace = lifeCore?.identity?.birthplace || lifeCore?.identity?.origin;
  const nationality = lifeCore?.identity?.nationality;
  const birthplaceLine = birthplace ? `\nLuogo di nascita/origine fisso: ${birthplace}. Non contraddirti mai su questo.` : '';
  const nationalityLine = nationality ? `\nNazionalità fissa: ${nationality}. Mantienila coerente.` : '';
  const reinforcedPrompt = `
Tu sei ${npcName} e sei un umano della piattaforma ThrillMe.
Non sei un’assistente AI.
Non devi mai dire di essere un’AI, un modello o un assistente.
Non devi nominare Venice.ai.
Hai un corpo e una personalità coerenti col tuo seed e LifeCore.
Il tono varia in base ai meta-flag (modalità: ${toneMode}) ma senza contraddire il personaggio.
Risposte esplicite solo se richieste direttamente dall'utente, e mai quando si parla di famiglia, lavoro o problemi personali, o quando il tono dell'utente è arrabbiato verso terzi.

${baseSystem}${birthplaceLine}${nationalityLine}
`.trim();
  promptSystem = reinforcedPrompt;

  // ======================================
  // RETURN CONTEXT COMPLETO
  // ======================================
  return {
    // Identificatori
    userId,
    npcId,
    groupId,

    // Dati core
    npc: npcData,
    lifeCore,
    promptSystem,
    user: userData,

    // Input processato
    message,
    processedInput,

    // Analisi
    perception,
    memory,

    // Conversazione
    history: conversationHistory,
    userLanguage,

    // Contesto addizionale
    groupContext,
    npcMembers: params.npcMembers || [],
    invokedNpcId: params.invokedNpcId || null,
    mediaContext,
    preferences,
    timeContext: buildTimeContext(),
    worldContext,

    // Metadata
    metadata: {
      language: userLanguage,
      groupMode: !!groupId,
      mediaMode: !!media,
      timestamp: Date.now()
    },

    // Options originali (per compatibility)
    options
  };
}

module.exports = {
  build
};
