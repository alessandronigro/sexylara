const express = require("express");
const router = express.Router();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Funzione fittizia per generare voce. Sostituisci con vera API (es. ElevenLabs)
async function generateAudioFromText(text, lang = "french", tone = "romantic") {
  const fakeAudioPath = path.join(__dirname, "..", "public", "audio", `${uuidv4()}.mp3`);

  // Simulazione: copia un file mp3 statico come segnaposto
  const placeholderPath = path.join(__dirname, "..", "assets", "voice-placeholder.mp3");
  fs.copyFileSync(placeholderPath, fakeAudioPath);

  return `/public/audio/${path.basename(fakeAudioPath)}`;
}

router.post("/", async (req, res) => {
  try {
    const { prompt, lang, tone } = req.body;
    const audioUrl = await generateAudioFromText(prompt, lang, tone);
    res.json({ audio: audioUrl });
  } catch (err) {
    console.error("Errore generazione audio:", err.message);
    res.status(500).json({ error: "Errore generazione audio" });
  }
});

module.exports = router;
