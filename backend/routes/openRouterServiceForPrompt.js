// routes/openRouterService.js
const fetch = require("node-fetch");

const generatePrompt = async (userMessage, language = 'en') => {

  const response = await fetch(process.env.ADDRESS_VENICE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.API_VENICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({

      model: process.env.MODEL_VENICE,
      messages: [
        {
          role: "system",
          content: `You are a professional prompt engineer specialized in image generation using Foocus Lab (Stable Diffusion + ControlNet).
Your task is to transform any user message into a rich, high-quality image prompt in English that is fully compatible with Foocus Lab. If the user provides an image via the "ImagePrompt" input, treat it as the visual reference (subject_reference) and ensure the generated prompt aligns with its aesthetic and content.
Instructions:
1. Identify visual elements from the user's message — such as:
   - setting (e.g. beach, bedroom, forest)
   - pose, clothing, mood, lighting
   - body language, eye contact, facial expression, totally nude
2. Translate these concepts into a vivid, descriptive prompt suitable for photorealistic generation.
3. Always include:
   - keywords for realism: "photorealistic", "4k", "ultra-detailed"
   - lighting type: e.g. "soft lighting", "warm sunset light", "studio lighting"
   - camera framing: "portrait", "close-up", "full body", "over-the-shoulder", etc.
   - mood or atmosphere: "elegant", "romantic", "dreamy", "intimate", "erotic but tasteful"
Respond ONLY with the image prompt, nothing else. Use English for the prompt. Respond in the same language as the user. The user language is ${language}.`
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "woman in elegant pose, soft lighting, cinematic atmosphere";

  return content;
};

module.exports = generatePrompt;
