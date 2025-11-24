/**
 * MemoryEngine.js
 * Gestisce memoria a lungo termine, di gruppo e fusione informazioni.
 */

class MemoryEngine {
    constructor() { }

    /**
     * Recupera il contesto rilevante per la conversazione attuale
     */
    async getRelevantContext(npcId, userId, currentMessage, storageService) {
        // In futuro: Vector Search su Supabase
        // Per ora: Mockup o recupero ultimi messaggi + summary

        // Esempio struttura memoria recuperata
        return {
            user_history: "L'utente ama la tecnologia e i gatti.",
            shared_facts: ["Ci siamo incontrati a Parigi virtualmente.", "Ti piace il colore blu."],
            group_context: null // Se siamo in un gruppo, recupera info sugli altri membri
        };
    }

    /**
     * Sintetizza nuovi ricordi da una sessione
     */
    async synthesizeMemory(sessionMessages) {
        // Qui andrebbe una chiamata LLM per riassumere:
        // "L'utente ha detto X, io ho risposto Y. Ho imparato Z."
        return "Sessione di chat generica.";
    }

    /**
     * Apprende dai gruppi (Social Learning)
     */
    async absorbGroupKnowledge(npc, groupMessages) {
        // Se altri NPC parlano di un argomento, questo NPC lo "impara"
        // Es. "Ho sentito dire da Luna che Marco è simpatico."
        return [];
    }
}

module.exports = new MemoryEngine();
