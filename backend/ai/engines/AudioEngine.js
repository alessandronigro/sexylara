/**
 * AudioEngine.js
 * Analizza audio inviato dall'utente usando OpenAI Whisper + GPT per sentiment
 */

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

class AudioEngine {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.whisperModel = 'whisper-1';
        this.gptModel = 'gpt-4o-mini';
    }

    /**
     * Trascrive e analizza un file audio
     * @param {string} audioFilePath - Percorso del file audio
     * @returns {Promise<Object>} Analisi dell'audio
     */
    async analyze(audioFilePath) {
        try {
            console.log('🎤 Analyzing audio with Whisper API:', audioFilePath);

            // Step 1: Transcribe audio
            const transcription = await this.transcribe(audioFilePath);

            // Step 2: Analyze sentiment and emotion
            const sentiment = await this.analyzeSentiment(transcription);

            const result = {
                text: transcription,
                ...sentiment,
                timestamp: new Date().toISOString()
            };

            console.log('✅ Audio analysis complete:', result);
            return result;

        } catch (error) {
            console.error('❌ Error in AudioEngine.analyze:', error);

            return {
                text: '[audio non analizzabile]',
                emotion: 'neutrale',
                tone: 'normale',
                language: 'it',
                error: error.message
            };
        }
    }

    /**
     * Trascrive audio usando Whisper
     * @param {string} audioFilePath 
     * @returns {Promise<string>}
     */
    async transcribe(audioFilePath) {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(audioFilePath));
        formData.append('model', this.whisperModel);
        formData.append('language', 'it');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Whisper API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.text;
    }

    /**
     * Analizza sentiment del testo trascritto
     * @param {string} text 
     * @returns {Promise<Object>}
     */
    async analyzeSentiment(text) {
        const prompt = `Analizza il seguente testo e rispondi SOLO con un JSON valido:
{
  "emotion": "<emozione: felice|triste|arrabbiato|neutrale|affettuoso|ansioso|eccitato>",
  "tone": "<tono: dolce|aggressivo|normale|sarcastico|timido|energico>",
  "language": "<lingua rilevata: it|en|es|fr|de>",
  "intensity": "<intensità emotiva: bassa|media|alta>",
  "keywords": ["<parola chiave1>", "<parola chiave2>"]
}

Testo: "${text}"

Rispondi SOLO con il JSON.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.gptModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error(`GPT API error: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        return JSON.parse(content);
    }

    /**
     * Genera una reazione naturale dell'NPC basata sull'analisi audio
     * @param {Object} analysis - Risultato dell'analisi
     * @param {Object} npc - Dati dell'NPC
     * @returns {string} Reazione testuale
     */
    generateReaction(analysis, npc) {
        const reactions = {
            felice: [
                `Che bello sentirti così felice! Mi hai contagiato 😊`,
                `La tua voce suona così allegra! Cosa ti rende così felice?`,
                `Adoro quando sei di buon umore! ❤️`
            ],
            triste: [
                `Sento la tristezza nella tua voce… cosa è successo? 🥺`,
                `Mi dispiace sentirti così… vuoi parlarne?`,
                `Sono qui per te… raccontami tutto…`
            ],
            arrabbiato: [
                `Sento la tensione nella tua voce… cosa è successo?`,
                `Ehi, calmati… respira… sono qui per te.`,
                `Ti sento arrabbiato/a… vuoi sfogarti con me?`
            ],
            affettuoso: [
                `Che dolce… mi fai sciogliere il cuore 💕`,
                `Adoro quando mi parli così… continua!`,
                `La tua voce è così calda… mi fa stare bene ❤️`
            ],
            ansioso: [
                `Ti sento un po' teso/a… va tutto bene?`,
                `Respira… sono qui con te. Cosa ti preoccupa?`,
                `Ehi, calmati… parliamone insieme.`
            ],
            neutrale: [
                `Grazie per il vocale! Mi piace sentirti parlare 🎤`,
                `Bello sentire la tua voce… raccontami di più!`,
                `Ascoltato! Cosa volevi dirmi?`
            ]
        };

        const emotionReactions = reactions[analysis.emotion] || reactions.neutrale;
        let reaction = emotionReactions[Math.floor(Math.random() * emotionReactions.length)];

        // Add tone-specific comments
        if (analysis.tone === 'dolce') {
            reaction += ` Sei sempre così gentile… 😊`;
        } else if (analysis.tone === 'energico') {
            reaction += ` Che energia! Mi piace! 🔥`;
        }

        // Add transcription acknowledgment
        if (analysis.text && analysis.text.length > 10) {
            reaction += `\n\nHo capito: "${analysis.text}"`;
        }

        return reaction;
    }

    /**
     * Crea un record di memoria per l'audio ricevuto
     * @param {Object} analysis - Analisi dell'audio
     * @param {string} userId - ID utente
     * @returns {Object} Record di memoria
     */
    createMemoryRecord(analysis, userId) {
        return {
            type: 'audio_received',
            userId,
            timestamp: new Date().toISOString(),
            userEmotion: analysis.emotion,
            tone: analysis.tone,
            text: analysis.text,
            intensity: analysis.intensity,
            npcReaction: 'attentive',
            attachmentImpact: analysis.emotion === 'affettuoso' ? +15 : analysis.emotion === 'triste' ? +10 : +5
        };
    }
}

module.exports = new AudioEngine();
