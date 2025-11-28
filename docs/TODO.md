# 📋 ThrillMe - TODO List & Action Items

> **Ultima revisione**: 25 Novembre 2025  
> **Priorità**: 🔴 Alta | 🟡 Media | 🟢 Bassa

---

## ✅ COMPLETAMENTI RECENTI

### Feed Social System (25 Nov 2025)
**Status**: ✅ Completato e Deployato

**Implementazione**:
- ✅ Database: Tabelle `npc_posts`, `post_likes`, `post_comments`, `npc_ratings`
- ✅ Backend: API complete in `backend/routes/npc_feed.js`
- ✅ Flutter: Service, Models, Widgets, Screens
- ✅ UI: Feed pubblico accessibile dalla home (`Icons.explore`)
- ✅ UI: Pubblicazione NPC dal profilo con messaggio personalizzato
- ✅ Funzionalità: Like, Commenti, Rating, Pubblicazione NPC
- ✅ Bug Fix: Risolto problema tabella `ai_npcs` → `npcs`

**Documentazione**: `FEED_SOCIAL_SYSTEM.md`

---

## 🔴 PRIORITÀ ALTA - Critici per Produzione

### 1. Consolidamento AI Engine
**File**: `backend/ai/Brain.js` vs `backend/ai/brainEngine.js`

**Problema**: Esistono due implementazioni del Brain Engine:
- `Brain.js`: Più completo, con orchestrazione di tutti gli engine
- `brainEngine.js`: Attualmente in uso, ma meno strutturato

**Azione**:
```bash
# 1. Analizzare differenze
# 2. Migrare funzionalità di Brain.js in brainEngine.js
# 3. Eliminare Brain.js
# 4. Aggiornare imports
```

**Impatto**: Riduce confusione, migliora manutenibilità

---

### 2. Sistema Notifiche WebSocket per Inviti
**File**: `backend/routes/groupManagement.js:29`

**Problema**: Quando un utente riceve un invito, non viene notificato in real-time

**Azione**:
```javascript
// In groupManagement.js dopo creazione invito
const { getWsConnectionForUser } = require('../utils/wsManager');
const wsConnection = getWsConnectionForUser(receiverId);
if (wsConnection) {
  wsConnection.send(JSON.stringify({
    type: 'group_invite',
    invite: inviteData
  }));
}
```

**Impatto**: Migliora UX, notifiche immediate

---

### 3. Persistenza Evoluzione AI
**File**: `backend/routes/openRouterService.js:42`

**Problema**: Gli aggiornamenti di stato AI (XP, intimacy, mood) non vengono salvati

**Azione**:
```javascript
// Dopo generazione risposta
if (brainResult.npcStateUpdates) {
  await supabase
    .from('npcs')
    .update({
      stats: brainResult.npcStateUpdates.stats,
      traits: brainResult.npcStateUpdates.traits,
      long_term_memory: brainResult.npcStateUpdates.memory
    })
    .eq('id', npcId);
}
```

**Impatto**: AI evolvono realmente nel tempo

---

### 4. Cleanup File Deprecati
**Files**: 
- `backend/routes/messages.js` (223 bytes, quasi vuoto)
- `backend/routes/openRouterServiceForAudio.js`
- `backend/routes/openRouterServiceForVideo.js`
- `backend/routes/openRouterServiceForPrompt.js`

**Azione**:
```bash
# 1. Verificare che non ci siano import attivi
grep -r "messages.js" backend/
grep -r "openRouterServiceForAudio" backend/
grep -r "openRouterServiceForVideo" backend/
grep -r "openRouterServiceForPrompt" backend/

# 2. Se non usati, eliminare
rm backend/routes/messages.js
rm backend/routes/openRouterServiceForAudio.js
rm backend/routes/openRouterServiceForVideo.js
rm backend/routes/openRouterServiceForPrompt.js

# 3. Consolidare logica in file principali
```

**Impatto**: Riduce complessità, evita confusione

---

## 🟡 PRIORITÀ MEDIA - Miglioramenti UX

### 5. Notifiche Push Utenti
**File**: `backend/routes/groupInvite.js:96`

**Problema**: Utenti invitati non ricevono notifica push quando app è chiusa

**Azione**:
```javascript
// Integrare Firebase Cloud Messaging
const admin = require('firebase-admin');

async function sendPushNotification(userId, title, body) {
  const { data: userTokens } = await supabase
    .from('user_devices')
    .select('fcm_token')
    .eq('user_id', userId);
  
  if (userTokens && userTokens.length > 0) {
    const tokens = userTokens.map(t => t.fcm_token);
    await admin.messaging().sendMulticast({
      tokens,
      notification: { title, body }
    });
  }
}

// Usare dopo creazione invito
await sendPushNotification(
  receiverId,
  'Nuovo invito gruppo!',
  `${senderName} ti ha invitato in ${groupName}`
);
```

**Impatto**: Migliora engagement, riduce inviti persi

---

### 6. Conteggi Statistiche NPC
**File**: `lib/screens/npc_profile_screen.dart:286-288`

**Problema**: Statistiche mostrano valori hardcoded (0, "No")

**Azione**:
```dart
// Aggiungere query per conteggi
Future<Map<String, dynamic>> _loadNPCStats(String npcId) async {
  final userId = SupabaseService.currentUser?.id;
  
  // Conta messaggi
  final messagesCount = await SupabaseService.client
    .from('messages')
    .select('id', const FetchOptions(count: CountOption.exact))
    .eq('npc_id', npcId)
    .eq('user_id', userId);
  
  // Conta foto
  final photosCount = await SupabaseService.client
    .from('messages')
    .select('id', const FetchOptions(count: CountOption.exact))
    .eq('npc_id', npcId)
    .eq('user_id', userId)
    .eq('type', 'image');
  
  // Check preferita
  final isFavorite = await SupabaseService.client
    .from('user_preferences')
    .select('favorite_npc_id')
    .eq('user_id', userId)
    .single();
  
  return {
    'messages': messagesCount.count ?? 0,
    'photos': photosCount.count ?? 0,
    'isFavorite': isFavorite.data?['favorite_npc_id'] == npcId
  };
}
```

**Impatto**: Statistiche reali, migliore engagement

---

### 7. Download & Share Immagini Gallery
**File**: `lib/screens/npc_gallery_screen.dart:196,205`

**Problema**: Pulsanti download/share non funzionanti

**Azione**:
```dart
// Download
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

Future<void> _downloadImage(String url) async {
  if (await Permission.storage.request().isGranted) {
    final dir = await getExternalStorageDirectory();
    final filename = url.split('/').last;
    final filepath = '${dir!.path}/$filename';
    
    await Dio().download(url, filepath);
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Immagine salvata in $filepath'))
    );
  }
}

// Share
import 'package:share_plus/share_plus.dart';

Future<void> _shareImage(String url) async {
  await Share.share(url, subject: 'Guarda questa foto!');
}
```

**Impatto**: Funzionalità complete, migliore UX

---

### 8. Eliminazione Media NPC
**File**: `backend/services/supabase-storage.js:215`

**Problema**: Quando si elimina npc, i media rimangono in storage

**Azione**:
```javascript
async function deleteNPCFiles(npcId) {
  try {
    // Elimina avatar
    await supabase.storage
      .from('avatars')
      .remove([`npcs/${npcId}`]);
    
    // Elimina chat images
    const { data: images } = await supabase.storage
      .from('chat-images')
      .list('', { prefix: `${npcId}/` });
    
    if (images && images.length > 0) {
      const imagePaths = images.map(img => `${npcId}/${img.name}`);
      await supabase.storage.from('chat-images').remove(imagePaths);
    }
    
    // Elimina video
    const { data: videos } = await supabase.storage
      .from('chat-videos')
      .list('', { prefix: `${npcId}/` });
    
    if (videos && videos.length > 0) {
      const videoPaths = videos.map(v => `${npcId}/${v.name}`);
      await supabase.storage.from('chat-videos').remove(videoPaths);
    }
    
    // Elimina audio
    const { data: audios } = await supabase.storage
      .from('chat-audios')
      .list('', { prefix: `${npcId}/` });
    
    if (audios && audios.length > 0) {
      const audioPaths = audios.map(a => `${npcId}/${a.name}`);
      await supabase.storage.from('chat-audios').remove(audioPaths);
    }
    
    console.log(`✅ Deleted all files for npc ${npcId}`);
  } catch (error) {
    console.error('Error deleting npc files:', error);
    throw error;
  }
}
```

**Impatto**: Risparmio storage, cleanup completo

---

## 🟢 PRIORITÀ BASSA - Ottimizzazioni Future

### 9. Ruoli Dinamici Gruppo
**File**: `backend/server-ws.js:774`

**Problema**: Ruoli gruppo determinati staticamente, non usano dinamiche salvate

**Azione**:
```javascript
function _determineGroupRole(ai, dynamics) {
  if (!dynamics || !dynamics.leadership) {
    // Fallback attuale
    return roleMap[ai.personality_type] || 'membro attivo';
  }
  
  // Logica avanzata basata su dinamiche
  const leadershipScore = dynamics.leadership[ai.id] || 0;
  const popularityScore = dynamics.popularity?.[ai.id] || 0;
  const activityScore = dynamics.activity?.[ai.id] || 0;
  
  if (leadershipScore > 0.8) return 'leader del gruppo';
  if (popularityScore > 0.7) return 'membro popolare';
  if (activityScore < 0.3) return 'osservatrice silenziosa';
  
  // Check relazioni specifiche
  const hasRivalry = Object.values(dynamics.relationships || {})
    .some(rel => rel.includes('rivalità') && rel.includes(ai.name));
  
  if (hasRivalry) return 'membro in conflitto';
  
  return 'membro attivo';
}
```

**Impatto**: Dinamiche gruppo più realistiche

---

### 10. Bonus Memoria Sociale
**File**: `backend/ai/engines/SocialEngine.js:39`

**Problema**: Non viene verificato se AI conosce già membri del gruppo

**Azione**:
```javascript
// In SocialEngine.decideJoinGroup()
async function checkExistingRelationships(aiId, groupId) {
  // Recupera membri del gruppo
  const { data: members } = await supabase
    .from('group_members')
    .select('member_id')
    .eq('group_id', groupId);
  
  if (!members) return 0;
  
  // Controlla memoria AI per menzioni di questi membri
  const { data: ai } = await supabase
    .from('npcs')
    .select('long_term_memory')
    .eq('id', aiId)
    .single();
  
  if (!ai || !ai.long_term_memory) return 0;
  
  // Conta quanti membri sono menzionati nella memoria
  const knownMembers = members.filter(m => 
    ai.long_term_memory.includes(m.member_id)
  ).length;
  
  // Bonus: +0.1 per ogni membro conosciuto
  return knownMembers * 0.1;
}

// Usare in calcolo probabilità
const relationshipBonus = await checkExistingRelationships(ai.id, groupId);
probability += relationshipBonus;
```

**Impatto**: Decisioni AI più intelligenti

---

### 11. Persistenza Messaggi Random
**File**: `lib/services/random_message_service.dart:75`

**Problema**: Messaggi random non salvati, persi al riavvio app

**Azione**:
```dart
Future<void> _sendRandomMessage(String npcId, String message) async {
  final userId = SupabaseService.currentUser?.id;
  if (userId == null) return;
  
  // Salva messaggio nel database
  await SupabaseService.client.from('messages').insert({
    'user_id': userId,
    'npc_id': npcId,
    'role': 'assistant',
    'type': 'text',
    'content': message,
    'session_id': DateTime.now().toIso8601String().substring(0, 10),
    'is_random': true  // Flag per distinguere messaggi random
  });
  
  // Mostra notifica
  _notificationService.showMessageNotification(
    npcName: npcName,
    message: message,
    npcId: npcId,
  );
}
```

**Impatto**: Storico completo conversazioni

---

## 🛠️ REFACTORING CONSIGLIATI

### 12. Centralizzare Configurazione Porte
**Files**: Vari

**Problema**: Porte hardcoded in più file

**Azione**:
```javascript
// backend/config/constants.js
module.exports = {
  PORTS: {
    API: process.env.API_PORT || 4000,
    WS: process.env.WS_PORT || 5001
  },
  LIMITS: {
    MAX_MESSAGE_LENGTH: 5000,
    MAX_GROUP_MEMBERS: 20,
    MAX_IMAGES_PER_DAY: 50
  },
  TIMEOUTS: {
    WS_PING: 30000,
    AI_RESPONSE: 60000,
    MEDIA_GENERATION: 120000
  }
};

// Usare ovunque
const { PORTS, LIMITS, TIMEOUTS } = require('./config/constants');
```

**Impatto**: Configurazione centralizzata, facile manutenzione

---

### 13. Utility per WebSocket Manager
**File**: Nuovo `backend/utils/wsManager.js`

**Problema**: Gestione connessioni WS sparsa nel codice

**Azione**:
```javascript
// backend/utils/wsManager.js
class WebSocketManager {
  constructor() {
    this.connections = new Map(); // userId -> WebSocket
  }
  
  addConnection(userId, ws) {
    this.connections.set(userId, ws);
    console.log(`✅ User ${userId} connected. Total: ${this.connections.size}`);
  }
  
  removeConnection(userId) {
    this.connections.delete(userId);
    console.log(`❌ User ${userId} disconnected. Total: ${this.connections.size}`);
  }
  
  getConnection(userId) {
    return this.connections.get(userId);
  }
  
  sendToUser(userId, message) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  
  broadcast(message, excludeUserId = null) {
    let sent = 0;
    this.connections.forEach((ws, userId) => {
      if (userId !== excludeUserId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        sent++;
      }
    });
    return sent;
  }
}

module.exports = new WebSocketManager();
```

**Impatto**: Gestione WS centralizzata, riutilizzabile

---

### 14. Error Handling Middleware
**File**: `backend/middleware/errorHandler.js`

**Problema**: Error handling inconsistente tra route

**Azione**:
```javascript
// backend/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err);
  
  // Log dettagliato
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    userId: req.headers['x-user-id']
  };
  
  logToFile(JSON.stringify(errorLog));
  
  // Risposta al client
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = errorHandler;

// Usare in server-api.js
app.use(errorHandler);
```

**Impatto**: Error handling consistente, debugging facilitato

---

## 📊 METRICHE & MONITORING

### 15. Implementare Analytics
**Nuovo**: `backend/services/analytics.js`

**Azione**:
```javascript
// backend/services/analytics.js
const { supabase } = require('../lib/supabase');

class Analytics {
  async trackEvent(userId, eventName, properties = {}) {
    await supabase.from('analytics_events').insert({
      user_id: userId,
      event_name: eventName,
      properties,
      timestamp: new Date().toISOString()
    });
  }
  
  async trackMessageSent(userId, npcId, type) {
    await this.trackEvent(userId, 'message_sent', {
      npc_id: npcId,
      message_type: type
    });
  }
  
  async trackMediaGenerated(userId, mediaType, success) {
    await this.trackEvent(userId, 'media_generated', {
      media_type: mediaType,
      success
    });
  }
  
  async getUserStats(userId, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const { data } = await supabase
      .from('analytics_events')
      .select('event_name, properties')
      .eq('user_id', userId)
      .gte('timestamp', since.toISOString());
    
    return {
      totalEvents: data?.length || 0,
      messagesSent: data?.filter(e => e.event_name === 'message_sent').length || 0,
      mediaGenerated: data?.filter(e => e.event_name === 'media_generated').length || 0
    };
  }
}

module.exports = new Analytics();
```

**Impatto**: Dati per decisioni product, ottimizzazioni

---

## 🔒 SICUREZZA

### 16. Rate Limiting
**Nuovo**: `backend/middleware/rateLimiter.js`

**Azione**:
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

const limiter = rateLimit({
  store: new RedisStore({ client }),
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // max 100 richieste per finestra
  message: 'Troppe richieste, riprova tra qualche minuto',
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter più restrittivo per media generation
const mediaLimiter = rateLimit({
  store: new RedisStore({ client }),
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 20, // max 20 media/ora
  message: 'Limite generazione media raggiunto'
});

module.exports = { limiter, mediaLimiter };

// Usare in server-api.js
const { limiter, mediaLimiter } = require('./middleware/rateLimiter');
app.use('/api', limiter);
app.use('/api/generate-avatar', mediaLimiter);
```

**Impatto**: Previene abusi, protegge risorse

---

### 17. Input Sanitization
**Nuovo**: `backend/middleware/sanitizer.js`

**Azione**:
```javascript
const validator = require('validator');
const xss = require('xss');

function sanitizeInput(req, res, next) {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
        req.body[key] = validator.escape(req.body[key]);
      }
    });
  }
  
  // Sanitize query params
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
        req.query[key] = validator.escape(req.query[key]);
      }
    });
  }
  
  next();
}

module.exports = sanitizeInput;

// Usare in server-api.js
app.use(sanitizeInput);
```

**Impatto**: Previene XSS, injection attacks

---

## 🧪 TESTING

### 18. Unit Tests per AI Engines
**Nuovo**: `backend/ai/__tests__/`

**Azione**:
```javascript
// backend/ai/__tests__/brainEngine.test.js
const { brainEngine } = require('../brainEngine');

describe('BrainEngine', () => {
  describe('generateIntelligentResponse', () => {
    it('should generate chat response for simple message', async () => {
      const result = await brainEngine.generateIntelligentResponse({
        ai: { name: 'Test AI', personality_type: 'friendly' },
        user: { name: 'Test User' },
        group: null,
        message: 'ciao',
        recentMessages: []
      });
      
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('type');
      expect(result.type).toBe('chat');
    });
    
    it('should handle errors gracefully', async () => {
      const result = await brainEngine.generateIntelligentResponse({
        ai: null, // Invalid input
        user: null,
        group: null,
        message: '',
        recentMessages: []
      });
      
      expect(result.output).toContain('cercando le parole');
      expect(result.type).toBe('chat');
    });
  });
});

// Run tests
// npm test
```

**Impatto**: Codice più robusto, regression prevention

---

## 📅 ROADMAP IMPLEMENTAZIONE

### Sprint 1 (Settimana 1-2)
- [ ] Task 4: Cleanup file deprecati
- [ ] Task 1: Consolidamento AI Engine
- [ ] Task 14: Error handling middleware

### Sprint 2 (Settimana 3-4)
- [ ] Task 3: Persistenza evoluzione AI
- [ ] Task 2: Notifiche WebSocket inviti
- [ ] Task 8: Eliminazione media npc

### Sprint 3 (Settimana 5-6)
- [ ] Task 5: Notifiche push
- [ ] Task 6: Statistiche npc
- [ ] Task 7: Download/share immagini

### Sprint 4 (Settimana 7-8)
- [ ] Task 15: Analytics
- [ ] Task 16: Rate limiting
- [ ] Task 17: Input sanitization

### Sprint 5 (Settimana 9+)
- [ ] Task 9-11: Ottimizzazioni bassa priorità
- [ ] Task 18: Testing suite
- [ ] Task 12-13: Refactoring generale

---

**Note**: Questa lista è viva e deve essere aggiornata man mano che i task vengono completati o nuovi requisiti emergono.
