// ai/brainEngine.js

/**
 * Wrapper di compatibilità tra il vecchio server-ws e il nuovo BrainEngine.think()
 * + gestione intenti utente (testo) + media understanding (immagini/audio)
 */

const { think } = require('./brain/BrainEngine');
// Media intent e altre euristiche locali disabilitate: BrainEngine ora genera solo testo.

/**
 * Utility per recuperare userId da diversi formati di oggetto utente.
 */
function resolveUserId(user) {
  return user?.id || user?.user_id || user?.owner_id || user?.userId || null;
}

/**
 * Pulisce e accorcia il testo generato dall'AI:
 * - elimina parole inventate / glitch
 * - riduce i monologhi
 * - applica uno stile coerente con la personalità NPC
 */
function postProcessAssistantText(text, language = 'it', npc = {}) {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text.trim();

  // ============================
  // 1. Normalizzazione base
  // ============================
  // rimuovi asterischi usati come markup ("*mi giro*")
  cleaned = cleaned.replace(/\*/g, ' ');
  // collassa spazi multipli
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // ============================
  // 2. Rimozione parole chiaramente "glitchate"
  //    (tanti caratteri di fila o pochissime vocali)
  // ============================
  cleaned = cleaned
    .split(/\s+/)
    .filter((word) => {
      const w = word.trim();
      if (!w) return false;

      // Mantieni emoji e punteggiatura isolata
      if (/^[.,!?…]+$/.test(w)) return true;

      const base = w.normalize('NFD').replace(/[^a-zA-Zàèéìòùç]/gi, '');
      if (!base) return false;

      // Se è lunghissima e senza abbastanza vocali → probabile nonsense
      const vowels = base.match(/[aeiouàèéìòù]/gi) || [];
      if (base.length > 14 && vowels.length < 3) return false;

      // Se ha più di 6 consonanti consecutive → probabile glitch
      if (/[^aeiouàèéìòù]{6,}/i.test(base)) return false;

      return true;
    })
    .join(' ')
    .trim();

  // ============================
  // 3. Ripulisci caratteri residui strani
  // ============================
  cleaned = cleaned.replace(/[^a-zA-Z0-9àèéìòùç.,!?'"() ]+/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // ============================
  // 4. Elimina frasi troppo "servizievoli" / da assistente
  // ============================
  const patterns = [
    /sono qui per ascoltarti[^.?!]*[.?!]/gi,
    /sono qui per te[^.?!]*[.?!]/gi,
    /sono qui per aiutarti[^.?!]*[.?!]/gi,
    /raccontami le tue fantasie[^.?!]*[.?!]/gi,
    /dimmi cosa desideri[^.?!]*[.?!]/gi,
    /sono un'?intelligenza artificiale[^.?!]*[.?!]/gi,
    /ti aiuterò[^.?!]*[.?!]/gi,
  ];
  patterns.forEach((re) => {
    cleaned = cleaned.replace(re, '');
  });
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // ============================
  // 5. Riduci descrizioni troppo lunghe (tipo mare infinito)
  // ============================
  const beachKeywords = ['mare', 'spiaggia', 'onde', 'brezza', 'marina'];
  const lower = cleaned.toLowerCase();
  const beachCount = beachKeywords.reduce(
    (acc, k) => acc + (lower.split(k).length - 1),
    0
  );
  if (beachCount > 3) {
    // Tieni al massimo due frasi con tema "mare" / "spiaggia"
    const sentences = cleaned.split(/([.!?])/);
    let kept = '';
    let seenBeach = 0;
    for (let i = 0; i < sentences.length; i += 2) {
      const chunk = (sentences[i] || '') + (sentences[i + 1] || '');
      const chunkLower = chunk.toLowerCase();
      if (beachKeywords.some((k) => chunkLower.includes(k))) {
        seenBeach++;
        if (seenBeach > 2) continue;
      }
      kept += chunk.trim() + ' ';
    }
    cleaned = kept.trim();
  }

  // ============================
  // 6. Taglia i monologhi (risposte più brevi e naturali)
  // ============================
  const MAX_CHARS = 320;
  if (cleaned.length > MAX_CHARS) {
    const slice = cleaned.slice(0, MAX_CHARS);
    const lastPunct = Math.max(
      slice.lastIndexOf('.'),
      slice.lastIndexOf('!'),
      slice.lastIndexOf('?')
    );
    cleaned = slice.slice(0, lastPunct > 80 ? lastPunct + 1 : MAX_CHARS).trim();
  }

  // ============================
  // 7. Applica un tocco di personalità NPC
  // ============================
  if (npc && npc.personality_type && cleaned.length > 0) {
    switch (npc.personality_type) {
      case 'dominant': {
        // più diretta, meno punti esclamativi ripetuti
        cleaned = cleaned.replace(/!+/g, '!');
        break;
      }
      case 'playful': {
        if (!/[😉😏]$/.test(cleaned)) cleaned += ' 😏';
        break;
      }
      case 'romantic': {
        if (!/[💫❤️]$/.test(cleaned)) cleaned += ' 💫';
        break;
      }
      case 'shy': {
        if (!/\.\.\.$/.test(cleaned)) cleaned = cleaned.replace(/([^.?!])$/, '$1...');
        break;
      }
      default:
        break;
    }
  }

  // ============================
  // 8. Fallback se risultato troppo corto o vuoto
  // ============================
  if (!cleaned || cleaned.length < 3) {
    cleaned = npc?.name
      ? `${npc.name} ti guarda in silenzio, con un piccolo sorriso.`
      : 'Ti guardo in silenzio, con un piccolo sorriso.';
  }

  return cleaned.trim();
}

/**
 * Wrapper principale usato da server-ws.js
 * Mantiene la stessa firma originale, ma delega a think() + post-processing.
 */
async function generateIntelligentResponse(ai, user, message, group = null, recentMessages = [], _generateChatReply, options = {}) {
  const userId = resolveUserId(user);
  const language = user?.language || 'it';
  const forcedMediaType = options.forcedMediaType || null;

  const context = {
    npcId: ai.id,
    userId,
    groupId: group?.id || null,
    message,
    npcName: ai.name,
    history: recentMessages,
    metadata: {
      language,
      groupMode: !!group
    }
  };

  // 1) Chiamata al core BrainEngine
  const result = await think(context);
  let finalText = result.text || '';
  let mediaRequest = forcedMediaType ? { type: forcedMediaType, details: null } : null;

  // 2) Post-processing del testo (anti-monologo, anti-servizievole)
  finalText = postProcessAssistantText(finalText, language, ai);

  // Ritorna nel formato compatibile con server-ws.js
  return {
    output: finalText,
    type: mediaRequest?.type || 'chat',
    mediaRequested: !!mediaRequest,
    mediaRequest,
    actions: result.actions || [],
    updatedState: result.updatedState
  };
}

/**
 * Compat wrapper usato in alcune parti legacy
 */
async function processInteraction(npcData, userMessage, userId, history = []) {
  const result = await think({
    npcId: npcData.id,
    userId,
    groupId: null,
    message: userMessage,
    history,
    metadata: { language: 'it' }
  });

  return {
    systemPrompt: result.text,
    npcStateUpdates: result.updatedState,
    xpUpdates: result.updatedState?.xpDelta,
    intent: result.updatedState?.actions,
    mood: result.updatedState?.mood,
    mediaIntent: result.mediaRequest,
    isConfirmation: false,
    pendingMedia: null
  };
}

/**
 * MediaUnderstandingEngine:
 * analizza immagini e audio utente tramite Replicate
 * (usato da server-ws.js, NON cambiare la firma pubblica).
 */
const MediaUnderstandingEngine = {
  /**
   * Analizza media (image/audio) e ritorna:
   * - analysis
   * - emotionalImpact
   * - memoryRecord
   * - reaction (testo base da poter usare)
   */
  async processReceivedMedia(type, url, girlfriend = null, userId = null) {
    try {
      let analysis = {};
      let emotionalImpact = null;
      let memoryRecord = null;
      let reaction = null;

      if (type === 'image') {
        analysis = await analyzeImage(url);

        emotionalImpact = {
          attachment: analysis.containsUserFace ? 3 : 1,
          intimacy: analysis.context === 'selfie' ? 3 : 1,
          trust: 1,
          mood: analysis.emotion || 'neutral'
        };

        reaction = this._buildImageReaction(analysis, girlfriend);

        memoryRecord = {
          kind: 'user_image',
          url,
          summary: analysis.description || 'foto ricevuta',
          tags: analysis.tags || [],
          emotion: analysis.emotion || null,
          created_at: new Date().toISOString()
        };
      } else if (type === 'audio') {
        analysis = await analyzeAudio(url);

        emotionalImpact = {
          attachment: analysis.userIsTalking ? 2 : 1,
          intimacy: (analysis.tones || []).includes('flirt') ? 3 : 1,
          trust: 2,
          mood: analysis.emotion || 'neutral'
        };

        reaction = this._buildAudioReaction(analysis, girlfriend);

        memoryRecord = {
          kind: 'user_audio',
          url,
          transcription: analysis.transcription || null,
          emotion: analysis.emotion || null,
          tones: analysis.tones || [],
          created_at: new Date().toISOString()
        };
      } else {
        analysis = { type, url };
        emotionalImpact = null;
        memoryRecord = { type, url, created_at: new Date().toISOString() };
        reaction = null;
      }

      return {
        analysis,
        emotionalImpact,
        memoryRecord,
        reaction
      };
    } catch (err) {
      console.error('[MediaUnderstandingEngine] Error processing media:', err);
      return {
        analysis: { type, url, error: err?.message },
        emotionalImpact: null,
        memoryRecord: { type, url, error: err?.message, created_at: new Date().toISOString() },
        reaction: null
      };
    }
  },

  /**
   * Prompt di contesto che viene appeso al testo utente in server-ws.js
   */
  generateContextPrompt(analysis, type) {
    const descr = analysis?.description || '';
    const emo = analysis?.emotion || analysis?.primary_emotion || 'neutral';

    return `
[CONTESTO MEDIA]
L'utente ti ha inviato un ${type}.
Analisi automatica:
- Descrizione: ${descr}
- Emozione percepita: ${emo}
- Dettagli tecnici: ${JSON.stringify(analysis)}

Rispondi in modo coerente con questo media: fai riferimento al contenuto,
alla situazione e al tono emotivo. Non essere servizievole, non fare la psicologa:
parla come un personaggio vivo, che reagisce spontaneamente al media ricevuto.
`;
  },

  async updateNpcMemory(_girlfriend, _record) {
    // Hook per futura integrazione con Supabase (memoria multimediale).
    return;
  },

  _buildImageReaction(analysis, girlfriend) {
    const name = girlfriend?.name || 'Lei';
    if (analysis.containsUserFace && analysis.smile) {
      return `${name} nota il tuo sorriso e si scioglie un po'.`;
    }
    if (analysis.context === 'selfie') {
      return `${name} guarda il tuo selfie e ti immagina ancora più vicino.`;
    }
    if (analysis.description) {
      return `${name} osserva la tua foto: "${analysis.description}".`;
    }
    return `${name} osserva la tua foto con attenzione e curiosità.`;
  },

  _buildAudioReaction(analysis, girlfriend) {
    const name = girlfriend?.name || 'Lei';
    if (analysis.transcription && (analysis.tones || []).includes('flirt')) {
      return `${name} ascolta la tua voce e sente chiaramente quel tono malizioso...`;
    }
    if (analysis.transcription) {
      return `${name} ti ascolta e rimane colpita da ciò che dici.`;
    }
    return `${name} ascolta il tuo audio e prova a immaginare il tuo stato d'animo.`;
  }
};

const brainEngine = {
  generateIntelligentResponse
};

function buildSentientPrompt() {
  // placeholder per compatibilità legacy
  return '';
}

async function generateNpcInitiativeMessage(npcData, user) {
  const userId = user?.id || user?.user_id || user;
  if (!npcData?.id || !userId) throw new Error('missing npc or user for initiative');

  // Carica profilo NPC (senza salvare)
  const npc = npcData;

  // Recupera ultimi messaggi
  const { data: historyRows } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .eq('npc_id', npc.id)
    .order('created_at', { ascending: false })
    .limit(10);
  const history = (historyRows || []).reverse();

  const context = {
    npcId: npc.id,
    npcName: npc.name,
    userId,
    message: 'Scrivi tu un messaggio spontaneo all’utente.',
    history,
    npc,
    userLanguage: user?.language || 'it',
  };

  const processedContext = InputLayer.process(context, npc.name);
  const memory = MemoryLayer.gatherMemory({ ...context, npc });
  const perception = PerceptionLayer.analyze(processedContext);
  const motivation = {
    primaryIntent: 'initiative',
    secondaryIntents: [],
    motivation: 'engage',
  };
  const personaState = buildPersonaState(processedContext, motivation, perception);

  const prompt = PromptBuilder.buildPrompt({
    ...processedContext,
    npc,
    motivation,
    mediaAnalysis: perception.visionAnalysis || perception.audioAnalysis,
    memory,
    history,
    perception,
    userLanguage: context.userLanguage || 'it',
  });

  const messagesArray = [
    { role: 'system', content: prompt },
    { role: 'user', content: 'Scrivi un messaggio spontaneo e breve per l’utente.' },
  ];

  const llmResponse = await generate(messagesArray, npc?.model_override || null);

  return {
    text: (llmResponse || '').trim(),
    npcId: npc.id,
  };
}

module.exports = {
  brainEngine,
  buildSentientPrompt,
  generateIntelligentResponse,
  processInteraction,
  MediaUnderstandingEngine,
  generateNpcInitiativeMessage,
};
