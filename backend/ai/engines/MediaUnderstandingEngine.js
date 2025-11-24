/**
 * MediaUnderstandingEngine.js
 * Orchestrates media analysis and NPC reactions
 */

const VisionEngine = require('./VisionEngine');
const AudioEngine = require('./AudioEngine');
const MediaIntentEngine = require('./MediaIntentEngine');

class MediaUnderstandingEngine {
    /**
     * Processa media ricevuto dall'utente
     * @param {string} mediaType - 'image' | 'audio' | 'video'
     * @param {string} mediaUrl - URL o path del media
     * @param {Object} npc - Dati dell'NPC
     * @param {string} userId - ID utente
     * @returns {Promise<Object>} Analisi e reazione
     */
    async processReceivedMedia(mediaType, mediaUrl, npc, userId) {
        try {
            console.log(`📥 Processing received ${mediaType} from user ${userId}`);

            let analysis, reaction, memoryRecord;

            switch (mediaType) {
                case 'image':
                case 'photo':
                    analysis = await VisionEngine.analyze(mediaUrl);
                    reaction = VisionEngine.generateReaction(analysis, npc);
                    memoryRecord = VisionEngine.createMemoryRecord(analysis, userId);
                    break;

                case 'audio':
                case 'voice':
                    analysis = await AudioEngine.analyze(mediaUrl);
                    reaction = AudioEngine.generateReaction(analysis, npc);
                    memoryRecord = AudioEngine.createMemoryRecord(analysis, userId);
                    break;

                case 'video':
                    // For now, treat video as image (analyze first frame)
                    // TODO: Implement proper video analysis
                    analysis = await VisionEngine.analyze(mediaUrl);
                    reaction = `Ho visto il tuo video! ${VisionEngine.generateReaction(analysis, npc)}`;
                    memoryRecord = {
                        ...VisionEngine.createMemoryRecord(analysis, userId),
                        type: 'video_received'
                    };
                    break;

                default:
                    throw new Error(`Unsupported media type: ${mediaType}`);
            }

            // Calculate emotional impact on NPC
            const emotionalImpact = this.calculateEmotionalImpact(analysis, npc);

            return {
                analysis,
                reaction,
                memoryRecord,
                emotionalImpact,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error processing media:', error);

            return {
                analysis: { error: error.message },
                reaction: `Grazie per il ${mediaType}! Mi dispiace, ho avuto un problema ad analizzarlo… ma apprezzo il gesto! ❤️`,
                memoryRecord: {
                    type: `${mediaType}_received`,
                    userId,
                    timestamp: new Date().toISOString(),
                    error: error.message
                },
                emotionalImpact: { attachment: +2 }
            };
        }
    }

    /**
     * Calcola l'impatto emotivo del media ricevuto sull'NPC
     * @param {Object} analysis - Analisi del media
     * @param {Object} npc - Dati dell'NPC
     * @returns {Object} Modifiche allo stato emotivo
     */
    calculateEmotionalImpact(analysis, npc) {
        const impact = {
            attachment: 0,
            intimacy: 0,
            trust: 0,
            mood: npc.current_mood || 'neutral'
        };

        // Base impact: receiving any media increases attachment
        impact.attachment += 5;

        // Emotion-specific impacts
        if (analysis.emotion === 'felice') {
            impact.attachment += 5;
            impact.mood = 'happy';
        } else if (analysis.emotion === 'triste') {
            impact.attachment += 10; // User sharing vulnerability
            impact.intimacy += 5;
            impact.trust += 5;
            impact.mood = 'concerned';
        } else if (analysis.emotion === 'affettuoso') {
            impact.attachment += 15;
            impact.intimacy += 10;
            impact.mood = 'loving';
        } else if (analysis.emotion === 'arrabbiato') {
            impact.attachment += 3;
            impact.mood = 'worried';
        }

        // Media type impacts
        if (analysis.type === 'audio_received') {
            impact.intimacy += 5; // Voice is more intimate
        }

        if (analysis.persons && analysis.persons > 1) {
            impact.attachment -= 2; // Slight jealousy if others are present
        }

        return impact;
    }

    /**
     * Aggiorna la memoria dell'NPC con il media ricevuto
     * @param {Object} npc - Dati dell'NPC
     * @param {Object} memoryRecord - Record di memoria
     * @returns {Object} Memoria aggiornata
     */
    updateNpcMemory(npc, memoryRecord) {
        if (!npc.media_memory) {
            npc.media_memory = [];
        }

        npc.media_memory.push(memoryRecord);

        // Keep only last 50 media memories
        if (npc.media_memory.length > 50) {
            npc.media_memory = npc.media_memory.slice(-50);
        }

        return npc.media_memory;
    }

    /**
     * Genera un prompt arricchito per l'AI che include il contesto del media
     * @param {Object} analysis - Analisi del media
     * @param {string} mediaType - Tipo di media
     * @returns {string} Prompt aggiuntivo
     */
    generateContextPrompt(analysis, mediaType) {
        let prompt = `\n\n### MEDIA APPENA RICEVUTO DALL'UTENTE\n`;

        if (mediaType === 'image' || mediaType === 'photo') {
            prompt += `L'utente ti ha appena inviato una foto.\n`;
            prompt += `Analisi immagine:\n`;
            prompt += `- Emozione rilevata: ${analysis.emotion}\n`;
            prompt += `- Contesto: ${analysis.context}\n`;
            prompt += `- Stile: ${analysis.style}\n`;
            prompt += `- Atmosfera: ${analysis.atmosphere}\n`;
            if (analysis.persons > 1) {
                prompt += `- ATTENZIONE: Ci sono ${analysis.persons} persone nella foto\n`;
            }
        } else if (mediaType === 'audio') {
            prompt += `L'utente ti ha appena inviato un messaggio vocale.\n`;
            prompt += `Trascrizione: "${analysis.text}"\n`;
            prompt += `- Emozione rilevata: ${analysis.emotion}\n`;
            prompt += `- Tono: ${analysis.tone}\n`;
            prompt += `- Intensità: ${analysis.intensity}\n`;
        }

        prompt += `\nDevi reagire in modo naturale, empatico e coerente con la tua personalità.\n`;
        prompt += `Mostra che hai davvero analizzato e compreso il contenuto.\n`;

        return prompt;
    }
}

module.exports = new MediaUnderstandingEngine();
