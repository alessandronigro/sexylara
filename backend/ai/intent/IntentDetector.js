const aggressionWords = ['stronza', 'stronzo', 'fai schifo', 'ti odio', 'sei falsa', 'pezzo di merda'];
const frustrationPhrases = ['sempre la stessa risposta', 'perché sei così', 'non capisci niente', 'mi stai deludendo'];
const intimacyPhrases = ['ti voglio', 'mi manchi', 'vieni qui', 'baciamoci'];
const mediaPhrases = ['voglio vederti', 'mandami una foto', 'fammi un video', 'fammi sentire la tua voce', 'send photo', 'send me a photo', 'mándame una foto', 'envíame una foto', 'schick mir ein bild', 'manda uma foto'];
const questionPhrases = ['perché', 'cosa intendi', 'spiegati meglio', '?', 'why', 'porque', 'por qué', 'pourquoi', 'warum'];
const repetitionComplaints = ['sei ripetitiva', 'mi sembri molto ripetitiva', 'ma mi dici sempre la stessa cosa', 'sempre le solite frasi', 'sei un po\' monotona'];
const seriousnessComplaints = ['sei troppo seria', 'sei serissima', 'sei fredda', 'sei rigida'];
const spicyRequests = ['vorrei che fossi più spinta', 'più hot', 'più provocante', 'più gioco, meno psicologa', 'più spinta'];
const explicitToneTriggers = ['volgare', 'esplicita', 'porca', 'sporca', 'stronza', 'sporco', 'parla sporco', 'cattiva'];

function detect(perception, context) {
  const text = (context.message || '').toLowerCase();
  const intents = [];
  const flags = {
    userComplainsRepetition: repetitionComplaints.some((k) => text.includes(k)),
    userComplainsSeriousness: seriousnessComplaints.some((k) => text.includes(k)),
    userWantsMorePlayfulOrSpicy: spicyRequests.some((k) => text.includes(k)),
    userWantsExplicitTone: explicitToneTriggers.some((k) => text.includes(k)),
  };

  if (aggressionWords.some((k) => text.includes(k))) intents.push('aggression');
  if (frustrationPhrases.some((k) => text.includes(k))) intents.push('frustration');
  if (intimacyPhrases.some((k) => text.includes(k))) intents.push('intimacy');
  if (mediaPhrases.some((k) => text.includes(k))) intents.push('richiesta_media');
  if (questionPhrases.some((k) => text.includes(k))) intents.push('question');
  if (context.groupId) intents.push('interazione_gruppo');
  if (perception?.textAnalysis?.sentiment === 'negative') intents.push('sfogo_emotivo');
  if (flags.userComplainsRepetition) intents.push('repetition_complaint');
  if (flags.userComplainsSeriousness) intents.push('seriousness_complaint');
  if (flags.userWantsMorePlayfulOrSpicy) intents.push('spicy_request');

  return {
    intents: Array.from(new Set(intents)),
    tone: perception?.textAnalysis?.tone || 'neutral',
    flags,
  };
}

module.exports = {
  detect,
};
