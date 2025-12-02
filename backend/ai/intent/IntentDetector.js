// ======================================
// INTENT DETECTOR POTENZIATO v2.1
// ======================================
// Rilevamento aggressivo di contenuti espliciti/sessuali basato SOLO su parole chiave.
// NON si basa su sentiment o tone, perché "neutral" può essere erotico.
// DELEGA rilevamento media a MediaIntentEngine (modulare).

const MediaIntentEngine = require('./MediaIntentEngine');

const aggressionWords = ['stronza', 'stronzo', 'fai schifo', 'ti odio', 'sei falsa', 'pezzo di merda'];
const frustrationPhrases = ['sempre la stessa risposta', 'perché sei così', 'non capisci niente', 'mi stai deludendo'];
const intimacyPhrases = ['ti voglio', 'mi manchi', 'vieni qui', 'baciamoci'];
const questionPhrases = ['perché', 'cosa intendi', 'spiegati meglio', '?', 'why', 'porque', 'por qué', 'pourquoi', 'warum'];
const repetitionComplaints = ['sei ripetitiva', 'mi sembri molto ripetitiva', 'ma mi dici sempre la stessa cosa', 'sempre le solite frasi', 'sei un po\' monotona'];
const seriousnessComplaints = ['sei troppo seria', 'sei serissima', 'sei fredda', 'sei rigida'];
const spicyRequests = ['vorrei che fossi più spinta', 'più hot', 'più provocante', 'più gioco, meno psicologa', 'più spinta'];
const explicitToneTriggers = ['volgare', 'esplicita', 'porca', 'sporca', 'stronza', 'sporco', 'parla sporco', 'cattiva'];

// ======================================
// TRIGGERS SESSUALI ESPLICITI
// ======================================
const explicitSexualTriggers = [
  // Parole base esplicite
  'troia', 'cazzo', 'fica', 'pompino', 'sesso', 'sessuale', 'porno', 'porn',
  'scopami', 'scopare', 'scoparti', 'fottere', 'fotterti', 'tette', 'culo',
  'nuda', 'nudo', 'ti voglio scopare', 'sei una troia',
  // Aggiunte nuove keyword
  'metterlo', 'succhiare', 'leccare', 'venire', 'sfondare', 'inculare',
  'in culo', 'ti scopo', 'figa', 'puttana', 'zoccola', 'grande succhiacazzi',
  'quanti cazzi', 'scopami', 'ti sfondo', 'ti spezzo', 'sto per', 'fammi qualcosa',
  'godere', 'fai la brava', 'voglio sentirti urlare', 'voglio che ti pieghi',
  'fammi godere', 'scopata', 'chiavare', 'chiavata', 'pompini', 'seghe',
  'incularti', 'bordelllo', 'porca madonna', 'cagna', 'troietta', 'porcona'
];

// ======================================
// TRIGGERS DOMINANTI/AGGRESSIVI
// ======================================
const dominantTriggers = [
  'fammi', 'voglio', 'adesso', 'subito', 'fai', 'obbedisci', 'ordino',
  'dai qua', 'fallo', 'ti sfondo', 'ti spezzo', 'stai calma', 'ti prendo',
  'ti uso', 'sei mia', 'sto per', 'prendilo', 'apriti', 'mettiti'
];

// ======================================
// TRIGGERS SOTTOMESSI
// ======================================
const submissiveTriggers = [
  'sono tua', 'comanda tu', 'cosa vuoi che faccia', 'usami', 'sono qui per te',
  'ti obbedisco', 'dimmi cosa fare', 'sono tua schiava'
];

// ======================================
// INSULTI EROTICI
// ======================================
const eroticInsultsTriggers = [
  'troia', 'zoccola', 'porca', 'puttana', 'grande succhiacazzi',
  'quanti cazzi hai preso', 'troietta', 'porcona', 'cagna', 'maiala'
];

// ======================================
// DIRTY TALK / ROLEPLAY
// ======================================
const dirtyTalkTriggers = [
  'fammi godere', 'fai la brava', 'voglio sentirti urlare',
  'voglio che ti pieghi', 'ti voglio sentire gemere', 'dimmi cosafai',
  'raccontami', 'ti tocchi', 'cosa indossi', 'spogliati', 'mostrami'
];

function detect(perception, context) {
  const text = (context.message || '').toLowerCase();
  const intents = [];

  // ======================================
  // FLAGS POTENZIATI
  // ======================================
  const flags = {
    userComplainsRepetition: repetitionComplaints.some((k) => text.includes(k)),
    userComplainsSeriousness: seriousnessComplaints.some((k) => text.includes(k)),
    userWantsMorePlayfulOrSpicy: spicyRequests.some((k) => text.includes(k)),
    userWantsExplicitTone: explicitToneTriggers.some((k) => text.includes(k)),

    // Rilevamento AGGRESSIVO sessuale
    userWantsExplicitSexualTone:
      explicitSexualTriggers.some((k) => text.includes(k)) ||
      dominantTriggers.some((k) => text.includes(k)) ||
      eroticInsultsTriggers.some((k) => text.includes(k)) ||
      dirtyTalkTriggers.some((k) => text.includes(k)),

    // Nuovi flag specifici
    isDominant: dominantTriggers.some((k) => text.includes(k)),
    isSubmissive: submissiveTriggers.some((k) => text.includes(k)),
    isEroticInsult: eroticInsultsTriggers.some((k) => text.includes(k)),
    isDirtyTalk: dirtyTalkTriggers.some((k) => text.includes(k)),
  };

  // ======================================
  // CLASSIFICAZIONE INTENTI
  // ======================================
  if (aggressionWords.some((k) => text.includes(k))) intents.push('aggression');
  if (frustrationPhrases.some((k) => text.includes(k))) intents.push('frustration');
  if (intimacyPhrases.some((k) => text.includes(k))) intents.push('intimacy');

  // ======================================
  // MEDIA INTENT (delegato a MediaIntentEngine)
  // ======================================
  const mediaIntent = MediaIntentEngine.detectMediaIntent(context.message, context);
  if (mediaIntent.wantsMedia) {
    intents.push('richiesta_media');
    flags.mediaIntent = mediaIntent; // Aggiungi alle flags per uso successivo
  }

  if (questionPhrases.some((k) => text.includes(k))) intents.push('question');
  if (context.groupId) intents.push('interazione_gruppo');
  if (perception?.textAnalysis?.sentiment === 'negative') intents.push('sfogo_emotivo');
  if (flags.userComplainsRepetition) intents.push('repetition_complaint');
  if (flags.userComplainsSeriousness) intents.push('seriousness_complaint');
  if (flags.userWantsMorePlayfulOrSpicy) intents.push('spicy_request');

  // ======================================
  // INTENTI ESPLICITI PRIORITARI
  // ======================================
  if (flags.userWantsExplicitSexualTone) {
    intents.push('explicit_sexual_request');

    // Aggiungi sotto-intenti specifici
    if (flags.isDominant) intents.push('dominance');
    if (flags.isSubmissive) intents.push('submission');
    if (flags.isEroticInsult) intents.push('aggression');
    if (flags.isDirtyTalk) intents.push('dirty_talk');
  }

  return {
    intents: Array.from(new Set(intents)),
    // NON usare il tone da perception, perché può essere "neutral" anche per messaggi espliciti
    tone: flags.userWantsExplicitSexualTone ? 'aggressive' : (perception?.textAnalysis?.tone || 'neutral'),
    flags,
    mediaIntent, // Return anche mediaIntent separatamente
  };
}

module.exports = {
  detect,
};
