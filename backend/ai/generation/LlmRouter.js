const Venice = require("./LlmClient");
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

  return await Venice.generate(messages, npcModel);
}

module.exports = { routeLLM };
