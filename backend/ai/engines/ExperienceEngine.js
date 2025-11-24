/**
 * ExperienceEngine.js
 * Gestisce XP, livelli e evoluzione dinamica basata sull'interazione.
 */

class ExperienceEngine {

    processInteraction(npc, userMessage, sentiment) {
        const updates = {
            xpGained: 0,
            intimacyDelta: 0,
            traitChanges: {}
        };

        // 1. Calcolo XP Base
        updates.xpGained = 10; // Base per messaggio
        if ((userMessage || "").length > 50) updates.xpGained += 5;

        // 2. Calcolo Intimità (Reward System)
        if (sentiment === 'positive') {
            updates.intimacyDelta = npc.evolution_rules.intimacy_growth_rate * 5;
            updates.xpGained += 10; // Bonus per interazione positiva
        } else if (sentiment === 'negative') {
            updates.intimacyDelta = -npc.evolution_rules.intimacy_growth_rate * 2;
        }

        // 3. Evoluzione Tratti (Adattamento)
        // Es. Se l'utente è molto romantico, l'NPC diventa più empatico
        const msg = (userMessage || "").toLowerCase();
        if (msg.includes("amore") || msg.includes("cuore")) {
            updates.traitChanges['empathy'] = 0.01;
        }

        // Applicazione modifiche
        npc.stats.xp += updates.xpGained;
        npc.stats.intimacy = Math.max(0, Math.min(100, npc.stats.intimacy + updates.intimacyDelta));

        // Level Up Check
        const nextLevelXp = npc.stats.level * 1000;
        if (npc.stats.xp >= nextLevelXp) {
            npc.stats.level++;
            updates.levelUp = true;
        }

        // Applica tratti
        for (const [trait, delta] of Object.entries(updates.traitChanges)) {
            if (npc.traits[trait] !== undefined) {
                npc.traits[trait] = Math.max(0, Math.min(1, npc.traits[trait] + delta));
            }
        }

        return updates;
    }
}

module.exports = new ExperienceEngine();
