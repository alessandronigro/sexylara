const Replicate = require("replicate");
const { routeLLM } = require('../generation/LlmRouter');

const ALL_LABELS = [
  'conversation',
  'request_image',
  'request_video',
  'request_audio',
  'talk_about_media',
  'flirt',
  'spicy',
  'group_engage',
  'npc_send_image',
  'npc_send_audio',
  'npc_send_video',
  'npc_send_couple_photo',
  'npc_send_none'
];

const USER_LABELS = [
  'conversation',
  'request_image',
  'request_video',
  'request_audio',
  'talk_about_media',
  'flirt',
  'spicy',
  'group_engage'
];

const NPC_LABELS = [
  'npc_send_image',
  'npc_send_audio',
  'npc_send_video',
  'npc_send_couple_photo',
  'npc_send_none'
];

const ASK_VERBS = [
  'fammi', 'manda', 'mandami', 'inviami', 'invia', 'mostra', 'mostrami',
  'fai vedere', 'mostrare', 'vorrei', 'voglio', 'puoi', 'potresti',
  'dammi', 'send', 'show', 'let me see'
];

function hasMediaKeyword(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return /\b(foto|immagine|pic|picture|selfie|video|clip|filmato|musica|canzone|song|audio|voce|registrazione|media)\b/i.test(lower);
}

function hasGroupKeyword(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return /(tutti|gli altri|ragazzi|gruppo|voi due|voi tutti|altre persone|altri)/i.test(lower);
}

function isPersonalityQuestion(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return /(chi sei|come sei|che tipo sei|personalit[aà]|carattere|come ti descriveresti|come ti present|cosa ti piace|cosa non ti piace)/i.test(lower);
}

function buildPrompt(labels) {
  return `
Sei un classificatore di intenzioni.
Rispondi con UNA sola etichetta, esattamente come scritta, tra:
${labels.join(', ')}

Regole:
- Nessun testo extra o punteggiatura.
- Se più etichette sembrano valide, scegli la più specifica legata a media (npc_send_image/audio/video/couple) prima di conversazione.
`.trim();
}

function heuristicIntent(text, role) {
  const lower = text.toLowerCase();
  const hasAskVerb = ASK_VERBS.some((v) => lower.includes(v));

  // Complimenti o commenti su media già esistenti non devono scatenare una richiesta
  const mediaCompliment = /(che bella foto|bella foto|bellissima foto|bel video|bello sto video|quanto sei bella nel video|bella immagine|nice pic|nice photo|great photo|beautiful picture)/i;
  if (mediaCompliment.test(lower) && !hasAskVerb) {
    return 'talk_about_media';
  }

  if (role === 'npc') {
    if (/(http.*\.(jpg|jpeg|png|webp)|data:image)/i.test(lower) || /ti mando.*foto|ecco.*foto|guarda questa foto/i.test(lower)) {
      return 'npc_send_image';
    }
    if (/audio|vocale|ascolta questo/i.test(lower)) return 'npc_send_audio';
    if (/video|guarda questo/i.test(lower)) return 'npc_send_video';
    if (/couple|noi due|insieme nella foto|abbracciati/i.test(lower)) return 'npc_send_couple_photo';
    return null;
  }

  if (hasGroupKeyword(lower)) return 'group_engage';

  if (isPersonalityQuestion(text)) {
    const flirtHint = /amore|tesoro|mi piaci|sei bell[ao]|cuore/i.test(lower);
    return flirtHint ? 'flirt' : 'conversation';
  }

  if (/\b(foto|immagine|selfie|pic|picture)\b/i.test(lower) && hasAskVerb) return 'request_image';
  if (/\b(video|filmato|clip)\b/i.test(lower) && hasAskVerb) return 'request_video';
  if (/\b(audio|vocale|voce)\b/i.test(lower) && hasAskVerb) return 'request_audio';
  if (hasMediaKeyword(text) && /perch[eé].*foto|aspetta.*foto|parli.*foto|media/i.test(lower)) return 'talk_about_media';
  if (/hot|piccante|spinto|sex|porno|nudo|nuda|cazzo|fica/i.test(lower)) return 'spicy';
  if (/amore|tesoro|mi manchi|baciami|sei bell[ao]|mi piaci/i.test(lower)) return 'flirt';

  return null;
}

async function classifyIntent(text, role = 'user') {
  // LOG PIPELINE (Intent)
  console.log('[TRACE][PIPELINE]', JSON.stringify({
    stage: 'IntentLLM',
    textFragment: (text || '').substring(0, 200),
  }, null, 2));

  if (!text) return 'conversation';
  // Normalizza input: se è un oggetto, estrai la stringa
  if (text && typeof text !== 'string') {
    text = text.output || text.text || text.toString() || '';
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    const label = role === 'npc' ? 'npc_send' : 'conversation'; // FORCE NPC RESPONSE
    console.log('[TRACE][PIPELINE]', JSON.stringify({ stage: 'IntentLLM', result: label }, null, 2));
    return label;
  }

  const allowed = role === 'npc' ? NPC_LABELS : USER_LABELS;
  const normalized = (text || '').toString();
  const lower = normalized.toLowerCase();
  const hasAskVerb = ASK_VERBS.some((v) => lower.includes(v));
  const heuristic = heuristicIntent(text, role);
  if (heuristic && allowed.includes(heuristic)) return heuristic;

  const systemPrompt = buildPrompt(allowed);
  const input = normalized.trim();
  let cleaned = '';

  try {
    const reply = await routeLLM(systemPrompt, [], input, null);
    cleaned = (reply || '').toString().trim().toLowerCase();
    if (cleaned.includes('venice_error')) cleaned = '';
    // Evita falsi positivi di media se manca un verbo di richiesta esplicita
    if (!hasAskVerb && ['request_image', 'request_video', 'request_audio'].includes(cleaned)) {
      cleaned = 'conversation';
    }
    if (cleaned === 'talk_about_media' && !hasMediaKeyword(input)) {
      cleaned = 'conversation';
    }
    if (cleaned === 'group_engage' && !hasGroupKeyword(input)) {
      cleaned = 'conversation';
    }

    if (allowed.includes(cleaned)) return cleaned;
    const partial = allowed.find(l => cleaned.includes(l));
    if (partial) {
      if (partial === 'talk_about_media' && !hasMediaKeyword(input)) return 'conversation';
      if (partial === 'group_engage' && !hasGroupKeyword(input)) return 'conversation';
      return partial;
    }
  } catch (err) {
    console.error('classifyIntent error:', err?.message || err);
  }

  const fallback = heuristicIntent(text, role);
  if (fallback && allowed.includes(fallback)) return fallback;

  // Se non è chiaro, chiedi conferma (for user role)
  if (role === 'user') return 'conversation';

  return role === 'npc' ? 'npc_send' : 'conversation'; // FORCE NPC RESPONSE
}

/* =========================================================
   PATCH — ADVANCED SEMANTIC SEXUAL INTENT CLASSIFIER
   ========================================================= */

/**
 * classifySexualIntentV3
 * Analisi semantica profonda del contesto.
 * Ritorna:
 * - non_sessuale
 * - sessuale_soft
 * - sessuale_esplicito
 */
async function classifySexualIntentV3(text) {
  try {
    const sys = `
Sei un classificatore SEMANTICO DI INTENZIONI.

Analizza SOLO il significato della frase dell'utente, ignorando lo stile o il tono.
Stabilisci se l'intento riguarda la sessualità, e SE SÌ, a quale livello.

Categorie (devi restituire SOLO una di queste parole):

1) "non_sessuale"
   - La frase parla di altro (relazioni, emozioni, contesto, curiosità).
   - Oppure nomina parole sessuali in modo NON diretto o NON orientato all'azione
     (es: "non mi piace parlare di sesso", "il sesso è un argomento delicato").
   - Oppure è un commento astratto privo di invito o immaginazione esplicita.

2) "sessuale_soft"
   - Flirt, doppi sensi, allusioni, atmosfera sexy, immaginazione lieve.
   - Desideri vaghi senza dettagli fisici espliciti.
   - Esempi: "vi immagino molto affiatati", "mi attira l'idea", "mi piace provocare".
   - L'utente evoca una situazione sexy ma NON descrive atti.

3) "sessuale_esplicito"
   - L'utente descrive atti sessuali, organi, posizioni, penetrazione, stimolazione.
   - Linguaggio grafico o diretto.
   - Esempi: "scopare", "penetrare", "pompin*", "tutta la notte a farlo",
             "vi immagino scopare insieme", "lo succhierei", "voglio venire".

IMPORTANTE:
- Non classificare come esplicito se il contesto è NEGATIVO o di rifiuto
  (es: "non voglio parlare di sesso").
- Le frasi devono essere valutate nel significato globale.
`;

    const prompt = `
Classifica questa frase:
"${text}"

Rispondi SOLO con una delle tre etichette:
non_sessuale
sessuale_soft
sessuale_esplicito
`;

    let full = "";
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY
    });

    for await (const ev of replicate.stream("openai/gpt-4o", {
      input: { system_prompt: sys, prompt }
    })) {
      full += ev.toString();
    }

    const clean = full.trim().toLowerCase();
    if (clean.includes("esplicito")) return "sessuale_esplicito";
    if (clean.includes("soft")) return "sessuale_soft";
    return "non_sessuale";
  } catch (err) {
    console.error("IntentLLM Error:", err);
    return "non_sessuale";
  }
}

// Keep old function for backward compatibility
async function classifySexualIntent(text) {
  return classifySexualIntentV3(text);
}

module.exports = { classifyIntent, classifySexualIntent, classifySexualIntentV3 };

