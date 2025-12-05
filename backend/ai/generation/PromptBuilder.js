// PromptBuilder v2: usa sempre il prompt System del LifeCore se presente.
// Se manca, applica un fallback minimale.
function buildPrompt(context) {
  const npc = context.npc || {};
  const lifeCore = context.lifeCore || npc.npc_json || npc.lifeCore || null;
  const promptSystem = context.promptSystem || npc.prompt_system || npc.promptSystem || null;
  const history = context.history || [];
  const userLanguage = context.userLanguage || lifeCore?.identity?.language || "it";
  const timeContext = context.timeContext || {};
  const worldContext = context.worldContext || {};
  const sceneContext = context.sceneContext || context.scene || null;
  const groupMeta =
    context.groupMeta ||
    sceneContext?.groupMeta ||
    context.groupContext?.groupMeta ||
    null;
  const groupMembers = context.group_members || context.groupContext?.members || [];

  // Sintesi gruppo basata su groupMeta
  let groupBlock = '';
  if (groupMeta && typeof groupMeta.memberCount === 'number') {
    const preview = (groupMeta.membersPreview || [])
      .slice(0, 3)
      .map((m) => `- ${m.name || (m.type === 'user' ? 'Utente' : 'NPC')} (${m.type === 'user' ? 'umano' : 'NPC'})`)
      .join('\n');
    const ownerLine = groupMeta.ownerName
      ? `owner: ${groupMeta.ownerName}`
      : '';
    const roleLine = groupMeta.currentUserRole
      ? `tuo ruolo attuale: ${groupMeta.currentUserRole}`
      : '';
    const membersLine = groupMembers && groupMembers.length
      ? `membri noti (${groupMembers.length}): ${groupMembers.slice(0, 5).map(m => m.name || (m.type === 'user' ? 'Utente' : 'NPC')).join(', ')}`
      : '';
    const previewLine = preview ? `\nnomi (max 3):\n${preview}` : '';
    groupBlock = `\n[GRUPPO]\nsei in una chat di gruppo.\npartecipanti totali: ${groupMeta.memberCount} (umani: ${groupMeta.humanCount ?? '?'} | NPC: ${groupMeta.aiCount ?? '?'})${ownerLine ? `\n${ownerLine}` : ''}${roleLine ? `\n${roleLine}` : ''}${membersLine ? `\n${membersLine}` : ''}${previewLine}\nUsa questi numeri se ti chiedono quanti siete o chi c'è; non inventare numeri o dettagli sensibili; non dire mai di non sapere chi c'è nel gruppo.`;
  }

  // Se c'è un prompt di sistema personalizzato, usarlo sempre.
  if (promptSystem) {
    return promptSystem;
  }

  // Blocco identità dal LifeCore, se presente
  let identityBlock = '';
  if (lifeCore && lifeCore.identity) {
    const id = lifeCore.identity;
    const persona = lifeCore.personality || {};
    const tm = lifeCore.time_memory || {};
    const rel = lifeCore.relationship || {};
    const groupPersona = lifeCore.groupPersona || {};
    const world = lifeCore.worldAwareness || {};
    const patterns = lifeCore.timePatterns || {};
    const urges = lifeCore.socialUrges || {};
    const nowBlock = timeContext?.today ? `\n[CONTESTO TEMPO]\ndata: ${timeContext.today} ora: ${timeContext.hour || '?'} (${timeContext.partOfDay || ''})` : '';
    const worldBlock = worldContext && (worldContext.weather || (worldContext.festivities || []).length || (worldContext.news || []).length)
      ? `\n[MONDO]\nmeteo: ${worldContext.weather ? JSON.stringify(worldContext.weather) : 'n/d'}\nfestività: ${(worldContext.festivities || []).join(', ') || 'none'}\nnews: ${(worldContext.news || []).slice(0,2).map((n) => n.title || n).join(' | ') || 'none'}`
      : '';
    identityBlock = `[IDENTITÀ NPC]
nome: ${id.name || npc.name || 'Sconosciuta'}
età: ${id.age || 'adult'}
città: ${id.origin || 'non specificata'}
origine/nascita: ${id.birthplace || id.origin || 'non specificata'}
nazionalità: ${id.nationality || 'non specificata'}
famiglia: ${id.family || 'non specificata'}
tratti: ${JSON.stringify(persona)}
personalità: ${JSON.stringify(persona)}
storia: ${lifeCore.backstory?.summary || lifeCore.backstory?.story || 'sintetica'}
valori: ${Array.isArray(lifeCore.values) ? lifeCore.values.join(', ') : 'non specificati'}
limiti: ${lifeCore.safety ? JSON.stringify(lifeCore.safety) : 'coerenti con sicurezza piattaforma'}
stile comunicativo: ${persona.stile || 'naturale, coerente con i tratti'}
[MEMORIA TEMPORALE]
passato: ${tm.past_events?.length || 0} eventi chiave
presente: clima ${tm.present_context?.emotional_climate || 'neutral'}, topic recente: ${tm.present_context?.last_significant_topic || 'n/d'}
futuro: ${tm.future_events?.length || 0} eventi programmati
[RELAZIONE]
confidenza: ${rel.confidence_level ?? 0}/5
ritmo contatto: ${rel.typical_rhythm_of_contact || 'weekly'}
[GRUPPO]
ruolo gruppo: ${groupPersona.role || 'supporter'}
proattività: ${groupPersona.proactivity || 'medium'}
[MONDO E TEMPO]
world awareness: ${world.sensitivity || 'light'}
time patterns energia (m/a/s): ${patterns.morning_energy ?? '?'} / ${patterns.afternoon_energy ?? '?'} / ${patterns.evening_energy ?? '?'}
social urges: baseline ${urges.baseline ?? 0} picchi: ${(urges.peaks_at || []).join(', ') || 'none'}${nowBlock}${worldBlock}
coerenza_identita: non contraddire mai origine/nascita (${id.birthplace || id.origin || 'n/d'}) e nazionalità (${id.nationality || 'n/d'}).
`;
    console.log('[PromptBuilder] Using NPC LifeCore');
  }

  const initiativeBlock = context.initiative
    ? `\n[INIZIATIVA]\nreason: ${context.initiative.reason || 'initiative'}\nfuture_event: ${context.initiative.futureEvent?.userMessageExtract || context.initiative.futureEvent?.type || 'nessuno'}` 
    : '';

  // Fallback system prompt minimale
  const fallbackSystem = `Sei un personaggio con una sua vita coerente e non un assistente. Mantieni tono caldo. Evita contenuti espliciti. Usa frasi brevi.

${identityBlock}
${initiativeBlock}
${groupBlock}

LINGUA: scrivi sempre in ${userLanguage}.

Regole gruppo: non inventare mondi esterni o gruppi finti, non dire di essere un umano o di non avere identità, non dire di non sapere chi c'è; rispondi usando i dati del gruppo sopra (numeri/nome max 3) e il tuo LifeCore. Se manca un'informazione specifica, rispondi in modo breve senza inventare.

Rispondi all'utente in modo naturale e coerente con la tua identità.`;

  if (identityBlock) {
    console.log('[PromptBuilder] Using NPC System Prompt Override');
  }

  return fallbackSystem;
}

module.exports = { buildPrompt };
