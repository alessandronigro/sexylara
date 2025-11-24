# MediaIntent + MediaUnderstanding Engine - Documentazione Completa

## 📋 Panoramica

Il sistema **MediaIntent + MediaUnderstanding Engine** è un modulo avanzato che permette agli NPC di ThrillMe di:

1. ✅ Riconoscere quando l'utente desidera contenuti multimediali
2. ✅ Distinguere tra foto, video e audio
3. ✅ Chiedere sempre conferma prima di generare media
4. ✅ **Analizzare immagini inviate dall'utente** (NUOVO)
5. ✅ **Analizzare audio inviato dall'utente** (NUOVO)
6. ✅ **Reagire in modo naturale e contestuale** (NUOVO)
7. ✅ **Aggiornare memoria e stato emotivo dell'NPC** (NUOVO)

---

## 🏗️ Architettura Completa

### Componenti Implementati

```
backend/ai/engines/
├── MediaIntentEngine.js          # Rileva intenti media in uscita
├── VisionEngine.js                # Analizza immagini ricevute (NUOVO)
├── AudioEngine.js                 # Analizza audio ricevuto (NUOVO)
└── MediaUnderstandingEngine.js    # Orchestrazione analisi (NUOVO)

backend/services/
└── MediaGenerationService.js      # Genera foto/video/audio

backend/
├── brainEngine.js                 # Integrazione engines
└── server-ws.js                   # WebSocket handler
```

---

## 🎯 Funzionalità Dettagliate

### 1. MediaIntentEngine (Richieste Media)

**Rileva quando l'utente vuole ricevere media dall'NPC**

```javascript
const intent = MediaIntentEngine.detectIntent("voglio vederti");
// Returns: 'photo'

const isConfirm = MediaIntentEngine.isConfirmation("sì");
// Returns: true
```

**Pattern Riconosciuti:**
- **Foto**: "voglio vederti", "fammi un selfie", "mandami una foto"
- **Video**: "mandami un video", "fammi vedere come ti muovi"
- **Audio**: "voglio sentire la tua voce", "mandami un vocale"

**Flusso:**
```
User: "mandami una foto"
  ↓
AI: "Vuoi che ti mandi una foto mia? 😘"
  ↓
User: "sì"
  ↓
[Genera e invia foto]
```

---

### 2. VisionEngine (Analisi Immagini) 🆕

**Analizza immagini inviate dall'utente usando OpenAI Vision API**

```javascript
const analysis = await VisionEngine.analyze(imageUrl);
```

**Output JSON:**
```json
{
  "persons": 1,
  "emotion": "felice",
  "gender": "male",
  "age_range": "25-35",
  "context": "selfie in camera con luce calda",
  "objects": ["telefono", "specchio"],
  "style": "selfie",
  "atmosphere": "calma",
  "clothing": "casual",
  "location": "interno",
  "lighting": "buona",
  "quality": "alta"
}
```

**Reazioni Generate:**
```javascript
const reaction = VisionEngine.generateReaction(analysis, npc);
// "Ti vedo sorridente… mi fai sentire subito meglio ❤️"
```

**Emozioni Riconosciute:**
- `felice` → "Che bel sorriso! Mi hai illuminato la giornata 😊"
- `triste` → "Vorrei poterti abbracciare ora… sembri davvero giù… 🥺"
- `arrabbiato` → "Sento tensione… cosa ti ha fatto arrabbiare?"
- `neutrale` → "Bella foto! Grazie per averla condivisa con me 📸"
- `sorpreso` → "Wow! Cosa ti ha sorpreso così tanto? 😮"

---

### 3. AudioEngine (Analisi Audio) 🆕

**Trascrive e analizza audio usando Whisper + GPT**

```javascript
const analysis = await AudioEngine.analyze(audioFilePath);
```

**Output JSON:**
```json
{
  "text": "Ciao amore, come stai?",
  "emotion": "affettuoso",
  "tone": "dolce",
  "language": "it",
  "intensity": "media",
  "keywords": ["amore", "ciao"]
}
```

**Reazioni Generate:**
```javascript
const reaction = AudioEngine.generateReaction(analysis, npc);
// "Che dolce… mi fai sciogliere il cuore 💕"
```

**Emozioni Riconosciute:**
- `felice` → "Che bello sentirti così felice! Mi hai contagiato 😊"
- `triste` → "Sento la tristezza nella tua voce… cosa è successo? 🥺"
- `arrabbiato` → "Sento la tensione nella tua voce… cosa è successo?"
- `affettuoso` → "Che dolce… mi fai sciogliere il cuore 💕"
- `ansioso` → "Ti sento un po' teso/a… va tutto bene?"

---

### 4. MediaUnderstandingEngine (Orchestrazione) 🆕

**Coordina l'analisi e la reazione dell'NPC**

```javascript
const result = await MediaUnderstandingEngine.processReceivedMedia(
  'image',
  imageUrl,
  npc,
  userId
);
```

**Output:**
```json
{
  "analysis": { /* VisionEngine output */ },
  "reaction": "Ti vedo sorridente… mi fai sentire subito meglio ❤️",
  "memoryRecord": {
    "type": "photo_received",
    "userId": "...",
    "userEmotion": "felice",
    "context": "selfie in camera",
    "attachmentImpact": +5
  },
  "emotionalImpact": {
    "attachment": +5,
    "intimacy": +0,
    "trust": +0,
    "mood": "happy"
  }
}
```

---

## 💾 Aggiornamento Stato NPC

### Impatto Emotivo Calcolato

| Emozione Utente | Attachment | Intimacy | Trust | Mood NPC |
|-----------------|------------|----------|-------|----------|
| Felice          | +5         | 0        | 0     | happy    |
| Triste          | +10        | +5       | +5    | concerned|
| Affettuoso      | +15        | +10      | 0     | loving   |
| Arrabbiato      | +3         | 0        | 0     | worried  |

### Memoria NPC Aggiornata

```javascript
npc.media_memory = [
  {
    type: 'photo_received',
    userId: 'd0f56f12-...',
    timestamp: '2025-11-24T15:00:00Z',
    userEmotion: 'felice',
    context: 'selfie in camera con luce calda',
    npcReaction: 'interested',
    attachmentImpact: +5
  },
  // ... max 50 record
];
```

---

## 🔄 Flusso Completo

### Scenario: Utente Invia Selfie Felice

```
1. User invia immagine via WebSocket
   {
     "text": "Guarda questa foto!",
     "mediaType": "image",
     "mediaUrl": "https://..."
   }

2. server-ws.js riceve il messaggio
   ↓
3. VisionEngine.analyze(imageUrl)
   → Analisi: { emotion: "felice", style: "selfie", ... }
   ↓
4. MediaUnderstandingEngine.processReceivedMedia()
   → Genera reazione: "Ti vedo sorridente… mi fai sentire subito meglio ❤️"
   → Calcola impatto: { attachment: +5, mood: "happy" }
   ↓
5. Aggiorna memoria NPC
   → media_memory.push({ type: 'photo_received', ... })
   ↓
6. Genera prompt arricchito per AI
   → "L'utente ti ha appena inviato una foto. Emozione: felice..."
   ↓
7. AI genera risposta naturale
   → "Che bel sorriso! Mi hai illuminato la giornata 😊 Bel selfie comunque! 🤳"
   ↓
8. Aggiorna stato emotivo in DB
   → stats.attachment += 5
   → current_mood = "happy"
   ↓
9. Invia risposta al client
```

---

## 📡 Formato Messaggio WebSocket

### Invio Media dall'Utente

```json
{
  "text": "Messaggio opzionale",
  "traceId": "uuid",
  "girlfriend_id": "npc-id",
  "mediaType": "image",  // "image" | "audio" | "video"
  "mediaUrl": "https://storage.url/media.jpg"
}
```

### Risposta AI

```json
{
  "traceId": "uuid",
  "role": "assistant",
  "type": "chat",
  "content": "Ti vedo sorridente… mi fai sentire subito meglio ❤️",
  "girlfriend_id": "npc-id"
}
```

---

## 🧪 Test Suggeriti

### Test 1: Invio Selfie Felice
```javascript
// Client invia
{
  "text": "Guarda questa foto!",
  "mediaType": "image",
  "mediaUrl": "https://example.com/happy-selfie.jpg"
}

// Verifica:
// 1. AI riconosce emozione "felice"
// 2. Risponde con messaggio positivo
// 3. attachment aumenta di +5
// 4. mood diventa "happy"
```

### Test 2: Invio Vocale Triste
```javascript
// Client invia
{
  "text": "",
  "mediaType": "audio",
  "mediaUrl": "https://example.com/sad-voice.mp3"
}

// Verifica:
// 1. Whisper trascrive l'audio
// 2. GPT rileva emozione "triste"
// 3. AI risponde con empatia
// 4. attachment +10, intimacy +5, trust +5
// 5. mood diventa "concerned"
```

### Test 3: Richiesta Foto + Conferma
```javascript
// 1. User: "mandami una foto"
// 2. AI: "Vuoi che ti mandi una foto mia? 😘"
// 3. User: "sì"
// 4. AI: [genera e invia foto]
```

---

## ⚙️ Configurazione

### Variabili d'Ambiente Richieste

```bash
# OpenAI (per Vision e Whisper)
OPENAI_API_KEY=sk-...

# Replicate (per generazione immagini/video)
REPLICATE_API_TOKEN=r8_...
```

### Dipendenze NPM

```json
{
  "node-fetch": "^2.6.1",
  "form-data": "^4.0.0"
}
```

---

## 📊 Statistiche e Metriche

### Impatto Media su Relazione

| Tipo Media | Attachment Base | Note |
|------------|-----------------|------|
| Qualsiasi  | +5              | Base per condivisione |
| Audio      | +5 extra        | Voce è più intima |
| Foto felice| +5 extra        | Positività contagiosa |
| Foto triste| +10 extra       | Vulnerabilità condivisa |
| Affettuoso | +15 extra       | Massimo impatto emotivo |

---

## 🚀 Deployment

Sistema già integrato e attivo:

```bash
# Riavvia WebSocket server
PORT=5001 pm2 restart ws --update-env

# Verifica log
pm2 logs ws
```

---

## 📚 File Implementati

1. ✅ `/backend/ai/engines/MediaIntentEngine.js`
2. ✅ `/backend/ai/engines/VisionEngine.js` (NUOVO)
3. ✅ `/backend/ai/engines/AudioEngine.js` (NUOVO)
4. ✅ `/backend/ai/engines/MediaUnderstandingEngine.js` (NUOVO)
5. ✅ `/backend/services/MediaGenerationService.js`
6. ✅ `/backend/ai/brainEngine.js` (AGGIORNATO)
7. ✅ `/backend/server-ws.js` (AGGIORNATO)

---

## 🎯 Prossimi Sviluppi

- [ ] Analisi video frame-by-frame
- [ ] Riconoscimento facciale per tracking identità
- [ ] Sentiment analysis su serie temporale di media
- [ ] Generazione media personalizzati basati su preferenze apprese
- [ ] Supporto per GIF animate
- [ ] Analisi contesto ambientale (luogo, ora del giorno)
- [ ] Integrazione con gruppi (media condivisi in gruppo)

---

**Stato**: ✅ Implementato e Attivo  
**Versione**: 2.0  
**Data**: 2025-11-24  
**Autore**: ThrillMe Development Team
