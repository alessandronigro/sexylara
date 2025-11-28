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

            const finalPrompt = intentDetails.scenePrompt;

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
     * @returns {Promise<{url: string, caption: string}>}
     */
    async generateVideo(npc, intentDetails) {
        try {
            console.log(`🎥 Generating video for NPC: ${npc.name}`);

            const prompt = intentDetails?.scenePrompt;
            if (!prompt) {
                throw new Error('missing intent details for video generation');
            }

            const result = await generateVideo(prompt, npc, [], null, npc.id);

            return {
                url: result.videoUrl || result.result,
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
    async generateAudio(npc, intentDetails) {
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
                null,
                npc.id,
                npc.voice_profile,
                npc.voice_engine
            );
            const finalUrl = typeof result === 'string'
                ? result
                : (result?.mediaUrl || result?.audioUrl || result?.result);

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
}

module.exports = new MediaGenerationService();
