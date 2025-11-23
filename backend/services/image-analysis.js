const Replicate = require("replicate");
const logToFile = require("../utils/log");

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

/**
 * Analyzes an image using a multimodal model (e.g., LLaVA or MiniGPT-4) via Replicate.
 * @param {string} imageUrl - The public URL of the image to analyze.
 * @param {string} prompt - The prompt for the analysis (default: "Describe this image in detail.").
 * @returns {Promise<string>} - The description of the image.
 */
const analyzeImage = async (imageUrl, prompt = "Describe this image in detail.") => {
    try {
        logToFile(`Analyzing image: ${imageUrl}`);

        // Using LLaVA (Large Language-and-Vision Assistant)
        // Model: yorickvp/llava-13b:b5f6212d032508382d61ff00469dd48e3a4cf34428aa335c9d6e44e889645056
        // Or a newer one if available. Let's use a popular one.
        // moondream is fast and good for descriptions.
        // vikhyatk/moondream1

        const output = await replicate.run(
            "vikhyatk/moondream1:719860583258597ac6c34c4eef255eb35e6e64d328b19ca1b90f18ed30d463cd",
            {
                input: {
                    image: imageUrl,
                    prompt: prompt
                }
            }
        );

        // Output is usually an array of strings or a string depending on the model.
        // Moondream returns a string.
        const description = Array.isArray(output) ? output.join(" ") : output;

        logToFile(`Image analysis result: ${description}`);
        return description;
    } catch (error) {
        logToFile(`Error analyzing image: ${error}`);
        console.error("Replicate error:", error);
        return "An image that I cannot see clearly.";
    }
};

module.exports = { analyzeImage };
