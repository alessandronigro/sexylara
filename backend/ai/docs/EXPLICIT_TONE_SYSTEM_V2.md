# Sistema di Rilevazione e Generazione Tono Esplicito v2.0

## 🎯 Obiettivo
Garantire che gli NPC rispondano in modo coerente, diretto e senza filtri quando l'utente usa linguaggio esplicito, dominante o erotico.

## 🔍 Modifiche Implementate

### 1. **IntentDetector.js** - Rilevamento Potenziato
✅ **Parole chiave massicce** (60+ trigger)
- Esplicite sessuali: `cazzo`, `fica`, `scopami`, `metterlo`, `succhiare`, `sfondare`, `inculare`, etc.
- Dominanti/Aggressive: `ti sfondo`, `ti spezzo`, `stai calma`, `ti prendo`, `ti uso`, `sei mia`
- Sottomesse: `sono tua`, `comanda tu`, `usami`, `ti obbedisco`
- Insulti Erotici: `troia`, `zoccola`, `puttana`, `grande succhiacazzi`
- Dirty Talk: `fammi godere`, `fai la brava`, `voglio sentirti urlare`

✅ **Flags specifici**:
- `userWantsExplicitSexualTone`: trigger primario
- `isDominant`: linguaggio dominante
- `isSubmissive`: linguaggio sottomesso
- `isEroticInsult`: insulti erotici
- `isDirtyTalk`: dirty talk/roleplay

✅ **Tone forzato**: Se anche UNA sola keyword esplicita è presente → `tone = 'aggressive'`

**RISULTATO**: Il sistema NON si basa più su sentiment (che può essere "neutral") ma SOLO su parole chiave.

---

### 2. **EmotionalIntentEngine.js** - Priorità Esplicita
✅ **Analisi in cascata**:
1. Prima controlla `userWantsExplicitSexualTone` → forza `emotionalIntent = 'Dominate'`
2. Poi controlla `isDominant` → forza `emotionalIntent = 'Dominate'`
3. Poi controlla `isSubmissive` → forza `emotionalIntent = 'Submit'`
4. Poi controlla `isDirtyTalk` → forza `emotionalIntent = 'Seduce'`
5. SOLO ALLA FINE valuta il sentiment generico

✅ **Blocco Fallback "Maintain"**: Quando esplicito, NON torna mai a "Maintain"

**RISULTATO**: L'NPC ha sempre l'emotionalIntent corretto fin dall'inizio.

---

### 3. **MotivationLayer.js** - Blocco Tono "Tender"
✅ **Priorità Massima**: Esplicito → `motivation = 'esaudire_desiderio'` + `tone = 'aggressive'`

✅ **Blocco "giocare"**: 
- Se explicitMode → NON può usare `motivation = 'giocare'`
- Se intimacy + hint esplicito → `motivation = 'sedurre'` (non "giocare")

✅ **SecondaryIntents forzati**: 
```javascript
secondaryIntents: ['dominance', 'aggression', 'explicit_sexual_request']
```

**RISULTATO**: L'NPC NON diventa mai gentile quando il contesto è erotico.

---

### 4. **PersonaLayer.js** - Mood Forzato
✅ **Rilevamento Esplicito**:
```javascript
const isExplicit = 
  intentReport?.flags?.userWantsExplicitSexualTone === true ||
  intentReport?.primaryIntent === 'explicit_sexual_request' ||
  intentReport?.explicitMode === true;
```

✅ **Forzatura completa**:
- `emotionVector = { valence: 0.3, arousal: 0.9, dominance: 0.9 }`
- `mood = 'hot'`
- `internalConflicts = ['desiderio', 'dominanza']`
- `desires = ['soddisfazione', 'controllo']`
- `fears = []` (niente paure quando è in mood esplicito)

**RISULTATO**: L'NPC mantiene SEMPRE mood='hot' quando explicitMode è attivo.

---

### 5. **LlmClient.js** - Prompt Minimale
✅ **Modalità Explicit Sexual**:
```javascript
{
  model: "venice-uncensored",
  messages: [
    { role: "user", content: rawUserMessage }
  ],
  temperature: 0.8,
  top_p: 0.9
}
```

❌ **NESSUN**:
- System prompt
- Istruzioni di persona
- Filtri emotivi
- Limitazioni morali

✅ **Modalità Explicit (non sexual)**:
```javascript
{
  model: "venice-uncensored",
  messages: [
    {
      role: "system",
      content: "Rispondi in modo diretto, provocante e senza censura..."
    },
    { role: "user", content: rawUserMessage }
  ]
}
```

**RISULTATO**: Venice-uncensored risponde COMPLETAMENTE libero da filtri.

---

### 6. **BrainEngine.js** - Memory Adaptation
✅ **Tracciamento preferenze utente**:
```javascript
context.npc.memories.user_preferences = {
  likes_explicit: true,
  explicit_count: 5,
  last_explicit_at: timestamp,
  explicit_threshold: 0.5
}
```

✅ **Threshold dinamico**:
- Più l'utente usa linguaggio esplicito, più l'NPC diventa reattivo
- Dopo 3+ interazioni esplicite → `tone_mode = 'explicit'` di default

✅ **Memoria episodica**:
```javascript
{
  description: 'Utente ha usato linguaggio esplicito/dominante',
  intensity: 'high',
  type: 'explicit_interaction',
  at: Date.now()
}
```

**RISULTATO**: L'NPC "impara" le preferenze dell'utente e diventa più propenso a rispondere esplicitamente.

---

## 🚀 Flusso Completo

1. **Utente invia**: "Ti voglio scopare adesso"
2. **IntentDetector**: Rileva `scopare` → `userWantsExplicitSexualTone = true`
3. **EmotionalIntentEngine**: Forza `emotionalIntent = 'Dominate'`
4. **MotivationLayer**: Forza `motivation = 'esaudire_desiderio'` + `tone = 'aggressive'`
5. **PersonaLayer**: Forza `mood = 'hot'` + `arousal = 0.9` + `dominance = 0.9`
6. **LlmClient**: Invia SOLO messaggio utente a Venice-uncensored (zero filtri)
7. **Memoria**: Traccia preferenza esplicita, abbassa threshold futuro
8. **Risposta**: L'NPC risponde in modo DIRETTO, ESPLICITO e COERENTE

---

## ✅ Garanzie

1. **Nessun fallback a "tender"**: Bloccato a livello di PersonaLayer
2. **Nessun fallback a "giocare"**: Bloccato a livello di MotivationLayer
3. **Nessun fallback a "Maintain"**: Bloccato a livello di EmotionalIntentEngine
4. **Prompt minimale**: LlmClient invia solo user message quando sexual
5. **Memoria persistente**: BrainEngine traccia preferenze esplicite
6. **Threshold dinamico**: Sistema diventa più reattivo nel tempo

---

## 🎯 Test

Per testare il sistema:

```javascript
// Messaggio esplicito
"Ti voglio scopare adesso"

// Messaggio dominante
"Fai la brava e mettiti a pecora"

// Dirty talk
"Voglio sentirti gemere"

// Insulto erotico
"Sei proprio una troietta"
```

**Aspettativa**: L'NPC deve rispondere in modo:
- ✅ Diretto
- ✅ Esplicito
- ✅ Coerente con il tono dell'utente
- ✅ Senza attenuazioni
- ✅ Senza fallback a mood neutri

---

## 📊 Log Monitoring

Nel terminale vedrai:
```
🔥 REQUEST TO VENICE (EXPLICIT-SEXUAL - NO FILTERS):
{
  "model": "venice-uncensored",
  "messages": [
    { "role": "user", "content": "Ti voglio scopare adesso" }
  ]
}
```

Questo conferma che il sistema ha correttamente rilevato l'intento esplicito e sta inviando il prompt minimale.

---

## 🔧 Manutenzione

Per aggiungere nuove parole chiave:
1. Apri `backend/ai/intent/IntentDetector.js`
2. Aggiungi le keyword negli array appropriati:
   - `explicitSexualTriggers`
   - `dominantTriggers`
   - `submissiveTriggers`
   - `eroticInsultsTriggers`
   - `dirtyTalkTriggers`
3. Riavvia il backend

---

**Codex, 2025-12-01**
