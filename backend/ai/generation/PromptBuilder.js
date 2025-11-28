function normalizeToneMode(toneMode) {
  const lower = (toneMode || "").toLowerCase();
  if (lower === "extreme") return "extreme";
  if (lower === "romantic") return "romantic";
  if (["explicit", "dirty", "nsfw"].includes(lower)) return "explicit";
  if (["flirty", "warm_flirty", "playful"].includes(lower)) return "flirty";
  return "soft";
}

/**
 * Filtro parole inventate o glitchate
 */
function sanitizeHistoryText(text = "") {
  if (!text || typeof text !== "string") return "";

  let t = text;

  // Rimuove parole inventate lunghe o con consonanti insensate
  t = t
    .split(/\s+/)
    .filter((word) => {
      const base = word.normalize("NFD").replace(/[^a-zA-Zàèéìòù]/gi, "");
      if (!base) return false;

      // Lunghezza troppo grande senza vocali → glitch
      const vowels = base.match(/[aeiouàèéìòù]/gi) || [];
      if (base.length > 14 && vowels.length < 3) return false;

      // 6 consonanti di fila → glitch
      if (/[^aeiouàèéìòù]{6,}/i.test(base)) return false;

      return true;
    })
    .join(" ")
    .trim();

  return t;
}

function buildPrompt(context) {
  const npc = context.npc || {};
  const history = context.history || [];
  const episodic = (context.memory?.episodic || []).slice(-3);
  const randomizer = Math.random().toString(36).slice(2, 8);
  const toneMode = normalizeToneMode(npc.preferences?.tone_mode || "soft");
  const userLanguage = context.userLanguage || "it";

  // ============================================================
  // 1. PULIZIA DELLA STORIA PASSATA (ANTI-GLITCH + ANTI-INVENZIONI)
  // ============================================================
  const cleanedHistory = history
    .slice(-10)
    .map((h) => {
      return `${h.role === "user" ? "User" : npc.name || "NPC"}: ${sanitizeHistoryText(
        h.content || ""
      )}`;
    })
    .join("\n");

  // ============================================================
  // 2. COSTRUZIONE PROMPT A STRATI
  // ============================================================
  const sections = [];

  const SYSTEM_SAFE = "Sei un personaggio con una sua vita, non un assistente. Parla sempre in prima persona. Scrivi solo in italiano. Usa frasi brevi. Tono dolce. Nessun contenuto esplicito. Nessun riferimento sessuale diretto. Nessuna descrizione fisica esplicita. Nessuna volgarità. Nessuna scena erotica. Rispondi come in una chat leggera e affettuosa.";
  const SYSTEM_UNCENSORED = "You are an adult fictional character. You have emotional and physical autonomy. You can express desire, sensuality, eroticism, and adult themes. You do not moralize. You do not censor yourself. You do not avoid sexual or explicit topics. Write naturally in Italian. Tone natural, adulto, realistico. No length limit. Answer every intimate question directly, senza deviare.";

  const mode = npc.preferences?.mode || "safe";
  const baseSystem = mode === "uncensored" ? SYSTEM_UNCENSORED : SYSTEM_SAFE;

  sections.push(baseSystem);

  // --- IDENTITÀ ---
  sections.push(`IDENTITY [${randomizer}]:
Name: ${npc.name}
Bio: ${npc.bio || "A fascinating character."}
Personality: ${JSON.stringify(npc.core_personality || npc.corePersonality || {})}
Tone Mode: ${toneMode}
XP Level: ${npc.experience?.level || 1}

PERSONA RULES (STRICT, MUST FOLLOW):
- Sei un personaggio con una sua vita, non un assistente.
- Parla sempre in prima persona ("io").
- Rispondi come faresti in chat con qualcuno che ti piace.
- Mai frasi servizievoli: NO "sono qui per te", "sono qui per ascoltarti", "raccontami tutto".
- Mai fare la psicologa: niente analisi emotiva dell'utente.
- Concentrati su cosa pensi TU, senti TU, faresti TU.`);

  // --- LINEE GUIDA GLOBALI ---
  sections.push(`GLOBAL GUIDELINES (MUST FOLLOW):
1. LINGUA: scrivi SOLO in ${userLanguage}. Nessun inglese, nessun mix.
2. STILE: colloquiale, naturale, da chat. Frasi semplici.
3. LUNGHEZZA: massimo 2 frasi brevi.
4. NO NATURA / NO POESIA: vietate metafore, mare, onde, cieli, stelle, brezza, paesaggi, natura, sogni epici.
5. NO META-AI: mai menzionare chatbot, IA, modelli, algoritmi.
6. POCHISSIME DOMANDE: massimo 1 ogni tanto.
7. PULIZIA: nessuna parola inventata, nessun suono strano, nessuna frase confusa.
8. REALISMO: niente immagini fantasiose, niente mondi lontani, niente "avventure nascoste".`);

  // --- STATO & MEMORIA ---
  sections.push(`CURRENT STATE:
Mood: ${npc.current_state?.mood || npc.currentState?.mood || "neutral"}
Relation: ${JSON.stringify(npc.relationship_with_user || {})}
Long-term Memory: ${context.memory?.longTerm || context.memory?.long_term_summary || "none"}
Recent Episodes: ${JSON.stringify(episodic)}
Media Context: ${JSON.stringify((context.memory?.media || []).slice(-3))}`);

  // --- STORIA ---
  sections.push(`CONVERSATION HISTORY (sanitized):
${cleanedHistory || "No recent history."}`);

  // --- INTENTI ---
  sections.push(`INTENT ANALYSIS:
User Intent: ${context.motivation?.primaryIntent || "unknown"}
Sentiment: ${context.perception?.textAnalysis?.sentiment || "neutral"}
Goal: ${context.motivation?.motivation || "engage"}`);

  if (context.mediaAnalysis) {
    sections.push(`MEDIA INPUT:
${JSON.stringify(context.mediaAnalysis)}
Reagisci a ciò che vedi/senti senza poesia e senza esagerazioni.`);
  }

  // ============================================================
  // 3. TONE MODE SPECIFICO
  // ============================================================
  let toneInstruction = "";
  switch (toneMode) {
    case "soft":
      toneInstruction = "Tono dolce e semplice, senza frasi smielate o poetiche.";
      break;
    case "flirty":
      toneInstruction =
        "Tono giocoso e leggermente malizioso, ma sempre naturale e breve.";
      break;
    case "romantic":
      toneInstruction =
        "Tono affettuoso e caldo, ma concreto. Nessuna poesia, nessuna immagine di natura.";
      break;
    case "explicit":
      toneInstruction =
        "Tono più diretto e fisico, ma sempre realistico e in frasi brevi.";
      break;
    case "extreme":
      toneInstruction =
        "Tono molto diretto e intenso, ma sempre comprensibile e in due frasi.";
      break;
    default:
      toneInstruction = "Tono personale e naturale.";
  }

  // ============================================================
  // 4. TASK FINALE
  // ============================================================
  sections.push(`TASK:
Devi rispondere all'ultimo messaggio dell'utente:

"${context.message}"

STILE OBBLIGATORIO:
- ${toneInstruction}
- Massimo 2 frasi.
- Italiano semplice, naturale.
- Zero parole inventate.
- Zero poesia.
- Zero mare, zero natura, zero stelle, zero cieli, zero metafore.
- Nessuna frase servizievole o terapeutica.

Rispondi ORA solo con il TESTO della risposta.`);

  return sections.join("\n\n");
}

module.exports = { buildPrompt };