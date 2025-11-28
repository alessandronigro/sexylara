const defaultEnv = process.env.NODE_ENV || 'development';

/**
 * Wrapper to log Replicate calls in non-production environments.
 * @param {object} replicateInstance - An instance of Replicate.
 * @param {string} modelName - The model to invoke.
 * @param {object} input - The input payload passed to Replicate.
 * @param {object} [debugContext] - Optional context (systemPrompt, userMessage, etc.) for richer logs.
 */
async function runReplicateWithLogging(replicateInstance, modelName, input, debugContext = {}) {
  if (defaultEnv !== 'production') {
    try {
      console.log("\n\n==================== REPLICATE REQUEST (DEBUG) ====================");
      console.log("MODEL:", modelName);
      console.log("---- INPUT ----\n", JSON.stringify(input, null, 2));
      if (debugContext.systemPrompt || debugContext.userMessage) {
        console.log("---- SYSTEM PROMPT ----\n", debugContext.systemPrompt || 'n/a');
        console.log("---- USER MESSAGE ----\n", debugContext.userMessage || 'n/a');
      }
      if (debugContext.history) {
        console.log("---- HISTORY ----\n", JSON.stringify(debugContext.history, null, 2));
      }
      if (debugContext.mediaContext) {
        console.log("---- MEDIA CONTEXT ----\n", debugContext.mediaContext);
      }
      if (debugContext.parameters) {
        console.log("---- PARAMETERS ----\n", debugContext.parameters);
      }
      console.log("=================================================================\n\n");
    } catch (err) {
      console.warn("⚠️ Failed to log Replicate payload:", err);
    }
  }

  const result = await replicateInstance.run(modelName, { input });

  if (defaultEnv !== 'production') {
    console.log("\n\n==================== REPLICATE RESPONSE (DEBUG) ====================");
    console.log(result);
    console.log("=================================================================\n\n");
  }

  return result;
}

module.exports = { runReplicateWithLogging };
