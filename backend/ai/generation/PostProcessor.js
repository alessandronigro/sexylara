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
  'sono un ai',
  'sono una ai',
  'sono un assistente ai',
  'sono un assistente virtuale',
  'sono un modello',
  'sono un\'intelligenza artificiale',
  'sono stata creata',
  'venice',
  'scusa ma non posso',
  'mi dispiace ma non posso'
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

function removeModelOpeners(text) {
  if (!text) return text;
  return text
    .replace(/^Beh[, ]+/i, "")
    .replace(/^Allora[, ]+/i, "")
    .replace(/^Direi che[, ]+/i, "")
    .replace(/^Penso che[, ]+/i, "")
    .trim();
}

function shortenNatural(text) {
  // NO LENGTH CUT - return full text
  return text;
}

function removeNovelPatterns(text) {
  if (!text) return text;
  return text
    .replace(/l[ae] (luce|stanza|aria|atmosfera|penombra)[^.,]+[,\.]?/gi, "")
    .replace(/(mi sembrava|come se)[^.,]+[,\.]?/gi, "")
    .replace(/(danzare|sussurrare|avvolgere)[^.,]+/gi, "")
    .trim();
}

function stripRomanticFluff(text) {
  if (!text) return text;
  return text
    .replace(/(luce|tramonto|soffusa|sussurro|atmosfera)[^.,]+/gi, "")
    .replace(/(come se|mi sembra|mi avvolge)[^.,]+/gi, "")
    .trim();
}

function limitSentences(text, max = 2) {
  if (!text) return text;
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= max) return text;
  return parts.slice(0, max).join(" ").trim();
}

function microVariation(text, seed) {
  if (!seed) return text;
  const variants = {
    shy: ["Mh…", "Non saprei…", "Sai…"],
    friendly: ["Guarda…", "Ti dico la verità…", "Onestamente…"],
    chaotic: ["Okay, senti…", "Aspetta, aspetta…", "Ti dico una cosa…"],
    sensual: ["Mmm…", "Ti confesso una cosa…", "Sai cosa mi capita?…"]
  };
  const prefixList = variants[seed];
  if (!prefixList) return text;
  const addPrefix = Math.random() < 0.25;
  if (!addPrefix) return text;
  const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
  return `${prefix} ${text}`;
}

function process(output, context) {
  const intentFlags = context.intentFlags || {};
  let toneMode = resolveToneMode(context.toneMode || 'soft');

  if (intentFlags?.userWantsMorePlayfulOrSpicy) {
    toneMode = 'explicit';
    console.log('[PostProcessor] Detected provocative tone → switching to explicit mode');
  }
  if (intentFlags?.userWantsExplicitSexualTone) {
    toneMode = 'explicit';
    console.log('[PostProcessor] Detected explicit sexual tone request');
  }
  if (context?.motivation?.motivation === 'sedurre') {
    console.log('[PostProcessor] Motivation sedurre detected');
  }

  // 1. Filter banned phrases
  let cleaned = filterBannedPhrases(output);

  console.log('[PostProcessor] 📜 Processing text:', {
    original: output,
    cleaned: cleaned,
    toneMode
  });

  // 2. Limit questions
  cleaned = limitQuestions(cleaned);

  // 3. Check repetition
  cleaned = rewriteIfRepetitive(cleaned, toneMode, context.lastOpenings, intentFlags);

  // 4. Finish cutoff
  let finalized = finishIfCutOff(cleaned);

  // 5. Brevity filter: se l'utente non ha chiesto dettagli, accorcia a max 2-3 frasi
  const userAskedDetails = /descrivi|racconta meglio|fammi immaginare|più dettagli|dimmi di più/i.test(
    context?.userMessage || context?.message || ''
  );
  if (!userAskedDetails) {
    const sentences = finalized
      .split(/(?<=[\.!\?])\s+/)
      .filter((s) => s && s.trim().length > 0);
    if (sentences.length > 3) {
      finalized = sentences.slice(0, 3).join(' ').trim();
    }
  }

  // 6. Ulteriore filtro anti-narrativo e di lunghezza
  finalized = removeModelOpeners(finalized);
  finalized = removeNovelPatterns(finalized);
  finalized = stripRomanticFluff(finalized);
  finalized = limitSentences(finalized, 3);
  finalized = shortenNatural(finalized);
  finalized = microVariation(finalized, context?.persona?.seed);

  // 6.1 Rimuovi riferimenti a partner/fidanzati inventati
  if (finalized && (finalized.toLowerCase().includes('partner') || finalized.toLowerCase().includes('fidanzat'))) {
    finalized = finalized.replace(/.*partner.*?/gi, '').replace(/.*fidanzat.*?/gi, '').trim();
  }

  // 7. Anti-intimità in gruppo
  if (context.isGroup) {
    finalized = finalized
      .replace(/\b(tesoro|amore|caro|cara|piccolo|piccola)\b/gi, '')
      .replace(/ti sento vicino/gi, '')
      .replace(/mi fai sentire/gi, '')
      .trim();
  }

  /* ============================================================
     PATCH: Anti-Mono NPC + Anti-Replica + Human Variation
     ============================================================ */
  // DISABLED: Override for empty responses
  // 1️⃣ Non permettere risposte vuote / ripetizioni note
  // if (!finalized || finalized.length < 2) {
  //   finalized = "Mh… ero distratta un attimo.";
  // }

  // DISABLED: Override for toxic responses
  // 2️⃣ Bannare risposta tossica "Non riesco a rispondere adesso"
  // if (/non riesco a rispondere adesso/i.test(finalized)) {
  //   const natural = [
  //     "Aspetta un attimo… ci sono.",
  //     "Mh… sì, dimmi pure.",
  //     "Stavo pensando ad altro un secondo.",
  //     "Eccomi, dimmi che c'è."
  //   ];
  //   finalized = natural[Math.floor(Math.random() * natural.length)];
  // }

  // DISABLED: Override for duplicate responses
  // 3️⃣ Anti-NPC Cloning → se due NPC generano la stessa risposta
  // if (context?.groupLastNpcOutput) {
  //   const last = context.groupLastNpcOutput.trim().toLowerCase();
  //   const now = finalized.trim().toLowerCase();
  //   if (last === now) {
  //     const variations = [
  //       "Mh… la vedo diversamente.",
  //       "Per me invece è un po' diverso.",
  //       "Io la penso in un altro modo.",
  //       "Mh… direi un'altra cosa."
  //     ];
  //     finalized = variations[Math.floor(Math.random() * variations.length)];
  //   }
  // }

  // 4️⃣ Humanizer forte basato su seed NPC
  if (context?.persona?.seed) {
    const seed = context.persona.seed;
    const humanVariants = {
      shy: ["Mh…", "Sai…", "Non so se dirlo ma…"],
      friendly: ["Guarda…", "Ti dico una cosa,", "Onestamente…"],
      chaotic: ["Aspetta aspetta…", "Okay senti…", "Oh, allora…"],
      sensual: ["Mmm…", "Ti confesso una cosa…", "Sai cosa?…"],
    };

    const list = humanVariants[seed];
    if (list) {
      const prefix = list[Math.floor(Math.random() * list.length)];
      if (!finalized.startsWith(prefix)) {
        finalized = `${prefix} ${finalized}`.trim();
      }
    }
  }

  // 5️⃣ Risposta finale naturale e NON robotica - NO LENGTH CUT
  // Removed truncation to allow full responses

  /* ============================================================
     PATCH B — Anti-skip: se il modello evita la domanda → riscrivi
     ============================================================ */
  const userText = context?.message?.toLowerCase() || "";
  const answer = finalized.toLowerCase();

  const evasivePatterns = [
    "sto pensando",
    "dimmi pure",
    "eccomi",
    "non saprei",
    "non so",
    "non riesco",
    "un attimo",
    "ci sono",
    "mh",
    "mmm"
  ];

  const importantWords = userText.split(/\W+/).filter(w => w.length > 3);
  let matchesTopic = importantWords.some(w => answer.includes(w));

  // DISABLED: PostProcessor override that replaced valid responses with generic phrases
  // Se NON risponde al topic → rigenerazione sintetica
  // if (!matchesTopic) {
  //   const spicyHints = [
  //     "Dipende dai momenti…",
  //     "Per me è più una questione di sensazioni.",
  //     "Non è qualcosa che misuro così, sinceramente.",
  //     "Mh… diciamo che certe cose mi incuriosiscono.",
  //   ];
  //   finalized = spicyHints[Math.floor(Math.random() * spicyHints.length)];
  // }

  const actions = [];
  if (context.motivation?.motivation === 'sedurre') {
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

  console.log('[TRACE][PIPELINE]', JSON.stringify({
    stage: 'PostProcessor',
    finalText: (finalized || '').substring(0, 500),
    actions: actions
  }, null, 2));

  // NOTE: addressing now handled implicitly by model; no automatic prefixes

  return {
    text: finalized,
    originalText: output,
    actions,
    meta: {
      filtered: cleaned !== output,
      toneMode,
    },
  };
}

module.exports = {
  process,
};
