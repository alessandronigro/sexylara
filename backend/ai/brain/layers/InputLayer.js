function normalizeText(text) {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

function enrichMetadata(context) {
  const timestamp = context.metadata?.timestamp ?? Date.now();
  const language = context.metadata?.language ?? 'it';
  const hourOfDay = new Date(timestamp).getHours();

  return {
    ...context.metadata,
    timestamp,
    language,
    hourOfDay,
    timezone: 'Europe/Rome',
  };
}

function detectAddressed(text, npcName = '') {
  const normalized = text.toLowerCase();
  const addressed = npcName && normalized.includes(npcName.toLowerCase());
  const directKeywords = ['ehi', 'hey', 'ciao', 'luna', 'arrivo']; // example
  const isDirect = directKeywords.some((kw) => normalized.includes(kw));
  return addressed || isDirect;
}

function process(context, npcName = '') {
  const normalizedMessage = normalizeText(context.message);
  const metadata = enrichMetadata(context);
  const directMessage = detectAddressed(normalizedMessage, npcName);
  const { normalizeMediaRequest } = require('../../media/inputNormalizer');
  return {
    ...context,
    message: normalizedMessage,
    metadata,
    directMessage,
    mediaRequestDetected: normalizeMediaRequest(normalizedMessage),
  };
}

module.exports = {
  process,
};
