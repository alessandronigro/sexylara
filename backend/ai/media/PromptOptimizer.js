const bannedWords = ['love'
  // 'nsfw', 'nude', 'naked', 'porn', 'sex', 'tits', 'boobs', 'breasts',
  // 'vagina', 'penis', 'cock', 'cum', 'ejaculation', 'hardcore', 'sucking',
  // 'blowjob', 'anal', 'bdsm', 'gore', 'violence'
];

function sanitizePrompt(text = '') {
  let cleaned = text.trim();
  bannedWords.forEach((w) => {
    const re = new RegExp(w, 'ig');
    cleaned = cleaned.replace(re, '');
  });
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned || 'high quality realistic photo, cinematic lighting';
}

async function optimizePrompt(userText, type = 'image') {
  // Placeholder: could call an LLM to enhance prompt; for now sanitize and bias to style
  const safe = sanitizePrompt(userText || '');
  if (type === 'video') {
    return `${safe}, dynamic scene, smooth motion, natural lighting`;
  }
  return `${safe}, high detail, natural lighting, realistic skin texture`;
}

module.exports = {
  optimizePrompt,
};
