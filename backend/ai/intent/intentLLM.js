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

  if (role === 'npc') {
    if (/(http.*\.(jpg|jpeg|png|webp)|data:image)/i.test(lower) || /ti mando.*foto|ecco.*foto|guarda questa foto/i.test(lower)) {
      return 'npc_send_image';
    }
    if (/audio|vocale|ascolta questo/i.test(lower)) return 'npc_send_audio';
    if (/video|guarda questo/i.test(lower)) return 'npc_send_video';
    if (/couple|noi due|insieme nella foto|abbracciati/i.test(lower)) return 'npc_send_couple_photo';
    return null;
  }

  if (/tutti|gli altri|ragazzi|gruppo|voi due|voi tutti/i.test(lower)) {
    return 'group_engage';
  }

  if (/\b(foto|immagine|selfie|pic|picture)\b/i.test(lower)) return 'request_image';
  if (/\b(video|filmato|clip)\b/i.test(lower)) return 'request_video';
  if (/\b(audio|vocale|voce)\b/i.test(lower)) return 'request_audio';
  if (/perch[eé].*foto|aspetta.*foto|parli.*foto|media/i.test(lower)) return 'talk_about_media';
  if (/hot|piccante|spinto|sex|porno|nudo|nuda|cazzo|fica/i.test(lower)) return 'spicy';
  if (/amore|tesoro|mi manchi|baciami|sei bell[ao]|mi piaci/i.test(lower)) return 'flirt';

  return null;
}

async function classifyIntent(text, role = 'user') {
  // Normalizza input: se è un oggetto, estrai la stringa
  if (text && typeof text !== 'string') {
    text = text.output || text.text || text.toString() || '';
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    return role === 'npc' ? 'npc_send_none' : 'conversation';
  }

  const allowed = role === 'npc' ? NPC_LABELS : USER_LABELS;
  const heuristic = heuristicIntent(text, role);
  if (heuristic && allowed.includes(heuristic)) return heuristic;

  const systemPrompt = buildPrompt(allowed);
  const input = text.trim();
  let cleaned = '';

  try {
    const reply = await routeLLM(systemPrompt, [], input, null);
    cleaned = (reply || '').toString().trim().toLowerCase();
    if (allowed.includes(cleaned)) return cleaned;
    const partial = allowed.find(l => cleaned.includes(l));
    if (partial) return partial;
  } catch (err) {
    console.error('classifyIntent error:', err?.message || err);
  }

  const fallback = heuristicIntent(text, role);
  if (fallback && allowed.includes(fallback)) return fallback;

  return role === 'npc' ? 'npc_send_none' : 'conversation';
}

module.exports = { classifyIntent };
