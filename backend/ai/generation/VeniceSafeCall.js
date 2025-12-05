const OpenAI = require("openai");

/**
 * VeniceSafeCall – Native Venice API call via OpenAI client
 */
async function veniceSafeCall(model, input) {
  try {
    const apiKey = process.env.API_VENICE;
    if (!apiKey) {
      console.error("Missing API_VENICE");
      return "[VENICE_ERROR]";
    }

    // Default to the provided address, cleaning it if it includes the endpoint path
    let baseURL = process.env.ADDRESS_VENICE || "https://api.venice.ai/api/v1";
    if (baseURL.endsWith("/chat/completions")) {
      baseURL = baseURL.replace(/\/chat\/completions\/?$/, "");
    }

    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    });

    // Construct Venice parameters with overrides
    const veniceParams = {
      include_venice_system_prompt: false,
      strip_thinking_response: input.strip_thinking ?? true,
      disable_thinking: input.disable_thinking ?? true,
      enable_web_search: input.venice_websearch ? "on" : "off",
      enable_web_scraping: false,
      enable_web_citations: false
    };

    const modelToUse = model || process.env.MODEL_VENICE || "venice-uncensored";

    console.log(`VeniceSafeCall: calling model=${modelToUse} at ${baseURL}`);

    const completion = await client.chat.completions.create({
      model: modelToUse,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.max_tokens ?? 500,
      venice_parameters: veniceParams
    });

    const content = completion.choices[0]?.message?.content;
    const usage = completion.usage;

    console.log(`[VeniceSafeCall] 🏁 Response received`, {
      model: modelToUse,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      finishReason: completion.choices[0]?.finish_reason,
      contentLength: content?.length,
      rawPreview: content ? content.substring(0, 300) : 'NULL'
    });

    if (!content) {
      console.warn("[VeniceSafeCall] Empty content received");
      return "[VENICE_ERROR]"; // Or empty string? Prompt says "[VENICE_ERROR]" on error.
    }

    return content;

  } catch (err) {
    console.error(`[VeniceSafeCall] ❌ CRITICAL ERROR calling ${model}`, err?.message || err);
    if (err.response) {
      console.error(`[VeniceSafeCall] API Response Data:`, err.response.data);
    }
    return "[VENICE_ERROR]";
  }
}

module.exports = { veniceSafeCall };
