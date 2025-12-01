const Replicate = require("replicate");

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

/**
 * VeniceSafeCall – wrapper universale per GPT-5/Venice via Replicate API 2025
 */
async function veniceSafeCall(model, input) {
  try {
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

    // ============ CHIAMATA A REPLICATE (NUOVA API) ============

    const run = await replicate.run(model, {
      input
    });

    // replicate.run() restituisce direttamente il risultato (string o array)
    if (typeof run === "string") return run.trim() || "[EMPTY_RESPONSE]";
    if (Array.isArray(run)) return run.join("").trim() || "[EMPTY_RESPONSE]";

    // Se è un oggetto, prova a estrarre output
    if (run && typeof run === "object") {
      if (run.output) return String(run.output).trim() || "[EMPTY_RESPONSE]";
      return JSON.stringify(run);
    }

    return "[EMPTY_RESPONSE]";

  } catch (err) {
    console.error("❌ VeniceSafeCall ERROR:", err);
    return "[VENICE_ERROR]";
  }
}

module.exports = { veniceSafeCall };