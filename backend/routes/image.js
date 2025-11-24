const Replicate = require("replicate");
const logToFile = require("../utils/log");
const { writeFile } = require("fs/promises");
const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/supabase-storage');
const { supabase } = require('../lib/supabase');
const generatePrompt = require('./promptGenerator');

const generateImage = async (prompt, girlfriend = null, userId = null, language = 'en') => {
    const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
    });

    // Arricchisci il prompt con le caratteristiche della girlfriend
    let contextPrompt = prompt;
    if (girlfriend) {
        const genderTerm = girlfriend.gender === 'male' ? 'man' : 'woman';
        const traits = [];

        if (girlfriend.gender === 'male') {
            traits.push('masculine features', 'strong jawline', 'handsome man');
        }

        if (girlfriend.ethnicity) traits.push(girlfriend.ethnicity);
        if (girlfriend.age) traits.push(`${girlfriend.age} years old`);
        if (girlfriend.body_type) traits.push(girlfriend.body_type);
        if (girlfriend.hair_length && girlfriend.hair_color) {
            traits.push(`${girlfriend.hair_length} ${girlfriend.hair_color} hair`);
        }
        if (girlfriend.eye_color) traits.push(`${girlfriend.eye_color} eyes`);

        if (traits.length > 0) {
            contextPrompt = `A ${traits.join(', ')} ${genderTerm}. ${prompt}`;
        }
    }

    // Usa AI per migliorare il prompt, includendo la lingua
    let enhancedPrompt;
    try {
        console.log('🎨 Original prompt:', contextPrompt);
        enhancedPrompt = await generatePrompt(contextPrompt, 'image', { language });
        console.log('✨ Enhanced prompt:', enhancedPrompt);
    } catch (error) {
        console.error('Error enhancing prompt, using original:', error);
        enhancedPrompt = contextPrompt + ", photorealistic, 8k, detailed";
    }

    try {
        const input = {
            prompt: enhancedPrompt,
            cn_type1: "FaceSwap",
            cn_img1: (girlfriend && girlfriend.avatar_url && girlfriend.avatar_url.startsWith('http'))
                ? girlfriend.avatar_url
                : "https://ui-avatars.com/api/?name=AI", // Generic fallback
            cn_weight1: 1.2,
            sharpness: 2,
            image_seed: 50403806253646856,
            uov_method: "Disabled",
            image_number: 1,
            guidance_scale: 4,
            refiner_switch: 0.5,
            negative_prompt: "distorted anatomy, incorrect proportions, cross-eyed, lazy gaze, cartoon face, plastic skin, glitch, watermark",
            style_selections: "Fooocus V2,Fooocus Enhance,Fooocus Sharp,Fooocus Semi Realistic",
            uov_upscale_value: 0,
            performance_selection: "Extreme Speed",
            aspect_ratios_selection: "768*1280",
        };

        console.log(`🖼️ Using avatar URL for FaceSwap: ${input.cn_img1}`);

        if (input.cn_img1.includes('localhost') || input.cn_img1.includes('10.0.2.2')) {
            console.log("⚠️ Avatar URL is local, Replicate cannot access it. FaceSwap might fail or use fallback.");
        }

        const output = await replicate.run(
            "konieshadow/fooocus-api:fda927242b1db6affa1ece4f54c37f19b964666bf23b0d06ae2439067cd344a4",
            { input }
        );

        logToFile(output.toString());
        const response2 = await fetch(output.toString());
        const arrayBuffer = await response2.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage se abbiamo userId e girlfriendId
        if (userId && girlfriend && girlfriend.id) {
            const result = await storageService.uploadChatImage(buffer, userId, girlfriend.id);
            return result.publicUrl;
        } else {
            // Fallback to local storage
            const fileimage = uuidv4() + ".png";
            await writeFile(`public/${fileimage}`, buffer);
            return fileimage;
        }
    } catch (error) {
        logToFile(error);
        throw error;
    }
};

const generateAvatar = async (prompt, girlfriendId = null) => {
    const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
    });

    try {
        const output = await replicate.run(
            "konieshadow/fooocus-api:fda927242b1db6affa1ece4f54c37f19b964666bf23b0d06ae2439067cd344a4",
            {
                input: {
                    prompt: prompt + ", professional portrait, high quality, 8k, photorealistic",
                    sharpness: 2,
                    uov_method: "Disabled",
                    image_number: 1,
                    guidance_scale: 4,
                    refiner_switch: 0.5,
                    negative_prompt: "distorted anatomy, incorrect proportions, cross-eyed, lazy gaze, cartoon face, plastic skin, glitch, watermark, nsfw",
                    style_selections: "Fooocus V2,Fooocus Enhance,Fooocus Sharp,Fooocus Semi Realistic",
                    uov_upscale_value: 0,
                    performance_selection: "Speed",
                    aspect_ratios_selection: "1024*1024",
                },
            }
        );

        logToFile(output.toString());
        const response2 = await fetch(output.toString());
        const arrayBuffer = await response2.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        if (girlfriendId) {
            const result = await storageService.uploadAvatar(buffer, girlfriendId);
            return result.publicUrl;
        } else {
            // Fallback to local storage if no girlfriendId
            const filename = `${uuidv4()}.png`;
            await writeFile(`public/${filename}`, buffer);
            return filename;
        }
    } catch (error) {
        logToFile(error);
        throw error;
    }
};

module.exports = { generateImage, generateAvatar };
