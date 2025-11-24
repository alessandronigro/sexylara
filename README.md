# 🎭 ThrillMe - AI Multi-Girlfriend Chat Platform

> **Piattaforma di chat AI con supporto multi-girlfriend, gruppi, e generazione contenuti multimediali**

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![Node](https://img.shields.io/badge/node-18.x-blue.svg)]()
[![Flutter](https://img.shields.io/badge/flutter-3.x-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

---

## 📚 Documentazione

Questa repository include documentazione completa e organizzata:

### 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)
**Architettura completa del sistema**
- Panoramica stack tecnologico
- Struttura backend e frontend
- Database schema dettagliato
- Sistema AI e engine specializzati
- Protocollo WebSocket
- Storage e media management

### 📋 [TODO.md](./TODO.md)
**Lista prioritizzata di task e miglioramenti**
- TODO critici per produzione (priorità alta)
- Miglioramenti UX (priorità media)
- Ottimizzazioni future (priorità bassa)
- Refactoring consigliati
- Roadmap implementazione

### 🗑️ [CLEANUP.md](./CLEANUP.md)
**Guida per pulizia codice obsoleto**
- File deprecati da eliminare
- Codice duplicato da consolidare
- Script di verifica
- Checklist cleanup
- Metriche pre/post cleanup

### 🗺️ [SYSTEM_MAP.md](./SYSTEM_MAP.md)
**Mappe visuali e diagrammi di flusso**
- Architettura ad alto livello
- Flussi chat 1-to-1 e gruppo
- Generazione media
- Autenticazione e inviti
- Database relationships
- Performance optimization

---

## 🚀 Quick Start

### Prerequisiti

- **Node.js** 18.x o superiore
- **Flutter** 3.x o superiore
- **PM2** (per process management)
- **Supabase** account (database + storage)
- **API Keys**:
  - OpenRouter (LLM)
  - Replicate (immagini/video)
  - ElevenLabs (audio)

### Installazione Backend

```bash
# Clone repository
git clone https://github.com/alessandronigro/sexylara.git
cd sexylara/backend

# Installa dipendenze
npm install

# Configura environment variables
cp .env.example .env
# Modifica .env con le tue chiavi API

# Avvia server con PM2
pm2 start ecosystem.config.js

# Verifica status
pm2 list
```

### Installazione Frontend

```bash
# Vai nella directory principale
cd ..

# Installa dipendenze Flutter
flutter pub get

# Avvia app (iOS/Android/Web)
flutter run
```

---

## 🏗️ Architettura Rapida

```
┌─────────────────┐
│  Flutter App    │  ← Frontend (Dart)
└────────┬────────┘
         │
    HTTP │ WebSocket
         │
┌────────▼────────┐
│  Node.js        │  ← Backend
│  - API :4000    │
│  - WS  :5001    │
└────────┬────────┘
         │
    ┌────┼────┐
    │    │    │
    ▼    ▼    ▼
┌────┐ ┌──┐ ┌───┐
│DB  │ │AI│ │CDN│  ← Services
└────┘ └──┘ └───┘
```

---

## 📂 Struttura Progetto

```
sexylara/
├── backend/                 # Backend Node.js
│   ├── server-api.js       # REST API (porta 4000)
│   ├── server-ws.js        # WebSocket (porta 5001)
│   ├── routes/             # Endpoint API
│   ├── ai/                 # Sistema AI
│   │   ├── brainEngine.js  # Core AI logic
│   │   └── engines/        # Engine specializzati
│   ├── services/           # Servizi (storage, etc)
│   └── migrations/         # SQL migrations
│
├── lib/                    # Frontend Flutter
│   ├── main.dart          # Entry point
│   ├── screens/           # UI screens
│   ├── services/          # Business logic
│   ├── widgets/           # Componenti riutilizzabili
│   └── models/            # Data models
│
├── ARCHITECTURE.md         # 📖 Architettura completa
├── TODO.md                # 📋 Task e miglioramenti
├── CLEANUP.md             # 🗑️ Guida cleanup
├── SYSTEM_MAP.md          # 🗺️ Diagrammi di flusso
└── README.md              # 📘 Questo file
```

---

## 🎯 Funzionalità Principali

### ✅ Implementate

- [x] **Chat 1-to-1** con AI girlfriends personalizzate
- [x] **Chat di gruppo** con più AI e utenti reali
- [x] **Generazione contenuti**:
  - [x] Immagini (Replicate Flux)
  - [x] Video (Replicate Minimax)
  - [x] Audio (ElevenLabs)
- [x] **Sistema inviti** per gruppi
- [x] **Permessi e ruoli** (owner, admin, member)
- [x] **AI pubbliche** condivisibili
- [x] **Discovery utenti** e AI
- [x] **Autenticazione** (Supabase Auth)
- [x] **Storage media** (Supabase Storage)
- [x] **Voice cloning** per AI
- [x] **Memoria AI** persistente
- [x] **Evoluzione personalità** AI

### 🚧 In Sviluppo (vedi [TODO.md](./TODO.md))

- [ ] Notifiche push
- [ ] Sistema preferiti
- [ ] Analytics e metriche
- [ ] Rate limiting
- [ ] Testing suite completa

---

## 🤖 Sistema AI

Il sistema AI è modulare e composto da:

### **brainEngine** (Core)
Orchestratore principale che coordina tutti gli engine

### **Engine Specializzati**
- **PersonaEngine**: Gestione personalità e mood
- **MemoryEngine**: Memoria a lungo termine
- **ExperienceEngine**: Sistema XP e livelli
- **IntentEngine**: Analisi intento utente
- **SocialEngine**: Decisioni sociali (inviti, gruppi)

### Flusso Generazione Risposta

```
User Message
    ↓
Intent Analysis
    ↓
Memory Retrieval
    ↓
Mood Calculation
    ↓
Prompt Building
    ↓
LLM Call (OpenRouter)
    ↓
Response Processing
    ↓
State Update (XP, intimacy)
```

Vedi [ARCHITECTURE.md](./ARCHITECTURE.md#sistema-ai) per dettagli completi.

---

## 🗄️ Database

### Tabelle Principali

- `users` - Utenti (Supabase Auth)
- `user_profile` - Profili utente estesi
- `girlfriends` - AI girlfriends
- `messages` - Messaggi chat 1-to-1
- `groups` - Gruppi
- `group_members` - Membri gruppi
- `group_messages` - Messaggi gruppi
- `group_memory` - Memoria collettiva gruppi
- `invites` - Inviti a gruppi
- `ai_contacts` - AI pubbliche condivise

Vedi [ARCHITECTURE.md](./ARCHITECTURE.md#database-schema) per schema completo.

---

## 🔌 API & WebSocket

### REST API (porta 4000)

```
POST   /api/generate-avatar
GET    /api/chat-history/:userId/:girlfriendId
POST   /api/photos/comment
GET    /api/girlfriend-gallery/:userId/:girlfriendId
DELETE /api/girlfriend/:id

GET    /api/groups
POST   /api/groups
DELETE /api/groups/:id
GET    /api/groups/:id/messages
POST   /api/groups/:id/messages

POST   /api/invites
PATCH  /api/invites/:id/respond
```

### WebSocket (porta 5001)

```
ws://localhost:5001/ws?user_id={userId}

Client → Server:
{
  "text": "messaggio",
  "traceId": "uuid",
  "girlfriend_id": "uuid",  // per chat 1-to-1
  "group_id": "uuid"        // per chat gruppo
}

Server → Client:
{
  "traceId": "uuid",
  "type": "ack" | "typing" | "group_message" | "image" | "video" | "audio",
  "content": "testo o URL",
  "end": true  // fine conversazione
}
```

Vedi [SYSTEM_MAP.md](./SYSTEM_MAP.md) per diagrammi di flusso completi.

---

## 🛠️ Sviluppo

### Comandi Utili

```bash
# Backend
cd backend

# Avvia in development
npm run dev

# Avvia con PM2
pm2 start ecosystem.config.js

# Logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all

# Frontend
cd ..

# Run app
flutter run

# Build
flutter build apk        # Android
flutter build ios        # iOS
flutter build web        # Web

# Test
flutter test
```

### Environment Variables

Crea file `.env` in `backend/`:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# OpenRouter (LLM)
OPENROUTER_API_KEY=your_openrouter_key

# Replicate (Media Generation)
REPLICATE_API_TOKEN=your_replicate_token

# ElevenLabs (Audio)
ELEVENLABS_API_KEY=your_elevenlabs_key

# Server
PORT=4000
WS_PORT=5001
NODE_ENV=development
```

---

## 📊 Performance

### Metriche Target

- **WebSocket Latency**: < 100ms
- **API Response Time**: < 500ms
- **AI Response Time**: < 5s (text), < 30s (media)
- **Uptime**: > 99.5%

### Ottimizzazioni

- Connection pooling (database)
- Lazy loading (immagini)
- Caching (Redis - futuro)
- CDN (media statici - futuro)
- Rate limiting (futuro)

Vedi [SYSTEM_MAP.md](./SYSTEM_MAP.md#performance-optimization-points) per dettagli.

---

## 🔒 Sicurezza

### Implementato

- ✅ Autenticazione JWT (Supabase)
- ✅ Authorization header (`x-user-id`)
- ✅ CORS configurato
- ✅ Input validation
- ✅ SQL injection prevention (Supabase client)

### Da Implementare

- [ ] Rate limiting
- [ ] Input sanitization (XSS prevention)
- [ ] HTTPS enforcement
- [ ] Secrets management (vault)
- [ ] Audit logging

Vedi [TODO.md](./TODO.md#sicurezza) per dettagli.

---

## 🧪 Testing

### Attuale

- Manuale testing
- PM2 process monitoring

### Pianificato

- [ ] Unit tests (AI engines)
- [ ] Integration tests (API)
- [ ] E2E tests (flussi critici)
- [ ] Load testing (performance)

Vedi [TODO.md](./TODO.md#testing) per roadmap.

---

## 📈 Roadmap

### Q1 2025
- [x] Sistema base chat 1-to-1
- [x] Chat di gruppo
- [x] Generazione media
- [x] Sistema inviti

### Q2 2025
- [ ] Notifiche push
- [ ] Analytics
- [ ] Rate limiting
- [ ] Testing suite

### Q3 2025
- [ ] Vector database (memoria)
- [ ] Caching (Redis)
- [ ] CDN integration
- [ ] Mobile app stores

### Q4 2025
- [ ] Scaling (load balancer)
- [ ] Advanced AI features
- [ ] Monetization
- [ ] Marketing

Vedi [TODO.md](./TODO.md#roadmap-implementazione) per dettagli completi.

---

## 🤝 Contribuire

### Workflow

1. Fork repository
2. Crea branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

### Coding Standards

- **Backend**: ESLint + Prettier
- **Frontend**: Dart analyzer
- **Commits**: Conventional Commits
- **Documentation**: Aggiornare ARCHITECTURE.md per modifiche significative

---

## 🐛 Bug Report

Apri issue su GitHub con:
- Descrizione problema
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (se applicabile)
- Environment (OS, Node version, Flutter version)

---

## 📞 Supporto

- **Developer**: Alessandro Nigro
- **Repository**: [alessandronigro/sexylara](https://github.com/alessandronigro/sexylara)
- **Email**: [da configurare]

---

## 📄 Licenza

Questo progetto è sotto licenza MIT - vedi file [LICENSE](LICENSE) per dettagli.

---

## 🙏 Ringraziamenti

- **Supabase** - Database e storage
- **OpenRouter** - LLM access
- **Replicate** - Media generation
- **ElevenLabs** - Voice cloning
- **Flutter** - Cross-platform framework

---

## 📖 Documentazione Completa

Per approfondimenti, consulta:

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architettura dettagliata
2. **[TODO.md](./TODO.md)** - Task e miglioramenti
3. **[CLEANUP.md](./CLEANUP.md)** - Guida cleanup codice
4. **[SYSTEM_MAP.md](./SYSTEM_MAP.md)** - Diagrammi e flussi

---

**Ultima revisione**: 24 Novembre 2025  
**Versione**: 2.0  
**Status**: Active Development

---

<div align="center">
  
**Made with ❤️ by Alessandro Nigro**

[⬆ Torna su](#-thrillme---ai-multi-girlfriend-chat-platform)

</div>
