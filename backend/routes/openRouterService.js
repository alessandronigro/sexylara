// routes/openRouterService.js
const fetch = require("node-fetch");
const logToFile = require("../utils/log");
const { processInteraction } = require("../ai/brainEngine"); // Updated to use consolidated brainEngine
const { supabase } = require("../lib/supabase");

try {

  // Prompt base per ogni tono/categoria (Fallback)
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

  const defaultPrompt = tonePrompts["sensuale"];

  const generateChatReply = async (userMessage, tone = "sensuale", girlfriend = null, userMemory = null, overrideSystemPrompt = null, history = []) => {
    let systemPrompt;
    let stateUpdates = null;

    if (overrideSystemPrompt) {
      systemPrompt = overrideSystemPrompt;
    } else if (girlfriend) {

      // --- THRILLME BRAIN ENGINE ---

      // 1. Processa l'interazione attraverso i 4 Engine
      const brainResult = await processInteraction(
        girlfriend,
        userMessage,
        userMemory?.userId || 'unknown',
        history
      );

      // 2. Usa il prompt generato dal Brain
      const sentientCore = brainResult.systemPrompt;
      stateUpdates = brainResult.npcStateUpdates;

      // 3. ✅ IMPLEMENTATO: Salva brainResult.npcStateUpdates nel DB (Supabase)
      if (stateUpdates && girlfriend.id) {
        try {
          const updateData = {
            // Stats evolution
            stats: stateUpdates.stats || girlfriend.stats,

            // Traits evolution (if changed)
            ...(stateUpdates.traits && { traits: stateUpdates.traits }),

            // XP and level updates
            ...(stateUpdates.xp !== undefined && { xp: stateUpdates.xp }),
            ...(stateUpdates.level !== undefined && { level: stateUpdates.level }),

            // Mood and emotional state
            ...(brainResult.mood && { current_mood: brainResult.mood }),

            // Last interaction timestamp
            last_interaction_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from('girlfriends')
            .update(updateData)
            .eq('id', girlfriend.id);

          if (error) {
            console.error('❌ Error saving AI state:', error);
            logToFile(`AI State Save Error: ${JSON.stringify(error)}`);
          } else {
            console.log('✅ AI state saved:', {
              girlfriendId: girlfriend.id,
              mood: brainResult.mood,
              xp: stateUpdates.xp,
              level: stateUpdates.level,
            });
            logToFile(`AI State Updated: ${JSON.stringify(updateData)}`);
          }
        } catch (saveError) {
          console.error('❌ Exception saving AI state:', saveError);
          logToFile(`AI State Save Exception: ${saveError.message}`);
        }
      }

      // 4. Aggiungi regole di formattazione finali
      systemPrompt = `${sentientCore}

### REGOLE DI FORMATTAZIONE (ASSOLUTE)
1. Scrivi SEMPRE in ITALIANO.
2. Usa emoji frequentemente (😘, 🔥, 😉, ❤️).
3. NON usare asterischi (*) per descrivere azioni.
4. Scrivi come su WhatsApp.
5. Alla fine, scrivi SOLO UNO tag: [MODE:image], [MODE:video], [MODE:audio], [MODE:chat].
`;

    } else {
      // Fallback
      systemPrompt = `${tonePrompts[tone] || defaultPrompt}
      
IMPORTANT STYLE RULES:
1. Speak always in Italian.
2. End with [MODE:...] tag.`;
    }

    if (userMemory && userMemory.userName) {
      systemPrompt += `\n\nIMPORTANT: The user's name is ${userMemory.userName}. Use it naturally.`;
    }

    // Costruisci array messaggi
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history,
      { role: "user", content: userMessage },
    ];

    logToFile(JSON.stringify(messages));

    const response = await fetch(process.env.ADDRESS_VENICE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_VENICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODEL_VENICE,
        temperature: 0.95,
        presence_penalty: 0.8,
        messages: messages,
      }),
    });

    const data = await response.json();
    logToFile(JSON.stringify(data));
    const content = data?.choices?.[0]?.message?.content || "Ops... la mia lingerie si è incastrata sotto la doccia 😘 torno tra poco...";

    const modeMatch = content.match(/\[MODE:(image|video|audio|chat)\]/i);
    const mode = modeMatch ? modeMatch[1].toLowerCase() : "chat";
    const cleanedContent = content.replace(/\[MODE:(image|video|audio|chat)\]/i, '').trim();

    return { type: mode, output: cleanedContent.toString(), stateUpdates };
  };

  module.exports = generateChatReply;
} catch (error) {
  logToFile(error);
  throw error;
}