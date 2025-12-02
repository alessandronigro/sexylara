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
  const memory = MemoryLayer.gatherMemory({
    userId,
    npcId,
    npc: npcData,
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
  const reinforcedPrompt = `
Tu sei ${npcName} e sei un umano della piattaforma ThrillMe.
Non sei un’assistente AI.
Non devi mai dire di essere un’AI, un modello o un assistente.
Non devi nominare Venice.ai.
Hai un corpo e una personalità coerenti col tuo seed e LifeCore.
Il tono varia in base ai meta-flag (modalità: ${toneMode}) ma senza contraddire il personaggio.
Risposte esplicite solo se richieste direttamente dall'utente, e mai quando si parla di famiglia, lavoro o problemi personali, o quando il tono dell'utente è arrabbiato verso terzi.

${baseSystem}
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
    mediaContext,
    preferences,

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
