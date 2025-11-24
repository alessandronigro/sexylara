// routes/replicateService.js
const Replicate = require("replicate");
const logToFile = require("../utils/log");
const { writeFile } = require('fs/promises');
const generatePrompt = require("./promptGenerator");
const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/supabase-storage');

const audio = async (prompt, voiceUrl, chatHistory = [], userId = null, girlfriendId = null) => {
    const sessionId = new Date().toISOString().slice(0, 10);

    const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
    });

    function cleanTextForTTS(text) {
        return text
            .replace(/[.,!?;:\"()\\[\\]{}]/g, '')    // rimuove punteggiatura comune
            .replace(/[\n\r]/g, ' ')              // rimuove a capo
            .replace(/\s+/g, ' ')                 // riduce spazi doppi
            .trim();
    }

    // Costruisci il contesto dagli ultimi messaggi
    let contextPrompt = prompt;
    if (chatHistory && chatHistory.length > 0) {
        const lastMessages = chatHistory.slice(-5); // Ultimi 5 messaggi
        const context = lastMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
        contextPrompt = `Context:\n${context}\n\nUser: ${prompt}`;
    }

    console.log('🎙️ Generating audio response for:', prompt);

    // Genera il testo migliorato con AI
    const enhancedText = await generatePrompt(contextPrompt, 'audio', { language: 'it' });
    console.log('✨ Enhanced audio text:', enhancedText);

    try {
        const input = {
            speaker: voiceUrl || "https://tnxdohjldclgbyadgdnt.supabase.co/storage/v1/object/public/voice-masters/girlfriend_default_master.mp3",
            text: cleanTextForTTS(enhancedText),
            language: "it",
            cleanup_voice: false
        };

        console.log('🔊 Using voice URL:', input.speaker);

        const output = await replicate.run("lucataco/xtts-v2:684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e", { input });

        if (output) {
            logToFile(output);

            const response2 = await fetch(output.url());
            const arrayBuffer = await response2.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Upload to Supabase Storage if userId and girlfriendId are provided
            if (userId && girlfriendId) {
                try {
                    const result = await storageService.uploadChatAudio(buffer, userId, girlfriendId);
                    console.log('✅ Audio uploaded to Supabase:', result.publicUrl);
                    return result.publicUrl;
                } catch (uploadError) {
                    console.error('Error uploading audio to Supabase:', uploadError);
                    // Fallback to local storage
                }
            }

            // Fallback: save locally
            const fileaudio = `${uuidv4()}.wav`;
            await writeFile("public/" + fileaudio, buffer);
            return fileaudio.toString();
        } else {
            logToFile("500");
            throw new Error('No output from Replicate');
        }
    } catch (error) {
        logToFile(error);
        throw error;
    }
};

module.exports = audio;
