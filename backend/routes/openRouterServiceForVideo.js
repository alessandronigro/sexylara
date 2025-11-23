// routes/openRouterServiceForVideo.js
const fetch = require("node-fetch");

const generatePromptVideo = async (userMessage, chatHistory = []) => {
    // Costruisci il contesto dagli ultimi messaggi
    let contextMessage = userMessage;
    if (chatHistory && chatHistory.length > 0) {
        const lastMessages = chatHistory.slice(-5);
        const context = lastMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
        contextMessage = `Recent conversation:\n${context}\n\nUser request: ${userMessage}`;
    }

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
                    content: `You are a professional video prompt engineer specialized in creating cinematic, sensual video prompts for MiniMax S2V-01 (Subject-to-Video AI).

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

Respond ONLY with the video prompt, nothing else. Use English for the prompt.`
                },
                { role: "user", content: contextMessage },
            ],
        }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "woman in elegant pose, soft lighting, cinematic atmosphere";

    return content;
};

module.exports = generatePromptVideo;
