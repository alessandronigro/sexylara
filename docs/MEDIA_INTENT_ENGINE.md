# MediaIntent Engine - Documentazione Implementazione

## 📋 Panoramica
Il **MediaIntent Engine** è un modulo avanzato che permette agli NPC di ThrillMe di:
- Riconoscere quando l'utente desidera contenuti multimediali (foto, video, audio)
- Chiedere conferma prima di generare media
- Generare il media corretto dopo conferma
- Aggiornare memoria e stato emotivo dell'NPC
- Funzionare sia in chat privata che nei gruppi

## 🏗️ Architettura

### Componenti Implementati

1. **MediaIntentEngine.js** (`backend/ai/engines/`)
   - Rileva intenti multimediali tramite pattern matching
   - Verifica conferme utente
   - Genera messaggi di richiesta conferma
   - Controlla richieste in sospeso nella cronologia

2. **MediaGenerationService.js** (`backend/services/`)
   - Genera foto, video e audio per gli NPC
   - Costruisce prompt basati sulle caratteristiche dell'NPC
   - Genera caption personalizzate
   - Gestisce errori di generazione

3. **Integrazione in brainEngine.js**
   - Aggiunta detection media intent in `processInteraction()`
   - Gestione conferme e richieste in `generateIntelligentResponse()`
   - Return di flag `mediaRequested` per segnalare al server

4. **Integrazione in server-ws.js**
   - Import di `MediaGenerationService`
   - Gestione generazione media quando `mediaRequested === true`
   - Salvataggio media nel database
   - Invio media al client via WebSocket

## 🔄 Flusso di Interazione

### Scenario 1: Richiesta Foto
```
User: "Mandami una foto"
  ↓
MediaIntentEngine.detectIntent() → 'photo'
  ↓
AI: "Vuoi che ti mandi una foto mia? 😘"
  ↓
User: "sì"
  ↓
MediaIntentEngine.isConfirmation() → true
MediaIntentEngine.checkPendingConfirmation() → 'photo'
  ↓
brainEngine returns: { mediaRequested: true, type: 'photo' }
  ↓
MediaGenerationService.generatePhoto()
  ↓
AI: [invia foto + caption]
```

### Scenario 2: Richiesta Video
```
User: "Fammi vedere come ti muovi"
  ↓
MediaIntentEngine.detectIntent() → 'video'
  ↓
AI: "Vuoi proprio un video? Te lo preparo se mi dici di sì."
  ↓
User: "ok"
  ↓
MediaGenerationService.generateVideo()
  ↓
AI: [invia video + caption]
```

### Scenario 3: Richiesta Audio
```
User: "Voglio sentire la tua voce"
  ↓
MediaIntentEngine.detectIntent() → 'audio'
  ↓
AI: "Vuoi un vocale? Posso registrarlo per te."
  ↓
User: "manda pure"
  ↓
MediaGenerationService.generateAudio()
  ↓
AI: [invia audio + caption]
```

## 🎯 Pattern Riconosciuti

### Foto
- "voglio vederti"
- "fammi un selfie"
- "mandami una tua immagine"
- "posso avere una foto?"
- "vorrei vedere come sei"
- "mandami un tuo scatto"
- "selfie?"
- "mandami una foto"
- "fatti vedere"

### Video
- "mandami un video"
- "fammi un video"
- "fammi vedere come ti muovi"
- "voglio vedere un video tuo"
- "puoi farmi un video?"

### Audio
- "mandami un audio"
- "voglio sentire la tua voce"
- "puoi parlarmi?"
- "mi mandi un vocale?"
- "fammi sentire come suoni"
- "mandami un vocale"

### Conferme
- "sì" / "si"
- "ok"
- "va bene"
- "manda pure"
- "certo"
- "fallo"
- "sisi"

## 📊 Struttura Dati

### Response Object (da brainEngine)
```javascript
{
  output: string,           // Testo risposta
  type: 'chat'|'photo'|'video'|'audio',
  mediaRequested: boolean,  // true se l'utente ha confermato
  pendingMediaType: string, // Tipo media in attesa di conferma
  stateUpdates: Object      // Aggiornamenti stato NPC
}
```

### Media Result (da MediaGenerationService)
```javascript
{
  url: string,     // URL del media generato
  caption: string  // Caption personalizzata
}
```

## 🧪 Test Suggeriti

### Test 1: Richiesta e Conferma
1. Scrivi: "mandami una foto"
2. Verifica che l'AI chieda conferma
3. Rispondi: "sì"
4. Verifica che venga generata e inviata la foto

### Test 2: Richiesta e Rifiuto
1. Scrivi: "voglio un video"
2. Verifica che l'AI chieda conferma
3. Rispondi: "no" o cambia argomento
4. Verifica che NON venga generato il video

### Test 3: Richiesta Multipla
1. Scrivi: "mandami una foto"
2. Conferma: "ok"
3. Dopo ricezione, scrivi: "ora un audio"
4. Conferma: "sì"
5. Verifica che entrambi i media vengano generati correttamente

## 🔧 Configurazione

### Variabili d'Ambiente Richieste
Le stesse già configurate per i servizi di generazione:
- `REPLICATE_API_TOKEN` (per immagini/video)
- `OPENAI_API_KEY` (per audio TTS se implementato)

### Dipendenze
- `backend/routes/image.js` - Generazione immagini
- `backend/routes/video.js` - Generazione video
- `backend/routes/audio.js` - Generazione audio

## 📝 Note Implementative

### Memoria delle Richieste
Il sistema controlla l'ultimo messaggio dell'AI nella cronologia per verificare se c'era una richiesta di conferma in sospeso. Questo approccio:
- ✅ Funziona senza stato aggiuntivo
- ✅ È resiliente ai riavvii
- ⚠️ Assume che l'utente risponda alla richiesta più recente

### Gestione Errori
Se la generazione media fallisce:
1. L'errore viene loggato
2. L'utente riceve un messaggio di fallback
3. Il tipo viene cambiato a 'chat' per continuare la conversazione

### Estensibilità
Per aggiungere nuovi tipi di media:
1. Aggiungi pattern in `MediaIntentEngine.patterns`
2. Aggiungi metodo `generate[Type]()` in `MediaGenerationService`
3. Aggiungi case in `server-ws.js` media handling

## 🚀 Deployment

Il sistema è già integrato e attivo dopo il riavvio di PM2:
```bash
PORT=5001 pm2 restart ws --update-env
```

## 📚 File Modificati

1. ✅ `/backend/ai/engines/MediaIntentEngine.js` (NUOVO)
2. ✅ `/backend/services/MediaGenerationService.js` (NUOVO)
3. ✅ `/backend/ai/brainEngine.js` (MODIFICATO)
4. ✅ `/backend/server-ws.js` (MODIFICATO)

## 🎯 Prossimi Sviluppi

- [ ] Supporto per richieste media nei gruppi (con targeting NPC specifico)
- [ ] Personalizzazione prompt basata su mood/stato NPC
- [ ] Cache media generati per richieste simili
- [ ] Analytics su tipi di media più richiesti
- [ ] Limiti di rate per prevenire spam di richieste media

---

**Stato**: ✅ Implementato e Attivo  
**Versione**: 1.0  
**Data**: 2025-11-24
