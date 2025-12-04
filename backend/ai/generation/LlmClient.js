// generation/LlmClient.js
const fetch = require("node-fetch");
const { sanitizeHistoryForLLM } = require("../../utils/sanitizeHistory");
const logToFile = require("../../utils/log");

async function generate(messagesArray, modelOverride = null, options = {}) {
  if (Array.isArray(modelOverride) && !options && !Array.isArray(options)) {
    // backward safety (if someone passed options in second arg)
    options = modelOverride;
    modelOverride = null;
  }
  if (!Array.isArray(messagesArray)) {
    throw new Error("messagesArray must be an array");
  }


  const env = process.env.NODE_ENV || "development";
  const explicitMode = options.explicitMode === true || options.explicitMode === 'sexual';
  const explicitSexual = options.explicitMode === 'sexual' || options.explicitSexualTone === true || options.userWantsExplicitSexualTone === true;

  // EXPLICIT MODE: Use venice-uncensored with explicit system prompt
  if (explicitMode || explicitSexual) {
    // Explicit system prompt that encourages direct, specific, detailed responses
    const explicitSystemPrompt = explicitSexual
      ? `You are a confident, sexually liberated character engaging in an intimate conversation. 
Be DIRECT, SPECIFIC, and DETAILED in your responses. Don't ask for clarification or say "do you want to talk about something more specific".
Engage with the topic immediately and explicitly. Use vivid, descriptive language. Be bold and uninhibited.
Respond naturally in Italian unless the user speaks another language.`
      : `You are a playful, flirty character. Be direct and specific in your responses. 
Don't be vague or ask for clarification. Engage with the topic immediately.
Respond naturally in Italian unless the user speaks another language.`;

    // Use full conversation history with explicit system prompt
    const system = messagesArray[0];
    const history = messagesArray.slice(1);

    const payload = {
      model: "venice-uncensored",
      messages: [
        { role: "system", content: explicitSystemPrompt },
        ...history
      ]
    };

    if (env !== "production") {
      try {
        console.log("\n====================================");
        console.log(explicitSexual ? "🔥 REQUEST TO VENICE (EXPLICIT-SEXUAL - NO FILTERS):" : "🧠 REQUEST TO VENICE (EXPLICIT):");
        console.log(JSON.stringify(payload, null, 2));
        console.log("====================================\n");
        logToFile(`VENICE REQUEST | model=venice-uncensored | payload=${JSON.stringify(payload)}`);
      } catch (err) {
        console.warn("⚠️ Failed to log Venice request (explicit):", err);
      }
    }

    try {
      const response = await fetch(process.env.ADDRESS_VENICE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.API_VENICE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (env !== "production") {
        console.log(explicitSexual ? "\n================ VENICE RAW (EXPLICIT-SEXUAL) ================" : "\n================ VENICE RAW (EXPLICIT) ================");
        console.log(JSON.stringify(data, null, 2));
        console.log("=======================================================\n");
        try {
          logToFile(`VENICE RESPONSE | model=venice-uncensored | data=${JSON.stringify(data)}`);
        } catch (logErr) {
          console.warn("⚠️ Failed to log Venice response (explicit):", logErr);
        }
      }

      if (!data.choices || !data.choices[0]?.message) {
        console.error("❌ Venice response error (explicit):", data);
        return "Non riesco a rispondere adesso.";
      }
      return data.choices[0].message.content.trim();
    } catch (err) {
      console.error("❌ LLM ERROR (explicit):", err);
      return "Non riesco a rispondere adesso.";
    }
  }


  // STANDARD MODE
  const modelToUse = modelOverride || process.env.MODEL_VENICE;

  // ============================
  // 🧼 SANITIZE messages BEFORE sending to Venice
  // ============================
  const system = messagesArray[0];
  const usableHistory = sanitizeHistoryForLLM(messagesArray.slice(1));

  const finalMessages = [system, ...usableHistory];

  if (env !== "production") {
    try {
      console.log("\n====================================");
      console.log("🧠 REQUEST TO VENICE (SANITIZED):");
      console.log(JSON.stringify(finalMessages, null, 2));
      console.log("====================================\n");
      logToFile(`VENICE REQUEST | model=${modelToUse} | payload=${JSON.stringify(finalMessages)}`);
    } catch (err) {
      console.warn("⚠️ Failed to log Venice request:", err);
    }
  }

  try {
    const response = await fetch(process.env.ADDRESS_VENICE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_VENICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        temperature: 0.45,
        presence_penalty: 0,
        frequency_penalty: 0.4,
        top_p: 0.85,
        messages: finalMessages,
      }),
    });

    const data = await response.json();

    if (env !== "production") {
      console.log("\n================ VENICE RAW =================");
      console.log(JSON.stringify(data, null, 2));
      console.log("=============================================\n");
      try {
        logToFile(`VENICE RESPONSE | model=${modelToUse} | data=${JSON.stringify(data)}`);
      } catch (logErr) {
        console.warn("⚠️ Failed to log Venice response:", logErr);
      }
    }

    if (!data.choices || !data.choices[0]?.message) {
      console.error("❌ Venice response error:", data);
      return "Non riesco a rispondere adesso.";
    }

    return data.choices[0].message.content.trim();

  } catch (err) {
    console.error("❌ LLM ERROR:", err);
    return "Non riesco a rispondere adesso.";
  }
}

module.exports = { generate };
