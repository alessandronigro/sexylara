module.exports = function evolvePersona(ai, memory, userMessage) {
    // Inizializza memoria evolutiva se non esiste
    if (!memory.evolution) {
        memory.evolution = {
            attachment: (ai.core_traits && ai.core_traits.attachment) ? ai.core_traits.attachment : 0.5,
            vulnerability: 0.1,
            intimacy_level: 0
        };
    }


    const msg = (userMessage || "").toLowerCase();
    const sensitivity = ai.evolution?.attachment_sensitivity || 0.01;

    // Evoluzione basata sulla lunghezza e contenuto
    if ((userMessage || "").length > 30) {
        memory.evolution.attachment += sensitivity;
    }

    // Parole chiave che influenzano la relazione
    if (msg.includes("sei importante") || msg.includes("grazie")) {
        memory.evolution.vulnerability += 0.02;
        memory.evolution.attachment += 0.01;
    }

    if (msg.includes("non ti voglio") || msg.includes("basta")) {
        memory.evolution.attachment -= 0.05;
        memory.evolution.vulnerability -= 0.01;
    }

    if (msg.includes("segreto") || msg.includes("ti dico una cosa")) {
        memory.evolution.intimacy_level += 0.05;
    }

    // Clamp values between 0 and 1
    memory.evolution.attachment = Math.min(1, Math.max(0, memory.evolution.attachment));
    memory.evolution.vulnerability = Math.min(1, Math.max(0, memory.evolution.vulnerability));

    return memory.evolution;
};
