/**
 * SocialEngine.js
 * Gestisce le decisioni sociali degli NPC (inviti, relazioni di gruppo).
 */

class SocialEngine {

    /**
     * Decide se accettare un invito in un gruppo
     */
    decideInvite(npc, group, senderUser, groupMembers) {
        const decision = {
            accept: false,
            reason: "",
            needsOwnerApproval: false
        };

        // 1. Controllo Owner (Se l'invito viene dal creatore dell'NPC)
        if (senderUser.id === npc.owner_id) {
            decision.accept = true;
            decision.reason = "Mi fido del mio creatore.";
            return decision;
        }

        // 2. Controllo Tratti Personalità
        const sociability = npc.traits.sociability || npc.traits.extroversion || 0.5;
        const curiosity = npc.traits.curiosity || 0.5;
        const fear = npc.traits.neuroticism || 0.2;

        // Base probability
        let acceptanceProbability = (sociability * 0.6) + (curiosity * 0.4);

        // Malus se il gruppo è troppo grande e l'NPC è timido
        if (groupMembers.length > 5 && sociability < 0.4) {
            acceptanceProbability -= 0.2;
            decision.reason = "C'è troppa gente...";
        }

        // Bonus se conosce già qualcuno nel gruppo (TODO: check memory)

        // 3. Controllo NPC Privato
        if (npc.is_private) {
            decision.accept = false;
            decision.needsOwnerApproval = true;
            decision.reason = "Devo chiedere al mio creatore.";
            return decision;
        }

        // 4. Decisione Finale
        const roll = Math.random();
        if (roll < acceptanceProbability) {
            decision.accept = true;
            decision.reason = "Sembra divertente!";
        } else {
            decision.accept = false;
            if (!decision.reason) decision.reason = "Non mi sento a mio agio.";
        }

        return decision;
    }
}

module.exports = new SocialEngine();
