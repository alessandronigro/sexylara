// routes/video.js
const express = require("express");
const fetch = require("node-fetch");
const logToFile = require("../utils/log");
const imageUrlToBase64 = require("../utils/imageToBase64");
const { writeFile } = require("fs/promises");
const generatePrompt = require("./promptGenerator");
const storageService = require('../services/supabase-storage');

const group_id = 1943287634835017980;

// Video generation route using MiniMax S2V-01
const video = async (prompt, girlfriend = null, chatHistory = [], userId = null, girlfriendId = null) => {
    try {
        const group_id = 1943287634835017980;

        // Use girlfriend's avatar if available, otherwise use default
        let imageUrl = "https://sexylara.chat/lara-avatar.png";
        if (girlfriend && girlfriend.avatar_url && girlfriend.avatar_url.startsWith('http')) {
            imageUrl = girlfriend.avatar_url;
        }

        console.log('🎬 Using avatar for video:', imageUrl);

        const imageBase64 = await imageUrlToBase64(imageUrl);

        // Generate enhanced prompt using AI
        let enhancedPrompt;
        try {
            console.log('🎬 Original video request:', prompt);
            enhancedPrompt = await generatePrompt(prompt, 'video', { chatHistory });
            console.log('✨ Enhanced video prompt:', enhancedPrompt);
        } catch (error) {
            console.error('Error enhancing video prompt:', error);
            enhancedPrompt = "woman in elegant pose, soft lighting, cinematic atmosphere";
        }

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

        // Upload to Supabase Storage if userId and girlfriendId are provided
        if (userId && girlfriendId) {
            try {
                const result = await storageService.uploadChatVideo(buffer, userId, girlfriendId);
                console.log('✅ Video uploaded to Supabase:', result.publicUrl);
                return result.publicUrl;
            } catch (uploadError) {
                console.error('Error uploading video to Supabase:', uploadError);
                // Fallback to local storage
            }
        }

        // Fallback: save locally
        const filevideo = `${fileId}.mp4`;
        await writeFile("public/" + filevideo, buffer);
        return filevideo.toString();

    } catch (error) {
        logToFile(error);
        throw error;
    }
};

module.exports = video;
