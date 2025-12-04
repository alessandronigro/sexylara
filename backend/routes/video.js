// routes/video.js
const express = require("express");
const fetch = require("node-fetch");
const logToFile = require("../utils/log");
const imageUrlToBase64 = require("../utils/imageToBase64");
const { writeFile } = require("fs/promises");
const storageService = require('../services/supabase-storage');
const PromptOptimizer = require('../ai/media/PromptOptimizer');

const FALLBACK_FACE_URL = "https://thril.me/lara-avatar.png";

const resolveFaceReference = (npc, overrideUrl = null) => {
    if (overrideUrl) return overrideUrl;
    if (!npc) return null;
    return npc.face_image_url
        || npc.avatar_url
        || npc.image_reference
        || npc.avatar
        || null;
};

const fetchFaceAsBase64 = async (url) => {
    if (!url) return null;
    try {
        // Support data URL already encoded
        if (url.startsWith('data:')) {
            const [, data] = url.split(',');
            return data || null;
        }
        return await imageUrlToBase64(url);
    } catch (err) {
        console.warn('⚠️ Unable to fetch face reference, falling back:', err?.message);
        return null;
    }
};

// Video generation route using MiniMax S2V-01 with NPC face swap
const video = async (prompt, npc = null, chatHistory = [], userId = null, npcId = null, faceImageUrl = null) => {
    try {
        // Use NPC face/ avatar if available, otherwise default
        const faceRefUrl = resolveFaceReference(npc, faceImageUrl) || FALLBACK_FACE_URL;
        let imageBase64 = await fetchFaceAsBase64(faceRefUrl);
        if (!imageBase64) {
            imageBase64 = await fetchFaceAsBase64(FALLBACK_FACE_URL);
        }

        if (!imageBase64) {
            throw new Error('Unable to load face reference for video generation');
        }

        console.log('🎬 Using face reference for video:', faceRefUrl);

        // Optimize prompt for video generation
        const enhancedPrompt = await PromptOptimizer.optimizePrompt(prompt, 'video');

        const output = await fetch("https://api.minimax.io/v1/video_generation", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
            },
            body: JSON.stringify({
                model: "S2V-01",
                prompt: enhancedPrompt,
                subject_reference: [
                    {
                        type: "character",
                        image: [
                            `data:image/jpeg;base64,${imageBase64}`
                        ]
                    }
                ]
            }),
        });

        const data = await output.json();
        logToFile(JSON.stringify(data));
        const taskId = data.task_id;

        // Step 2: Poll until ready
        let fileId = null;
        let status = null;
        for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 8000));

            const query = await fetch(`https://api.minimax.io/v1/query/video_generation?task_id=${taskId}`, {
                headers: { Authorization: `Bearer ${process.env.MINIMAX_API_KEY}` },
            });
            const queryData = await query.json();

            logToFile(JSON.stringify(queryData));

            status = queryData.status;
            if (status === "Success") {
                fileId = queryData.file_id;
                break;
            } else if (status === "Fail" || status === "Unknown") {
                throw new Error("Video generation failed");
            }
        }

        if (!fileId) throw new Error("Timeout: video not ready");

        const response = await fetch(`https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`
            }
        });

        const download = await response.json();

        logToFile("downloadurl" + JSON.stringify(download));

        const response2 = await fetch(download.file.download_url.toString());
        const buffer = await response2.buffer();

        const ownerId = userId || npc?.user_id || npc?.owner_id || npc?.created_by || null;

        // Upload to Supabase Storage if identifiers are provided
        if (ownerId && npcId) {
            try {
                const result = await storageService.uploadChatVideo(buffer, ownerId, npcId);
                console.log('✅ Video uploaded to Supabase:', result.publicUrl);
                return {
                    videoUrl: result.publicUrl,
                    mediaUrl: result.publicUrl,
                    storagePath: result.path,
                    storageBucket: storageService.buckets?.chatVideos || 'chat-videos',
                };
            } catch (uploadError) {
                console.error('Error uploading video to Supabase:', uploadError);
                // Fallback to local storage
            }
        }

        // Fallback: save locally
        const filevideo = `${fileId}.mp4`;
        await writeFile("public/" + filevideo, buffer);
        return {
            videoUrl: filevideo.toString(),
            mediaUrl: filevideo.toString(),
            localPath: filevideo.toString(),
        };

    } catch (error) {
        logToFile(error);
        throw error;
    }
};

module.exports = video;
