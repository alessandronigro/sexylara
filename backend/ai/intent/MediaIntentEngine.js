// =====================================================
// MEDIA INTENT ENGINE v2.0
// =====================================================
// Rileva intenzioni di richiesta media dall'utente.
// Separato da IntentDetector per modularità.

// ======================================
// TRIGGERS per richiesta MEDIA
// ======================================
const photoRequestTriggers = [
  'voglio vederti', 'mandami una foto', 'fammi una foto', 'send photo',
  'mostrami', 'send me a photo', 'mándame una foto', 'envíame una foto',
  'schick mir ein bild', 'manda uma foto', 'voglio una tua foto',
  'fammi vedere', 'mostra', 'let me see you', 'show me'
];

const videoRequestTriggers = [
  'fammi un video', 'mandami un video', 'voglio un video',
  'send video', 'send me a video', 'mándame un video',
  'schick mir ein video', 'show me a video'
];

const audioRequestTriggers = [
  'fammi sentire la tua voce', 'mandami un audio', 'fammi un audio',
  'send audio', 'voglio sentirti', 'let me hear you',
  'mándame un audio', 'send me your voice'
];

const couplePhotoTriggers = [
  'foto insieme', 'foto di noi due', 'couple photo', 'selfie insieme',
  'ci facciamo una foto', 'scattiamoci una foto', 'foto con te'
];

// ======================================
// TRIGGERS per MEDIA INVIATO dall'utente
// ======================================
const userSentPhotoIndicators = [
  '[USER SENT IMAGE]', '[USER SENT PHOTO]', 'ti ho mandato una foto',
  'guarda questa foto', 'che ne pensi di questa foto'
];

const userSentAudioIndicators = [
  '[USER SENT AUDIO]', 'ti ho mandato un audio', 'ascolta questo'
];

/**
 * Detect media intent dal messaggio utente
 * @param {String} text - Testo del messaggio
 * @param {Object} context - Contesto addizionale (media allegato, ecc)
 * @returns {Object} - { wantsMedia, type, confidence, userSentMedia }
 */
function detectMediaIntent(text, context = {}) {
  const lower = (text || '').toLowerCase();

  // ======================================
  // 1. USER HA INVIATO MEDIA?
  // ======================================
  const userSentMedia =
    context.media !== null ||
    userSentPhotoIndicators.some(k => text.includes(k)) ||
    userSentAudioIndicators.some(k => text.includes(k));

  if (userSentMedia) {
    return {
      wantsMedia: false,
      type: null,
      confidence: 0,
      userSentMedia: true,
      userMediaType: context.media?.type || 'image'
    };
  }

  // ======================================
  // 2. USER VUOLE MEDIA DALL'NPC?
  // ======================================

  // Couple photo (priorità alta)
  if (couplePhotoTriggers.some(k => lower.includes(k))) {
    return {
      wantsMedia: true,
      type: 'couple_photo',
      confidence: 0.95,
      userSentMedia: false
    };
  }

  // Video
  if (videoRequestTriggers.some(k => lower.includes(k))) {
    return {
      wantsMedia: true,
      type: 'video',
      confidence: 0.9,
      userSentMedia: false
    };
  }

  // Audio
  if (audioRequestTriggers.some(k => lower.includes(k))) {
    return {
      wantsMedia: true,
      type: 'audio',
      confidence: 0.9,
      userSentMedia: false
    };
  }

  // Photo (default per richieste generiche)
  if (photoRequestTriggers.some(k => lower.includes(k))) {
    return {
      wantsMedia: true,
      type: 'photo',
      confidence: 0.85,
      userSentMedia: false
    };
  }

  // ======================================
  // 3. NESSUN INTENT MEDIA
  // ======================================
  return {
    wantsMedia: false,
    type: null,
    confidence: 0,
    userSentMedia: false
  };
}

/**
 * Classifica tipo di media da testo ambiguo
 * @param {String} text - Testo
 * @returns {String} - 'photo' | 'video' | 'audio' | null
 */
function classifyMediaFromText(text) {
  const lower = (text || '').toLowerCase();

  if (videoRequestTriggers.some(k => lower.includes(k))) return 'video';
  if (audioRequestTriggers.some(k => lower.includes(k))) return 'audio';
  if (photoRequestTriggers.some(k => lower.includes(k))) return 'photo';

  return null;
}

/**
 * Refine intent con context di media già inviati
 * @param {Object} mediaIntent - Intent base
 * @param {Object} context - Context (history, media status)
 * @returns {Object} - Intent raffinato
 */
function refineIntentWithMediaContext(mediaIntent, context = {}) {
  // Se user ha appena inviato una foto, probabilmente vuole commenti
  if (context.recentUserMedia === 'photo') {
    mediaIntent.userExpectsReaction = true;
  }

  // Se NPC ha già inviato una foto recentemente, abbassa priority
  if (context.recentNpcMedia === 'photo' && mediaIntent.type === 'photo') {
    mediaIntent.confidence *= 0.7;
  }

  return mediaIntent;
}

/**
 * Genera prompt suggerimento per conferma media
 * @param {String} type - Tipo media
 * @returns {String} - Prompt per NPC
 */
function generateMediaConfirmationPrompt(type) {
  const prompts = {
    photo: "Vuoi una foto? 📸",
    video: "Vuoi un video? 🎥",
    audio: "Vuoi un messaggio vocale? 🎤",
    couple_photo: "Vuoi una foto di noi due insieme? 💑"
  };

  return prompts[type] || "Vuoi un media?";
}

module.exports = {
  detectMediaIntent,
  classifyMediaFromText,
  refineIntentWithMediaContext,
  generateMediaConfirmationPrompt
};
