const Replicate = require("replicate");

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

/**
 * Image analyzer professionale
 * Usa due modelli:
 * 1) sgaspari/image-analyzer → descrizioni, emozioni, tags
 * 2) abetlen/face-detection   → volti, sorrisi, confidenza
 */
async function analyzeImage(imageUrl) {
    let description = null;
    let emotion = null;
    let tags = [];
    let faces = [];
    let containsUserFace = false;
    let smile = false;

    try {
        // ---------------------------
        // 1) ANALISI SEMANTICA
        // ---------------------------
        const semantic = await replicate.run(
            "sgaspari/image-analyzer:latest",
            { input: { image: imageUrl } }
        );

        description = semantic?.caption || semantic?.description || null;
        emotion = semantic?.emotion || semantic?.primary_emotion || null;
        tags = semantic?.tags || semantic?.labels || [];

        // ---------------------------
        // 2) FACE DETECTION
        // ---------------------------
        const faceResult = await replicate.run(
            "abetlen/face-detection:latest",
            { input: { image: imageUrl } }
        );

        faces = faceResult?.faces || [];
        containsUserFace = faces.length > 0;

        if (faces[0]?.expressions) {
            smile = faces[0].expressions.smile > 0.5;
        }

        return {
            raw: {
                semantic,
                faceResult
            },
            description,
            emotion,
            tags,
            faces,
            containsUserFace,
            smile,
            context: tags.includes("selfie") ? "selfie" : "generic"
        };

    } catch (err) {
        console.error('[replicate-image-analyzer] Error:', err);
        return {
            error: err?.message || String(err),
            description: null,
            emotion: null,
            faces: [],
            containsUserFace: false,
            smile: false,
            tags: [],
            context: 'error'
        };
    }
}

module.exports = { analyzeImage };