/**
 * MediaGenerationService.js
 * Gestisce la generazione effettiva di foto, video e audio per gli NPC
 */

const { generateImage } = require('../routes/image');
const { generateVideo } = require('../routes/video');
const { generateAudio } = require('../routes/audio');

class MediaGenerationService {
    /**
     * Genera una foto basata sull'NPC
     * @param {Object} npc - Dati dell'NPC
     * @param {string} userId - ID utente richiedente
     * @returns {Promise<{url: string, caption: string}>}
     */
    async generatePhoto(npc, userId) {
        try {
            console.log(`📸 Generating photo for NPC: ${npc.name}`);

            // Build prompt based on NPC characteristics
            const prompt = this.buildPhotoPrompt(npc);

            // Call image generation service
            const result = await generateImage({
                body: {
                    prompt,
                    girlfriendId: npc.id,
                    userId
                }
            });

            return {
                url: result.imageUrl || result.result,
                caption: this.generatePhotoCaption(npc)
            };
        } catch (error) {
            console.error('❌ Error generating photo:', error);
            throw error;
        }
    }

    /**
     * Genera un video basato sull'NPC
     * @param {Object} npc - Dati dell'NPC
     * @param {string} userId - ID utente richiedente
     * @returns {Promise<{url: string, caption: string}>}
     */
    async generateVideo(npc, userId) {
        try {
            console.log(`🎥 Generating video for NPC: ${npc.name}`);

            const prompt = this.buildVideoPrompt(npc);

            const result = await generateVideo({
                body: {
                    prompt,
                    girlfriendId: npc.id,
                    userId
                }
            });

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
     * @param {string} userId - ID utente richiedente
     * @param {string} text - Testo da convertire in audio (opzionale)
     * @returns {Promise<{url: string, caption: string}>}
     */
    async generateAudio(npc, userId, text = null) {
        try {
            console.log(`🎤 Generating audio for NPC: ${npc.name}`);

            const audioText = text || this.generateAudioText(npc);

            const result = await generateAudio({
                body: {
                    text: audioText,
                    girlfriendId: npc.id,
                    userId,
                    voice: npc.voice_id || 'default'
                }
            });

            return {
                url: result.audioUrl || result.result,
                caption: "🎤 Ascolta il mio messaggio vocale..."
            };
        } catch (error) {
            console.error('❌ Error generating audio:', error);
            throw error;
        }
    }

    /**
     * Costruisce un prompt per la generazione di foto
     */
    buildPhotoPrompt(npc) {
        const traits = npc.core_traits || npc.traits || {};
        const appearance = npc.appearance || {};

        return `portrait photo of ${npc.name}, ${appearance.age || 25} years old, ${appearance.ethnicity || 'caucasian'}, ${appearance.hair_color || 'brown'} hair, ${appearance.eye_color || 'brown'} eyes, ${traits.style || 'casual'} style, high quality, realistic`;
    }

    /**
     * Costruisce un prompt per la generazione di video
     */
    buildVideoPrompt(npc) {
        return `short video of ${npc.name} smiling and waving at camera, realistic, high quality`;
    }

    /**
     * Genera un testo per l'audio
     */
    generateAudioText(npc) {
        const greetings = [
            `Ciao! Sono ${npc.name}. Come stai?`,
            `Ehi, volevo sentire la tua voce... spero ti piaccia la mia!`,
            `Ti mando questo vocale perché scrivere non basta... 😘`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
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
