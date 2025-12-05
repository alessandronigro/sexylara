// generation/LlmClient.js
const { sanitizeHistoryForLLM } = require("../../utils/sanitizeHistory");
const logToFile = require("../../utils/log");
const { veniceSafeCall } = require("./VeniceSafeCall");

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

  // Helper to log payload
  const logPayload = (label, payload, model) => {
    if (env === "production") return;
    try {
      console.log(`\n================ ${label} (${model}) ================`);
      console.log(JSON.stringify(payload, null, 2));
      console.log("=====================================================\n");
      logToFile(`VENICE REQUEST | model=${model} | payload=${JSON.stringify(payload)}`);
    } catch (err) {
      console.warn("⚠️ Failed to log Venice request:", err);
    }
  };

  // Internal helper: call VeniceSafeCall directly
  const callVenice = async (model, messages, temperature = 0.45, maxTokens = 500, callOptions = {}) => {
    const payload = {
      messages,
      temperature,
      max_tokens: maxTokens,
      // Pass overrides for Venice parameters
      venice_websearch: callOptions.venice_websearch,
      disable_thinking: callOptions.disable_thinking,
      strip_thinking: callOptions.strip_thinking
    };
    logPayload("REQUEST TO VENICE", payload, model);

    // STRICT: Only VeniceSafeCall
    const resp = await veniceSafeCall(model, payload);

    if (!resp || resp === "[VENICE_ERROR]") {
      return '';
    }
    try {
      logToFile(`VENICE RESPONSE | model=${model} | len=${resp.length}`);
    } catch (_) { }
    return resp.trim();
  };

  // EXPLICIT MODE
  if (explicitMode || explicitSexual) {
    const explicitSystemPrompt = explicitSexual
      ? `You are a confident, sexually liberated character engaging in an intimate conversation. 
Be DIRECT, SPECIFIC, and DETAILED in your responses. Don't ask for clarification.
Engage immediately. Use vivid, descriptive language.`
      : `You are a playful, flirty character. Be direct and specific in your responses.
Don't be vague or ask for clarification. Engage immediately.`;

    const history = messagesArray.slice(1);
    const messages = [
      { role: "system", content: explicitSystemPrompt },
      ...history
    ];

    // Model selection: Explicit override -> Default
    const explicitModel = process.env.MODEL_VENICE_EXPLICIT || "venice-uncensored";

    const resp = await callVenice(explicitModel, messages, 0.7, 600, options);
    return resp || "Non riesco a rispondere adesso.";
  }


  // STANDARD MODE
  // Model selection: Override -> Env -> Default
  const modelToUse = modelOverride || process.env.MODEL_VENICE || "venice-uncensored";

  const system = messagesArray[0];
  const usableHistory = sanitizeHistoryForLLM(messagesArray.slice(1));
  const finalMessages = [system, ...usableHistory];

  const resp = await callVenice(modelToUse, finalMessages, 0.45, 500, options);
  return resp || "Non riesco a rispondere adesso.";
}

module.exports = { generate };
