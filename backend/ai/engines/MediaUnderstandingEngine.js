'use strict';

// MediaUnderstandingEngine (engines layer)
// ---------------------------------------
// Questo modulo fornisce una API pulita e focalizzata per analizzare
// IMMAGINI e AUDIO inviati dall'utente, usando i servizi Replicate
// definiti in services/replicate-image-analyzer.js e
// services/replicate-audio-analyzer.js.
//
// È "pure": nessuna chiamata a WebSocket o al database.
// I layer superiori (brainEngine, server-ws) decidono se e come
// usare i risultati per memoria, stato emotivo, ecc.

const { analyzeImage } = require('../../services/replicate-image-analyzer');
const { analyzeAudio } = require('../../services/replicate-audio-analyzer');

const MediaUnderstandingEngine = {
    /**
     * Analizza un media inviato dall'utente (immagine o audio)
     * e restituisce un oggetto normalizzato:
     * - analysis: risultato grezzo/normalizzato dal modello
     * - emotionalImpact: { attachment, intimacy, trust, mood }
     * - memoryRecord: record descrittivo da poter salvare nella memoria NPC
     * - reaction: breve testo che l'NPC potrebbe usare come base di risposta
     */
    async processReceivedMedia(type, url, npc = null, userId = null) {
        try {
            let analysis = {};
            let emotionalImpact = null;
            let memoryRecord = null;
            let reaction = null;

            if (type === 'image') {
                analysis = await analyzeImage(url);

                emotionalImpact = {
                    attachment: analysis.containsUserFace ? 3 : 1,
                    intimacy: analysis.context === 'selfie' ? 3 : 1,
                    trust: 1,
                    mood: analysis.emotion || 'neutral',
                };

                reaction = this._buildImageReaction(analysis, npc);

                memoryRecord = {
                    kind: 'user_image',
                    url,
                    summary: analysis.description || 'foto ricevuta',
                    tags: analysis.tags || [],
                    emotion: analysis.emotion || null,
                    created_at: new Date().toISOString(),
                    user_id: userId || null,
                };
            } else if (type === 'audio') {
                analysis = await analyzeAudio(url);

                emotionalImpact = {
                    attachment: analysis.userIsTalking ? 2 : 1,
                    intimacy: (analysis.tones || []).includes('flirt') ? 3 : 1,
                    trust: 2,
                    mood: analysis.emotion || 'neutral',
                };

                reaction = this._buildAudioReaction(analysis, npc);

                memoryRecord = {
                    kind: 'user_audio',
                    url,
                    transcription: analysis.transcription || null,
                    emotion: analysis.emotion || null,
                    tones: analysis.tones || [],
                    created_at: new Date().toISOString(),
                    user_id: userId || null,
                };
            } else {
                // Tipologia non supportata: ritorno un payload minimale
                analysis = { type, url };
                emotionalImpact = null;
                memoryRecord = {
                    kind: 'generic_media',
                    type,
                    url,
                    created_at: new Date().toISOString(),
                    user_id: userId || null,
                };
                reaction = null;
            }

            return {
                analysis,
                emotionalImpact,
                memoryRecord,
                reaction,
            };
        } catch (err) {
            console.error('[MediaUnderstandingEngine] Error processing media:', err);
            return {
                analysis: { type, url, error: err?.message },
                emotionalImpact: null,
                memoryRecord: {
                    kind: 'error',
                    type,
                    url,
                    error: err?.message,
                    created_at: new Date().toISOString(),
                    user_id: userId || null,
                },
                reaction: null,
            };
        }
    },

    /**
     * Genera un blocco di testo da appendere al messaggio utente
     * per dare contesto al BrainEngine.
     */
    generateContextPrompt(analysis, type, language = 'it') {
        const descr = analysis?.description || '';
        const emo = analysis?.emotion || analysis?.primary_emotion || 'neutral';

        const header = language === 'it' ? '[CONTESTO MEDIA]' : '[MEDIA CONTEXT]';

        if (language === 'it') {
            return `\n${header}\n` +
                `L'utente ti ha inviato un ${type}.\n` +
                `Analisi automatica:\n` +
                `- Descrizione: ${descr}\n` +
                `- Emozione percepita: ${emo}\n` +
                `- Dettagli tecnici: ${JSON.stringify(analysis)}\n\n` +
                'Rispondi in modo coerente con questo media: fai riferimento al contenuto, ' +
                'alla situazione e al tono emotivo. Non essere servizievole, non fare la psicologa: ' +
                'parla come un personaggio vivo, che reagisce spontaneamente al media ricevuto.\n';
        }

        // EN default
        return `\n${header}\n` +
            `The user sent you a ${type}.\n` +
            `Automatic analysis:\n` +
            `- Description: ${descr}\n` +
            `- Detected emotion: ${emo}\n` +
            `- Technical details: ${JSON.stringify(analysis)}\n\n` +
            'Reply in a way that matches this media: refer to its content, the situation, and the emotional tone. ' +
            'Do not sound like a therapist or an assistant: speak as a vivid character reacting naturally to what they see/hear.\n';
    },

    /**
     * Hook per futura integrazione con una vera memoria persitente.
     * Rimane NO-OP per compatibilità e per evitare dipendenze dal DB.
     */
    async updateNpcMemory(_npc, _record) {
        return;
    },

    _buildImageReaction(analysis, npc) {
        const name = npc?.name || 'Lei';

        if (analysis.containsUserFace && analysis.smile) {
            return `${name} nota il tuo sorriso e si scioglie un po'.`;
        }
        if (analysis.context === 'selfie') {
            return `${name} guarda il tuo selfie e ti immagina ancora più vicino.`;
        }
        if (analysis.description) {
            return `${name} osserva la tua foto: "${analysis.description}".`;
        }
        return `${name} osserva la tua foto con attenzione e curiosità.`;
    },

    _buildAudioReaction(analysis, npc) {
        const name = npc?.name || 'Lei';

        if (analysis.transcription && (analysis.tones || []).includes('flirt')) {
            return `${name} ascolta la tua voce e sente chiaramente quel tono malizioso...`;
        }
        if (analysis.transcription) {
            return `${name} ti ascolta e rimane colpita da ciò che dici.`;
        }
        return `${name} ascolta il tuo audio e prova a immaginare il tuo stato d'animo.`;
    },
};

module.exports = MediaUnderstandingEngine;
