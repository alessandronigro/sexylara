/**
 * IntentEngine.js
 * Analizza l'input utente per capire intenti espliciti e impliciti.
 */

class IntentEngine {

    analyze(userMessage) {
        const msg = userMessage.toLowerCase();

        // Default
        const result = {
            type: 'chat', // chat, image, audio, action
            sentiment: 'neutral',
            topics: []
        };

        // 1. Riconoscimento Sentiment (Euristica base, sostituibile con AI)
        if (msg.includes("ti amo") || msg.includes("grazie") || msg.includes("bello")) result.sentiment = 'positive';
        if (msg.includes("odio") || msg.includes("brutto") || msg.includes("stupido")) result.sentiment = 'negative';

        // 2. Riconoscimento Intento Immagine
        if (msg.includes("mandami una foto") || msg.includes("fatti vedere") || msg.includes("selfie")) {
            result.type = 'image';
        }

        // 3. Riconoscimento Intento Audio
        if (msg.includes("mandami un vocale") || msg.includes("voglio sentirti")) {
            result.type = 'audio';
        }

        // 4. Riconoscimento Nome Utente (Self-disclosure)
        if (msg.includes("mi chiamo") || msg.includes("sono ") || msg.includes("il mio nome è")) {
            result.type = 'name_share';
        }

        return result;
    }
}

module.exports = new IntentEngine();
