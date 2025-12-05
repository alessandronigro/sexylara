const Replicate = require("replicate");

/**
 * VeniceSafeCall – wrapper universale per GPT-5/Venice via Replicate API 2025
 */
async function veniceSafeCall(model, input) {
  try {
    input = input || {};
    // ============ SANITIZZAZIONE ============
    if (input.messages) {
      if (!Array.isArray(input.messages)) input.messages = [];

      input.messages = input.messages
        .filter(m => m && m.role && m.content)
        .map(m => ({
          role: String(m.role),
          content: String(m.content),
        }));
    } else {
      input.messages = [];
    }

    if (input.prompt && typeof input.prompt !== "string") {
      input.prompt = String(input.prompt);
    }

    if (!Array.isArray(input.image_input)) {
      input.image_input = [];
    }

    input.verbosity = input.verbosity || "medium";
    input.reasoning_effort = input.reasoning_effort || "low";

    // ============ PREPARAZIONE CLIENT E PROMPT ============
    const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      throw new Error("Missing Replicate API key (REPLICATE_API_KEY or REPLICATE_API_TOKEN)");
    }
    const replicate = new Replicate({ auth: apiKey });

    const systemPrompt = (input.messages.find(m => m.role === "system")?.content || "").trim();
    const dialogue = (input.messages || [])
      .filter(m => m.role !== "system")
      .map(m => {
        const speaker = m.role === "assistant" ? "Assistant" : "User";
        return `${speaker}: ${m.content}`;
      })
      .join("\n");
    const prompt = dialogue ? `${dialogue}\nAssistant:` : "Assistant:";

    const payload = {
      prompt,
      system_prompt: systemPrompt || "You are a helpful assistant.",
      temperature: input.temperature ?? 0.7,
      max_new_tokens: input.max_tokens ?? input.max_new_tokens ?? 500,
      top_p: input.top_p ?? 0.9,
    };

    // ============ CHIAMATA STREAMING REPLICATE ============
    const candidates = [];
    if (model) candidates.push(model);
    if (model && !model.includes(":")) candidates.push(`${model}:latest`);

    let output = "";
    let lastErr = null;
    for (const candidate of candidates) {
      try {
        let buffer = "";
        const stream = await replicate.stream(candidate, { input: payload });
        for await (const event of stream) {
          if (typeof event === "string") {
            buffer += event;
          } else if (event?.output) {
            buffer += Array.isArray(event.output) ? event.output.join("") : String(event.output);
          }
        }
        output = buffer;
        console.log(`[VeniceSafeCall] model ok: ${candidate}`);
        break;
      } catch (streamErr) {
        lastErr = streamErr;
        const status = streamErr?.response?.status || streamErr?.status;
        console.warn("⚠️ VeniceSafeCall stream fallback:", streamErr?.message || streamErr, 'status:', status, 'model:', candidate);
        try {
          const res = await replicate.run(candidate, { input: payload });
          if (Array.isArray(res)) output = res.join("");
          else if (typeof res === "string") output = res;
          else if (res?.output) output = Array.isArray(res.output) ? res.output.join("") : String(res.output);
          else output = String(res || "");
          console.log(`[VeniceSafeCall] run fallback ok: ${candidate}`);
          break;
        } catch (runErr) {
          lastErr = runErr;
          const runStatus = runErr?.response?.status || runErr?.status;
          console.warn("⚠️ VeniceSafeCall run failed:", runErr?.message || runErr, 'status:', runStatus, 'model:', candidate);
          if (runStatus !== 404 && runStatus !== 422) {
            throw runErr;
          }
        }
      }
    }

    if (!output && lastErr) {
      throw lastErr;
    }

    const cleaned = (output || "").toString().trim();
    if (!cleaned) {
      const warnMsg = `[VeniceSafeCall] Empty output after all candidates. Returning [EMPTY_RESPONSE]. Models tried: ${candidates.join(', ')}`;
      console.warn(warnMsg);
      try { require('../../utils/log')(`${warnMsg} | prompt="${prompt.slice(0,200)}..."`); } catch (e) {}
      return "[EMPTY_RESPONSE]";
    }

    try { require('../../utils/log')(`[VeniceSafeCall] ok model=${candidates[0]} len=${cleaned.length}`); } catch (e) {}
    return cleaned;

  } catch (err) {
    const status = err?.response?.status || err?.status;
    console.error("❌ VeniceSafeCall ERROR:", err?.message || err, 'status:', status);
    return "[VENICE_ERROR]";
  }
}

module.exports = { veniceSafeCall };
