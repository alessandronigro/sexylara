// routes/video.js
const express = require("express");
const fetch = require("node-fetch");
const logToFile = require("../utils/log");
const { writeFile } = require("fs/promises");


const group_id = 1943287634835017980;
// Video generation route using MiniMax S2V-01
const retrievevideo = async (prompt) => {
    try {
        const group_id = 1943287634835017980;
        const fileId = 291979243106422;



        const response = await fetch(`https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`
            }
        });

        const download = await response.json()

        const filevideo = `${fileId}.mp4`;
        const response2 = await fetch(download.file.download_url.toString());
        const buffer = await response2.buffer();

        await writeFile("public/" + filevideo, buffer);


        return filevideo.toString();






    } catch (error) {
        logToFile(error);
        throw error;
    }
};
module.exports = retrievevideo;
