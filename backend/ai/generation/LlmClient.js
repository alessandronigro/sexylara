// generation/LlmClient.js
const { sanitizeHistoryForLLM } = require("../../utils/sanitizeHistory");
const logToFile = require("../../utils/log");
const { veniceSafeCall } = require("./VeniceSafeCall");
const Replicate = require("replicate");

// ============================================================
// REMOVED: humanizeNpcOutput function that modified LLM responses
// ============================================================

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

  // ============================================================
  // V3 ROUTING — Clean semantic-based model selection
  // ============================================================
  // - non_sessuale → GPT
  // - sessuale_soft → Venice (standard model)
  // - sessuale_esplicito → Venice (uncensored model)

  // EXPLICIT MODE (sessuale_soft or sessuale_esplicito)
  if (explicitMode || explicitSexual) {
    const history = messagesArray.slice(1);

    // System prompt based on sexual intensity
    const explicitSystemPrompt = explicitSexual
      ? `You are a confident, sexually liberated character engaging in an intimate conversation. 
Be DIRECT, SPECIFIC, and DETAILED in your responses. Don't ask for clarification.
Engage immediately. Use vivid, descriptive language.`
      : `You are a playful, flirty character. Be direct and specific in your responses.
Don't be vague or ask for clarification. Engage immediately.`;

    const messages = [
      { role: "system", content: explicitSystemPrompt },
      ...history
    ];

    // Model selection based on sexual intensity
    // sessuale_esplicito → uncensored model
    // sessuale_soft → standard model
    const explicitModel = explicitSexual
      ? (process.env.MODEL_VENICE_EXPLICIT || process.env.MODEL_VENICE || "veniceai/venice-1.0")
      : (process.env.MODEL_VENICE || "veniceai/venice-1.0");

    const resp = await callVenice(explicitModel, messages, 0.7, 600, options);

    console.log('[TRACE][PIPELINE]', JSON.stringify({
      stage: 'LlmClient',
      model: explicitModel,
      isExplicitMode: true,
      isSexual: explicitSexual,
      rawOutput: (resp || '').substring(0, 500)
    }, null, 2));

    return resp || "";
  }

  // ==================================================
  // GPT FOR NON-SEXUAL CONTENT (non_sessuale)
  // ==================================================
  const useGPT = !explicitMode && !explicitSexual;

  if (useGPT) {
    try {
      console.log("[GPT] Using GPT-4o-mini for natural conversation");
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN,
      });

      const systemPrompt = (messagesArray[0] && messagesArray[0].content) || "You are a helpful assistant.";
      const userPrompt = (messagesArray[messagesArray.length - 1] && messagesArray[messagesArray.length - 1].content) || "";

      const gptInput = {
        prompt: userPrompt,
        system_prompt: systemPrompt,
        max_tokens: 300,
        temperature: 0.6
      };

      console.log('[GPT] Input:', {
        promptLength: userPrompt.length,
        systemPromptLength: systemPrompt.length,
        promptPreview: userPrompt.substring(0, 100)
      });

      let text = "";
      let eventCount = 0;

      console.log('[GPT] Calling replicate.stream...');
      try {
        for await (const event of replicate.stream("openai/gpt-4o", { input: gptInput })) {
          eventCount++;
          const chunk = event.toString();  // ← FIX: Use .toString() as per Replicate docs!
          console.log('[GPT] Stream event #' + eventCount + ':', {
            type: typeof event,
            chunkLength: chunk.length,
            chunkPreview: chunk.substring(0, 50)
          });
          text += chunk;
        }
        console.log('[GPT] Stream completed:', { eventCount, totalLength: text.length, preview: text.substring(0, 100) });
      } catch (streamErr) {
        console.error('[GPT] Stream failed:', streamErr?.message || streamErr);
        console.log('[GPT] Falling back to run...');
        try {
          const output = await replicate.run("openai/gpt-4o", { input: gptInput });
          console.log('[GPT] Run output:', {
            type: typeof output,
            isArray: Array.isArray(output),
            length: Array.isArray(output) ? output.length : 'N/A'
          });
          text = Array.isArray(output) ? output.join("") : String(output || "");
        } catch (runErr) {
          console.error('[GPT] Run also failed:', runErr?.message || runErr);
          text = "";
        }
      }

      const finalGpt = (text || '').trim();

      console.log('[GPT] Final result:', { length: finalGpt.length, preview: finalGpt.substring(0, 100) });

      console.log('[TRACE][PIPELINE]', JSON.stringify({
        stage: 'LlmClient',
        model: 'gpt-4o',
        isExplicitMode: false,
        rawOutput: (finalGpt || '').substring(0, 500)
      }, null, 2));

      return finalGpt;
    } catch (gptErr) {
      console.warn("[GPT] Fallback to Venice due to error:", gptErr?.message || gptErr);
    }
  }


  // STANDARD MODE
  // Model selection: Override -> Env -> Default
  const modelToUse = modelOverride || process.env.MODEL_VENICE || "veniceai/venice-1.0";

  const system = messagesArray[0];
  const usableHistory = sanitizeHistoryForLLM(messagesArray.slice(1));
  const finalMessages = [system, ...usableHistory];

  const resp = await callVenice(modelToUse, finalMessages, 0.45, 500, options);

  console.log('[TRACE][PIPELINE]', JSON.stringify({
    stage: 'LlmClient',
    model: modelToUse,
    isExplicitMode: false,
    rawOutput: (resp || '').substring(0, 500)
  }, null, 2));

  const veniceOut = resp && resp.trim() ? resp.trim() : "";
  return veniceOut;
}

module.exports = { generate };
