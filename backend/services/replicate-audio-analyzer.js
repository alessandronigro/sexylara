const Replicate = require("replicate");

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

/**
 * Analizza un audio remoto combinando:
 * 1) WhisperX → trascrizione
 * 2) Voice Emotion Classifier → emozioni vocali
 */
async function analyzeAudio(audioUrl) {
    let transcription = null;
    let emotion = "neutral";
    let tones = [];
    let rawWhisper = null;
    let rawEmotion = null;

    try {
        //------------------------------------------------------
        // 1) GPT-4o Transcribe → trascrizione testo
        //------------------------------------------------------
        rawWhisper = await replicate.run("openai/gpt-4o-transcribe", {
            input: {
                audio_file: audioUrl,
                language: "it",
            }
        });

        // Handle different output formats
        if (Array.isArray(rawWhisper)) {
            // New format: array of strings (tokens/words)
            transcription = rawWhisper.join("");
        } else if (typeof rawWhisper === 'string') {
            transcription = rawWhisper;
        } else {
            // Old/Fallback formats
            transcription = rawWhisper?.transcription || rawWhisper?.text || rawWhisper?.output || null;
            if (Array.isArray(transcription)) {
                transcription = transcription.join("");
            }
        }

        //------------------------------------------------------
        // 2) EMOTION ANALYZER → TONO VOCALE
        //------------------------------------------------------
        if (transcription) {
            rawEmotion = await replicate.run(
                "taranjeet/voice-emotion:latest",
                {
                    input: {
                        audio: audioUrl
                    }
                }
            );

            emotion = rawEmotion?.emotion || "neutral";
            tones = mapEmotionToSexylaraTone(emotion);
        }

        return {
            raw: {
                whisper: rawWhisper,
                emotion: rawEmotion
            },
            transcription,
            userIsTalking: !!transcription,
            emotion,
            tones
        };

    } catch (err) {
        console.error('[replicate-audio-analyzer] Error:', err);

        return {
            error: err?.message || String(err),
            transcription: null,
            userIsTalking: false,
            emotion: "neutral",
            tones: []
        };
    }
}

/**
 * Traduce l'emozione grezza del modello Replicate nel sistema dei "tones"
 */
function mapEmotionToSexylaraTone(emotion) {
    switch (emotion) {
        case "happy":
            return ["warm", "friendly", "flirt"];
        case "sad":
            return ["sad", "soft"];
        case "angry":
            return ["angry", "aggressive"];
        case "fearful":
            return ["anxious", "tense"];
        case "disgust":
            return ["cold", "rejecting"];
        case "surprised":
            return ["surprised", "curious"];
        default:
            return ["neutral"];
    }
}

module.exports = { analyzeAudio };
