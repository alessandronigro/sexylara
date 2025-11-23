function analyzeText(text, memory) {
    const updated = { ...memory };

    // 1. Parole frequenti
    const parole = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const paroleFrequenza = {};
    parole.forEach(w => {
        paroleFrequenza[w] = (paroleFrequenza[w] || 0) + 1;
    });
    updated.parole_frequenti = Object.entries(paroleFrequenza)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);

    // 1.5 Estrazione Nome
    const nameMatch = text.match(/(?:mi chiamo|sono|chiamami)\s+([A-Z][a-z]+)/i);
    if (nameMatch && nameMatch[1]) {
        updated.userName = nameMatch[1];
    }

    // 2. Tono
    if (text.match(/(?:amore|bacio|cuore|carezza)/i)) updated.tono = "romantico";
    else if (text.match(/(?:voglio|ora|fai|subito|comando)/i)) updated.tono = "dominante";
    else updated.tono = "giocoso";

    // 3. Emozioni
    updated.emozione = detectEmotion(text);

    // 4. Risposte brevi
    updated.risposte_brevi_preferite = text.length < 60;

    // 5. Attesa calcolata
    updated.attesa_media = Math.min(3000, text.length * 50);

    return updated;
}

function detectEmotion(text) {
    text = text.toLowerCase();

    if (text.match(/(?:triste|solo|mancanza|deluso|vuoto)/)) return "tristezza";
    if (text.match(/(?:bello|magico|dolce|cuore|piacere)/)) return "affetto";
    if (text.match(/(?:voglio|desidero|nudo|corpo|eccitazione|toccami)/)) return "desiderio";
    if (text.match(/(?:arrabbiato|basta|odio|nervoso)/)) return "rabbia";

    return "neutra";
}

module.exports = { analyzeText };
