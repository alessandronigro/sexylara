const fetch = require("node-fetch");

async function imageUrlToBase64(imageUrl) {
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    return buffer.toString("base64");
}

module.exports = imageUrlToBase64;
