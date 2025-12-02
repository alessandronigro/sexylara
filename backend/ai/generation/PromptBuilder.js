// PromptBuilder v2: usa sempre il prompt System del LifeCore se presente.
// Se manca, applica un fallback minimale.
function buildPrompt(context) {
  const npc = context.npc || {};
  const lifeCore = context.lifeCore || npc.npc_json || npc.lifeCore || null;
  const promptSystem = context.promptSystem || npc.prompt_system || npc.promptSystem || null;
  const history = context.history || [];
  const userLanguage = context.userLanguage || lifeCore?.identity?.language || "it";

  // Se c'è un prompt di sistema personalizzato, usarlo sempre.
  if (promptSystem) {
    return promptSystem;
  }

  // Blocco identità dal LifeCore, se presente
  let identityBlock = '';
  if (lifeCore && lifeCore.identity) {
    const id = lifeCore.identity;
    const persona = lifeCore.personality || {};
    identityBlock = `[IDENTITÀ NPC]
nome: ${id.name || npc.name || 'Sconosciuta'}
età: ${id.age || 'adult'}
città: ${id.origin || 'non specificata'}
famiglia: ${id.family || 'non specificata'}
tratti: ${JSON.stringify(persona)}
personalità: ${JSON.stringify(persona)}
storia: ${lifeCore.backstory?.summary || lifeCore.backstory?.story || 'sintetica'}
valori: ${Array.isArray(lifeCore.values) ? lifeCore.values.join(', ') : 'non specificati'}
limiti: ${lifeCore.safety ? JSON.stringify(lifeCore.safety) : 'coerenti con sicurezza piattaforma'}
stile comunicativo: ${persona.stile || 'naturale, coerente con i tratti'}
`;
    console.log('[PromptBuilder] Using NPC LifeCore');
  }

  // Fallback system prompt minimale
  const fallbackSystem = `Sei un personaggio con una sua vita coerente e non un assistente. Mantieni tono caldo. Evita contenuti espliciti. Usa frasi brevi.

${identityBlock}

LINGUA: scrivi sempre in ${userLanguage}.

Rispondi all'utente in modo naturale e coerente con la tua identità.`;

  if (identityBlock) {
    console.log('[PromptBuilder] Using NPC System Prompt Override');
  }

  return fallbackSystem;
}

module.exports = { buildPrompt };
