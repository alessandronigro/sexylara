# 📡 Documentazione API - ThrillMe

> **Guida completa alle API REST e WebSocket di ThrillMe**

**Versione**: 2.0  
**Base URL**: `http://localhost:4000` (development)  
**WebSocket URL**: `ws://localhost:5001/ws`

---

## 📋 Indice

1. [Autenticazione](#autenticazione)
2. [NPC Endpoints](#npc-endpoints)
3. [Messaggi Endpoints](#messaggi-endpoints)
4. [Gruppi Endpoints](#gruppi-endpoints)
5. [Utenti Endpoints](#utenti-endpoints)
6. [Media Generation](#media-generation)
7. [WebSocket API](#websocket-api)
8. [Errori e Codici di Stato](#errori-e-codici-di-stato)

---

## 🔐 Autenticazione

Tutte le richieste API (eccetto `/api/auth/*`) richiedono l'header:
```
x-user-id: {userId}
```

L'`userId` viene ottenuto dal token JWT di Supabase Auth.

### POST /api/auth/login
Autentica un utente esistente.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

### POST /api/auth/register
Registra un nuovo utente.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "username"
}
```

**Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username"
  },
  "session": {
    "access_token": "jwt_token"
  }
}
```

### GET /api/auth/me
Ottiene il profilo dell'utente corrente.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "username": "username",
    "avatar_url": "https://...",
    "is_public": true
  }
}
```

---

## 👤 NPC Endpoints

### GET /api/npcs
Lista tutte le NPC dell'utente corrente.

**Headers**:
```
x-user-id: {userId}
```

**Query Parameters**:
- `is_public` (boolean, optional): Filtra per NPC pubbliche

**Response** (200):
```json
{
  "npcs": [
    {
      "id": "uuid",
      "name": "Lara",
      "avatar_url": "https://...",
      "is_public": false,
      "personality_type": "playful",
      "tone": "flirty",
      "age": 25,
      "gender": "female",
      "stats": {
        "attachment": 50,
        "intimacy": 30,
        "trust": 40,
        "xp": 100
      },
      "current_mood": "happy"
    }
  ]
}
```

### POST /api/npcs
Crea una nuova NPC.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "name": "Lara",
  "personality_type": "playful",
  "tone": "flirty",
  "age": 25,
  "gender": "female",
  "bio": "Descrizione NPC"
}
```

**Response** (201):
```json
{
  "npc": {
    "id": "uuid",
    "name": "Lara",
    "user_id": "uuid",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

### GET /api/npcs/:id
Ottiene dettagli di una NPC specifica.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "npc": {
    "id": "uuid",
    "name": "Lara",
    "avatar_url": "https://...",
    "personality_type": "playful",
    "tone": "flirty",
    "stats": { ... },
    "current_mood": "happy"
  }
}
```

### PUT /api/npcs/:id
Aggiorna una NPC esistente.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "name": "Lara Updated",
  "tone": "romantic"
}
```

**Response** (200):
```json
{
  "npc": {
    "id": "uuid",
    "name": "Lara Updated",
    ...
  }
}
```

### DELETE /api/npcs/:id
Elimina una NPC e tutti i suoi dati associati.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "success": true,
  "message": "NPC deleted successfully"
}
```

### PUT /api/npcs/:id/privacy
Aggiorna la visibilità pubblica di una NPC.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "isPublic": true
}
```

**Response** (200):
```json
{
  "success": true,
  "isPublic": true
}
```

---

## 💬 Messaggi Endpoints

### GET /api/chat-history/:userId/:npcId
Ottiene la cronologia chat tra utente e NPC.

**Headers**:
```
x-user-id: {userId}
```

**Query Parameters**:
- `limit` (number, default: 50): Numero massimo di messaggi
- `offset` (number, default: 0): Offset per paginazione

**Response** (200):
```json
[
  {
    "id": "uuid",
    "role": "user",
    "type": "text",
    "content": "Ciao!",
    "created_at": "2025-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "role": "assistant",
    "type": "text",
    "content": "Ciao! Come stai?",
    "created_at": "2025-01-01T00:01:00Z"
  }
]
```

### POST /api/photos/comment
Carica una foto e ottiene un commento dalla NPC.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "userId": "uuid",
  "npcId": "uuid",
  "filename": "photo.jpg",
  "imageBase64": "base64_encoded_image"
}
```

**Response** (200):
```json
{
  "userMessage": {
    "id": "uuid",
    "role": "user",
    "type": "image",
    "content": "https://...",
    "created_at": "2025-01-01T00:00:00Z"
  },
  "assistantMessage": {
    "id": "uuid",
    "role": "assistant",
    "type": "chat",
    "content": "Che bella foto!",
    "created_at": "2025-01-01T00:00:01Z"
  }
}
```

### GET /api/npc-gallery/:userId/:npcId
Ottiene la galleria immagini di una chat.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
[
  "https://storage.supabase.co/.../image1.jpg",
  "https://storage.supabase.co/.../image2.jpg"
]
```

---

## 👥 Gruppi Endpoints

### GET /api/groups
Lista tutti i gruppi dell'utente.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "Gruppo Amici",
      "user_id": "uuid",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/groups
Crea un nuovo gruppo.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "name": "Gruppo Amici"
}
```

**Response** (201):
```json
{
  "group": {
    "id": "uuid",
    "name": "Gruppo Amici",
    "user_id": "uuid",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

### GET /api/groups/:id
Ottiene dettagli di un gruppo.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "group": {
    "id": "uuid",
    "name": "Gruppo Amici",
    "members": [
      {
        "id": "uuid",
        "type": "user",
        "name": "User",
        "role": "owner"
      },
      {
        "id": "uuid",
        "type": "npc",
        "name": "Lara",
        "role": "member"
      }
    ]
  }
}
```

### DELETE /api/groups/:id
Elimina un gruppo (solo owner).

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "success": true
}
```

### GET /api/groups/:id/messages
Ottiene i messaggi di un gruppo.

**Headers**:
```
x-user-id: {userId}
```

**Query Parameters**:
- `limit` (number, default: 50)
- `offset` (number, default: 0)

**Response** (200):
```json
{
  "messages": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "sender_name": "User",
      "type": "text",
      "content": "Ciao a tutti!",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/groups/:id/messages
Invia un messaggio in un gruppo (via REST, preferibile WebSocket).

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "content": "Ciao a tutti!",
  "type": "text"
}
```

**Response** (201):
```json
{
  "message": {
    "id": "uuid",
    "sender_id": "uuid",
    "content": "Ciao a tutti!",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

## 👤 Utenti Endpoints

### GET /api/users/me
Ottiene il profilo dell'utente corrente.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "username": "username",
    "avatar_url": "https://...",
    "is_public": true
  }
}
```

### GET /api/users/thrillers
Lista utenti pubblici e NPC pubbliche (per discovery).

**Headers**:
```
x-user-id: {userId}
```

**Query Parameters**:
- `search` (string, optional): Filtra per nome

**Response** (200):
```json
{
  "thrillers": [
    {
      "id": "uuid",
      "name": "User",
      "avatar": "https://...",
      "type": "user"
    },
    {
      "id": "uuid",
      "name": "Lara",
      "avatar": "https://...",
      "type": "npc",
      "ownerId": "uuid"
    }
  ]
}
```

### GET /api/users/contacts
Lista contatti (utenti e NPC) ottenuti tramite inviti accettati.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "contacts": [
    {
      "id": "uuid",
      "type": "user",
      "name": "User",
      "avatar": "https://..."
    },
    {
      "id": "uuid",
      "type": "npc",
      "name": "Lara",
      "avatar": "https://...",
      "ownerId": "uuid"
    }
  ]
}
```

### POST /api/users/invite
Invia un invito per aggiungere un contatto.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "targetId": "uuid",
  "targetType": "user" | "npc",
  "message": "Messaggio opzionale"
}
```

**Response** (201):
```json
{
  "success": true,
  "invite": {
    "id": "uuid",
    "sender_id": "uuid",
    "receiver_id": "uuid",
    "status": "pending"
  }
}
```

### GET /api/users/invites/pending
Lista inviti in sospeso per l'utente corrente.

**Headers**:
```
x-user-id: {userId}
```

**Response** (200):
```json
{
  "invites": [
    {
      "id": "uuid",
      "status": "pending",
      "targetType": "npc",
      "targetId": "uuid",
      "targetName": "Lara",
      "message": "Vuoi aggiungere Lara?",
      "senderId": "uuid",
      "senderName": "User",
      "senderAvatar": "https://...",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/users/invites/:id/respond
Accetta o rifiuta un invito.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "accept": true
}
```

**Response** (200):
```json
{
  "success": true,
  "status": "accepted"
}
```

### PUT /api/users/settings/privacy
Aggiorna impostazioni privacy utente.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "isPublic": true
}
```

**Response** (200):
```json
{
  "success": true,
  "isPublic": true
}
```

### PUT /api/users/settings/profile
Aggiorna profilo utente.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "displayName": "New Name",
  "isPublic": true
}
```

**Response** (200):
```json
{
  "success": true
}
```

---

## 🎨 Media Generation

### POST /api/generate-avatar
Genera un avatar per una NPC.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "prompt": "Beautiful woman, long hair, smiling",
  "npcId": "uuid"
}
```

**Response** (200):
```json
{
  "imageUrl": "https://storage.supabase.co/.../avatar.jpg"
}
```

### POST /api/audio/upload
Carica un file audio.

**Headers**:
```
x-user-id: {userId}
```

**Request**:
```json
{
  "userId": "uuid",
  "npcId": "uuid",
  "filename": "audio.m4a",
  "audioBase64": "base64_encoded_audio"
}
```

**Response** (200):
```json
{
  "url": "https://storage.supabase.co/.../audio.m4a",
  "path": "userId/npcId/audio.m4a"
}
```

---

## 🔌 WebSocket API

### Connessione

```
ws://localhost:5001/ws?user_id={userId}&npc_id={npcId}
```

**Parametri Query**:
- `user_id` (required): ID utente
- `npc_id` (optional): ID NPC per chat 1-to-1

### Eventi Client → Server

#### Messaggio Testo (Chat 1-to-1)
```json
{
  "text": "Ciao!",
  "traceId": "uuid",
  "npc_id": "uuid"
}
```

#### Messaggio Testo (Gruppo)
```json
{
  "text": "Ciao a tutti!",
  "traceId": "uuid",
  "group_id": "uuid"
}
```

#### Media Upload
```json
{
  "text": "Ecco una foto",
  "traceId": "uuid",
  "npc_id": "uuid",
  "mediaType": "image",
  "mediaUrl": "https://..."
}
```

### Eventi Server → Client

#### ACK
```json
{
  "traceId": "uuid",
  "type": "ack",
  "serverId": "uuid"
}
```

#### Messaggio Testo
```json
{
  "traceId": "uuid",
  "role": "assistant",
  "type": "chat",
  "content": "Ciao! Come stai?",
  "npc_id": "uuid"
}
```

#### Messaggio Gruppo
```json
{
  "traceId": "uuid",
  "role": "assistant",
  "type": "group_message",
  "content": "Ciao!",
  "sender_id": "uuid",
  "sender_name": "Lara",
  "avatar": "https://...",
  "group_id": "uuid",
  "messageId": "uuid"
}
```

#### Media Generation Started
```json
{
  "event": "media_generation_started",
  "tempId": "uuid",
  "npcId": "uuid",
  "mediaType": "photo" | "video" | "audio",
  "traceId": "uuid"
}
```

#### Media Generation Completed
```json
{
  "event": "media_generation_completed",
  "tempId": "uuid",
  "mediaType": "photo",
  "finalUrl": "https://...",
  "caption": "Ecco la foto!",
  "messageId": "uuid",
  "npcId": "uuid"
}
```

#### Media Generation Failed
```json
{
  "event": "media_generation_failed",
  "tempId": "uuid",
  "error": "Error message"
}
```

#### NPC Status
```json
{
  "event": "npc_status",
  "npcId": "uuid",
  "status": "typing" | "sending_image" | "sending_video" | "recording_audio" | "",
  "traceId": "uuid"
}
```

#### Fine Conversazione
```json
{
  "traceId": "uuid",
  "end": true
}
```

---

## ❌ Errori e Codici di Stato

### Codici HTTP

- `200 OK`: Richiesta completata con successo
- `201 Created`: Risorsa creata con successo
- `400 Bad Request`: Richiesta malformata
- `401 Unauthorized`: Autenticazione richiesta
- `403 Forbidden`: Autorizzazione negata
- `404 Not Found`: Risorsa non trovata
- `500 Internal Server Error`: Errore server

### Formato Errori

```json
{
  "error": "Error message description"
}
```

### Errori Comuni

#### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
**Causa**: Header `x-user-id` mancante o non valido.

#### 400 Bad Request
```json
{
  "error": "targetId e targetType sono obbligatori"
}
```
**Causa**: Parametri richiesti mancanti o non validi.

#### 404 Not Found
```json
{
  "error": "NPC non trovato"
}
```
**Causa**: Risorsa richiesta non esiste.

#### 500 Internal Server Error
```json
{
  "error": "Failed to generate avatar"
}
```
**Causa**: Errore interno del server (log per dettagli).

---

## 📝 Note

### Rate Limiting
Attualmente non implementato. Pianificato per produzione.

### Paginazione
Gli endpoint che restituiscono liste supportano:
- `limit`: Numero massimo di risultati (default: 50)
- `offset`: Offset per paginazione (default: 0)

### Versioning
API attualmente non versionate. Versioning pianificato per v3.0.

### WebSocket Reconnection
Il client dovrebbe implementare:
- Auto-reconnect con exponential backoff
- Gestione disconnessioni
- Retry per messaggi non confermati

---

**Ultima revisione**: Gennaio 2025  
**Mantenuto da**: Team ThrillMe







