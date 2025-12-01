/**
 * MediaGenerationService.js
 * Gestisce la generazione effettiva di foto, video e audio per gli NPC
 */

const { generateImage } = require('../routes/image');
const generateVideo = require('../routes/video');
const generateAudio = require('../routes/audio');

class MediaGenerationService {
    /**
     * Genera una foto basata sull'NPC
     * @param {Object} npc - Dati dell'NPC
     * @param {Object} npc - Dati dell'NPC
     * @param {Object} intentDetails - Dettagli dal MediaIntentEngine (scenePrompt/profilePrompt)
     * @param {string|null} faceImageUrl - URL del volto di riferimento
     * @returns {Promise<{url: string, caption: string}>}
     */
    async generatePhoto(npc, intentDetails, faceImageUrl) {
        try {
            console.log(`📸 Generating photo for NPC: ${npc.name}`);
            if (!intentDetails || !intentDetails.scenePrompt) {
                throw new Error("missing intent details for photo generation");
            }

            const finalPrompt = this._applyGenderConsistency(intentDetails.scenePrompt, npc);

            const result = await generateImage(finalPrompt, npc, null, 'it', {
                skipEnhance: true,
                preservePrompt: true,
                faceImageUrl
            });

            if (!result || !result.mediaUrl) {
                throw new Error(result?.error || 'image generation failed');
            }

            return {
                url: result.mediaUrl || result.imageUrl || result.result,
                caption: this.generatePhotoCaption(npc)
            };
        } catch (error) {
            console.error('❌ Error generating photo:', error);
            return {
                url: null,
                caption: null,
                error: error.message || 'image generation failed'
            };
        }
    }

    /**
     * Genera un video basato sull'NPC
     * @param {Object} npc - Dati dell'NPC
     * @param {Object} npc - Dati dell'NPC
     * @param {Object} intentDetails - Dettagli dal MediaIntentEngine (scenePrompt)
     * @param {string|null} userId - ID dell'utente che ha richiesto il video (per storage)
     * @returns {Promise<{url: string, caption: string}>}
     */
    async generateVideo(npc, intentDetails, userId = null) {
        try {
            console.log(`🎥 Generating video for NPC: ${npc.name}`);

            const prompt = intentDetails?.scenePrompt;
            if (!prompt) {
                throw new Error('missing intent details for video generation');
            }

            const faceRef = this._resolveNpcFace(npc);
            const result = await generateVideo(prompt, npc, [], userId, npc.id, faceRef);
            const finalUrl = typeof result === 'string'
                ? result
                : (result?.videoUrl || result?.mediaUrl || result?.result);

            if (!finalUrl) {
                throw new Error('video generation returned empty url');
            }

            return {
                url: finalUrl,
                caption: this.generateVideoCaption(npc)
            };
        } catch (error) {
            console.error('❌ Error generating video:', error);
            throw error;
        }
    }

    /**
     * Genera un audio basato sull'NPC
     * @param {Object} npc - Dati dell'NPC
     * @param {Object} npc - Dati dell'NPC
     * @param {Object} intentDetails - Dettagli dal MediaIntentEngine (scenePrompt)
     * @returns {Promise<{url: string, caption: string}>}
     */
    async generateAudio(npc, intentDetails, userId = null) {
        try {
            console.log(`🎤 Generating audio for NPC: ${npc.name}`);

            const audioText = intentDetails?.scenePrompt;
            if (!audioText) {
                throw new Error('missing intent details for audio generation');
            }

            const result = await generateAudio(
                audioText,
                npc.voice_master_url || null, // prefer cloned master url
                [],
                userId,
                npc.id,
                npc.voice_profile,
                npc.voice_engine
            );
            const finalUrl = typeof result === 'string'
                ? result
                : (result?.mediaUrl || result?.audioUrl || result?.result);
            console.log('🔊 Audio generation result URL:', finalUrl || 'null');

            return {
                url: finalUrl,
                caption: "🎤 Ascolta il mio messaggio vocale..."
            };
        } catch (error) {
            console.error('❌ Error generating audio:', error);
            throw error;
        }
    }

    /**
     * Genera una caption per la foto
     */
    generatePhotoCaption(npc) {
        const captions = [
            "Ecco la foto che mi hai chiesto... spero ti piaccia 😘",
            "Come ti sembro? 📸",
            "Fatto! Dimmi cosa ne pensi...",
            "Selfie appena scattato per te ❤️"
        ];
        return captions[Math.floor(Math.random() * captions.length)];
    }

    /**
     * Genera una caption per il video
     */
    generateVideoCaption(npc) {
        const captions = [
            "Ecco il video! 🎥",
            "Spero ti piaccia vedermi in movimento...",
            "Video pronto! Guardalo e dimmi cosa ne pensi 😘"
        ];
        return captions[Math.floor(Math.random() * captions.length)];
    }
    /**
     * Mantiene la coerenza di genere tra NPC e prompt.
     * Sostituisce termini maschili/femminili se contrastano con l'NPC.
     */
    _applyGenderConsistency(prompt, npc) {
        if (!prompt || !npc || !npc.gender) return prompt;

        const gender = (npc.gender || '').toLowerCase();
        let updated = prompt;

        const toMale = [
            { find: /\bwoman\b/gi, repl: 'man' },
            { find: /\bgirl\b/gi, repl: 'man' },
            { find: /\bfemale\b/gi, repl: 'male' }
        ];

        const toFemale = [
            { find: /\bman\b/gi, repl: 'woman' },
            { find: /\bguy\b/gi, repl: 'woman' },
            { find: /\bmale\b/gi, repl: 'female' }
        ];

        if (gender === 'male' || gender === 'm') {
            toMale.forEach(rule => {
                updated = updated.replace(rule.find, rule.repl);
            });
        } else if (gender === 'female' || gender === 'f') {
            toFemale.forEach(rule => {
                updated = updated.replace(rule.find, rule.repl);
            });
        }

        return updated;
    }

    _resolveNpcFace(npc) {
        if (!npc) return null;
        return npc.face_image_url
            || npc.avatar_url
            || npc.image_reference
            || npc.avatar
            || null;
    }
}

module.exports = new MediaGenerationService();
