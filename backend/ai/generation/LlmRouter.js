const { veniceSafeCall } = require("./VeniceSafeCall");
const { sanitizeHistoryForLLM } = require("../../utils/sanitizeHistory");
const logToFile = require("../../utils/log");

async function routeLLM(systemPrompt, history, userMessage, npcModel) {
  // Use Venice model from env or default to venice-1.0
  const DEFAULT_MODEL = process.env.MODEL_VENICE || "venice-1.0";

  let cleanHistory = [];
  try {
    cleanHistory = sanitizeHistoryForLLM(history || []);
  } catch (err) {
    console.warn('⚠️ sanitizeHistoryForLLM failed, falling back to empty history:', err?.message);
    cleanHistory = [];
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...cleanHistory,
    { role: "user", content: userMessage }
  ];

  try {
    // Use provided model or default. NO :latest appending.
    const modelName = npcModel || DEFAULT_MODEL;

    const resp = await veniceSafeCall(modelName, {
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    if (!resp || resp === "[VENICE_ERROR]" || resp === "[EMPTY_RESPONSE]") {
      logToFile(`[LLMRouter] Error/Empty from VeniceSafeCall | model=${modelName}`);
      return null;
    }
    return resp;
  } catch (err) {
    logToFile(`⚠️ LlmRouter fallback due to Venice error: ${err?.message || err}`);
    return null;
  }
}

module.exports = { routeLLM };
