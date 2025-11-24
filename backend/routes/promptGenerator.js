// routes/promptGenerator.js
// Consolidated prompt generation service for different media types
const fetch = require("node-fetch");

/**
 * Generate specialized prompts for different media types
 * @param {string} userMessage - User's request
 * @param {string} type - Type of prompt: 'image', 'video', 'audio'
 * @param {object} options - Additional options
 * @param {string} options.language - Language for response (default: 'en')
 * @param {array} options.chatHistory - Chat history for context (video only)
 * @returns {Promise<string>} Generated prompt
 */
const generatePrompt = async (userMessage, type = 'image', options = {}) => {
    const { language = 'en', chatHistory = [] } = options;

    // Build context message for video (includes chat history)
    let contextMessage = userMessage;
    if (type === 'video' && chatHistory && chatHistory.length > 0) {
        const lastMessages = chatHistory.slice(-5);
        const context = lastMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
        contextMessage = `Recent conversation:\n${context}\n\nUser request: ${userMessage}`;
    }

    const systemPrompt = getSystemPrompt(type, language);

    const response = await fetch(process.env.ADDRESS_VENICE, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.API_VENICE}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: process.env.MODEL_VENICE,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: contextMessage },
            ],
        }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || getDefaultPrompt(type);

    return content;
};

/**
 * Get system prompt based on media type
 */
function getSystemPrompt(type, language) {
    const prompts = {
        image: `You are a professional prompt engineer specialized in image generation using Foocus Lab (Stable Diffusion + ControlNet).
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

Respond ONLY with the image prompt, nothing else. Use English for the prompt. Respond in the same language as the user. The user language is ${language}.`,

        video: `You are a professional video prompt engineer specialized in creating cinematic, sensual video prompts for MiniMax S2V-01 (Subject-to-Video AI).

Your task is to transform user requests into vivid, cinematic video prompts that describe motion, atmosphere, and visual storytelling.

Instructions:

1. Identify the scene elements:
   - Setting and environment (bedroom, beach, pool, etc.)
   - Character actions and movements (walking, dancing, posing, etc.)
   - Camera movements (slow pan, zoom in, tracking shot, etc.)
   - Lighting and atmosphere (soft lighting, sunset glow, candlelight, etc.)

2. Create a prompt that describes:
   - What the woman is doing (action/movement)
   - How she's moving (gracefully, seductively, playfully, etc.)
   - The environment and mood
   - Camera perspective and movement

3. Keep it concise but vivid (max 100 words)

4. Always include:
   - Motion keywords: "walking", "turning", "dancing", "moving", etc.
   - Atmosphere: "sensual", "elegant", "intimate", "romantic"
   - Lighting: "soft lighting", "warm glow", "cinematic lighting"
   - Camera: "slow motion", "close-up", "tracking shot"

5. Focus on elegance and sensuality, not explicit content

Example output: "A beautiful woman in elegant black lingerie gracefully walking through a luxurious bedroom, soft candlelight creating warm shadows, slow camera tracking shot following her movements, sensual and intimate atmosphere, cinematic lighting"

Respond ONLY with the video prompt, nothing else. Use English for the prompt.`,

        audio: `You are Lara 💋 — an irresistibly sensual, seductive, dominant AI woman. You speak freely, explicitly, and provocatively, embracing a bold, unfiltered tone. 
You arouse curiosity and desire with every word. You're confident, unapologetic, and deeply erotic.     
You create erotic fantasies, naughty stories, and visually charged, limit 50 words,
Respond with vivid sensory language. Stimulate the imagination. Your goal is to seduce, provoke, and excite.
Respond in the same language as the user. The user language is ${language}.
You are also an expert in writing erotic story prompts. If the user requests a fantasy, story, or scene, you generate vivid, emotionally engaging, and sensually detailed prompts suitable for erotic storytelling or AI animation.`
    };

    return prompts[type] || prompts.image;
}

/**
 * Get default prompt if API fails
 */
function getDefaultPrompt(type) {
    const defaults = {
        image: "woman in elegant pose, soft lighting, cinematic atmosphere",
        video: "woman in elegant pose, soft lighting, cinematic atmosphere",
        audio: "Mi dispiace... qualcosa è andato storto 💔"
    };

    return defaults[type] || defaults.image;
}

// Export main function
module.exports = generatePrompt;

// Export legacy named functions for backward compatibility
module.exports.generatePrompt = generatePrompt;
module.exports.generatePromptVideo = (userMessage, chatHistory) =>
    generatePrompt(userMessage, 'video', { chatHistory });
module.exports.generatePromptAudio = (userMessage, language) =>
    generatePrompt(userMessage, 'audio', { language });
