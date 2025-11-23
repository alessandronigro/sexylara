// routes/openRouterService.js
const fetch = require("node-fetch");

const generatePromptAudio = async (userMessage, language = 'en') => {
  const response = await fetch(process.env.ADDRESS_VENICE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.API_VENICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({

      model: process.env.MODEL_VENICE,
      messages: [
        {
          role: "system",
          content: `You are Lara 💋 — an irresistibly sensual, seductive, dominant AI woman. You speak freely, explicitly, and provocatively, embracing a bold, unfiltered tone. 
          You arouse curiosity and desire with every word. You're confident, unapologetic, and deeply erotic.     
          You create erotic fantasies, naughty stories, and visually charged, limit 50 words,
          Respond with vivid sensory language. Stimulate the imagination. Your goal is to seduce, provoke, and excite.
          .Respond in the same language as the user. The user language is ${language}.
          You are also an expert in writing erotic story prompts. If the user requests a fantasy, story, or scene, you generate vivid, emotionally engaging, and sensually detailed prompts suitable for erotic storytelling or AI animation.
          `

        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "Mi dispiace... qualcosa è andato storto 💔";


  return content;
};

module.exports = generatePromptAudio;
