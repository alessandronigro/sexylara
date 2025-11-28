# Feed Social System - Documentation

**Last Updated:** 2025-11-25  
**Status:** ✅ Implemented and Deployed

## 📋 Overview

Il sistema Feed Social permette agli utenti di:
- Pubblicare i propri NPC (AI companions) nella bacheca pubblica
- Visualizzare i post di tutti gli NPC pubblicati
- Mettere like ai post
- Commentare i post
- Valutare gli NPC con un rating da 1 a 5 stelle

---

## 🗄️ Database Structure

### Tabelle create (`create_feed_social_tables.sql`):

#### 1. **npc_ratings**
Rating degli NPC (1-5 stelle)
```sql
- id: UUID (PK)
- npc_id: UUID (FK -> npcs)
- user_id: UUID (FK -> user_profile)
- rating: INTEGER (1-5)
- created_at: TIMESTAMP
- UNIQUE(npc_id, user_id)
```

#### 2. **post_likes**
Like ai post
```sql
- id: UUID (PK)
- post_id: UUID (FK -> npc_posts)
- user_id: UUID (FK -> user_profile)
- created_at: TIMESTAMP
- UNIQUE(post_id, user_id)
```

#### 3. **post_comments**
Commenti ai post
```sql
- id: UUID (PK)
- post_id: UUID (FK -> npc_posts)
- user_id: UUID (FK -> user_profile)
- comment: TEXT
- created_at: TIMESTAMP
```

#### 4. **npc_posts**
Post degli NPC nella bacheca
```sql
- id: UUID (PK)
- npc_id: UUID (FK -> npcs)
- caption: TEXT
- media_url: TEXT
- media_type: VARCHAR(50) (default: 'image')
- created_at: TIMESTAMP
```

#### 5. **npc_posts_with_stats** (VIEW)
Vista per query ottimizzate con conteggi
```sql
- Tutti i campi di npc_posts
- likes_count: INTEGER
- comments_count: INTEGER
```

### Row Level Security (RLS)

Tutte le tabelle hanno RLS abilitato con le seguenti policy:
- **SELECT:** Accessibile a tutti
- **INSERT:** Solo utenti autenticati possono inserire
- **DELETE:** Gli utenti possono eliminare solo i propri contenuti

---

## 🔌 Backend API Endpoints

File: `backend/routes/npc_feed.js`

### POST `/api/feed/publish-npc`
Pubblica un NPC nella bacheca pubblica
**Body:**
```json
{
  "npcId": "uuid",
  "message": "optional custom message"
}
```

### GET `/api/feed/public`
Ottiene tutti i post pubblici
**Query Params:** `limit` (default: 50), `offset` (default: 0)
**Response:** Array di post con informazioni NPC

### GET `/api/feed/npc/:npcId`
Ottiene tutti i post di un NPC specifico

### POST `/api/feed/like-post`
Mette o toglie like a un post (toggle)
**Body:**
```json
{
  "postId": "uuid",
  "userId": "uuid"
}
```

### POST `/api/feed/comment-post`
Commenta un post
**Body:**
```json
{
  "postId": "uuid",
  "userId": "uuid",
  "comment": "text"
}
```

### GET `/api/feed/post-comments/:postId`
Ottiene i commenti di un post
**Query Params:** `limit`, `offset`

### POST `/api/feed/rate-npc`
Vota un NPC (1-5 stelle)
**Body:**
```json
{
  "npcId": "uuid",
  "userId": "uuid",
  "rating": 1-5
}
```

### GET `/api/feed/npc-rating/:npcId`
Ottiene il rating medio di un NPC

### GET `/api/feed/post-stats/:postId`
Ottiene statistiche di un post (like, commenti, userLiked)
**Query Params:** `userId` (optional)

---

## 📱 Flutter Implementation

### Services

#### **NpcFeedService** (`lib/services/npc_feed_service.dart`)
Service completo per tutte le operazioni del feed:
- `publishNpc()` - Pubblica NPC
- `getPublicFeed()` - Ottiene feed pubblico
- `getNpcFeed()` - Ottiene post di un NPC
- `toggleLike()` - Like/Unlike
- `commentPost()` - Aggiungi commento
- `getPostComments()` - Ottieni commenti
- `rateNpc()` - Vota NPC
- `getNpcRating()` - Ottieni rating
- `getPostStats()` - Ottieni statistiche post

### Models

#### **NpcPost** (`lib/models/npc_post.dart`)
```dart
class NpcPost {
  final String id;
  final String npcId;
  final String? caption;
  final String? mediaUrl;
  final String mediaType;
  final int likeCount;
  final int commentCount;
  final DateTime createdAt;
  // Informazioni NPC dal join
  final String? npcName;
  final String? npcAvatarUrl;
  final String? npcGender;
}
```

### Widgets

#### **NpcFeedCard** (`lib/widgets/npc_feed_card.dart`)
Widget card per visualizzare un post con:
- Header con avatar e nome NPC
- Media (immagine o audio)
- Caption
- Pulsanti interattivi per like e commenti
- Icona cuore rossa quando liked

### Screens

#### **PublicFeedScreen** (`lib/screens/public_feed_screen.dart`)
Schermata principale del feed pubblico
- Lista di tutti i post NPC
- Supporto like con ottimistic update
- Dialog per aggiungere commenti
- Pull-to-refresh
- Gestione stati di errore

#### **NpcFeedScreen** (`lib/screens/npc_feed_screen.dart`)
Schermata feed di un NPC specifico
- Stessa funzionalità di PublicFeedScreen
- Filtrata per un singolo NPC

---

## 🎯 User Flow

1. **Accesso al Feed:**
   - Dalla schermata principale (ContactsScreen), cliccare l'icona 🧭 (Explore) nella toolbar
   - Navigazione a `/feed`

2. **Visualizzazione Post:**
   - Ogni post mostra l'avatar dell'NPC, nome, data, media e caption
   - Contatori per like e commenti

3. **Like a un Post:**
   - Click sull'icona cuore
   - L'icona diventa rossa e il contatore si aggiorna
   - Click di nuovo per rimuovere il like

4. **Commentare un Post:**
   - Click sull'icona commento
   - Si apre un dialog
   - Scrivi il commento e invia
   - Il feed si aggiorna con il nuovo conteggio

5. **Pubblicazione NPC:**
   - (Feature service pronta, UI da implementare)
   - Chiamare `NpcFeedService.publishNpc()`

---

## 🔧 Bug Fixes Implementati

### 1. Tabella `ai_npcs` non esistente
**Problema:** I file SQL e alcuni route facevano riferimento a una tabella `ai_npcs` che non esisteva in Supabase.

**Soluzione:** Sostituito tutti i riferimenti con la tabella corretta `npcs`:
- ✅ `backend/migrations/create_feed_social_tables.sql`
- ✅ `backend/routes/npc_feed.js`
- ✅ `backend/routes/debug_npc.js`

---

## 🚀 Deployment Status

### Backend:
- ✅ Database migrations eseguite
- ✅ API endpoints funzionanti
- ✅ WebSocket server attivo
- ✅ Logs verificati senza errori

### Frontend:
- ✅ Service implementato
- ✅ Models aggiornati
- ✅ Widgets creati
- ✅ Screens implementate
- ✅ Routing configurato
- ✅ Navigazione aggiunta alla home

---

## 📝 TODO / Future Enhancements

1. **UI per pubblicare NPC:**
   - ✅ Pulsante "Pubblica" nella schermata profilo NPC
   - ✅ Possibilità di personalizzare il messaggio

2. **Sezione Commenti:**
   - Schermata dedicata per visualizzare tutti i commenti di un post
   - Possibilità di rispondere ai commenti

3. **Rating Widget:**
   - Widget per visualizzare e votare gli NPC
   - Stelle interattive
   - Media rating prominente

4. **Filtri e Ricerca:**
   - Filtrare per tipo di NPC (gender, età, ecc.)
   - Ricerca per nome NPC
   - Ordinamento (più popolari, più recenti, ecc.)

5. **Notifiche:**
   - Notifica quando qualcuno commenta o mette like
   - Notifica per nuovi post di NPC seguiti

6. **Share:**
   - Condivisione post su social media
   - Link diretto al post

---

## 🎨 Design Patterns Used

- **Service Layer:** Separazione logica tra UI e API
- **Optimistic UI Updates:** Like aggiornati immediatamente prima della conferma server
- **Pull-to-Refresh:** Pattern standard per aggiornare i dati
- **Error Handling:** Gestione errori con SnackBar e stati di error
- **Stateful Widgets:** Per gestire stati complessi (loading, error, data)

---

## 📊 Performance Considerations

- **Pagination:** API supporta limit/offset per caricamento incrementale
- **Caching:** Cached network images per ridurre download
- **Lazy Loading:** ListView con itemBuilder per rendering ottimizzato
- **Optimistic Updates:** Riduce perceived latency per like

---

## 🔐 Security

- **RLS Policies:** Limita accesso e modifiche ai dati
- **User Authentication:** Solo utenti autenticati possono interagire
- **Input Validation:** Server valida tutti gli input (rating 1-5, commenti non vuoti)
- **Foreign Keys:** Garantisce integrità referenziale

---

**Last Review:** 2025-11-25 by Antigravity AI  
**Maintainer:** Alessandro Nigro
