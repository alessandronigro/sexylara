const Replicate = require("replicate");

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

async function generateNpcVoiceMaster(npc) {
    try {
        // 1. Calculate parameters
        let pitch = 0;
        if (npc.gender === 'female') pitch += 2;
        if (npc.gender === 'male') pitch -= 2;
        if (npc.age < 25) pitch += 1;
        if (npc.age > 40) pitch -= 1;

        let speed = 1;
        if (npc.energy === 'high') speed = 1.2;
        else if (npc.energy === 'low') speed = 0.85;
        else if (npc.speaking_speed === 'slow') speed = 0.9;

        let emotion = 'neutral';
        if (npc.tone_mode === 'soft') emotion = 'calm';
        else if (npc.tone_mode === 'flirty') emotion = 'happy';
        else if (npc.tone_mode === 'romantic') emotion = 'gentle';
        else if (npc.tone_mode === 'explicit') emotion = 'serious';

        let volume = 1;
        if (npc.shyness > 0.7) volume = 0.85;
        if (npc.confidence > 0.7) volume = 1.1;

        let language_boost = 'Italian';
        if (npc.accent === 'english') language_boost = 'English';

        // 2. Construct input
        const input = {
            text: `Questo è il campione vocale iniziale di ${npc.name}.`,
            pitch,
            speed,
            volume,
            bitrate: 128000,
            channel: "mono",
            emotion,
            voice_id: "Friendly_Person",
            sample_rate: 32000,
            audio_format: "mp3",
            language_boost,
            subtitle_enable: false,
            english_normalization: false
        };

        console.log(`🎤 Generating voice master for ${npc.name} with params:`, input);

        // 3. Run Replicate
        const output = await replicate.run("minimax/speech-02-hd", { input });

        // 4. Handle Output
        // Replicate run returns the output directly. 
        // Based on the example, output is the URL string: "https://replicate.delivery/..."

        let voiceUrl = null;
        if (typeof output === 'string') {
            voiceUrl = output;
        } else if (output && output.url) {
            // Fallback if it returns an object with url property (some models do)
            voiceUrl = typeof output.url === 'function' ? output.url() : output.url;
        } else if (output && output.output) {
            // Fallback if it returns the full prediction object
            voiceUrl = output.output;
        }

        if (!voiceUrl) {
            console.warn("⚠️ Replicate output format unexpected:", output);
            return { voiceUrl: null, voiceProfile: input, voiceEngine: 'minimax' };
        }

        // 5. Upload to Supabase Storage
        let finalVoiceUrl = voiceUrl;
        try {
            const response = await fetch(voiceUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Use storage service to upload
            const storageService = require('./supabase-storage');
            const filename = `voice_master_${npc.name.replace(/\s+/g, '_')}_${Date.now()}.mp3`;
            const uploadPath = `voice-masters/${filename}`;

            const { data, error } = await require('../lib/supabase').supabase.storage
                .from('voice-masters') // Assuming a bucket for voice masters exists or use chat-audio
                .upload(uploadPath, buffer, {
                    contentType: 'audio/mp3',
                    upsert: false
                });

            if (error) {
                // Try fallback bucket if voice-masters doesn't exist
                console.warn("⚠️ Failed to upload to voice-masters, trying chat-audio:", error.message);
                const fallbackPath = `voice-masters/${filename}`;
                const { data: fbData, error: fbError } = await require('../lib/supabase').supabase.storage
                    .from('chat-audio')
                    .upload(fallbackPath, buffer, { contentType: 'audio/mp3' });

                if (fbError) throw fbError;

                const { data: { publicUrl } } = require('../lib/supabase').supabase.storage
                    .from('chat-audio')
                    .getPublicUrl(fallbackPath);
                finalVoiceUrl = publicUrl;
            } else {
                const { data: { publicUrl } } = require('../lib/supabase').supabase.storage
                    .from('voice-masters')
                    .getPublicUrl(uploadPath);
                finalVoiceUrl = publicUrl;
            }

            console.log("✅ Voice master uploaded to Supabase:", finalVoiceUrl);

        } catch (uploadError) {
            console.error("❌ Error uploading voice master to Supabase, using Replicate URL as fallback:", uploadError);
            // Fallback to Replicate URL (might expire)
        }

        return {
            voiceUrl: finalVoiceUrl,
            voiceProfile: input,
            voiceEngine: 'minimax'
        };
    } catch (error) {
        console.error("Error generating NPC voice master:", error);
        throw error;
    }
}

module.exports = { generateNpcVoiceMaster };
