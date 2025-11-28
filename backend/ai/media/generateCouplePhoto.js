const Replicate = require('replicate');
const { runReplicateWithLogging } = require('../../utils/replicateLogger');

/**
 * Genera una foto di coppia tra utente e NPC.
 * @param {Object} params
 * @param {string} params.userImageUrl
 * @param {string} params.npcImageUrl
 * @param {string} params.npcName
 * @returns {Promise<{status: string, npc: string, baseImageUrl: string, finalImageUrl: string}>}
 */
async function generateCouplePhoto({ userImageUrl, npcImageUrl, npcName }) {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  // Prima passata: instantid
  const baseOutput = await runReplicateWithLogging(
    replicate,
    'tencentarc/instantid',
    {
      face_image: userImageUrl,
      face_image2: npcImageUrl,
      prompt: `Selfie of the user and the NPC named ${npcName}, close together, smiling, natural lighting, highly realistic`,
      negative_prompt: 'blur, distortion, artifacts, deformed',
      num_inference_steps: 30,
      guidance_scale: 1.2,
      image_resolution: 1024,
    }
  );
  const baseImageUrl = Array.isArray(baseOutput) ? baseOutput[0] : baseOutput?.toString();

  // Seconda passata: flux per rifinitura
  const finalOutput = await runReplicateWithLogging(
    replicate,
    'black-forest-labs/flux-1-schnell',
    {
      image: baseImageUrl,
      prompt: 'High quality realistic warm-photo of two people close together',
      strength: 0.5,
    }
  );
  const finalImageUrl = Array.isArray(finalOutput) ? finalOutput[0] : finalOutput?.toString();

  return {
    status: 'success',
    npc: npcName,
    baseImageUrl,
    finalImageUrl,
  };
}

module.exports = {
  generateCouplePhoto,
};
