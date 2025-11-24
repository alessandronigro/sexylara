# 🔗 ThrillMe - Backend ↔ Frontend Integration & Consolidation

> **Ultima revisione**: 24 Novembre 2025  
> **Obiettivo**: Mappatura completa integrazioni e task di consolidamento

---

## 📊 Overview Integrazione

```
┌──────────────────────────────────────────────────────────────┐
│                    FLUTTER APP (Frontend)                     │
│                                                               │
│  40 file Dart                                                 │
│  - 16 Screens                                                 │
│  - 9 Services                                                 │
│  - 5 Widgets                                                  │
│  - 5 Models                                                   │
│                                                               │
└────────────┬─────────────────────────────────┬───────────────┘
             │                                 │
        HTTP │ :4000                      WS   │ :5001
             │                                 │
┌────────────▼─────────────────────────────────▼───────────────┐
│                   NODE.JS BACKEND                             │
│                                                               │
│  50 file JavaScript                                           │
│  - 22 Routes                                                  │
│  - 5 AI Engines                                               │
│  - 2 Services                                                 │
│  - 7 Migrations                                               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 🔄 API Endpoints - Status Mapping

### ✅ Completamente Implementati (Backend + Frontend)

| Endpoint | Backend | Frontend Service | Screen |
|----------|---------|------------------|--------|
| `GET /api/chat-history/:userId/:girlfriendId` | ✅ server-api.js | ✅ chat_service.dart | chat_screen.dart |
| `GET /api/girlfriend-gallery/:userId/:girlfriendId` | ✅ server-api.js | ✅ girlfriend_service.dart | girlfriend_gallery_screen.dart |
| `POST /api/generate-avatar` | ✅ server-api.js | ✅ girlfriend_service.dart | create_girlfriend_screen.dart |
| `GET /api/groups` | ✅ routes/group.js | ✅ group_service.dart | group_list_screen.dart |
| `POST /api/groups` | ✅ routes/group.js | ✅ group_service.dart | create_group_screen.dart |
| `DELETE /api/groups/:id` | ✅ routes/group.js | ✅ group_service.dart | group_chat_screen.dart |
| `GET /api/groups/:id/messages` | ✅ routes/group.js | ✅ group_chat_screen.dart | group_chat_screen.dart |
| `POST /api/groups/:id/messages` | ✅ routes/group.js | ✅ WebSocket | group_chat_screen.dart |
| `GET /api/groups/:id/members` | ✅ routes/group.js | ✅ group_chat_screen.dart | group_chat_screen.dart |
| `POST /api/invites` | ✅ routes/groupInvite.js | ✅ group_service.dart | group_invite_screen.dart |
| `PATCH /api/invites/:id/respond` | ✅ routes/groupInvite.js | ✅ group_service.dart | - |
| `GET /api/ai/list` | ✅ routes/aiContacts.js | ✅ ai_contact_service.dart | group_invite_screen.dart |
| `GET /api/users/search` | ✅ routes/userDiscovery.js | ✅ user_service.dart | invite_user_screen.dart |

---

### ⚠️ Parzialmente Implementati (Backend OK, Frontend Mancante)

| Endpoint | Backend | Frontend Needed | Priority |
|----------|---------|-----------------|----------|
| `POST /api/photos/comment` | ✅ server-api.js | ❌ Manca UI upload foto | 🟡 Media |
| `DELETE /api/girlfriend/:id` | ✅ server-api.js | ✅ Implementato | ✅ OK |
| `POST /api/ai/create` | ✅ routes/aiContacts.js | ❌ Manca UI creazione AI pubblica | 🟢 Bassa |
| `PUT /api/ai/:id/publish` | ✅ routes/aiContacts.js | ❌ Manca toggle pubblicazione | 🟢 Bassa |
| `POST /api/ai/:id/rate` | ✅ routes/aiContacts.js | ❌ Manca UI rating | 🟢 Bassa |

---

### ❌ Da Implementare (Backend + Frontend)

| Feature | Backend Endpoint | Frontend Service | Priority |
|---------|------------------|------------------|----------|
| **Statistiche Girlfriend** | `GET /api/girlfriends/:id/stats` | girlfriend_service.dart | 🟡 Media |
| **Sistema Preferiti** | `POST /api/girlfriends/:id/favorite` | girlfriend_service.dart | 🟡 Media |
| **Messaggi Random Persistiti** | `POST /api/messages/random` | random_message_service.dart | 🟡 Media |
| **Download Immagini** | - (client-side) | girlfriend_gallery_screen.dart | 🟡 Media |
| **Share Immagini** | - (client-side) | girlfriend_gallery_screen.dart | 🟡 Media |
| **Notifiche Push** | Firebase integration | notification_service.dart | 🔴 Alta |
| **Presenza Utenti** | WebSocket event | - | 🟢 Bassa |
| **Typing Indicator** | WebSocket event | chat_screen.dart | 🟢 Bassa |

---

## 🔌 WebSocket Events - Status Mapping

### ✅ Implementati (Backend + Frontend)

| Event | Direction | Backend | Frontend | Screen |
|-------|-----------|---------|----------|--------|
| `connect` | Client → Server | ✅ server-ws.js | ✅ chat_service.dart | - |
| `message` (1-to-1) | Client → Server | ✅ server-ws.js | ✅ chat_service.dart | chat_screen.dart |
| `message` (group) | Client → Server | ✅ server-ws.js | ✅ group_chat_screen.dart | group_chat_screen.dart |
| `ack` | Server → Client | ✅ server-ws.js | ✅ chat_service.dart | - |
| `typing` | Server → Client | ✅ server-ws.js | ✅ chat_service.dart | chat_screen.dart |
| `group_message` | Server → Client | ✅ server-ws.js | ✅ group_chat_screen.dart | group_chat_screen.dart |
| `end` | Server → Client | ✅ server-ws.js | ✅ chat_service.dart | - |
| `status` (rendering) | Server → Client | ✅ server-ws.js | ✅ chat_service.dart | chat_screen.dart |

---

### ❌ Da Implementare

| Event | Direction | Purpose | Priority |
|-------|-----------|---------|----------|
| `invite_notification` | Server → Client | Notifica invito gruppo real-time | 🔴 Alta |
| `user_online` | Server → Client | Presenza utenti | 🟢 Bassa |
| `user_typing` | Client ↔ Server | Indicatore typing | 🟢 Bassa |
| `message_deleted` | Server → Client | Sincronizzazione eliminazione | 🟡 Media |
| `group_updated` | Server → Client | Aggiornamento info gruppo | 🟡 Media |

---

## 📋 Task di Consolidamento - Priorità Integrate

### 🔴 PRIORITÀ ALTA (Critici per Produzione)

#### Backend

1. **Consolidamento AI Engine** (TODO.md #1)
   - File: `backend/ai/Brain.js` vs `backend/ai/brainEngine.js`
   - Azione: Migrare funzionalità Brain.js → brainEngine.js
   - Impatto: Riduce confusione, migliora manutenibilità
   - Tempo: 4-6 ore

2. **Notifiche WebSocket Inviti** (TODO.md #2)
   - File: `backend/routes/groupManagement.js:29`
   - Azione: Implementare notifica real-time quando utente riceve invito
   - Impatto: UX immediata
   - Tempo: 2-3 ore
   - **Richiede**: Implementazione frontend in `notification_service.dart`

3. **Persistenza Evoluzione AI** (TODO.md #3)
   - File: `backend/routes/openRouterService.js:42`
   - Azione: Salvare aggiornamenti stato AI (XP, intimacy, mood)
   - Impatto: AI evolvono realmente
   - Tempo: 3-4 ore

4. **Cleanup File Deprecati** (TODO.md #4)
   - Files: `messages.js`, `openRouterServiceFor*.js`
   - Azione: Eliminare file duplicati
   - Impatto: Riduce complessità
   - Tempo: 1-2 ore

#### Frontend

5. **Consolidamento Widget Message Bubble** (FLUTTER_ANALYSIS.md #2)
   - File: `lib/widgets/message_bubble.dart` vs `chat_message_bubble.dart`
   - Azione: Creare `unified_message_bubble.dart`
   - Impatto: -14KB codice, widget riutilizzabile
   - Tempo: 4-6 ore

6. **Consolidamento Model Message** (FLUTTER_ANALYSIS.md #3)
   - File: `lib/models/message.dart` vs `chat_message.dart`
   - Azione: Estendere `message.dart`, eliminare `chat_message.dart`
   - Impatto: Modello unico, meno confusione
   - Tempo: 2-3 ore

---

### 🟡 PRIORITÀ MEDIA (Miglioramenti UX)

#### Backend

7. **Endpoint Statistiche Girlfriend**
   - Nuovo: `GET /api/girlfriends/:id/stats`
   - Azione: Implementare conteggio messaggi, foto, preferiti
   - Impatto: Dati reali per UI
   - Tempo: 2-3 ore
   - **Richiede**: Implementazione frontend (FLUTTER_ANALYSIS.md #4-6)

8. **Endpoint Sistema Preferiti**
   - Nuovo: `POST /api/girlfriends/:id/favorite`
   - Azione: Toggle girlfriend preferita
   - Impatto: Feature preferiti funzionante
   - Tempo: 1-2 ore
   - **Richiede**: Implementazione frontend

9. **Eliminazione Media Girlfriend** (TODO.md #8)
   - File: `backend/services/supabase-storage.js:215`
   - Azione: Eliminare media quando si elimina girlfriend
   - Impatto: Risparmio storage
   - Tempo: 2-3 ore

#### Frontend

10. **Implementare Download Immagini** (FLUTTER_ANALYSIS.md #2)
    - File: `lib/screens/girlfriend_gallery_screen.dart:196`
    - Azione: Implementare download con `dio` + `path_provider`
    - Impatto: Feature completa
    - Tempo: 2-3 ore

11. **Implementare Share Immagini** (FLUTTER_ANALYSIS.md #3)
    - File: `lib/screens/girlfriend_gallery_screen.dart:205`
    - Azione: Implementare share con `share_plus`
    - Impatto: Feature completa
    - Tempo: 1-2 ore

12. **Implementare Statistiche Girlfriend** (FLUTTER_ANALYSIS.md #4-6)
    - File: `lib/screens/girlfriend_profile_screen.dart:286-288`
    - Azione: Caricare stats reali da backend
    - Impatto: Informazioni accurate
    - Tempo: 3-4 ore
    - **Richiede**: Backend endpoint (#7)

13. **Persistenza Messaggi Random** (FLUTTER_ANALYSIS.md #1)
    - File: `lib/services/random_message_service.dart:75`
    - Azione: Salvare messaggi random in DB
    - Impatto: Storico completo
    - Tempo: 2-3 ore

---

### 🟢 PRIORITÀ BASSA (Ottimizzazioni Future)

14. **State Management Riverpod** (FLUTTER_ANALYSIS.md - Miglioramento #1)
    - Azione: Creare provider per girlfriends, groups, messages
    - Impatto: Caching, performance
    - Tempo: 6-8 ore

15. **Error Handling Centralizzato** (FLUTTER_ANALYSIS.md - Miglioramento #2)
    - Azione: Creare `ErrorHandler` utility
    - Impatto: UX consistente
    - Tempo: 3-4 ore

16. **Responsive Design** (FLUTTER_ANALYSIS.md - Miglioramento #4)
    - Azione: Implementare breakpoints mobile/tablet/desktop
    - Impatto: Supporto multi-device
    - Tempo: 8-12 ore

17. **Offline Support** (FLUTTER_ANALYSIS.md - Miglioramento #5)
    - Azione: Implementare cache locale con `sqflite`
    - Impatto: App funziona offline
    - Tempo: 12-16 ore

---

## 🗺️ Roadmap Consolidamento Integrato

### Sprint 1 (Settimana 1-2) - Cleanup & Consolidamento

**Backend**:
- [ ] Task #4: Eliminare file deprecati (1-2h)
- [ ] Task #1: Consolidare AI Engine (4-6h)
- [ ] Task #3: Persistenza evoluzione AI (3-4h)

**Frontend**:
- [ ] Task #5: Consolidare widget message bubble (4-6h)
- [ ] Task #6: Consolidare model message (2-3h)
- [ ] Aggiungere dipendenze (dio, share_plus, etc.)

**Totale**: ~20-26 ore

---

### Sprint 2 (Settimana 3-4) - Feature Complete

**Backend**:
- [ ] Task #2: Notifiche WebSocket inviti (2-3h)
- [ ] Task #7: Endpoint statistiche girlfriend (2-3h)
- [ ] Task #8: Endpoint sistema preferiti (1-2h)
- [ ] Task #9: Eliminazione media girlfriend (2-3h)

**Frontend**:
- [ ] Task #10: Download immagini (2-3h)
- [ ] Task #11: Share immagini (1-2h)
- [ ] Task #12: Statistiche girlfriend (3-4h)
- [ ] Task #13: Persistenza messaggi random (2-3h)

**Totale**: ~18-25 ore

---

### Sprint 3 (Settimana 5-6) - Miglioramenti

**Frontend**:
- [ ] Task #14: State management Riverpod (6-8h)
- [ ] Task #15: Error handling centralizzato (3-4h)

**Backend**:
- [ ] Implementare analytics (TODO.md #15)
- [ ] Implementare rate limiting (TODO.md #16)

**Totale**: ~15-20 ore

---

### Sprint 4 (Settimana 7-8) - Ottimizzazioni

**Frontend**:
- [ ] Task #16: Responsive design (8-12h)
- [ ] Task #17: Offline support (12-16h)

**Backend**:
- [ ] Testing suite
- [ ] Performance optimization

**Totale**: ~25-35 ore

---

## 📊 Metriche Consolidamento

### Prima

```
Backend:
- File JavaScript: 50
- Linee codice: ~8000
- File duplicati: 5
- TODO: 6

Frontend:
- File Dart: 40
- Linee codice: ~15000
- Widget duplicati: 2
- Model duplicati: 1
- TODO: 6

Totale TODO: 12
```

### Dopo (Target)

```
Backend:
- File JavaScript: 45 (-10%)
- Linee codice: ~7200 (-10%)
- File duplicati: 0 (-100%)
- TODO: 0 (-100%)

Frontend:
- File Dart: 38 (-5%)
- Linee codice: ~13500 (-10%)
- Widget duplicati: 0 (-100%)
- Model duplicati: 0 (-100%)
- TODO: 0 (-100%)

Totale TODO: 0 (-100%)
```

---

## ✅ Quick Wins - Immediate Actions

### Backend (< 2 ore totali)

```bash
# 1. Elimina file deprecati
cd backend/routes
rm messages.js
rm openRouterServiceForAudio.js
rm openRouterServiceForVideo.js
rm openRouterServiceForPrompt.js

# 2. Verifica nessun import
grep -r "messages\.js" ../
grep -r "openRouterServiceFor" ../

# 3. Commit
git add .
git commit -m "Remove deprecated route files"
```

### Frontend (< 2 ore totali)

```bash
# 1. Rinomina conversation_service
cd lib/services
mv conversation_service.dart conversation_metadata_service.dart

# 2. Aggiorna import
sed -i '' 's/conversation_service/conversation_metadata_service/g' ../screens/chat_screen.dart

# 3. Aggiungi dipendenze
cd ../..
# Modifica pubspec.yaml manualmente per aggiungere:
# dio, path_provider, permission_handler, share_plus

flutter pub get

# 4. Commit
git add .
git commit -m "Rename conversation_service and add dependencies"
```

---

## 🎯 Success Criteria

### Consolidamento Completato Quando:

- [ ] ✅ Tutti i file duplicati eliminati
- [ ] ✅ Tutti i TODO implementati
- [ ] ✅ Test passano (backend + frontend)
- [ ] ✅ Documentazione aggiornata
- [ ] ✅ Metriche target raggiunte
- [ ] ✅ Code review completato
- [ ] ✅ Deploy staging OK

---

## 📞 Coordinamento Team

### Backend Developer
- Responsabile: Task #1-4, #7-9
- Focus: Consolidamento AI, API endpoints, cleanup

### Frontend Developer
- Responsabile: Task #5-6, #10-13
- Focus: Consolidamento widget/model, feature implementation

### Full-Stack Developer
- Responsabile: Task #2, #14-17
- Focus: Integrazioni, state management, ottimizzazioni

---

**Fine Consolidamento** - Seguire roadmap per implementazione sistematica
