const keywords = {
  it: ['ciao', 'grazie', 'perché', 'foto', 'insieme', 'vorrei', 'più', 'mando'],
  en: ['hello', 'thanks', 'because', 'photo', 'together', 'want', 'more', 'send'],
  es: ['hola', 'gracias', 'por qué', 'foto', 'juntos', 'quiero', 'más', 'mando'],
  pt: ['olá', 'obrigado', 'porque', 'foto', 'juntos', 'quero', 'mais', 'envia'],
  fr: ['bonjour', 'merci', 'pourquoi', 'photo', 'ensemble', 'veux', 'plus', 'envoie'],
  de: ['hallo', 'danke', 'warum', 'foto', 'zusammen', 'möchte', 'mehr', 'schick'],
  ar: ['مرحبا', 'شكرا', 'لماذا', 'صورة', 'معا'],
  ja: ['こんにちは', 'ありがとう', 'なぜ', '写真', '一緒', '欲しい'],
};

function detectLanguage(text) {
  if (!text) return 'en';
  const raw = typeof text === 'string' ? text : (text?.toString?.() || '');
  const lower = raw.toLowerCase();
  let best = 'en';
  let maxHits = 0;
  for (const [lang, words] of Object.entries(keywords)) {
    let hits = 0;
    for (const w of words) {
      if (lower.includes(w)) hits++;
    }
    if (hits > maxHits) {
      maxHits = hits;
      best = lang;
    }
  }
  return best;
}

module.exports = { detectLanguage };
