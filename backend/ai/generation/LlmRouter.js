const { veniceSafeCall } = require("./VeniceSafeCall");
const { sanitizeHistoryForLLM } = require("../../utils/sanitizeHistory");
const logToFile = require("../../utils/log");

async function routeLLM(systemPrompt, history, userMessage, npcModel) {
  const DEFAULT_MODEL = process.env.REPLICATE_LLM_MODEL || "meta/meta-llama-3-8b-instruct:5a6809ca6288247d06daf6365557e5e429063f32a21146b2a807c682652136b8";
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
    const modelName = npcModel || DEFAULT_MODEL;
    const modelWithVersion = modelName.includes(":") ? modelName : `${modelName}:latest`;
    console.log('LlmRouter: calling veniceSafeCall with model', modelWithVersion);
    const resp = await veniceSafeCall(modelWithVersion, {
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });
    if (!resp || (typeof resp === 'string' && resp.includes('[EMPTY_RESPONSE]'))) {
      logToFile(`[LLMRouter] Empty/marker response from VeniceSafeCall | model=${modelWithVersion} | resp="${resp || ''}" | prompt="${(systemPrompt || '').slice(0,200)}..."`);
      return '';
    }
    return resp;
  } catch (err) {
    console.error('⚠️ LlmRouter fallback due to Venice error:', err?.message || err);
    return null; // let caller/heuristic decide
  }
}

module.exports = { routeLLM };
