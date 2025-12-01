const { veniceSafeCall } = require("./VeniceSafeCall");
const { sanitizeHistoryForLLM } = require("../../utils/sanitizeHistory");

async function routeLLM(systemPrompt, history, userMessage, npcModel) {
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

  return await veniceSafeCall("meta/meta-llama-3.1-405b-instruct", {
    prompt: systemPrompt,
    messages,
    temperature: 0.7,
    max_tokens: 500,
  });
}

module.exports = { routeLLM };
