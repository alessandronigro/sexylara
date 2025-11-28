const { MEDIA_INTENT_SYSTEM_PROMPT } = require('../prompts/mediaIntentPrompt');
const { generate } = require('../generation/LlmClient');

const photoWords = ['vederti', 'mandami una foto', 'foto', 'selfie', 'send photo', 'envíame una foto', 'schick mir ein bild', 'pic', 'picture', 'immagine'];
const videoWords = ['video', 'mandami un video', 'fammi un video', 'send video', 'filmato'];
const audioWords = ['voce', 'audio', 'fammi sentire', 'send audio', 'vocale', 'messaggio vocale'];
const coupleWords = ['foto insieme', 'selfie con te', 'foto con te', 'una foto con noi', 'facciamo una foto insieme', 'photo together', 'selfie together', 'noi due'];
const userPhotoPhrases = ['ti mando una foto', 'ecco la mia foto', 'questa sono io', 'questo sono io', 'here is my photo', 'this is me'];

async function analyze(context, perception) {
  const text = (context.message || '').toLowerCase();

  // 1. Fast keyword check
  let potentialType = null;
  if (photoWords.some((w) => text.includes(w))) potentialType = 'photo';
  if (videoWords.some((w) => text.includes(w))) potentialType = 'video';
  if (audioWords.some((w) => text.includes(w))) potentialType = 'audio';
  if (coupleWords.some((w) => text.includes(w))) potentialType = 'couple_photo';

  // Also check perception hints from previous layers
  if (!potentialType && perception.textAnalysis.intentHints?.includes('richiesta_media')) {
    potentialType = 'photo';
  }

  // If no media intent detected via keywords/hints, return early
  if (!potentialType) {
    return {
      wantsMedia: false,
      type: null,
      userProvidesPhoto: userPhotoPhrases.some((p) => text.includes(p)),
    };
  }

  // 2. Deep analysis with LLM for photos/videos to get detailed prompt
  if (potentialType === 'photo' || potentialType === 'couple_photo') {
    try {
      console.log('🧠 MediaIntentEngine: Analyzing detailed media intent with LLM...');

      const messages = [
        { role: "system", content: MEDIA_INTENT_SYSTEM_PROMPT },
        { role: "user", content: `User request: "${context.message}"\nNPC Context: ${JSON.stringify(context.npc?.appearance || {})}` }
      ];

      // Use a faster/cheaper model if possible, or the default one
      const llmResponse = await generate(messages, context.npc?.model);

      // Try to parse JSON from LLM response
      let parsedIntent = {};
      try {
        // Find JSON block if wrapped in markdown
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : llmResponse;
        parsedIntent = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('⚠️ MediaIntentEngine: Failed to parse LLM JSON response, using fallback.', e);
        // Fallback to simple keyword detection result
      }

      if (parsedIntent.intent) {
        console.log('✅ MediaIntentEngine: Detected intent:', parsedIntent);

        // Map LLM intent to our internal types
        let finalType = 'photo';
        if (parsedIntent.intent === 'TOGETHER') finalType = 'couple_photo';
        if (parsedIntent.intent === 'SELFIE') finalType = 'photo'; // Selfie is just a photo type

        return {
          wantsMedia: true,
          type: finalType,
          details: parsedIntent, // Contains mood, location, action, scenePrompt, etc.
          userProvidesPhoto: userPhotoPhrases.some((p) => text.includes(p)),
        };
      }
    } catch (err) {
      console.error('❌ MediaIntentEngine: LLM analysis failed:', err);
    }
  }

  // Fallback (or for audio/video which might not need complex prompt generation yet)
  return {
    wantsMedia: !!potentialType,
    type: potentialType,
    userProvidesPhoto: userPhotoPhrases.some((p) => text.includes(p)),
  };
}

module.exports = {
  analyze,
};
