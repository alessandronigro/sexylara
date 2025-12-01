# 🏗️ Architettura del Sistema - ThrillMe

> **Documentazione tecnica completa dell'architettura del sistema ThrillMe**

**Versione**: 2.0  
**Ultima revisione**: Gennaio 2025  
**Status**: Active Development

---

## 📋 Indice

1. [Panoramica Generale](#panoramica-generale)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Architettura Backend](#architettura-backend)
4. [Architettura Frontend](#architettura-frontend)
5. [Sistema AI](#sistema-ai)
6. [Database Schema](#database-schema)
7. [API e WebSocket](#api-e-websocket)
8. [Storage e Media](#storage-e-media)
9. [Sicurezza](#sicurezza)
10. [Deployment](#deployment)

---

## 🎯 Panoramica Generale

ThrillMe è una piattaforma di chat AI multi-NPC che permette agli utenti di:
- Creare e personalizzare NPC (Non-Player Characters) AI
- Chattare 1-to-1 con NPC personalizzate
- Partecipare a chat di gruppo con più NPC e utenti reali
- Generare contenuti multimediali (immagini, video, audio) tramite AI
- Condividere NPC pubbliche e scoprire altri utenti

### Architettura ad Alto Livello

```
┌─────────────────────────────────────────────────────────────┐
│                    Flutter App (Frontend)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Screens │  │ Services │  │  Widgets │  │  Models  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
    ┌───────▼────────┐    ┌─────────▼────────┐
    │  REST API       │    │  WebSocket       │
    │  (Express)      │    │  (WS Server)     │
    │  Port: 4000     │    │  Port: 5001     │
    └───────┬────────┘    └─────────┬────────┘
            │                       │
    ┌───────▼───────────────────────▼────────┐
    │         Node.js Backend                 │
    │  ┌──────────┐  ┌──────────────────┐  │
    │  │  Routes   │  │   AI System       │  │
    │  │  Services │  │   - BrainEngine   │  │
    │  │  Models   │  │   - Engines        │  │
    │  └──────────┘  └──────────────────┘  │
    └───────┬────────────────────────────────┘
            │
    ┌───────┴───────────┬──────────────┬──────────────┐
    │                   │              │              │
┌───▼────┐    ┌─────────▼────┐  ┌─────▼─────┐  ┌────▼─────┐
│Supabase│    │  OpenRouter   │  │ Replicate  │  │ElevenLabs│
│Database│    │    (LLM)      │  │  (Media)   │  │  (Voice) │
│Storage │    │               │  │            │  │          │
└────────┘    └───────────────┘  └────────────┘  └──────────┘
```

---

## 🛠️ Stack Tecnologico

### Frontend
- **Framework**: Flutter 3.x (Dart)
- **State Management**: Riverpod 2.4.1
- **Routing**: GoRouter 8.2.0
- **WebSocket**: web_socket_channel 2.4.5
- **Storage**: Supabase Flutter SDK 1.2.0
- **Autenticazione**: Supabase Auth + Google Sign-In + Apple Sign-In

### Backend
- **Runtime**: Node.js 18.x
- **Framework**: Express 4.21.2
- **WebSocket**: ws 8.18.3
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Process Manager**: PM2

### Servizi Esterni
- **LLM**: OpenRouter (accesso a vari modelli: GPT-4, Claude, etc.)
- **Generazione Immagini**: Replicate (Flux, Stable Diffusion)
- **Generazione Video**: Replicate (Minimax)
- **Generazione Audio**: ElevenLabs (Voice Cloning)
- **Autenticazione**: Supabase Auth
- **Payments**: Stripe

---

## 🏛️ Architettura Backend

### Struttura Directory

```
backend/
├── server-api.js          # Server REST API (porta 4000)
├── server-ws.js           # Server WebSocket (porta 5001)
├── routes/                # Endpoint REST API
│   ├── auth.js           # Autenticazione
│   ├── npc.js            # Gestione NPC
│   ├── message.js        # Messaggi
│   ├── group.js          # Gruppi
│   ├── user.js           # Utenti
│   ├── image.js          # Generazione immagini
│   ├── video.js          # Generazione video
│   ├── audio.js          # Generazione audio
│   └── ...
├── ai/                    # Sistema AI
│   ├── brainEngine.js    # Wrapper principale
│   ├── brain/            # Core AI engine
│   │   ├── BrainEngine.js
│   │   ├── InputLayer.js
│   │   ├── MemoryLayer.js
│   │   ├── PerceptionLayer.js
│   │   ├── MotivationLayer.js
│   │   ├── PersonaLayer.js
│   │   └── StateLayer.js
│   ├── engines/          # Engine specializzati
│   ├── intent/           # Analisi intenti
│   ├── memory/           # Gestione memoria
│   ├── persona/          # Personalità NPC
│   └── generation/       # Generazione risposte
├── services/             # Servizi business logic
│   ├── MediaGenerationService.js
│   ├── voiceGenerator.js
│   ├── pushService.js
│   └── ...
├── controllers/          # Controller (legacy)
├── models/               # Modelli dati
├── middleware/           # Middleware Express
└── lib/                  # Librerie utility
```

### Server API (REST)

**File**: `server-api.js`  
**Porta**: 4000 (configurabile via `PORT` env)

**Responsabilità**:
- Gestione richieste HTTP REST
- Autenticazione e autorizzazione
- CRUD operazioni (NPC, messaggi, gruppi, utenti)
- Upload e gestione media
- Integrazione con servizi esterni

**Middleware**:
- CORS abilitato
- Body parser (limite 50MB per media)
- Static file serving (`/public`)

### Server WebSocket

**File**: `server-ws.js`  
**Porta**: 5001 (configurabile via `WS_PORT` env)

**Responsabilità**:
- Gestione connessioni WebSocket real-time
- Chat 1-to-1 con NPC
- Chat di gruppo multi-NPC
- Generazione media in tempo reale
- Notifiche push
- Status NPC (typing, sending_image, etc.)

**Protocollo WebSocket**:
```
ws://localhost:5001/ws?user_id={userId}&npc_id={npcId}
```

**Eventi Client → Server**:
```json
{
  "text": "messaggio",
  "traceId": "uuid",
  "npc_id": "uuid",      // per chat 1-to-1
  "group_id": "uuid",    // per chat gruppo
  "mediaType": "image",  // opzionale
  "mediaUrl": "url"      // opzionale
}
```

**Eventi Server → Client**:
```json
{
  "traceId": "uuid",
  "type": "ack" | "typing" | "group_message" | "image" | "video" | "audio",
  "content": "testo o URL",
  "sender_id": "uuid",
  "sender_name": "nome",
  "avatar": "url",
  "end": true
}
```

---

## 📱 Architettura Frontend

### Struttura Directory

```
lib/
├── main.dart            # Entry point
├── screens/             # UI screens
│   ├── chat_screen.dart
│   ├── contacts_screen.dart
│   ├── group_chat_screen.dart
│   ├── create_npc_screen.dart
│   └── ...
├── services/            # Business logic
│   ├── supabase_service.dart
│   ├── websocket_service.dart
│   ├── notification_service.dart
│   └── ...
├── widgets/             # Componenti riutilizzabili
├── models/              # Data models
├── providers/           # Riverpod providers
└── config.dart          # Configurazione
```

### State Management

**Riverpod** è utilizzato per:
- Gestione sessione utente
- Cache dati NPC
- Stato connessione WebSocket
- Preferenze utente

### Routing

**GoRouter** gestisce:
- Navigazione tra schermate
- Deep linking
- Redirect basati su autenticazione
- Parametri di route

---

## 🤖 Sistema AI

Il sistema AI è modulare e composto da diversi layer e engine specializzati.

### Architettura BrainEngine

Il `BrainEngine` è il core del sistema AI, organizzato in layer:

```
User Message
    ↓
[InputLayer]        → Normalizza input, arricchisce metadati
    ↓
[StateLayer]        → Carica stato NPC (mood, stats, XP)
    ↓
[MemoryLayer]       → Recupera memorie rilevanti
    ↓
[PerceptionLayer]   → Analizza intento, emozioni, contesto
    ↓
[MotivationLayer]   → Determina motivazione dominante
    ↓
[PersonaLayer]      → Costruisce stato persona (mood, relazione)
    ↓
[PromptBuilder]     → Costruisce prompt per LLM
    ↓
[LlmClient]         → Chiamata a OpenRouter
    ↓
[PostProcessor]     → Post-processing risposta
    ↓
Response + Actions
```

### Engine Specializzati

#### 1. **PersonaEngine**
Gestisce personalità e mood NPC:
- Calcolo mood basato su interazioni
- Evoluzione personalità nel tempo
- Adattamento tono conversazione

#### 2. **MemoryEngine**
Gestisce memoria a lungo termine:
- Memoria episodica (eventi specifici)
- Memoria semantica (conoscenze generali)
- Consolidamento memoria periodico

#### 3. **ExperienceEngine**
Sistema XP e livelli:
- Calcolo XP per interazioni
- Livelli NPC basati su XP
- Sblocco funzionalità per livello

#### 4. **IntentEngine**
Analisi intento utente:
- Classificazione intenti (chat, request_image, request_video, etc.)
- Rilevamento emozioni
- Analisi contesto sociale

#### 5. **SocialEngine**
Decisioni sociali:
- Gestione inviti
- Comportamento in gruppi
- Relazioni tra NPC

#### 6. **MediaUnderstandingEngine**
Analisi media ricevuti:
- Analisi immagini (Replicate Vision)
- Analisi audio (transcription + sentiment)
- Impatto emotivo su NPC

### Flusso Generazione Risposta

1. **Input Processing**: Normalizzazione e arricchimento metadati
2. **Context Gathering**: Carica stato NPC, memorie, storia recente
3. **Perception**: Analizza intento, emozioni, contesto
4. **Motivation**: Determina motivazione (rispondere, chiedere, generare media)
5. **Persona State**: Costruisce stato persona (mood, relazione, tono)
6. **Prompt Building**: Costruisce prompt completo per LLM
7. **LLM Call**: Chiamata a OpenRouter con modello appropriato
8. **Post-Processing**: Pulizia output, rimozione glitch, applicazione personalità
9. **Response**: Ritorna testo + eventuali azioni (genera media, aggiorna stato)

### GroupBrainEngine

Per chat di gruppo, utilizza `GroupBrainEngine` che:
- Gestisce multiple NPC simultaneamente
- Determina quale NPC risponde (o se rimangono silenti)
- Mantiene contesto condiviso
- Gestisce dinamiche di gruppo

---

## 🗄️ Database Schema

### Tabelle Principali

#### `user_profile`
Profilo utente esteso:
```sql
- id (uuid, PK, FK → auth.users)
- username (text)
- name (text)
- avatar_url (text)
- is_public (boolean)
- language (varchar, default 'it')
- memory (jsonb)
- tone (text)
- likes (text[])
- dislikes (text[])
```

#### `npcs`
NPC create dagli utenti:
```sql
- id (uuid, PK)
- user_id (uuid, FK → auth.users)
- name (text)
- avatar_url (text)
- is_public (boolean)
- personality_type (text)
- tone (text)
- age (int)
- gender (text)
- stats (jsonb)          -- attachment, intimacy, trust, XP
- current_mood (text)
- voice_master_url (text)
- group_behavior_profile (jsonb)
- preferences (jsonb)
```

#### `messages`
Messaggi chat 1-to-1:
```sql
- id (uuid, PK)
- user_id (uuid, FK → auth.users)
- npc_id (uuid, FK → npcs)
- session_id (text)
- role (text)            -- 'user' | 'assistant'
- type (text)             -- 'text' | 'image' | 'video' | 'audio'
- content (text)         -- testo o URL media
- created_at (timestamptz)
```

#### `groups`
Gruppi chat:
```sql
- id (uuid, PK)
- name (text)
- user_id (uuid, FK → auth.users)  -- owner
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `group_members`
Membri gruppi:
```sql
- id (uuid, PK)
- group_id (uuid, FK → groups)
- member_id (uuid)       -- user_id o npc_id
- member_type (enum)      -- 'user' | 'npc' | 'ai'
- npc_id (uuid, FK → npcs) -- se member_type = 'npc'
- role (enum)             -- 'owner' | 'admin' | 'member'
```

#### `group_messages`
Messaggi gruppi:
```sql
- id (uuid, PK)
- group_id (uuid, FK → groups)
- sender_id (uuid)        -- user_id o npc_id
- type (text)             -- 'text' | 'image' | 'video' | 'audio'
- content (text)
- created_at (timestamptz)
```

#### `invites`
Sistema inviti:
```sql
- id (uuid, PK)
- sender_id (uuid, FK → auth.users)
- receiver_id (uuid, FK → auth.users)
- receiver_type (text)    -- 'user' | 'npc'
- status (text)           -- 'pending' | 'accepted' | 'rejected'
- context (jsonb)         -- metadata invito
- created_at (timestamptz)
```

#### `npc_profiles`
Profilo AI esteso (JSONB):
```sql
- id (uuid, PK)
- owner_id (uuid, FK → auth.users)
- name (text)
- data (jsonb)            -- brain state, memories, etc.
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Relazioni

```
users (auth.users)
  ├── user_profile (1:1)
  ├── npcs (1:N)
  ├── messages (1:N)
  ├── groups (1:N, owner)
  └── invites (1:N, sender/receiver)

npcs
  ├── messages (1:N)
  ├── group_members (1:N)
  └── npc_profiles (1:1)

groups
  ├── group_members (1:N)
  ├── group_messages (1:N)
  └── group_memory (1:1)
```

---

## 🔌 API e WebSocket

### REST API Endpoints

#### Autenticazione
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
GET    /api/auth/me
```

#### NPC
```
GET    /api/npcs
POST   /api/npcs
GET    /api/npcs/:id
PUT    /api/npcs/:id
DELETE /api/npcs/:id
PUT    /api/npcs/:id/privacy
```

#### Messaggi
```
GET    /api/chat-history/:userId/:npcId
POST   /api/photos/comment
GET    /api/npc-gallery/:userId/:npcId
```

#### Gruppi
```
GET    /api/groups
POST   /api/groups
GET    /api/groups/:id
DELETE /api/groups/:id
GET    /api/groups/:id/messages
POST   /api/groups/:id/messages
```

#### Utenti
```
GET    /api/users/me
GET    /api/users/thrillers
GET    /api/users/contacts
POST   /api/users/invite
GET    /api/users/invites/pending
POST   /api/users/invites/:id/respond
```

#### Media Generation
```
POST   /api/generate-avatar
POST   /api/audio/upload
```

### WebSocket Events

#### Client → Server
```javascript
// Messaggio testo
{
  "text": "Ciao!",
  "traceId": "uuid",
  "npc_id": "uuid"  // per chat 1-to-1
}

// Messaggio gruppo
{
  "text": "Ciao a tutti!",
  "traceId": "uuid",
  "group_id": "uuid"
}

// Media upload
{
  "text": "Ecco una foto",
  "traceId": "uuid",
  "npc_id": "uuid",
  "mediaType": "image",
  "mediaUrl": "https://..."
}
```

#### Server → Client
```javascript
// ACK
{
  "traceId": "uuid",
  "type": "ack",
  "serverId": "uuid"
}

// Messaggio testo
{
  "traceId": "uuid",
  "role": "assistant",
  "type": "chat",
  "content": "Ciao! Come stai?",
  "npc_id": "uuid"
}

// Messaggio gruppo
{
  "traceId": "uuid",
  "role": "assistant",
  "type": "group_message",
  "content": "Ciao!",
  "sender_id": "uuid",
  "sender_name": "NPC Name",
  "avatar": "url",
  "group_id": "uuid",
  "messageId": "uuid"
}

// Media generation started
{
  "event": "media_generation_started",
  "tempId": "uuid",
  "npcId": "uuid",
  "mediaType": "photo",
  "traceId": "uuid"
}

// Media generation completed
{
  "event": "media_generation_completed",
  "tempId": "uuid",
  "mediaType": "photo",
  "finalUrl": "https://...",
  "caption": "Ecco la foto!",
  "messageId": "uuid",
  "npcId": "uuid"
}

// NPC status
{
  "event": "npc_status",
  "npcId": "uuid",
  "status": "typing" | "sending_image" | "sending_video" | "recording_audio",
  "traceId": "uuid"
}

// Fine conversazione
{
  "traceId": "uuid",
  "end": true
}
```

---

## 💾 Storage e Media

### Supabase Storage Buckets

#### `chat-images`
Immagini caricate dagli utenti e generate:
```
{userId}/{npcId}/{filename}
```

#### `chat-audio`
Audio caricati e generati:
```
{userId}/{npcId}/{filename}
```

#### `chat-videos`
Video generati:
```
{userId}/{npcId}/{filename}
```

#### `npc-avatars`
Avatar NPC:
```
{npcId}/avatar.{ext}
```

### Generazione Media

#### Immagini
- **Provider**: Replicate (Flux, Stable Diffusion)
- **Input**: Prompt + face reference (per consistency)
- **Output**: URL Supabase Storage

#### Video
- **Provider**: Replicate (Minimax)
- **Input**: Prompt + chat history
- **Output**: URL Supabase Storage

#### Audio
- **Provider**: ElevenLabs
- **Input**: Testo + voice profile NPC
- **Output**: URL Supabase Storage

---

## 🔒 Sicurezza

### Autenticazione
- **Provider**: Supabase Auth
- **Metodi**: Email/Password, Google, Apple
- **Token**: JWT (gestito da Supabase)

### Autorizzazione
- **Header**: `x-user-id` (verificato da middleware)
- **Row Level Security**: Abilitato su Supabase
- **Ownership Check**: Verifica ownership su operazioni sensibili

### Validazione Input
- Sanitizzazione input utente
- Validazione parametri API
- Rate limiting (da implementare)

### CORS
- Configurato per domini specifici
- Credentials abilitati

---

## 🚀 Deployment

### Backend
```bash
# PM2
pm2 start ecosystem.config.js

# Environment variables
PORT=4000
WS_PORT=5001
SUPABASE_URL=...
SUPABASE_KEY=...
OPENROUTER_API_KEY=...
REPLICATE_API_TOKEN=...
ELEVENLABS_API_KEY=...
```

### Frontend
```bash
# Build
flutter build apk        # Android
flutter build ios        # iOS
flutter build web        # Web

# Deploy web
# Vedi scripts/deploy_web.sh
```

### Database
- Migrazioni Supabase: `supabase/migrations/`
- Schema DDL: `supabase/ddl.sql`

---

## 📊 Performance

### Metriche Target
- **WebSocket Latency**: < 100ms
- **API Response Time**: < 500ms
- **AI Response Time**: < 5s (text), < 30s (media)
- **Uptime**: > 99.5%

### Ottimizzazioni
- Connection pooling (Supabase)
- Lazy loading immagini
- Caching (futuro: Redis)
- CDN per media statici (futuro)

---

## 🔄 Flussi Principali

### Chat 1-to-1
1. Utente invia messaggio via WebSocket
2. Server salva messaggio in DB
3. BrainEngine genera risposta
4. Server salva risposta in DB
5. Server invia risposta via WebSocket
6. Frontend aggiorna UI

### Chat Gruppo
1. Utente invia messaggio gruppo
2. Server salva messaggio gruppo
3. GroupBrainEngine determina quali NPC rispondono
4. Ogni NPC genera risposta (parallelamente)
5. Server salva risposte in DB
6. Server invia risposte via WebSocket
7. Frontend aggiorna UI

### Generazione Media
1. Utente richiede media (testo o intent)
2. Server avvia generazione (Replicate/ElevenLabs)
3. Server invia evento `media_generation_started`
4. Frontend mostra placeholder
5. Generazione completata
6. Server uploada media su Supabase Storage
7. Server invia evento `media_generation_completed`
8. Frontend aggiorna UI con media

---

## 📝 Note di Sviluppo

### Convenzioni Codice
- **Backend**: JavaScript (ES6+), async/await
- **Frontend**: Dart, Flutter best practices
- **Naming**: camelCase (JS), snake_case (SQL)

### Testing
- Manual testing attuale
- Unit tests (da implementare)
- Integration tests (da implementare)

### Logging
- File logging: `backend/logs.txt`, `backend/api.log`, `backend/ws.log`
- Console logging con emoji per categorizzazione

---

**Ultima revisione**: Gennaio 2025  
**Mantenuto da**: Team ThrillMe






