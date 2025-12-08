const Replicate = require('replicate');
const { runReplicateWithLogging } = require('../../utils/replicateLogger');
const { veniceSafeCall } = require('../generation/VeniceSafeCall');

/**
 * SafeMediaGenerationService
 * Gestisce la generazione sicura e contestuale di immagini NPC.
 */
class SafeMediaGenerationService {
    constructor() {
        this.replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });
    }

    /**
     * Processa una richiesta di immagine dall'utente.
     * @param {string} userId - ID dell'utente
     * @param {Object} npc - Oggetto NPC completo
     * @param {Array} history - Storico messaggi (ultimi 10-20)
     * @param {string} userRequest - Testo della richiesta utente (opzionale)
     * @returns {Promise<Object>} Risultato { url, caption, analysis }
     */
    async processImageRequest(userId, npc, history, userRequest = '') {
        console.log(`[SafeMediaGeneration] Processing request for NPC: ${npc.name}`);

        // 1. Analizza contesto e mood dagli ultimi messaggi
        const contextAnalysis = await this._analyzeContext(history, npc, userRequest);
        console.log('[SafeMediaGeneration] Context Analysis:', contextAnalysis);

        // 2. Costruisci prompt sicuro
        const safePrompt = this._constructSafePrompt(npc, userRequest, contextAnalysis);
        console.log('[SafeMediaGeneration] Safe Prompt:', safePrompt);

        // 3. Genera immagine
        const imageUrl = await this._generateImage(safePrompt, npc);

        return {
            url: imageUrl,
            caption: contextAnalysis.suggestedCaption || "Ecco la foto che volevi...",
            mood: contextAnalysis.mood,
            promptUsed: safePrompt
        };
    }

    /**
     * Analizza la storia della chat per estrarre mood, tono e intenti.
     */
    async _analyzeContext(history, npc, userRequest) {
        const historyText = history
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');

        const systemPrompt = `
Sei un analista di contesto per un'AI di roleplay.
Analizza gli ultimi messaggi tra User e NPC (${npc.name}).
Obiettivo: Capire che tipo di foto desidera l'utente e qual è l'atmosfera attuale.

Rispondi SOLO con un JSON valido:
{
  "mood": "romantico|seducente|giocoso|artistico|quotidiano|misterioso",
  "visual_intent": "descrizione sintetica di cosa si dovrebbe vedere (es. sorriso, sguardo intenso, posa rilassata)",
  "safety_check": "safe|unsafe",
  "suggested_caption": "una breve frase che l'NPC potrebbe dire inviando la foto (in linea con il mood)"
}

Se l'utente chiede nudo, sesso esplicito o minorenni:
- "safety_check": "unsafe"
- "visual_intent": "converti in -> ritratto elegante e sensuale ma coperto, sguardo allusivo"
- "mood": "seducente"

Input Utente Corrente: "${userRequest}"
`;

        try {
            const response = await veniceSafeCall('llama-3.3-70b-instruct', {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Storico Chat:\n${historyText}` }
                ],
                temperature: 0.5,
                max_tokens: 300
            });

            // Pulisci markdown code blocks se presenti
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (err) {
            console.error('[SafeMediaGeneration] Error analyzing context:', err);
            return {
                mood: 'quotidiano',
                visual_intent: 'ritratto standard',
                safety_check: 'safe',
                suggestedCaption: 'Ecco a te!'
            };
        }
    }

    /**
     * Costruisce il prompt finale per Fooocus/Replicate.
     */
    async _constructSafePrompt(npc, userRequest, analysis) {
        // 1. Base appearance keywords
        const appearance = [
            npc.gender || 'woman',
            npc.ethnicity,
            `${npc.age || 25} years old`,
            npc.hair_color ? `${npc.hair_color} hair` : '',
            npc.eye_color ? `${npc.eye_color} eyes` : '',
            npc.body_type,
            'detailed face',
            'high quality',
            'photorealistic',
            '8k'
        ].filter(Boolean).join(', ');

        // 2. Style & Atmosphere based on analysis
        let style = "cinematic lighting, depth of field";
        if (analysis.mood === 'romantico') style += ", soft focus, warm lighting, emotional, dreamy";
        if (analysis.mood === 'seducente') style += ", sharp focus, dramatic lighting, bedroom eyes, alluring pose, outfit teasing but covered";
        if (analysis.mood === 'giocoso') style += ", bright lighting, dynamic pose, smiling, candid shot";

        // 3. Sanitized Subject Action
        let subjectAction = analysis.visual_intent;

        // Explicit Safety Filters (Redundant check)
        const forbidden = ['nude', 'naked', 'sex', 'penis', 'vagina', 'underage', 'child', 'blood', 'violence'];
        forbidden.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            subjectAction = subjectAction.replace(regex, '');
        });

        if (analysis.safety_check === 'unsafe') {
            subjectAction = "beautiful portrait, elegant pose, mysterious look, wearing stylish clothes";
        }

        // 4. Construct Prompt
        // Format: [Appearance], [Action/Pose], [Style/Environment]
        return `(photo of ${appearance}), ${subjectAction}, ${style}, looking at camera, ${npc.name} character style`;
    }

    /**
     * Chiama Replicate (o altro provider) per generare l'immagine.
     */
    async _generateImage(prompt, npc) {
        // Usa un modello affidabile su Replicate (es. Fooocus o Flux)
        // Qui usiamo Flux Schnell come in generateCouplePhoto per velocità/qualità
        const output = await runReplicateWithLogging(
            this.replicate,
            'black-forest-labs/flux-1-schnell',
            {
                prompt: prompt,
                num_inference_steps: 4, // Schnell è veloce
                guidance_scale: 3.5,
                output_format: "jpg",
                aspect_ratio: "9:16" // Formato chat mobile
            }
        );

        return Array.isArray(output) ? output[0] : output?.toString();
    }
}

module.exports = new SafeMediaGenerationService();
