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
    let output = "";
    try {
      const stream = await replicate.stream(model, { input: payload });
      for await (const event of stream) {
        if (typeof event === "string") {
          output += event;
        } else if (event?.output) {
          output += Array.isArray(event.output) ? event.output.join("") : String(event.output);
        }
      }
    } catch (streamErr) {
      console.warn("⚠️ VeniceSafeCall stream fallback:", streamErr?.message || streamErr);
      const res = await replicate.run(model, { input: payload });
      if (Array.isArray(res)) output = res.join("");
      else if (typeof res === "string") output = res;
      else if (res?.output) output = Array.isArray(res.output) ? res.output.join("") : String(res.output);
      else output = String(res || "");
    }

    return output.trim() || "[EMPTY_RESPONSE]";

  } catch (err) {
    const status = err?.response?.status || err?.status;
    console.error("❌ VeniceSafeCall ERROR:", err?.message || err, 'status:', status);
    return "[VENICE_ERROR]";
  }
}

module.exports = { veniceSafeCall };
