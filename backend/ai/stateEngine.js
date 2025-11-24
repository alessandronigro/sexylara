module.exports = function computeEmotion(ai, userMessage, aiMemory) {

    let emotion = aiMemory.currentEmotion || "calmo";
    const msg = userMessage.toLowerCase();

    // Logica di base per il cambio emotivo
    if (msg.includes("ti amo") || msg.includes("mi manchi") || msg.includes("sei speciale")) {
        emotion = "toccato";
    } else if (msg.includes("sei stupida") || msg.includes("non mi piaci") || msg.includes("odio")) {
        emotion = "ferito";
    } else if (msg.includes("foto") || msg.includes("voglio vederti") || msg.includes("sei sexy")) {
        emotion = "imbarazzato_ma_lusingato";
    } else if (msg.includes("ciao") || msg.includes("come stai")) {
        emotion = "accogliente";
    } else if (msg.includes("triste") || msg.includes("sto male")) {
        emotion = "preoccupato";
    }

    // Se l'emozione non cambia drasticamente, tende a tornare verso uno stato neutro/calmo nel tempo
    // (Qui potremmo aggiungere logica di decadimento emotivo)

    aiMemory.currentEmotion = emotion;
    return emotion;
};
