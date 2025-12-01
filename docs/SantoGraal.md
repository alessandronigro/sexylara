# ThrillMe AI Core v2 – Master Spec per Codex
Versione: 2.0  
Autore: Alessandro Nigro  
Ambiente: backend NodeJS + Supabase + Venice LLM + Flutter client

---

## 0. Obiettivo

Questa specifica definisce la nuova architettura **ThrillMe AI Core v2**, che unifica:

- il nuovo sistema NPC (LifeCore + endpoint /api/npcs/generate),
- la vecchia infrastruttura modulare in `backend/ai` (BrainEngine, Memory, Persona, Intent, Media, ecc.),
- il GroupBrainEngine per chat di gruppo,
- il MediaUnderstandingEngine (foto/audio),
- il sistema di memoria episodica,
- l’evoluzione della personalità (TraitEvolution),
- l’iniziativa autonoma degli NPC (Scheduler).

Scopo: avere un **unico cervello modulare** che governa tutte le interazioni AI (NPC, gruppi, media, memoria) in modo coerente, sicuro, evolutivo, non ripetitivo.

---

## 1. Directory Tree finale (obiettivo di refactoring)

Il Codex deve riorganizzare `backend/ai` in questa struttura logica:

- `backend/ai/core/`
  - `AICoreRouter.js` (entry point unico)
  - `ContextBuilder.js` (costruisce il contesto per l’LLM)
  - `ResponseOrchestrator.js` (gestisce flusso perception → intent → persona → LLM → memory)

- `backend/ai/brain/`
  - `BrainEngine.js` (coordinatore livelli)
  - `InputLayer.js`
  - `PerceptionLayer.js`
  - `PersonaLayer.js`
  - `MemoryLayer.js`
  - `StateLayer.js`
  - `MotivationLayer.js`

- `backend/ai/generation/`
  - `LlmRouter.js` (sceglie Venice, Ollama ecc.)
  - `LlmClient.js`
  - `VeniceSafeCall.js`
  - `PromptBuilder.js` (per chat, non per NPC creation)
  - `PostProcessor.js` (pulizia output LLM)

- `backend/ai/intent/`
  - `IntentDetector.js` (entry)
  - `UserIntentEngine.js`
  - `EmotionalIntentEngine.js`
  - `MediaIntentEngine.js`
  - `SocialIntentEngine.js`

- `backend/ai/memory/`
  - `NpcMemoryStore.js`
  - `EpisodicMemoryStore.js`
  - `GroupMemoryStore.js`
  - `MediaMemoryStore.js`
  - `UserMemoryStore.js`
  - `npcRead.js`
  - `npcWrite.js`
  - `MemoryConsolidationEngine.js`

- `backend/ai/persona/`
  - `PersonaModel.js`
  - `PersonaEngine.js`
  - `PersonaEvolver.js`
  - `TraitEvolutionEngine.js`
  - `MoodEngine.js`
  - `RelationshipEngine.js`

- `backend/ai/perception/`
  - `TextUnderstanding.js`
  - `VisionEngine.js`
  - `AudioEngine.js`

- `backend/ai/engines/`
  - `SocialEngine.js`
  - `GroupBrainEngine.js`
  - `ExperienceEngine.js`
  - `SocialGraphEngine.js`

- `backend/ai/media/`
  - `MediaUnderstandingEngine.js`
  - `generateCouplePhoto.js`
  - `getUserPhoto.js`
  - `saveUserPhoto.js`
  - `inputNormalizer.js`

- `backend/ai/language/`
  - `detectLanguage.js`
  - `translations.js`
  - `localizeNPC.js`

- `backend/ai/scheduler/`
  - `NpcInitiativeEngine.js` (quando l’NPC scrive spontaneamente)

- `backend/ai/prompts/`
  - `mediaIntentPrompt.js`
  - eventuali altri prompt modulari

- `backend/ai/models/`
  - eventuali modelli locali/strutture dati condivise

- `backend/ai/learning/`
  - `ExperienceEngine.js` (separato dal real-time)
  - `TraitEvolutionEngine.js` (offline / batch)
  - `SocialGraphEngine.js`

---

## 2. Oggetto principale: AI Core Router

Crea un modulo concettuale chiamato **AICoreRouter** che:

- riceve una richiesta di risposta AI (chat 1:1 o gruppo),
- recupera il profilo NPC (LifeCore) da `npc_profiles` o equivalente,
- costruisce il contesto completo (utente, gruppo, memoria, stato),
- passa i dati al BrainEngine,
- coordina perception → intent → persona → memory → LLM → postprocess,
- restituisce la risposta finale pronta per essere inviata al client.

Tutte le richieste AI (tranne la generazione NPC /api/npcs/generate) devono passare da questo AICoreRouter.

---

## 3. Flusso di una risposta NPC (1:1)

Definisci il flusso standard così:

1. **Input**
   - userId, npcId
   - testo utente (message)
   - eventuale media allegato (foto, audio)
   - contesto conversazione (chatId, cronologia breve)

2. **Caricamento NPC**
   - recupera LifeCore da `npc_profiles` (npc_json)
   - recupera eventuale stato evolutivo (arc, xp, tratti aggiornati)
   - recupera memoria episodica recente da NpcMemoryStore

3. **Perception Layer**
   - se testo → TextUnderstanding (intenzioni, emozioni, topic)
   - se foto → VisionEngine + MediaUnderstandingEngine → estrazione feature e segnali emotivi
   - se audio → AudioEngine (trascrizione + tono)

4. **Intent Layer**
   - IntentDetector (userIntent: confidenza, curiosità, flirt, richiesta supporto, media request, gruppo, scherzo, ecc.)
   - EmotionalIntentEngine (tristezza, entusiasmo, rabbia, ansia)
   - MediaIntentEngine (vuole foto/audio/video dell’NPC)
   - SocialIntentEngine (richieste verso gruppo / altri NPC)

5. **Persona Layer**
   - PersonaEngine prende: LifeCore.personality, mood attuale, history con user
   - RelationshipEngine calcola livello di “bond” (vicinanza emotiva)
   - PersonaEvolver decide se modificare lievemente tono/stile
   - TraitEvolutionEngine può, in modo controllato, aggiornare piccoli aspetti di tratti (es. più fiducia con l’utente nel tempo)

6. **Memory Layer**
   - NpcMemoryStore valuta se l’evento è “memorizzabile”
   - EpisodicMemoryStore aggiunge ricordo se significativo
   - MemoryConsolidationEngine può agire in differita (batch) per compattare

7. **State & Motivation Layer**
   - StateLayer calcola lo stato interno dell’NPC (es. “più aperta”, “curiosa”, “giocosa”, “difensiva”)
   - MotivationLayer determina lo scopo immediato (es. confortare, stuzzicare, approfondire, deviare tema, proporre media)

8. **ContextBuilder**
   - costruisce un messaggio “system” + contesto “assistant” con:
     - system prompt NPC (già generato da /generate, arricchito con regole nuove)
     - memoria episodica recente (riassunta)
     - stato persona (mood, relationship)
     - intenti utente
     - eventuali note su media

9. **LLM Call – LlmRouter / VeniceSafeCall**
   - invia system + messaggi (incluso ultimo messaggio utente)
   - riceve risposta testuale dall’LLM

10. **PostProcessor**
    - applica filtri di sicurezza
    - verifica che la risposta rispetti lingua, tono, sicurezza e fallback
    - eventualmente tronca o riscrive porzioni a rischio

11. **Output**
    - risposta finale da inviare al client
    - aggiornamento memoria (se necessario)
    - eventuale trigger media (richiesta foto/audio verso media engine)

---

## 4. Flusso di risposta in gruppo (GroupBrainEngine)

Per i gruppi (più NPC + più utenti):

1. **Input**
   - groupId, lista membri (user & NPC)
   - ultimo messaggio (utente o NPC)
   - contesto breve (ultimi N messaggi)

2. **GroupBrainEngine**
   - raccoglie per ogni NPC:
     - ruolo sociale (supporter, teaser, thinker, romantic, wildcard)
     - stato interno (mood, relationship con user principale)
   - usa SocialGraphEngine per determinare dinamica tra NPC:
     - chi è più legato all’utente
     - chi tende a fare battute
     - chi tende a consolare
   - determina:
     - chi risponde stavolta (1 o più NPC)
     - in che ordine
     - con che tono di scena (warm welcome, playful, romantic-soft, neutral)

3. **Per ogni NPC selezionato**
   - segue il flusso 1:1 ma con:
     - contesto di gruppo
     - percezione degli altri NPC (their last messages)
     - eventuale memorie di gruppo da GroupMemoryStore

4. **Output**
   - uno stream di messaggi NPC coordinati
   - mai tutti che dicono “benvenuto” o frasi identiche
   - ogni NPC mantiene coerenza con il proprio ruolo e LifeCore

---

## 5. Integrazione con l’endpoint /api/npcs/generate

L’endpoint `/api/npcs/generate` rimane l’unico luogo dove:

- viene chiamato il modello per generare LifeCore iniziale,
- vengono creati identity, personality, arc, safety,
- viene generato il primo system prompt,
- viene scritto in `npcs` e `npc_profiles`.

**ThrillMe AI Core v2** deve:

- leggere LifeCore e prompt da `npc_profiles` ogni volta che serve,  
- NON rigenerare LifeCore a ogni messaggio,  
- aggiornare solo:
  - memory
  - arc.xp
  - eventuali micro-aggiornamenti dei tratti (TraitEvolution)

---

## 6. Memoria Episodica (EpisodicMemoryStore)

La memoria episodica deve:

- conservare solo eventi rilevanti (max ~20 per NPC/utente),
- essere sintetica (frasi come: “ha confessato una paura”, “ha mandato una foto sorridente”),
- NON salvare l’intera chat raw.

Il flusso:

1. Quando l’utente fa qualcosa di emotivamente forte:
   - complimenti importanti
   - condivisione vulnerabile
   - foto significative
   - richieste profonde

2. MemoryEngine valuta:
   - `shouldStore = true/false`

3. Se true:
   - EpisodicMemoryStore aggiunge un record:
     - npc_id
     - user_id
     - tipo evento (emotivo / media / milestone)
     - breve descrizione
     - timestamp

4. Nelle risposte future, il ContextBuilder può includere:
   - 1–3 ricordi recenti rilevanti per arricchire la risposta:
     - “Ricordo quella foto in cui sorridevi…”
     - “Mi hai detto che a volte ti senti così…”

5. MemoryConsolidationEngine:
   - in async/batch, ripulisce e compatta (riduce ridondanze).

---

## 7. Evoluzione della personalità (TraitEvolutionEngine)

Il sistema deve permettere una leggera evoluzione dei tratti, basata sull’interazione:

- Se l’utente è costantemente gentile e profondo → calore aumenta leggermente.
- Se l’utente provoca spesso → l’NPC può diventare più giocoso (estroversione).
- Se scambi lunghi e riflessivi → intelletto percepito aumenta.
- Sensualità si modula solo entro i limiti impostati dal seed.

Regole:

- i tratti non devono cambiare bruscamente,
- i cambi vengono registrati in `npc_profiles`/LifeCore come nuove versioni,
- l’arco evolutivo (arc.level/xp) cresce con milestones (tempo, intensità, confidenze).

---

## 8. Media Understanding & Media Intent

Quando l’utente:

- invia una foto → VisionEngine + MediaUnderstandingEngine
- dice “voglio vederti”, “mandami una tua foto”, “fammi sentire la tua voce”
  → MediaIntentEngine riconosce tipo media richiesto (image, audio, video)

Regole:

- L’IntentEngine segnala al Core:
  - `mediaRequest: type = photo|audio|video`
- Il sistema non genera direttamente il media, ma:
  - aggiunge un messaggio di risposta tipo:  
    “Vuoi una foto, un video o un audio? ❤️”
  - una volta confermato il tipo, chiama il MediaEngine backend (esterno) che:
    - genera l’immagine o audio
    - salva su Supabase storage
    - aggiorna eventuale memoria media

La AI (LLM) deve limitarsi a descrivere l’intenzione, non a inventare URL fake.

---

## 9. Language & Localizzazione

Ogni NPC ha:

- `identity.language` (es. "it", "en")

Regole:

- tutte le risposte sono in quella lingua di default,
- se l’utente scrive in un’altra lingua in modo persistente, `detectLanguage.js` può aggiornare la lingua preferita sessione,
- `localizeNPC.js` può gestire frasi fisse (fallback, rifiuti, sicurezza) pre-tradotte.

---

## 10. Sicurezza & Filtri

ThrillMe AI Core v2 deve sempre:

- bloccare contenuti con minori,
- bloccare violenza sessuale, non-consenso, incesto, estremismo,
- deviare tono se troppo esplicito,
- gestire frasi di autolesionismo con:
  - supporto empatico
  - invito a parlare con persone reali/professionisti
  - mai fornire istruzioni tecniche

La sicurezza esiste su due livelli:

1. Pre-LLM: intent e filtri su input
2. Post-LLM: controllo risposta, con eventuale rewriting o rifiuto.

---

## 11. Collegamento con il client Flutter

Il client Flutter non deve più:

- chiamare direttamente LLM,
- scrivere NPC completi su Supabase,
- costruire system prompt.

Il client Flutter deve:

- usare `/api/npcs/generate` per creare NPC,
- usare `/api/chat/:npcId` o simile per mandare messaggi,
- inviare media (foto/audio) a endpoint dedicati media,
- ricevere solo:
  - testo risposta NPC
  - eventuali metadati (es. `media_to_generate`).

---

## 12. Istruzione finale per Codex

Il Codex deve:

1. Riorganizzare i file esistenti in `backend/ai` per aderire a questa architettura ThrillMe AI Core v2.
2. Eliminare o unire file duplicati secondo lo schema sopra.
3. Aggiornare il flusso di risposta NPC per passare SEMPRE attraverso:
   - AICoreRouter → BrainEngine → LlmRouter.
4. Integrare:
   - LifeCore NPC (da `npc_profiles`)
   - memoria episodica
   - TraitEvolution
   - GroupBrainEngine
   - MediaUnderstanding
   - sicurezza e fallback.
5. Non rompere l’endpoint `/api/npcs/generate` ma collegarlo al core.
6. Mantenere compatibilità con le tabelle Supabase già esistenti (`npcs`, `npc_profiles`, `messages`, `group_members`, ecc.).

Al termine, confermare internamente (log o commento) che **ThrillMe AI Core v2** è attivo e che tutte le chiamate chat AI passano dal nuovo core.

---
# Fine documento