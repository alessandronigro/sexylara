const overusedIntros = [
  'sto ascoltando',
  'ti sento',
  'sono qui',
  'capisco',
  'dimmi',
  'raccontami',
];

const bannedPhrases = [
  'sono qui per te',
  'raccontami di più',
  'quali sono le tue fantasie',
  'sono qui ad ascoltarti',
  'come posso aiutarti',
  'dimmi cosa vuoi',
  'sto qui per soddisfarti',
  'come ti senti',
  'perché provi questo',
  'capisco cosa stai provando',
  'ovviamente',
  'come modello ai',
  'in quanto ia',
  'posso fare qualcosa',
  'se hai bisogno',
  'non esitare a',
  'sono programmata',
];

const openings = {
  soft: [
    'Mmm...',
    'Sai...',
    '*Ti guardo negli occhi*',
    'Sento che...',
  ],
  flirty: [
    'Ehi...',
    '*Sorrido maliziosa*',
    'Mmm, interessante...',
    'Sai cosa penso?',
  ],
  explicit: [
    'Voglio...',
    '*Ti tocco*',
    'Sento il tuo...',
    'Mmm, sì...',
  ],
};

function resolveToneMode(toneMode) {
  const lower = (toneMode || '').toLowerCase();
  if (lower === 'extreme') return 'explicit';
  if (['explicit', 'dirty', 'nsfw'].includes(lower)) return 'explicit';
  if (lower === 'romantic') return 'soft';
  if (lower === 'flirty' || lower === 'warm_flirty' || lower === 'playful') return 'flirty';
  return 'soft';
}

function filterBannedPhrases(text) {
  let filtered = text;
  bannedPhrases.forEach(phrase => {
    const regex = new RegExp(phrase, 'gi');
    filtered = filtered.replace(regex, '');
  });

  // Clean up double spaces and punctuation left behind
  filtered = filtered.replace(/\s+/g, ' ').replace(/\s([.,?!])/g, '$1').trim();
  return filtered;
}

function limitQuestions(text) {
  // Simple heuristic: if more than 1 question mark, try to remove subsequent questions
  const parts = text.split('?');
  if (parts.length > 2) {
    // Keep only the first question (parts[0] + '?') and the rest as statements if possible
    // This is tricky without NLP, so we'll just truncate after the first question if it's too much
    // Or better, just replace extra '?' with '.'
    let newText = parts[0] + '?';
    for (let i = 1; i < parts.length - 1; i++) {
      newText += parts[i] + '.';
    }
    newText += parts[parts.length - 1];
    return newText;
  }
  return text;
}

function applyTone(text, toneMode) {
  // Minimal tone application, mostly rely on LLM
  return text;
}

function rewriteIfRepetitive(text, toneMode, lastOpenings, intentFlags) {
  const lower = text.toLowerCase();
  const matchesHistory = (lastOpenings || []).some((o) => lower.startsWith(o.toLowerCase()));

  if (!matchesHistory) return text;

  const normalized = resolveToneMode(toneMode);
  const toneList = openings[normalized] || openings.soft;
  const opener = toneList[Math.floor(Math.random() * toneList.length)];

  // Try to keep the body
  const body = text.replace(/^[^.?!]{0,50}[.?!]\s*/i, '').trim();
  return `${opener} ${body}`.trim();
}

function finishIfCutOff(text) {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (/[.!?…]|["')\]]/.test(trimmed.slice(-1))) return text;
  return `${text}...`;
}

function process(output, context) {
  const intentFlags = context.intentFlags || {};
  let toneMode = resolveToneMode(context.toneMode || 'soft');

  if (intentFlags?.userWantsMorePlayfulOrSpicy) {
    toneMode = 'explicit';
  }

  // 1. Filter banned phrases
  let cleaned = filterBannedPhrases(output);

  // 2. Limit questions
  cleaned = limitQuestions(cleaned);

  // 3. Check repetition
  cleaned = rewriteIfRepetitive(cleaned, toneMode, context.lastOpenings, intentFlags);

  // 4. Finish cutoff
  const finalized = finishIfCutOff(cleaned);

  const actions = [];
  if (context.motivation.motivation === 'sedurre') {
    actions.push('SUGGEST_MEDIA');
  }
  if (context.perception?.textAnalysis?.sentiment === 'negative') {
    actions.push('ASK_EMPATHY');
  }
  if (context.mediaIntent?.type === 'couple_photo') {
    actions.push('GENERATE_COUPLE_PHOTO');
  }

  let mediaRequest = context.mediaRequestOverride;
  if (!mediaRequest && context.mediaIntent?.wantsMedia) {
    mediaRequest = {
      type: context.mediaIntent.type,
      requireConfirmation: true,
      details: context.mediaIntent.details,
    };
  } else if (mediaRequest && context.mediaIntent?.details && !mediaRequest.details) {
    mediaRequest = { ...mediaRequest, details: context.mediaIntent.details };
  }
  if (mediaRequest?.type === 'user_photo_needed' && !actions.includes('ASK_USER_FOR_PHOTO')) {
    actions.push('ASK_USER_FOR_PHOTO');
  }

  return {
    text: finalized,
    mediaRequest,
    actions
  };
}

module.exports = {
  process,
};
