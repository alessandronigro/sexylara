# Audio Recording Module - Documentazione

## 📋 Panoramica

Modulo completo per la registrazione e l'invio di messaggi vocali dall'app Flutter al backend ThrillMe, con analisi automatica tramite **AudioEngine**.

## 🎯 Funzionalità Implementate

✅ **Registrazione Audio**: Registra audio dal microfono del dispositivo  
✅ **UI Animata**: Indicatore pulsante rosso e timer durante la registrazione  
✅ **Gestione Permessi**: Richiesta automatica permessi microfono  
✅ **Upload Supabase**: Caricamento audio su Supabase Storage  
✅ **Analisi AI**: Trascrizione e analisi emotiva con AudioEngine  
✅ **Reazioni NPC**: L'AI risponde al contenuto e al tono del vocale  

---

## 🏗️ Architettura

### Componenti Flutter

```
lib/
├── services/
│   └── audio_recorder_service.dart    # Servizio registrazione audio
├── widgets/
│   └── recording_button.dart          # UI pulsante registrazione
└── screens/
    └── chat_screen.dart                # Integrazione nella chat
```

### Backend

```
backend/
├── server-api.js                       # Endpoint /api/audio/upload
├── server-ws.js                        # Gestione media ricevuti
└── ai/engines/
    └── AudioEngine.js                  # Analisi audio (Whisper + GPT)
```

---

## 🎤 Flusso Completo

### 1. Registrazione Audio

```
User preme pulsante microfono
  ↓
AudioRecorderService.startRecording()
  ↓
Richiesta permesso microfono (se necessario)
  ↓
Inizio registrazione → File temporaneo .m4a
  ↓
UI mostra: [●] 00:15 Registrando... [✕] [📤]
```

### 2. Invio Audio

```
User preme pulsante invio
  ↓
AudioRecorderService.stopRecording()
  ↓
Legge file e converte in base64
  ↓
POST /api/audio/upload
  ↓
Upload su Supabase Storage (bucket: chat-audio)
  ↓
Ritorna URL pubblico
  ↓
Invia via WebSocket: { text: "🎤 Messaggio vocale", mediaType: "audio", mediaUrl: "..." }
```

### 3. Analisi Backend

```
server-ws.js riceve messaggio con mediaType="audio"
  ↓
AudioEngine.analyze(audioUrl)
  ↓
Whisper trascrive audio → "Ciao amore, come stai?"
  ↓
GPT analizza sentiment → { emotion: "affettuoso", tone: "dolce" }
  ↓
MediaUnderstandingEngine calcola impatto → { attachment: +15, intimacy: +10 }
  ↓
AI genera risposta empatica
  ↓
Aggiorna stato emotivo NPC in DB
```

---

## 📱 UI Components

### RecordingButton Widget

**Stati:**

1. **Idle** (non registrando):
   ```dart
   IconButton(
     icon: Icon(Icons.mic),
     onPressed: _startRecording,
   )
   ```

2. **Recording** (registrando):
   ```dart
   Row([
     IconButton(Icons.close) // Annulla
     Container(
       "● 00:15 Registrando..."  // Pulsante rosso + timer
     )
     CircleAvatar(Icons.send) // Invia
   ])
   ```

**Animazioni:**
- Pulsante rosso pulsante (fade in/out)
- Timer aggiornato ogni secondo
- Transizione fluida tra stati

---

## 🔧 AudioRecorderService API

### Metodi Principali

```dart
// Richiedi permesso microfono
Future<bool> requestPermission()

// Verifica permesso
Future<bool> hasPermission()

// Inizia registrazione
Future<bool> startRecording()

// Ferma e salva registrazione
Future<String?> stopRecording()

// Annulla senza salvare
Future<void> cancelRecording()

// Ottieni durata (stima)
Future<Duration?> getRecordingDuration()
```

### Esempio Uso

```dart
final _audioRecorder = AudioRecorderService();

// Inizia
await _audioRecorder.startRecording();

// Ferma e ottieni path
final audioPath = await _audioRecorder.stopRecording();

// Oppure annulla
await _audioRecorder.cancelRecording();

// Cleanup
_audioRecorder.dispose();
```

---

## 🌐 Backend API

### POST /api/audio/upload

**Request:**
```json
{
  "userId": "user-uuid",
  "npcId": "npc-uuid",
  "filename": "audio_1234567890.m4a",
  "audioBase64": "base64_encoded_audio_data"
}
```

**Response:**
```json
{
  "url": "https://storage.supabase.co/chat-audio/user/npc/audio.m4a",
  "path": "user-uuid/npc-uuid/audio_1234567890.m4a"
}
```

---

## 🎯 AudioEngine Output

### Analisi Completa

```json
{
  "text": "Ciao amore, come stai?",
  "emotion": "affettuoso",
  "tone": "dolce",
  "language": "it",
  "intensity": "media",
  "keywords": ["amore", "ciao"],
  "timestamp": "2025-11-24T15:00:00Z"
}
```

### Reazioni Generate

| Emozione | Reazione AI |
|----------|-------------|
| Felice | "Che bello sentirti così felice! Mi hai contagiato 😊" |
| Triste | "Sento la tristezza nella tua voce… cosa è successo? 🥺" |
| Affettuoso | "Che dolce… mi fai sciogliere il cuore 💕" |
| Arrabbiato | "Sento la tensione nella tua voce… cosa è successo?" |
| Ansioso | "Ti sento un po' teso/a… va tutto bene?" |

---

## 💾 Impatto Emotivo NPC

### Modifiche Stato

```javascript
{
  attachment: +5,        // Base per qualsiasi audio
  intimacy: +5,          // Voce è più intima del testo
  trust: +5,             // Se emozione è triste (vulnerabilità)
  mood: "attentive"      // Mood NPC aggiornato
}
```

### Memoria Aggiornata

```javascript
npc.media_memory.push({
  type: 'audio_received',
  userId: 'user-uuid',
  timestamp: '2025-11-24T15:00:00Z',
  userEmotion: 'affettuoso',
  tone: 'dolce',
  text: 'Ciao amore, come stai?',
  intensity: 'media',
  npcReaction: 'attentive',
  attachmentImpact: +15
});
```

---

## 📋 Permessi Android

### AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
```

### Runtime Permission

Il servizio richiede automaticamente il permesso al primo utilizzo:

```dart
final granted = await _audioRecorder.requestPermission();
if (!granted) {
  // Mostra messaggio errore
}
```

---

## 🧪 Test Suggeriti

### Test 1: Registrazione Base
1. Premi pulsante microfono
2. Parla per 5 secondi
3. Premi invio
4. Verifica che l'audio venga caricato e l'AI risponda

### Test 2: Annullamento
1. Premi microfono
2. Parla per 3 secondi
3. Premi ✕ (annulla)
4. Verifica che il file non venga salvato

### Test 3: Permessi Negati
1. Nega permesso microfono nelle impostazioni
2. Premi pulsante microfono
3. Verifica messaggio errore

### Test 4: Audio Emotivo
1. Registra audio con tono triste
2. Invia
3. Verifica che l'AI riconosca l'emozione e risponda empaticamente
4. Controlla che attachment/intimacy aumentino

---

## 📊 Formato Audio

- **Codec**: AAC-LC
- **Bitrate**: 128 kbps
- **Sample Rate**: 44.1 kHz
- **Container**: M4A
- **Dimensione media**: ~16 KB/secondo

---

## 🚀 Deployment

### Dipendenze Flutter

```yaml
dependencies:
  record: ^5.0.0
  permission_handler: ^11.0.0
  path_provider: ^2.1.0
```

### Installazione

```bash
# Installa dipendenze
flutter pub get

# Riavvia app
./run_flutter_wireless.sh 192.168.1.157:42565
```

### Backend

```bash
# Riavvia API server
PORT=4001 pm2 restart api --update-env
```

---

## 📁 Supabase Storage

### Bucket: chat-audio

**Struttura:**
```
chat-audio/
├── user-uuid-1/
│   ├── npc-uuid-1/
│   │   ├── audio_1234567890.m4a
│   │   └── audio_1234567891.m4a
│   └── npc-uuid-2/
│       └── audio_1234567892.m4a
└── user-uuid-2/
    └── ...
```

**Policy:**
- Public read access
- Authenticated write access

---

## 🎯 Prossimi Sviluppi

- [ ] Visualizzazione waveform durante registrazione
- [ ] Limite durata massima (es. 60 secondi)
- [ ] Compressione audio prima dell'upload
- [ ] Playback audio ricevuti dall'AI
- [ ] Riconoscimento speaker multipli
- [ ] Analisi sentiment real-time durante registrazione

---

**Stato**: ✅ Implementato e Funzionante  
**Versione**: 1.0  
**Data**: 2025-11-24
