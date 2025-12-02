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

  try {
    // Ensure the model includes a version tag to avoid 404 from Replicate
    const modelName = "meta/meta-llama-3-8b-instruct";
    const modelWithVersion = modelName.includes(":") ? modelName : `${modelName}:latest`;
    console.log('LlmRouter: calling veniceSafeCall with model', modelWithVersion);
    return await veniceSafeCall(modelWithVersion, {
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });
  } catch (err) {
    console.error('⚠️ LlmRouter fallback due to Venice error:', err?.message || err);
    return null; // let caller/heuristic decide
  }
}

module.exports = { routeLLM };

