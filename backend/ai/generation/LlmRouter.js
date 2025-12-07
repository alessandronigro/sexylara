const { veniceSafeCall } = require("./VeniceSafeCall");
const { sanitizeHistoryForLLM } = require("../../utils/sanitizeHistory");
const logToFile = require("../../utils/log");
const ReplicateClient = require("../llm/ReplicateClient");

const replicate = new ReplicateClient();

async function callGPT(systemPrompt, userPrompt, stream = false) {
  const input = {
    system_prompt: systemPrompt || "",
    prompt: userPrompt || ""
  };

  if (stream) {
    let acc = "";
    await replicate.stream("openai/gpt-4o", input, (tk) => { acc += tk; });
    return acc;
  }

  return await replicate.call("openai/gpt-4o", input);
}

async function routeLLM(systemPrompt, history, userMessage, npcModel, options = {}) {
  // Support object-style call: routeLLM({ promptSystem, builtPrompt, isExplicitMode, perception, veniceClient })
  if (systemPrompt && typeof systemPrompt === 'object' && !Array.isArray(systemPrompt)) {
    const ctx = systemPrompt;
    const explicit = ctx.isExplicitMode || ctx.explicitMode || (ctx.perception?.intent === 'sexual');
    const sys = ctx.promptSystem || ctx.systemPrompt || '';
    const usr = ctx.builtPrompt || ctx.userPrompt || ctx.prompt || '';
    if (explicit) {
      try {
        if (ctx.veniceClient && typeof ctx.veniceClient.call === 'function') {
          return await ctx.veniceClient.call({
            model: "venice-uncensored",
            system: sys,
            prompt: usr
          });
        }
      } catch (err) {
        logToFile(`⚠️ LlmRouter explicit veniceClient error: ${err?.message || err}`);
      }
    }
    try {
      return await callGPT(sys, usr, false);
    } catch (err) {
      logToFile(`⚠️ LlmRouter error using GPT (object ctx): ${err?.message || err}`);
      return null;
    }
  }

  const DEFAULT_MODEL = process.env.MODEL_VENICE || "venice-1.0";
  const isExplicit = options.isExplicitMode || options.explicitMode || false;

  let cleanHistory = [];
  try {
    cleanHistory = sanitizeHistoryForLLM(history || []);
  } catch (err) {
    console.warn('⚠️ sanitizeHistoryForLLM failed, falling back to empty history:', err?.message);
    cleanHistory = [];
  }

  const historyText = cleanHistory
    .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n');
  const combinedPrompt = historyText
    ? `${historyText}\nUser: ${userMessage}\nAssistant:`
    : `User: ${userMessage}\nAssistant:`;

  if (isExplicit) {
    try {
      const modelName = npcModel || DEFAULT_MODEL;
      const resp = await veniceSafeCall(modelName, {
        messages: [
          { role: "system", content: systemPrompt },
          ...cleanHistory,
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });
      if (!resp || resp === "[VENICE_ERROR]" || resp === "[EMPTY_RESPONSE]") {
        logToFile(`[LLMRouter] Error/Empty from VeniceSafeCall | model=${modelName}`);
        return null;
      }
      return resp;
    } catch (err) {
      logToFile(`⚠️ LlmRouter fallback due to Venice error (explicit): ${err?.message || err}`);
    }
  }

  try {
    return await callGPT(systemPrompt, combinedPrompt, false);
  } catch (err) {
    logToFile(`⚠️ LlmRouter error using GPT: ${err?.message || err}`);
    return null;
  }
}

module.exports = { routeLLM };
