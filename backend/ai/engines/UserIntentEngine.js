// ai/engines/UserIntentEngine.js

/**
 * Analizza il testo utente e, opzionalmente, la risposta AI prevista,
 * per capire:
 * - se vuole un audio
 * - se vuole una foto
 * - se sta scherzando
 * - se c'è un tono flirty/emotivo
 */

function detectUserIntent(message, aiText = '', options = {}) {
    const lang = options.language || 'it';
    const text = (message || '').toLowerCase();

    const intent = {
        wantsPhoto: false,
        wantsAudio: false,
        joking: false,
        tone: {
            flirty: false,
            emotional: false,
            angry: false
        },
        explicitMediaType: null // 'photo' | 'audio' | null
    };

    // --- Trigger per FOTO (multi-lingua base) ---
    const photoTriggers = [
        'mandami una foto',
        'mandami una tua foto',
        'voglio vederti',
        'fammi vedere come sei',
        'scattati una foto',
        'fatti una foto',
        'selfie',
        'send me a pic',
        'send me a photo',
        'show me how you look',
        'take a selfie',
        'picture of you'
    ];

    if (photoTriggers.some(t => text.includes(t))) {
        intent.wantsPhoto = true;
        intent.explicitMediaType = 'photo';
    }

    // --- Trigger per AUDIO (multi-lingua base) ---
    const audioTriggers = [
        'voglio sentirti',
        'fammi sentire la tua voce',
        'mandami un vocale',
        'mandami un audio',
        'nota vocale',
        'voice note',
        'send me a voice',
        'send me a voice note',
        'send me an audio',
        'i want to hear your voice',
        'talk to me with your voice'
    ];

    if (audioTriggers.some(t => text.includes(t))) {
        intent.wantsAudio = true;
        intent.explicitMediaType = 'audio';
    }

    // --- Riconoscimento "scherzo" / tono leggero ---
    const jokingMarkers = [
        'scherzo',
        'sto scherzando',
        'ahah',
        'lol',
        '😂',
        '🤣'
    ];
    if (jokingMarkers.some(t => text.includes(t))) {
        intent.joking = true;
    }

    // --- Tono flirty / emotivo / arrabbiato (molto semplice) ---
    const flirtyMarkers = ['tesoro', 'amore', 'sei bellissima', 'sei bellissimo', 'mi piaci'];
    if (flirtyMarkers.some(t => text.includes(t))) {
        intent.tone.flirty = true;
    }

    const emotionalMarkers = ['mi manchi', 'penso a te', 'non sto bene', 'sono triste'];
    if (emotionalMarkers.some(t => text.includes(t))) {
        intent.tone.emotional = true;
    }

    const angryMarkers = ['sono arrabbiato', 'mi fai arrabbiare', 'non mi piace'];
    if (angryMarkers.some(t => text.includes(t))) {
        intent.tone.angry = true;
    }

    // Piccolo extra: se la risposta AI è già molto sensuale/emotiva,
    // possiamo marcare emotional/flirty anche senza indicatori espliciti nel testo utente.
    const aiLower = (aiText || '').toLowerCase();
    if (aiLower.includes('mi viene da') || aiLower.includes('mi fai') || aiLower.includes('non smetto di pensare')) {
        intent.tone.emotional = true;
    }

    return intent;
}

/**
 * Decide se l'NPC dovrebbe rispondere con AUDIO AUTOMATICO
 * anche se l'utente non ha esplicitamente scritto "voglio un vocale".
 */
function shouldReplyWithAudio(message, aiText, intent, options = {}) {
    const lang = options.language || 'it';

    // 1) Se l'utente ha chiesto esplicitamente audio → sì, sempre.
    if (intent.explicitMediaType === 'audio' || intent.wantsAudio) {
        return true;
    }

    const text = (message || '').toLowerCase();

    // 2) Se il messaggio è molto breve tipo "ciao", "ehi", "sei lì?"
    //    di solito meglio una risposta testuale breve → niente audio.
    const veryShort = text.replace(/\s+/g, '').length <= 4;
    if (veryShort) return false;

    // 3) Se il tono è molto emotivo o flirty, possiamo scegliere audio
    //    con una certa probabilità (per non abusare).
    if (intent.tone.flirty || intent.tone.emotional) {
        const roll = Math.random();
        // 60% di probabilità di fare risposta audio
        return roll < 0.6;
    }

    // 4) Se ci sono emoji vocali / musicali
    const audioEmojiMarkers = ['🎧', '🎤', '🎶', '🎼'];
    if (audioEmojiMarkers.some(e => text.includes(e))) {
        return true;
    }

    // Default: nessun audio automatico
    return false;
}

module.exports = {
    detectUserIntent,
    shouldReplyWithAudio
};