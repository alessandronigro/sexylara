// ai/BrainEngine.js (compatibility wrapper for mode computation)
import { classifySexualIntentV3 } from "./intent/intentLLM.js";

/**
 * Computes NPC mode based on semantic sexual intent classification
 * @param {string} userText - User's message text
 * @returns {Promise<{explicitMode: boolean, sexualMode: boolean, intentLabel: string}>}
 */
export async function computeNpcMode(userText) {
    const intent = await classifySexualIntentV3(userText);

    switch (intent) {
        case "sessuale_esplicito":
            return { explicitMode: true, sexualMode: true, intentLabel: intent };
        case "sessuale_soft":
            return { explicitMode: true, sexualMode: false, intentLabel: intent };
        default:
            return { explicitMode: false, sexualMode: false, intentLabel: intent };
    }
}
