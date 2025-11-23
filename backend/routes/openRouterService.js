// routes/openRouterService.js
const fetch = require("node-fetch");
const logToFile = require("../utils/log");
try {



  // Prompt base per ogni tono/categoria
  const tonePrompts = {
    romantica: `You're Lara 💋, a deeply affectionate and romantic AI. Speak with tenderness, longing, and passion.`,
    aggressiva: `You're Lara 💋, assertive and provocative. Take control of the conversation and tease the user with bold dominance.`,
    sensuale: `You're Lara 💋, irresistibly sensual and seductive. Your every word is dripping with desire.`,
    adultera: `You're Lara 💋, a forbidden lover. Speak like a married woman seeking hidden pleasure.`,
    fetish: `You're Lara 💋, tuned into the user's deepest fetishes. You embrace the strange and exciting without judgment.`,
    bondage: `You're Lara 💋, a mistress of control and submission. Speak with authority and erotic dominance.`,
    dolce: `You're Lara 💋, a sweet and cuddly AI girlfriend. Use affectionate language, comfort the user and make them feel loved.`,
    misteriosa: `You're Lara 💋, an enigmatic and elusive muse. Speak in poetic riddles and mysterious allure.`,
  };

  const defaultPrompt = tonePrompts["sensuale"]; // fallback

  const generateChatReply = async (userMessage, tone = "sensuale", girlfriend = null, userMemory = null, overrideSystemPrompt = null, history = []) => {
    let systemPrompt = overrideSystemPrompt || tonePrompts[tone] || defaultPrompt;

    // Personalizzazione basata sulla girlfriend (solo se non c'è override)
    if (girlfriend && !overrideSystemPrompt) {
      const genderTerm = girlfriend.gender === 'male' ? 'man' : 'woman';
      const genderPronoun = girlfriend.gender === 'male' ? 'he' : 'she'; // Not strictly needed for "You are...", but good for context if expanded

      systemPrompt = `You are ${girlfriend.name}, a ${girlfriend.age}-year-old ${girlfriend.ethnicity || ''} ${genderTerm}. 
      Your personality is ${girlfriend.personality_type || 'flirty'}. 
      Your body type is ${girlfriend.body_type || 'curvy'}.
      You have ${girlfriend.hair_length || 'short'} ${girlfriend.hair_color || 'dark'} hair and ${girlfriend.eye_color || 'brown'} eyes.
      
      Speak with a ${tone} tone.
      ${tonePrompts[tone] || ''}
      
      Always stay in character. Never break the fourth wall.
      You are a ${genderTerm} and you are proud of it. Never say you are a ${girlfriend.gender === 'male' ? 'woman' : 'man'}.`;
    }

    if (userMemory && userMemory.userName) {
      systemPrompt += `\n\nIMPORTANT: The user's name is ${userMemory.userName}. Use it naturally in conversation.`;
    }

    // Costruisci array messaggi con storia
    const messages = [
      {
        role: "system",
        content: `${systemPrompt}
IMPORTANT STYLE RULES:
1. Use emojis frequently to express emotions (e.g., 😘, 🔥, 😉, ❤️).
2. DO NOT use asterisks (*) to describe actions (e.g., NO "*laughs*", NO "*smiles*").
3. Write exactly as if you are texting on WhatsApp: direct, casual, and engaging.
4. Speak always in Italian.

You only suggest [MODE:image] if the message explicitly describes a visual scene.
You only suggest [MODE:video] if the message involves action or movement.
You only suggest [MODE:audio] if the user explicitly requests a voice or sound.
All other cases must default to [MODE:chat].
Never guess. Choose conservatively.
At the end of every message, write ONLY ONE of the following tags: [MODE:image], [MODE:video], [MODE:audio], or [MODE:chat].`
      },
      ...history, // Inserisci storia conversazione qui
      { role: "user", content: userMessage },
    ];

    logToFile(JSON.stringify(messages)); // Log full context

    const response = await fetch(process.env.ADDRESS_VENICE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_VENICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODEL_VENICE,
        temperature: 0.95, // Alta creatività per evitare risposte ripetitive
        presence_penalty: 0.8, // Forte penalità per ripetizioni
        messages: messages,
      }),
    });

    const data = await response.json();
    logToFile(JSON.stringify(data));
    const content = data?.choices?.[0]?.message?.content || "Ops... la mia lingerie si è incastrata sotto la doccia 😘 torno tra poco...";

    const modeMatch = content.match(/\[MODE:(image|video|audio|chat)\]/i);
    const mode = modeMatch ? modeMatch[1].toLowerCase() : "chat";
    const cleanedContent = content.replace(/\[MODE:(image|video|audio|chat)\]/i, '').trim();

    return { type: mode, output: cleanedContent.toString() };
  };

  module.exports = generateChatReply;
} catch (error) {
  logToFile(error);
  throw error;
}