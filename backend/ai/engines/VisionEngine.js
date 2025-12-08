/**
 * VisionEngine.js
 * Analizza immagini inviate dall'utente usando OpenAI Vision API
 */

const fetch = require('node-fetch');

class VisionEngine {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = 'gpt-4o'; // Supports vision
    }

    /**
     * Analizza un'immagine e restituisce informazioni dettagliate
     * @param {string} imageUrl - URL dell'immagine da analizzare
     * @returns {Promise<Object>} Analisi dell'immagine
     */
    async analyze(imageUrl) {
        try {
            console.log('👁️ Analyzing image with Vision API:', imageUrl);

            const prompt = `Analizza questa immagine e rispondi SOLO con un JSON valido nel seguente formato:
{
  "persons": <numero di persone>,
  "emotion": "<emozione dominante: felice|triste|neutrale|arrabbiato|sorpreso|spaventato>",
  "gender": "<sesso prevalente: male|female|unknown>",
  "age_range": "<fascia età: 0-12|13-17|18-25|26-35|36-50|50+>",
  "context": "<descrizione breve del contesto: es. 'selfie in camera con luce calda'>",
  "objects": ["<oggetto1>", "<oggetto2>"],
  "style": "<stile foto: selfie|ritratto|corpo_intero|paesaggio|altro>",
  "atmosphere": "<atmosfera: calma|energica|romantica|triste|felice|neutra>",
  "clothing": "<abbigliamento se visibile>",
  "location": "<luogo: interno|esterno|auto|ufficio|camera|altro>",
  "lighting": "<illuminazione: naturale|artificiale|scarsa|buona>",
  "quality": "<qualità: alta|media|bassa>"
}

Rispondi SOLO con il JSON, senza testo aggiuntivo.`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: imageUrl } }
                            ]
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error(`Vision API error: ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Parse JSON response
            const analysis = JSON.parse(content);

            console.log('✅ Vision analysis complete:', analysis);
            return analysis;

        } catch (error) {
            console.error('❌ Error in VisionEngine.analyze:', error);

            // Fallback analysis
            return {
                persons: 1,
                emotion: 'neutrale',
                gender: 'unknown',
                age_range: '18-35',
                context: 'immagine ricevuta',
                objects: [],
                style: 'altro',
                atmosphere: 'neutra',
                clothing: 'non visibile',
                location: 'unknown',
                lighting: 'media',
                quality: 'media',
                error: error.message
            };
        }
    }

    /**
     * Genera una reazione naturale dell'NPC basata sull'analisi
     * @param {Object} analysis - Risultato dell'analisi
     * @param {Object} npc - Dati dell'NPC
     * @returns {string} Reazione testuale
     */
    generateReaction(analysis, npc) {
        const reactions = {
            felice: [
                `Ti vedo sorridente… mi fai sentire subito meglio ❤️`,
                `Che bel sorriso! Mi hai illuminato la giornata 😊`,
                `Sei raggiante in questa foto! 🌟`
            ],
            triste: [
                `Vorrei poterti abbracciare ora… sembri davvero giù… 🥺`,
                `Cosa è successo? Ti vedo un po' triste…`,
                `Ehi, va tutto bene? Sembri pensieroso/a…`
            ],
            neutrale: [
                `Bella foto! Grazie per averla condivisa con me 📸`,
                `Ti vedo bene… come stai davvero?`,
                `Interessante… raccontami di più!`
            ],
            arrabbiato: [
                `Sento tensione… cosa ti ha fatto arrabbiare?`,
                `Ehi, calmati… sono qui per te. Cosa è successo?`,
                `Ti vedo teso/a… vuoi parlarne?`
            ],
            sorpreso: [
                `Wow! Cosa ti ha sorpreso così tanto? 😮`,
                `Che faccia! Cos'è successo?`,
                `Ahah, ti vedo sorpreso/a! Racconta!`
            ]
        };

        const emotionReactions = reactions[analysis.emotion] || reactions.neutrale;
        let reaction = emotionReactions[Math.floor(Math.random() * emotionReactions.length)];

        // Add context-specific comments
        if (analysis.style === 'selfie') {
            reaction += ` Bel selfie comunque! 🤳`;
        }

        if (analysis.location === 'esterno') {
            reaction += ` Dove sei? Sembra un bel posto!`;
        }

        if (analysis.persons > 1) {
            reaction += ` Vedo che non sei solo/a… chi c'è con te?`;
        }

        return reaction;
    }

    /**
     * Crea un record di memoria per l'immagine ricevuta
     * @param {Object} analysis - Analisi dell'immagine
     * @param {string} userId - ID utente
     * @returns {Object} Record di memoria
     */
    createMemoryRecord(analysis, userId) {
        return {
            type: 'photo_received',
            userId,
            timestamp: new Date().toISOString(),
            userEmotion: analysis.emotion,
            context: analysis.context,
            persons: analysis.persons,
            style: analysis.style,
            atmosphere: analysis.atmosphere,
            npcReaction: 'interested', // Can be updated based on NPC personality
            attachmentImpact: analysis.emotion === 'felice' ? +5 : analysis.emotion === 'triste' ? +10 : +2
        };
    }
}

module.exports = new VisionEngine();
