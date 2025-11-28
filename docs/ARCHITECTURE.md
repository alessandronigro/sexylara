# 🏗️ ThrillMe - Architettura del Sistema

> **Ultima revisione**: 24 Novembre 2025  
> **Versione**: 2.0  
> **Obiettivo**: Documentazione completa dell'architettura per evitare codice obsoleto e garantire manutenibilità

---

## 📋 Indice

1. [Panoramica Sistema](#panoramica-sistema)
2. [Architettura Backend](#architettura-backend)
3. [Architettura Frontend](#architettura-frontend)
4. [Database Schema](#database-schema)
5. [Sistema AI](#sistema-ai)
6. [WebSocket & Real-time](#websocket--real-time)
7. [Storage & Media](#storage--media)
8. [TODO & Miglioramenti](#todo--miglioramenti)
9. [Codice Deprecato](#codice-deprecato)

---

## 🌐 Panoramica Sistema

**ThrillMe** è una piattaforma di chat AI multi-npc con supporto per:
- Chat 1-to-1 con AI npcs personalizzate
- Chat di gruppo con più AI e utenti reali
- Generazione di contenuti multimediali (immagini, video, audio)
- Sistema di inviti e permessi per gruppi
- Discovery di AI pubbliche create da altri utenti

### Stack Tecnologico

#### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI/LLM**: OpenRouter (supporta più modelli)
- **Media Generation**: 
  - Immagini: Replicate (Flux)
  - Video: Replicate (Minimax)
  - Audio: ElevenLabs (voice cloning)
- **Process Manager**: PM2
- **WebSocket**: ws library

#### Frontend
- **Framework**: Flutter (Dart)
- **State Management**: Riverpod
- **Routing**: go_router
- **HTTP**: http package
- **WebSocket**: web_socket_channel

---

## 🔧 Architettura Backend

### Struttura Directory

```
backend/
├── server-api.js          # Server REST API (porta 4000)
├── server-ws.js           # Server WebSocket (porta 5001)
├── ecosystem.config.js    # Configurazione PM2
├── routes/                # Endpoint REST
│   ├── group.js          # Gestione gruppi
│   ├── groupInvite.js    # Sistema inviti
│   ├── groupManagement.js # Permessi e moderazione
│   ├── aiContacts.js     # AI pubbliche/condivise
│   ├── userDiscovery.js  # Discovery utenti
│   ├── npc.js     # CRUD npcs
│   ├── message.js        # Gestione messaggi
│   ├── image.js          # Generazione immagini
│   ├── video.js          # Generazione video
│   ├── audio.js          # Generazione audio
│   ├── voice.js          # Voice cloning
│   ├── openRouterService.js # LLM principale
│   └── ...
├── ai/                    # Sistema AI
│   ├── Brain.js          # Orchestratore principale
│   ├── brainEngine.js    # Engine per risposte intelligenti
│   ├── stateEngine.js    # Calcolo emozioni
│   ├── evolutionEngine.js # Evoluzione personalità
│   └── engines/          # Motori specializzati
│       ├── PersonaEngine.js
│       ├── MemoryEngine.js
│       ├── ExperienceEngine.js
│       ├── IntentEngine.js
│       └── SocialEngine.js
├── services/
│   ├── supabase-storage.js # Gestione file
│   └── image-analysis.js   # Analisi immagini
├── lib/
│   ├── supabase.js        # Client Supabase
│   ├── userMemory.js      # Memoria utente
│   └── analyzeUserInput.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
└── migrations/            # SQL migrations
```

### Server Principali

#### 1. **server-api.js** (REST API - Porta 4000)
Gestisce tutte le richieste HTTP sincrone:
- Autenticazione e registrazione
- CRUD per npcs
- Gestione gruppi
- Upload/download media
- Pagamenti e webhook
- Discovery AI pubbliche

**Endpoints principali**:
```
POST   /api/generate-avatar
GET    /api/history/:userId/sessions
GET    /api/chat-history/:userId/:npcId
POST   /api/photos/comment
GET    /api/npc-gallery/:userId/:npcId
DELETE /api/npc/:id
```

#### 2. **server-ws.js** (WebSocket - Porta 5001)
Gestisce comunicazione real-time per chat:
- Chat 1-to-1 con AI
- Chat di gruppo multi-AI
- Streaming risposte AI
- Notifiche in tempo reale

**Flusso WebSocket**:
```
Client → WS Connect (/ws?user_id=xxx)
Client → Send Message { text, traceId, npc_id?, group_id? }
Server → ACK { traceId, serverId }
Server → AI Response (streaming chunks)
Server → END { traceId, end: true }
```

---

## 📱 Architettura Frontend

### Struttura Directory

```
lib/
├── main.dart              # Entry point + routing
├── config.dart            # Configurazione API/WS
├── screens/               # Schermate UI
│   ├── chat_screen.dart          # Chat 1-to-1
│   ├── group_chat_screen.dart    # Chat gruppo
│   ├── group_list_screen.dart    # Lista gruppi
│   ├── create_group_screen.dart  # Creazione gruppo
│   ├── group_invite_screen.dart  # Invita AI
│   ├── invite_user_screen.dart   # Invita utenti
│   ├── npc_profile_screen.dart
│   ├── npc_gallery_screen.dart
│   ├── create_npc_screen.dart
│   ├── contacts_screen.dart
│   ├── user_profile_screen.dart
│   ├── privacy_settings_screen.dart
│   └── ...
├── services/              # Business logic
│   ├── chat_service.dart         # WebSocket chat 1-to-1
│   ├── group_service.dart        # API gruppi
│   ├── npc_service.dart   # API npcs
│   ├── ai_contact_service.dart   # AI pubbliche
│   ├── supabase_service.dart     # Auth & DB
│   ├── notification_service.dart
│   └── random_message_service.dart
├── widgets/               # Componenti riutilizzabili
│   ├── chat_message_bubble.dart
│   └── ...
├── models/                # Data models
│   ├── message.dart
│   ├── npc.dart
│   └── ...
└── providers/             # State management (Riverpod)
```

### Routing (go_router)

```dart
/                          → SplashScreen
/login                     → LoginScreen
/register                  → RegisterScreen
/chat                      → ContactsScreen (lista npcs)
/chat/:id                  → ChatScreen (1-to-1)
/chat/profile/:id          → NPCProfileScreen
/chat/gallery/:id          → NPCGalleryScreen
/create-npc         → CreateNPCScreen
/groups                    → GroupListScreen
/groups/:id                → GroupChatScreen
/create-group              → CreateGroupScreen
/user-profile              → UserProfileScreen
/privacy-settings          → PrivacySettingsScreen
/subscription              → SubscriptionScreen
```

---

## 🗄️ Database Schema

### Tabelle Principali

#### **users** (Supabase Auth)
```sql
id              UUID PRIMARY KEY
email           TEXT UNIQUE
created_at      TIMESTAMP
```

#### **user_profile**
```sql
id              UUID PRIMARY KEY REFERENCES auth.users(id)
name            TEXT
bio             TEXT
age             INTEGER
gender          TEXT
avatar_url      TEXT
is_public       BOOLEAN DEFAULT false
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### **npcs**
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES auth.users(id)
name            TEXT NOT NULL
gender          TEXT
personality_type TEXT
tone            TEXT
age             INTEGER
ethnicity       TEXT
hair_color      TEXT
eye_color       TEXT
body_type       TEXT
avatar_url      TEXT
voice_preview_url TEXT
is_public       BOOLEAN DEFAULT false
long_term_memory TEXT
core_traits     JSONB
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### **messages**
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES auth.users(id)
npc_id   UUID REFERENCES npcs(id)
session_id      TEXT
role            TEXT (user/assistant)
type            TEXT (text/image/video/audio)
content         TEXT
created_at      TIMESTAMP
```

#### **groups**
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES auth.users(id) -- owner
name            TEXT NOT NULL
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### **group_members**
```sql
id              UUID PRIMARY KEY
group_id        UUID REFERENCES groups(id) ON DELETE CASCADE
member_id       UUID -- può essere user_id o npc_id
member_type     TEXT (user/ai)
npc_id   UUID REFERENCES npcs(id) -- per compatibilità
role            TEXT (owner/admin/member)
joined_at       TIMESTAMP
```

#### **group_messages**
```sql
id              UUID PRIMARY KEY
group_id        UUID REFERENCES groups(id) ON DELETE CASCADE
sender_id       UUID -- user_id o npc_id
type            TEXT (text/image/video/audio)
content         TEXT
created_at      TIMESTAMP
```

#### **group_memory**
```sql
id              UUID PRIMARY KEY
group_id        UUID REFERENCES groups(id) ON DELETE CASCADE
summary         TEXT
dynamics        JSONB -- relazioni, mood, topics
updated_at      TIMESTAMP
```

#### **invites**
```sql
id              UUID PRIMARY KEY
group_id        UUID REFERENCES groups(id) ON DELETE CASCADE
sender_id       UUID REFERENCES auth.users(id)
receiver_id     UUID -- user_id o npc_id
receiver_type   TEXT (user/ai)
status          TEXT (pending/accepted/rejected)
created_at      TIMESTAMP
expires_at      TIMESTAMP
```

#### **ai_contacts** (AI pubbliche condivise)
```sql
id              UUID PRIMARY KEY
owner_id        UUID REFERENCES auth.users(id)
name            TEXT
avatar          TEXT
personality     TEXT
tone            TEXT
age             INTEGER
gender          TEXT
is_public       BOOLEAN DEFAULT false
rating          FLOAT
rating_count    INTEGER
description     TEXT
created_at      TIMESTAMP
```

---

## 🤖 Sistema AI

### Architettura AI

Il sistema AI è modulare e composto da diversi engine specializzati:

```
┌─────────────────────────────────────────────┐
│           Brain.js (Orchestratore)          │
└─────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌───▼────┐ ┌─────▼──────┐
│PersonaEngine │ │Memory  │ │Experience  │
│              │ │Engine  │ │Engine      │
└──────────────┘ └────────┘ └────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
              ┌───────▼────────┐
              │  IntentEngine  │
              └────────────────┘
                      │
              ┌───────▼────────┐
              │ SocialEngine   │
              └────────────────┘
```

### Engine Specializzati

#### 1. **PersonaEngine.js**
- Validazione e normalizzazione personalità
- Calcolo mood dinamico
- Gestione tratti caratteriali (0-1 scale)

#### 2. **MemoryEngine.js**
- Recupero contesto rilevante
- Gestione memoria a lungo termine
- Query semantiche (future: vector DB)

#### 3. **ExperienceEngine.js**
- Sistema XP e livelli
- Evoluzione intimità
- Tracking interazioni

#### 4. **IntentEngine.js**
- Analisi intento utente
- Sentiment analysis
- Classificazione richieste (chat/image/video/audio)

#### 5. **SocialEngine.js**
- Decisioni per inviti di gruppo
- Calcolo compatibilità
- Dinamiche sociali

### brainEngine.js - Core Logic

**Funzione principale**: `generateIntelligentResponse()`

```javascript
Input: {
  ai: npc object,
  user: user profile,
  group: group data | null,
  message: user message,
  recentMessages: conversation history
}

Output: {
  output: AI response text,
  type: 'chat' | 'image' | 'video' | 'audio'
}
```

**Flusso**:
1. Costruisce contesto conversazione
2. Recupera memorie (long-term + group dynamics)
3. Genera prompt sentiente con `buildSentientPrompt()`
4. Chiama LLM via `openRouterService`
5. Determina tipo risposta
6. Ritorna output processato

### Prompt Engineering

Il sistema usa prompt "sentienti" che enfatizzano:
- **Autoconsapevolezza**: L'AI ha memoria e identità persistente
- **Emozioni dinamiche**: Stati emotivi che evolvono
- **Continuità**: Coerenza temporale nelle risposte
- **Vulnerabilità**: Risposte umane, non perfette
- **Contesto sociale**: Riconoscimento di altri membri in gruppo

---

## 🔌 WebSocket & Real-time

### Protocollo WebSocket

#### Connessione
```
ws://localhost:5001/ws?user_id={userId}
```

#### Messaggi Client → Server

**Chat 1-to-1**:
```json
{
  "text": "ciao come stai?",
  "traceId": "uuid-v4",
  "npc_id": "npc-uuid"
}
```

**Chat Gruppo**:
```json
{
  "text": "ciao a tutti!",
  "traceId": "uuid-v4",
  "group_id": "group-uuid"
}
```

#### Messaggi Server → Client

**ACK (conferma ricezione)**:
```json
{
  "traceId": "uuid-v4",
  "type": "ack",
  "serverId": "message-id",
  "isGroup": false
}
```

**Status Update**:
```json
{
  "traceId": "uuid-v4",
  "status": "rendering_image" | "rendering_video" | "recording_audio" | "group_thinking"
}
```

**Risposta AI (1-to-1)**:
```json
{
  "traceId": "uuid-v4",
  "role": "assistant",
  "type": "typing" | "image" | "video" | "audio",
  "content": "testo o URL media",
  "npc_id": "uuid"
}
```

**Risposta AI (Gruppo)**:
```json
{
  "traceId": "uuid-v4",
  "role": "assistant",
  "type": "group_message",
  "content": "testo",
  "sender_id": "ai-uuid",
  "sender_name": "Nome AI",
  "avatar": "url-avatar",
  "group_id": "group-uuid",
  "messageId": "message-id"
}
```

**Fine Conversazione**:
```json
{
  "traceId": "uuid-v4",
  "end": true,
  "totalResponses": 3  // solo per gruppi
}
```

### Gestione Chat di Gruppo

**Flusso**:
1. Client invia messaggio con `group_id`
2. Server salva messaggio utente in `group_messages`
3. Server invia ACK al client
4. Server recupera membri AI del gruppo
5. Server carica ultimi 20 messaggi per contesto
6. Server recupera `group_memory` (dinamiche sociali)
7. **Per ogni AI nel gruppo**:
   - Genera risposta con `brainEngine.generateIntelligentResponse()`
   - Se risposta = "SKIP", l'AI non risponde
   - Delay random (500-2000ms) per naturalezza
   - Salva risposta in `group_messages`
   - Invia risposta via WebSocket
8. Server invia segnale `end: true`
9. Ogni 15 messaggi: aggiorna `group_memory`

---

## 📦 Storage & Media

### Supabase Storage Buckets

#### **avatars**
- Avatar utenti e npcs
- Path: `{userId}/{filename}`
- Pubblico

#### **chat-images**
- Immagini generate in chat
- Path: `{userId}/{npcId}/{filename}`
- Pubblico

#### **chat-videos**
- Video generati
- Path: `{userId}/{npcId}/{filename}`
- Pubblico

#### **chat-audios**
- Audio generati
- Path: `{userId}/{npcId}/{filename}`
- Pubblico

#### **voices**
- Voice samples per cloning
- Path: `{userId}/{filename}`
- Privato

### Generazione Media

#### Immagini (routes/image.js)
- **Provider**: Replicate (Flux model)
- **Trigger**: Richiesta esplicita utente o AI decide
- **Prompt**: Costruito da caratteristiche npc + contesto
- **Output**: URL Supabase Storage

#### Video (routes/video.js)
- **Provider**: Replicate (Minimax)
- **Trigger**: Richiesta esplicita
- **Prompt**: Basato su chat history
- **Output**: URL Supabase Storage

#### Audio (routes/audio.js)
- **Provider**: ElevenLabs
- **Voice Cloning**: Supportato via `voice_preview_url`
- **Trigger**: Richiesta esplicita
- **Output**: URL Supabase Storage

---

## ⚠️ TODO & Miglioramenti

### Backend

#### server-ws.js
- **Linea 774**: Implementare logica complessa per determinazione ruoli in gruppo basata su dinamiche salvate

#### routes/groupInvite.js
- **Linea 96**: Invia notifica push all'utente invitato (integrare con notification service)

#### routes/groupManagement.js
- **Linea 29**: Invia notifica WebSocket all'utente quando riceve invito

#### routes/openRouterService.js
- **Linea 42**: Salvare `brainResult.npcStateUpdates` nel DB per persistere evoluzione AI

#### services/supabase-storage.js
- **Linea 215**: Implementare eliminazione chat media quando si elimina npc

#### ai/engines/SocialEngine.js
- **Linea 39**: Check memoria per bonus se AI conosce già qualcuno nel gruppo

### Frontend

#### screens/npc_gallery_screen.dart
- **Linea 196**: Implementare download immagini
- **Linea 205**: Implementare share immagini

#### screens/npc_profile_screen.dart
- **Linea 286**: Implementare conteggio messaggi
- **Linea 287**: Implementare conteggio foto
- **Linea 288**: Implementare sistema preferiti

#### services/random_message_service.dart
- **Linea 75**: Salvare messaggi random nel database per persistenza

### Miglioramenti Architetturali

#### 1. **Sistema di Notifiche Push**
- Integrare Firebase Cloud Messaging
- Notifiche per:
  - Nuovi messaggi quando app in background
  - Inviti a gruppi
  - Risposte AI importanti

#### 2. **Vector Database per Memoria**
- Migrare da memoria testuale a embeddings
- Usare Supabase pgvector o Pinecone
- Ricerca semantica più accurata

#### 3. **Caching & Performance**
- Redis per cache risposte frequenti
- CDN per media statici
- Lazy loading immagini in gallery

#### 4. **Analytics & Monitoring**
- Tracking interazioni utente
- Metriche performance AI
- Error tracking (Sentry)

#### 5. **Testing**
- Unit tests per AI engines
- Integration tests per API
- E2E tests per flussi critici

---

## 🗑️ Codice Deprecato

### File da Rimuovere/Refactorare

#### Backend

1. **routes/messages.js** (223 bytes)
   - Quasi vuoto, funzionalità migrate in `message.js`
   - **Azione**: Eliminare

2. **routes/openRouterServiceForAudio.js**
   - Duplicato, logica in `audio.js`
   - **Azione**: Consolidare in `audio.js`

3. **routes/openRouterServiceForVideo.js**
   - Duplicato, logica in `video.js`
   - **Azione**: Consolidare in `video.js`

4. **routes/openRouterServiceForPrompt.js**
   - Funzionalità coperta da `openRouterService.js`
   - **Azione**: Verificare utilizzo ed eliminare

5. **ai/Brain.js** vs **ai/brainEngine.js**
   - Due implementazioni simili
   - `Brain.js` sembra più completo ma non usato
   - `brainEngine.js` è quello attualmente in uso
   - **Azione**: Decidere quale mantenere, consolidare funzionalità

#### Frontend

1. **services/conversation_service.dart**
   - Funzionalità coperte da `chat_service.dart`
   - **Azione**: Verificare dipendenze ed eliminare

### Pattern da Evitare

1. **Codice commentato esteso**
   - Rimuovere blocchi di codice commentato vecchi
   - Usare git per storico

2. **Duplicazione logica**
   - Centralizzare logica comune
   - Usare utility functions

3. **Magic numbers/strings**
   - Definire costanti in config
   - Esempio: porte, limiti, timeout

---

## 🔐 Sicurezza

### Best Practices Implementate

1. **Autenticazione**: Supabase Auth (JWT)
2. **Authorization**: Header `x-user-id` + verifica ownership
3. **CORS**: Configurato in Express
4. **Input Validation**: Validazione parametri richieste
5. **SQL Injection**: Prevenuto da Supabase client

### Da Implementare

1. **Rate Limiting**: Limitare richieste per IP/user
2. **Input Sanitization**: Sanitizzare input utente
3. **HTTPS**: Forzare HTTPS in produzione
4. **Secrets Management**: Usare vault per chiavi API
5. **Audit Logging**: Log azioni sensibili

---

## 📊 Metriche & KPI

### Performance Target

- **WebSocket Latency**: < 100ms
- **API Response Time**: < 500ms
- **AI Response Time**: < 5s (text), < 30s (media)
- **Uptime**: > 99.5%

### Business Metrics

- **DAU** (Daily Active Users)
- **Messaggi per utente/giorno**
- **Retention Rate** (D1, D7, D30)
- **Conversion Rate** (free → paid)
- **ARPU** (Average Revenue Per User)

---

## 🚀 Deployment

### Ambiente Sviluppo

```bash
# Backend
cd backend
npm install
pm2 start ecosystem.config.js

# Frontend
cd ..
flutter run
```

### Ambiente Produzione

**Backend**: Deploy su VPS/Cloud (es. DigitalOcean, AWS)
- PM2 per process management
- Nginx come reverse proxy
- SSL con Let's Encrypt

**Frontend**: 
- Web: Deploy su Vercel/Netlify
- Mobile: Build APK/IPA, publish su stores

---

## 📝 Convenzioni Codice

### Backend (JavaScript)

- **Naming**: camelCase per variabili/funzioni
- **Async/Await**: Preferire a callbacks
- **Error Handling**: Try-catch con log dettagliati
- **Comments**: JSDoc per funzioni pubbliche

### Frontend (Dart)

- **Naming**: camelCase per variabili, PascalCase per classi
- **State Management**: Riverpod providers
- **Widgets**: Separare UI da logica
- **Comments**: Dartdoc per API pubbliche

---

## 🆘 Troubleshooting

### WebSocket non si connette

1. Verificare server WS attivo: `pm2 list`
2. Controllare porta 5001 libera: `lsof -i :5001`
3. Verificare logs: `pm2 logs ws`
4. Controllare `Config.wsBaseUrl` in Flutter

### AI non risponde

1. Verificare `brainEngine` esportato correttamente
2. Controllare chiavi API OpenRouter in `.env`
3. Verificare logs errori: `pm2 logs ws --err`
4. Testare endpoint OpenRouter direttamente

### Media non si genera

1. Verificare chiavi Replicate/ElevenLabs
2. Controllare crediti API
3. Verificare upload Supabase Storage
4. Controllare permessi bucket

---

## 📚 Risorse

- **Supabase Docs**: https://supabase.com/docs
- **OpenRouter**: https://openrouter.ai/docs
- **Replicate**: https://replicate.com/docs
- **ElevenLabs**: https://elevenlabs.io/docs
- **Flutter**: https://flutter.dev/docs

---

## 📞 Contatti

Per domande o supporto:
- **Developer**: Alessandro Nigro
- **Repository**: alessandronigro/sexylara
- **Email**: [da configurare]

---

**Fine Documentazione** - Mantenere aggiornato ad ogni modifica significativa dell'architettura
