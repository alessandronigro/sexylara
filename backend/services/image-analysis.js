const Replicate = require("replicate");
const logToFile = require("../utils/log");

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const MODEL_VERSION =
  process.env.REPLICATE_IMAGE_MODEL
  || "yorickvp/llava-13b:80537f9eead1a5bfa72d5ac6ea6414379be41d4d4f6679fd776e9535d1eb58bb";

const analyzeImage = async (imageUrl, prompt = "Describe this image in detail.") => {
  logToFile(`Analyzing image with model ${MODEL_VERSION}: ${imageUrl}`);

  try {
    const output = await replicate.run(MODEL_VERSION, {
      input: {
        image: imageUrl,
        prompt,
        top_p: 1,
        max_tokens: 1024,
        temperature: 0.2,
      },
    });

    let description = null;
    if (Array.isArray(output)) description = output.join(" ");
    else if (typeof output === "string") description = output;
    else if (output && typeof output === "object") {
      description = output.caption || output.description || output.toString?.();
    }

    if (description) {
      logToFile(`Image analysis (${MODEL_VERSION}) result: ${description}`);
      return description;
    }
  } catch (err) {
    console.error(`[replicate-image-analyzer] Error (${MODEL_VERSION}):`, err);
    logToFile(`Error analyzing image with ${MODEL_VERSION}: ${err?.message}`);
  }

  return "An image that I cannot see clearly.";
};

module.exports = { analyzeImage };
