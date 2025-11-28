// generation/LlmClient.js
const fetch = require("node-fetch");
const { sanitizeHistoryForLLM } = require("../../utils/sanitizeHistory");
const logToFile = require("../../utils/log");

async function generate(messagesArray, modelOverride = null) {
  if (!Array.isArray(messagesArray)) {
    throw new Error("messagesArray must be an array");
  }

  const modelToUse = modelOverride || process.env.MODEL_VENICE;
  const env = process.env.NODE_ENV || "development";

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
