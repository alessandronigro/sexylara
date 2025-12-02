const Replicate = require("replicate");
const logToFile = require("../utils/log");
const { writeFile } = require("fs/promises");
const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/supabase-storage');
const { runReplicateWithLogging } = require('../utils/replicateLogger');

// ===============================================================
//  GENERA AVATAR DI BASE (FOCUSSATO SUL VISO)
// ===============================================================
async function generateAvatar(prompt, npcId = null, faceImageUrl = null, gender = null) {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  try {
    const genderHint = gender === 'male'
      ? 'handsome masculine man, male face, male body proportions'
      : gender === 'female'
        ? 'beautiful feminine woman, female face, female body proportions'
        : '';

    const output = await replicate.run(
      "konieshadow/fooocus-api:fda927242b1db6affa1ece4f54c37f19b964666bf23b0d06ae2439067cd344a4",
      {
        input: {
          prompt: `${prompt}, ${genderHint}, professional portrait, high quality, 8k, photorealistic`,
          sharpness: 2,
          uov_method: "Disabled",
          image_number: 1,
          guidance_scale: 5,
          refiner_switch: 0.4,
          negative_prompt: "distorted anatomy, incorrect proportions, cartoon face, plastic skin, glitch, watermark",
          style_selections: "Fooocus V2,Fooocus Semi Realistic",
          uov_upscale_value: 0,
          performance_selection: "Speed",
          aspect_ratios_selection: "1024*1024",
          ...(faceImageUrl
            ? {
              cn_type1: "FaceSwap",
              cn_img1: faceImageUrl,
              cn_weight1: 1.1,
            }
            : {}),
        },
      }
    );

    const avatarUrl = Array.isArray(output) ? output[0] : output.toString();

    logToFile(avatarUrl);
    const response = await fetch(avatarUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload avatar to Supabase
    if (npcId) {
      const result = await storageService.uploadAvatar(buffer, npcId);
      return result.publicUrl;
    } else {
      const filename = `${uuidv4()}.png`;
      await writeFile(`public/${filename}`, buffer);
      return filename;
    }
  } catch (error) {
    logToFile(error);
    throw error;
  }
}

// ===============================================================
//  RISOLVE L'IMMAGINE VISO BASE DELLA NPC
// ===============================================================
async function resolveNpcFaceImage(npc, language = 'en') {
  if (!npc) return null;

  const direct = npc.avatar || npc.avatar_url || npc.image_reference;
  if (direct) return direct;

  const gender = (npc.gender || npc.appearance?.gender) === 'male' ? 'man' : 'woman';
  const prompt = `Portrait photo of ${npc.name || 'the NPC'}, ${gender}, photorealistic`;

  try {
    return await generateAvatar(prompt, npc.id || npc.npc_id || null, null, npc.gender || npc.appearance?.gender || null);
  } catch (err) {
    console.error('❌ Error generating fallback NPC portrait:', err?.message);
    return null;
  }
}

// ===============================================================
//  GENERATORE DI IMMAGINI FULL-BODY CON FACE CONSISTENCY
// ===============================================================
function resolveReplicateUrl(output) {
  if (!output) return null;
  if (Array.isArray(output)) return output[0];
  if (typeof output === 'string') return output;
  if (output?.output) {
    if (Array.isArray(output.output)) return output.output[0];
    if (typeof output.output === 'string') return output.output;
  }
  if (output?.urls?.get) return output.urls.get;
  if (output?.url) return output.url;
  const asString = output.toString ? output.toString() : '';
  if (asString && typeof asString === 'string' && asString.startsWith('http')) return asString;
  return null;
}

async function streamToBuffer(stream) {
  console.log('🔄 streamToBuffer: starting to read stream...');
  const reader = stream.getReader ? stream.getReader() : null;
  if (!reader) {
    console.error('❌ streamToBuffer: no reader available');
    return null;
  }
  const chunks = [];
  let totalSize = 0;
  while (true) {
    try {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`✅ streamToBuffer: reading complete. Total size: ${totalSize} bytes`);
        break;
      }
      if (value) {
        chunks.push(Buffer.from(value));
        totalSize += value.length;
        // console.log(`📦 streamToBuffer: received chunk of ${value.length} bytes`);
      }
    } catch (err) {
      console.error('❌ streamToBuffer: error reading stream:', err);
      break;
    }
  }
  return Buffer.concat(chunks);
}

async function generateImage(prompt, npc = null, userId = null, language = 'en', _options = {}) {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  const genderHint = npc?.gender === 'male'
    ? 'male, masculine body, man, no breasts'
    : npc?.gender === 'female'
      ? 'female, feminine body, woman'
      : '';
  const enhancedPrompt = genderHint ? `${genderHint}, ${prompt}` : prompt;

  // ========== 3️⃣ RECUPERA FACCIA NPC PER FACESWAP ==========
  const faceImage = _options.faceImageUrl || (npc ? await resolveNpcFaceImage(npc, language) : null);
  const hasFaceImage = !!faceImage;

  // ========== 4️⃣ SEED CASUALE PER POSE/SCENE SEMPRE DIVERSE ==========
  const randomSeed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  // ========== 5️⃣ INPUT OTTIMIZZATO PER VISI CONSISTENTI ==========
  const input = {
    prompt: `
${enhancedPrompt},

cinematic look, realistic skin texture,

consistent lighting, natural shadows,

well-proportioned body, cohesive face-body integration,

sharp details, high dynamic range,

perfect color matching between face and body

    `.trim(),

    // FACE REFERENCE
    face: faceImage,
    face_strength: 0.65,            // 🔽 ridotto → meno distorsioni
    face_guidance: 8,               // 🔽 più basso → blending più naturale
    identity_weight: 0.75,          // 🔽 permette integrazione col corpo
    identity_preservation: "medium",

    // CONTROLNET BODY (NEW 🔥)
    cn_type1: hasFaceImage ? "FaceSwap" : null,
    cn_img1: hasFaceImage ? faceImage : null,
    cn_weight1: 0.85,





    // CAMERA SETTINGS
    sharpness: 2.2,
    preserve_prompt: true,
    skip_enhance: false,
    refiner_switch: 0.35,
    guidance_scale: 5.6,

    // SEED
    image_seed: randomSeed,
    image_number: 1,

    // NEGATIVE PROMPT FIX
    negative_prompt: `
deformed body, disproportioned limbs, warped torso,

wrong skin tone, mismatched lighting,

double face, bad blending,

over-sharpened skin, plastic skin,

cartoon, anime, watermark, logo

    `.trim(),

    aspect_ratios_selection: "768*1280",
    style_selections: "Fooocus V2,Fooocus Realistic Portrait",
    performance_selection: "Quality"
  };

  console.log("🖼️ Face image for FaceSwap:", faceImage || 'none');
  console.log("🚀 Sending prompt to Replicate (truncated):", (enhancedPrompt || '').slice(0, 180));

  try {
    const output = await runReplicateWithLogging(
      replicate,
      "konieshadow/fooocus-api:fda927242b1db6affa1ece4f54c37f19b964666bf23b0d06ae2439067cd344a4",
      input,
      {
        systemPrompt: enhancedPrompt,
        parameters: { aspect: input.aspect_ratios_selection }
      }
    );

    const finalUrl = resolveReplicateUrl(output);

    console.log("✅ Replicate returned URL:", finalUrl || 'none');

    let buffer = null;

    if (finalUrl && typeof finalUrl === 'string' && finalUrl.startsWith('http')) {
      logToFile(finalUrl);
      const response = await fetch(finalUrl);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (finalUrl?.getReader) {
      console.log('ℹ️ Replicate returned stream, converting to buffer.');
      buffer = await streamToBuffer(finalUrl);
    } else {
      const errMsg = `Invalid Replicate output URL or stream: ${finalUrl}`;
      console.error(errMsg);
      return { imageUrl: null, mediaUrl: null, error: errMsg };
    }

    // Upload su Supabase
    const effectiveUserId = userId || (npc && npc.id) || null;
    if (effectiveUserId) {
      console.log('🔼 Uploading image to Supabase with effectiveUserId', effectiveUserId);
      const result = await storageService.uploadChatImage(buffer, effectiveUserId, npc.id);
      console.log('✅ Image uploaded to Supabase:', result);
      console.log('✅ Public URL:', result.publicUrl);
      return { imageUrl: result.publicUrl, mediaUrl: result.publicUrl, type: 'photo' };
    } else {
      const filename = `${uuidv4()}.png`;
      await writeFile(`public/${filename}`, buffer);
      console.log('✅ Image saved locally as', filename);
      return { imageUrl: filename, mediaUrl: `/${filename}`, type: 'photo' };
    }
  } catch (error) {
    console.error('❌ Replicate image generation failed:', error);
    logToFile(error);
    return { imageUrl: null, mediaUrl: null, error: error.message };
  }
}

module.exports = { generateImage, generateAvatar };
