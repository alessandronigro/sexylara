const Replicate = require("replicate");
const { runReplicateWithLogging } = require("../utils/replicateLogger");
const logToFile = require("../utils/log");
const { writeFile } = require("fs/promises");
const generatePrompt = require("./promptGenerator");
const { v4: uuidv4 } = require("uuid");
const storageService = require("../services/supabase-storage");

const audio = async (prompt, voiceUrl, chatHistory = [], userId = null, girlfriendId = null, voiceProfile = null, voiceEngine = null) => {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  function cleanTextForTTS(text) {
    return text
      .replace(/[.,!?;:\"()\[\]{}]/g, "")
      .replace(/[\n\r]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Costruisci il contesto dagli ultimi messaggi
  let contextPrompt = prompt;
  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    const lastMessages = chatHistory.slice(-5);
    const context = lastMessages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");
    contextPrompt = `Context:\n${context}\n\nUser: ${prompt}`;
  }

  console.log("🎙️ Generating audio response for:", prompt);

  // Genera il testo migliorato con AI senza sanitizzazione
  const enhancedText = await generatePrompt(contextPrompt, "audio", { language: "it" });
  const textForAudio = enhancedText;
  console.log("✨ Enhanced audio text:", textForAudio);

  try {
    let output;

    // Fallback to XTTS (default) with provided or default voice
    const input = {
      speaker:
        voiceUrl ||
        "https://tnxdohjldclgbyadgdnt.supabase.co/storage/v1/object/public/voice-masters/girlfriend_default_master.mp3",
      text: cleanTextForTTS(textForAudio),
      language: "it",
      cleanup_voice: false,
    };

    console.log("🔊 Using XTTS voice URL:", input.speaker);

    output = await runReplicateWithLogging(
      replicate,
      "lucataco/xtts-v2:684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e",
      input,
      { systemPrompt: prompt, userMessage: textForAudio }
    );

    if (!output) {
      logToFile("500");
      throw new Error("No output from Replicate");
    }

    // Resolve URL or stream to buffer
    let audioUrl = null;
    if (typeof output === 'string') {
      // Direct string output (like in XTTS example)
      audioUrl = output;
    } else if (output?.url) {
      audioUrl = typeof output.url === 'function' ? output.url() : output.url;
    } else if (output?.urls?.get) {
      audioUrl = output.urls.get;
    } else if (Array.isArray(output) && output[0]) {
      audioUrl = output[0];
    }

    let buffer = null;
    if (audioUrl) {
      const response2 = await fetch(audioUrl.toString());
      const arrayBuffer = await response2.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (output?.getReader) {
      const reader = output.getReader();
      const chunks = [];
      let done, value;
      while (true) {
        ({ done, value } = await reader.read());
        if (done) break;
        if (value) chunks.push(Buffer.from(value));
      }
      buffer = Buffer.concat(chunks);
    } else {
      // If output is a stream but not a web stream (Node stream)
      if (output && typeof output.on === 'function') {
        // Handle Node stream if necessary, but Replicate usually returns web stream or URL
        // For now assume URL or WebStream
        throw new Error("No audio URL/stream returned from Replicate (unknown format)");
      }
      // If output is just the buffer (rare)
      if (Buffer.isBuffer(output)) {
        buffer = output;
      } else {
        throw new Error("No audio URL/stream returned from Replicate");
      }
    }

    // Upload to Supabase Storage if userId and girlfriendId are provided
    if (userId && girlfriendId) {
      try {
        const result = await storageService.uploadChatAudio(buffer, userId, girlfriendId);
        console.log("✅ Audio uploaded to Supabase:", result.publicUrl);
        return { type: "audio", mediaUrl: result.publicUrl };
      } catch (uploadError) {
        console.error("Error uploading audio to Supabase:", uploadError);
      }
    }

    // Fallback: save locally
    const fileaudio = `${uuidv4()}.wav`;
    await writeFile("public/" + fileaudio, buffer);
    return { type: "audio", mediaUrl: `/${fileaudio}` };
  } catch (error) {
    logToFile(error);
    throw error;
  }
};

module.exports = audio;
