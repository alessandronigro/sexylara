/**
 * PersonaEngine.js
 * Gestisce l'identità, i tratti e l'evoluzione statica dell'NPC.
 */

class PersonaEngine {
    constructor() { }

    /**
     * Inizializza o valida un profilo NPC
     */
    validatePersona(npcData) {
        return {
            name: npcData.name || "Unknown",
            role: npcData.role || "companion",
            traits: {
                empathy: npcData.traits?.empathy ?? 0.5,
                curiosity: npcData.traits?.curiosity ?? 0.5,
                dominance: npcData.traits?.dominance ?? 0.5,
                humor: npcData.traits?.humor ?? 0.5,
                jealousy: npcData.traits?.jealousy ?? 0.1,
                ...npcData.traits
            },
            stats: {
                level: npcData.stats?.level ?? 1,
                xp: npcData.stats?.xp ?? 0,
                intimacy: npcData.stats?.intimacy ?? 0, // Con l'owner
                mood: npcData.stats?.mood ?? "neutral"
            },
            evolution_rules: npcData.evolution_rules || {
                xp_per_message: 10,
                intimacy_growth_rate: 0.01
            }
        };
    }

    /**
     * Modifica tratti base (addestramento utente)
     */
    modifyTrait(npc, trait, value) {
        if (npc.traits[trait] !== undefined) {
            npc.traits[trait] = Math.max(0, Math.min(1, value)); // Clamp 0-1
            return true;
        }
        return false;
    }

    /**
     * Calcola lo stato emotivo corrente basato sui tratti e input recente
     */
    calculateMood(npc, recentEvents) {
        // Logica semplice per ora, espandibile
        let moodScore = 0;
        recentEvents.forEach(e => {
            if (e.sentiment === 'positive') moodScore += 1;
            if (e.sentiment === 'negative') moodScore -= 1;
        });

        if (moodScore > 2) return "happy";
        if (moodScore < -2) return "sad";
        return "neutral";
    }
}

module.exports = new PersonaEngine();
