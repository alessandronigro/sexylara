/**
 * MediaIntentEngine.js
 * Gestisce il riconoscimento, la conferma e la generazione di intenti multimediali.
 */

const IntentEngine = require('./IntentEngine');

class MediaIntentEngine {
    constructor() {
        this.patterns = {
            photo: [
                /voglio vederti/i,
                /fammi un selfie/i,
                /mandami una tua immagine/i,
                /posso avere una foto/i,
                /vorrei vedere come sei/i,
                /mandami un tuo scatto/i,
                /selfie\?/i,
                /mandami una foto/i,
                /fatti vedere/i
            ],
            video: [
                /mandami un video/i,
                /fammi un video/i,
                /fammi vedere come ti muovi/i,
                /voglio vedere un video tuo/i,
                /puoi farmi un video/i
            ],
            audio: [
                /mandami un audio/i,
                /voglio sentire la tua voce/i,
                /puoi parlarmi/i,
                /mi mandi un vocale/i,
                /fammi sentire come suoni/i,
                /mandami un vocale/i
            ],
            confirmation: [
                /^s[ìi]$/i,
                /^ok$/i,
                /^va bene$/i,
                /^manda pure$/i,
                /^certo$/i,
                /^fallo$/i,
                /^sisi$/i
            ]
        };
    }

    /**
     * Rileva se il messaggio contiene un intento multimediale
     * @param {string} message 
     * @returns {string|null} 'photo', 'video', 'audio' o null
     */
    detectIntent(message) {
        if (!message) return null;

        for (const [type, regexes] of Object.entries(this.patterns)) {
            if (type === 'confirmation') continue;
            for (const regex of regexes) {
                if (regex.test(message)) {
                    return type;
                }
            }
        }
        return null;
    }

    /**
     * Verifica se il messaggio è una conferma
     * @param {string} message 
     * @returns {boolean}
     */
    isConfirmation(message) {
        if (!message) return false;
        return this.patterns.confirmation.some(regex => regex.test(message.trim()));
    }

    /**
     * Genera un messaggio di richiesta conferma basato sul tipo di media e NPC
     * @param {string} mediaType 
     * @param {Object} npc 
     * @returns {string}
     */
    generateConfirmationRequest(mediaType, npc) {
        const responses = {
            photo: [
                "Vuoi che ti mandi una foto mia? 😘",
                "Che tipo di immagine desideri esattamente?",
                "Posso mandarti un selfie se davvero lo vuoi... sei sicuro?",
                "Mmm, vuoi vedermi? Confermamelo."
            ],
            video: [
                "Vuoi proprio un video? Te lo preparo se mi dici di sì.",
                "Un video? È una richiesta impegnativa... lo vuoi davvero?",
                "Posso registrarti un video, ma devi promettere di guardarlo. Confermi?"
            ],
            audio: [
                "Vuoi un vocale? Posso registrarlo per te, dimmi se procedere.",
                "Ti piace la mia voce? Vuoi che ti mandi un audio?",
                "Posso parlarti... mi dai l'ok?"
            ]
        };

        const options = responses[mediaType] || responses.photo;
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Verifica se nel contesto precedente c'era una richiesta di conferma in sospeso
     * @param {Array} history Messaggi recenti
     * @returns {string|null} Il tipo di media in attesa di conferma ('photo', 'video', 'audio') o null
     */
    checkPendingConfirmation(history) {
        if (!history || history.length === 0) return null;

        // Controlla l'ultimo messaggio dell'AI
        // Assumiamo che history sia ordinato dal più vecchio al più recente, o viceversa.
        // Solitamente in brainEngine recentMessages è passato.
        // Dobbiamo trovare l'ultimo messaggio inviato dall'AI.

        // Se history[0] è il più recente:
        const lastAiMsg = history.find(m => m.role === 'assistant' || m.senderName === 'AI' || m.sender_name === 'AI'); // Adatta in base alla struttura

        if (!lastAiMsg) return null;

        const content = lastAiMsg.content || lastAiMsg.text || "";

        // Euristiche per capire se l'ultimo messaggio era una richiesta di conferma media
        if (content.includes("Vuoi che ti mandi una foto") || content.includes("un selfie se davvero lo vuoi")) return 'photo';
        if (content.includes("Vuoi proprio un video") || content.includes("Un video?")) return 'video';
        if (content.includes("Vuoi un vocale") || content.includes("Ti piace la mia voce")) return 'audio';

        return null;
    }
}

module.exports = new MediaIntentEngine();
