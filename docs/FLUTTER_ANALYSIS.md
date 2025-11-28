# 📱 ThrillMe Flutter - Analisi e Consolidamento

> **Ultima revisione**: 24 Novembre 2025  
> **Obiettivo**: Documentazione completa app Flutter + identificazione duplicati e TODO

---

## 📊 Panoramica App Flutter

### Statistiche

```
Totale file Dart:        40 file
Dimensione totale:       ~120 KB

Breakdown:
- Screens:               16 file (40%)
- Services:              9 file (22.5%)
- Widgets:               5 file (12.5%)
- Models:                5 file (12.5%)
- Providers:             1 file (2.5%)
- Config + Main:         2 file (5%)
- L10n:                  2 file (5%)
```

---

## 🏗️ Architettura Flutter

### Struttura Directory

```
lib/
├── main.dart                    # Entry point + routing (GoRouter)
├── config.dart                  # Configurazione API/WS
│
├── screens/                     # 16 schermate UI
│   ├── splash_screen.dart
│   ├── login_screen.dart
│   ├── register_screen.dart
│   ├── contacts_screen.dart           # Lista npcs
│   ├── chat_screen.dart               # Chat 1-to-1
│   ├── create_npc_screen.dart
│   ├── npc_profile_screen.dart
│   ├── npc_gallery_screen.dart
│   ├── group_list_screen.dart         # Lista gruppi
│   ├── group_chat_screen.dart         # Chat gruppo
│   ├── create_group_screen.dart
│   ├── group_invite_screen.dart       # Invita AI
│   ├── invite_user_screen.dart        # Invita utenti
│   ├── user_profile_screen.dart
│   ├── privacy_settings_screen.dart
│   ├── preference_screen.dart
│   ├── subscription_screen.dart
│   └── payment_success_screen.dart
│
├── services/                    # 9 servizi business logic
│   ├── supabase_service.dart          # Auth + DB client
│   ├── chat_service.dart              # WebSocket chat 1-to-1
│   ├── conversation_service.dart      # ⚠️ DUPLICATO? Gestione conversazioni
│   ├── npc_service.dart        # CRUD npcs
│   ├── group_service.dart             # API gruppi
│   ├── ai_contact_service.dart        # AI pubbliche
│   ├── user_service.dart              # Gestione utente
│   ├── notification_service.dart      # Notifiche locali
│   └── random_message_service.dart    # Messaggi random AI
│
├── widgets/                     # 5 widget riutilizzabili
│   ├── chat_input.dart
│   ├── chat_message_bubble.dart       # Bubble per chat gruppo
│   ├── message_bubble.dart            # ⚠️ DUPLICATO? Bubble per chat 1-to-1
│   ├── conversation_tile.dart
│   └── npc_avatar.dart
│
├── models/                      # 5 data models
│   ├── message.dart
│   ├── chat_message.dart              # ⚠️ DUPLICATO di message.dart?
│   ├── npc.dart
│   ├── conversation.dart
│   └── credit_package.dart
│
├── providers/                   # 1 provider (Riverpod)
│   └── session_provider.dart          # Gestione sessione auth
│
└── l10n/                        # Localizzazione (future)
    └── app_en.arb
```

---

## 🔍 Analisi TODO

### TODO Trovati (6 totali)

#### 1. **random_message_service.dart:75**
```dart
// TODO: Optionally save this message to the database
```

**Problema**: Messaggi random non persistiti  
**Impatto**: Storico conversazioni incompleto  
**Priorità**: 🟡 Media

**Soluzione**:
```dart
Future<void> _sendRandomMessage(String npcId, String message) async {
  final userId = SupabaseService.currentUser?.id;
  if (userId == null) return;
  
  // Salva nel database
  await SupabaseService.client.from('messages').insert({
    'user_id': userId,
    'npc_id': npcId,
    'role': 'assistant',
    'type': 'text',
    'content': message,
    'session_id': DateTime.now().toIso8601String().substring(0, 10),
    'is_random': true  // Flag per distinguere
  });
  
  // Mostra notifica
  _notificationService.showMessageNotification(
    npcName: npcName,
    message: message,
    npcId: npcId,
  );
}
```

---

#### 2. **npc_gallery_screen.dart:196**
```dart
// TODO: Implement download
```

**Problema**: Download immagini non funzionante  
**Impatto**: UX incompleta  
**Priorità**: 🟡 Media

**Soluzione**:
```dart
// Aggiungi dipendenze in pubspec.yaml
dependencies:
  dio: ^5.0.0
  path_provider: ^2.0.0
  permission_handler: ^10.0.0

// Implementa download
Future<void> _downloadImage(String url) async {
  if (await Permission.storage.request().isGranted) {
    final dir = await getExternalStorageDirectory();
    final filename = url.split('/').last;
    final filepath = '${dir!.path}/$filename';
    
    await Dio().download(url, filepath);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Immagine salvata in $filepath'))
      );
    }
  }
}
```

---

#### 3. **npc_gallery_screen.dart:205**
```dart
// TODO: Implement share
```

**Problema**: Share immagini non funzionante  
**Impatto**: UX incompleta  
**Priorità**: 🟡 Media

**Soluzione**:
```dart
// Aggiungi dipendenza
dependencies:
  share_plus: ^7.0.0

// Implementa share
Future<void> _shareImage(String url) async {
  await Share.share(url, subject: 'Guarda questa foto!');
}
```

---

#### 4-6. **npc_profile_screen.dart:286-288**
```dart
_buildStatItem(Icons.message, 'Messaggi', '0'), // TODO: Implementa conteggio
_buildStatItem(Icons.photo, 'Foto', '0'), // TODO: Implementa conteggio
_buildStatItem(Icons.favorite, 'Preferita', 'No'), // TODO: Implementa preferiti
```

**Problema**: Statistiche hardcoded  
**Impatto**: Informazioni non reali  
**Priorità**: 🟡 Media

**Soluzione**:
```dart
// Aggiungi metodo per caricare stats
Future<Map<String, dynamic>> _loadNPCStats(String npcId) async {
  final userId = SupabaseService.currentUser?.id;
  
  // Conta messaggi
  final messagesResp = await SupabaseService.client
    .from('messages')
    .select('id', const FetchOptions(count: CountOption.exact, head: true))
    .eq('npc_id', npcId)
    .eq('user_id', userId);
  
  // Conta foto
  final photosResp = await SupabaseService.client
    .from('messages')
    .select('id', const FetchOptions(count: CountOption.exact, head: true))
    .eq('npc_id', npcId)
    .eq('user_id', userId)
    .eq('type', 'image');
  
  // Check preferita
  final favoriteResp = await SupabaseService.client
    .from('user_preferences')
    .select('favorite_npc_id')
    .eq('user_id', userId)
    .maybeSingle();
  
  return {
    'messages': messagesResp.count ?? 0,
    'photos': photosResp.count ?? 0,
    'isFavorite': favoriteResp?['favorite_npc_id'] == npcId
  };
}

// Usa in build
FutureBuilder<Map<String, dynamic>>(
  future: _loadNPCStats(widget.npcId),
  builder: (context, snapshot) {
    if (!snapshot.hasData) {
      return CircularProgressIndicator();
    }
    
    final stats = snapshot.data!;
    return Row(
      children: [
        _buildStatItem(Icons.message, 'Messaggi', '${stats['messages']}'),
        _buildStatItem(Icons.photo, 'Foto', '${stats['photos']}'),
        _buildStatItem(
          Icons.favorite, 
          'Preferita', 
          stats['isFavorite'] ? 'Sì' : 'No'
        ),
      ],
    );
  },
)
```

---

## 🗑️ Codice Duplicato/Deprecato

### 1. **conversation_service.dart** vs **chat_service.dart** 🔄

**Analisi**:

**conversation_service.dart** (2.4 KB):
- Gestisce tabella `conversations` (metadata conversazioni)
- Metodi: `watchConversations()`, `getConversations()`, `markAsRead()`, `getOrCreateConversation()`
- **Usato solo in**: `chat_screen.dart`

**chat_service.dart** (5.2 KB):
- Gestisce WebSocket per chat real-time
- Gestisce stream messaggi
- Metodi: `connect()`, `sendMessage()`, `fetchChatHistory()`, `deleteMessage()`
- **Usato in**: `chat_screen.dart`

**Conclusione**: ✅ **NON sono duplicati**, hanno responsabilità diverse:
- `conversation_service.dart` → Metadata conversazioni (lista, unread count)
- `chat_service.dart` → Real-time messaging (WebSocket)

**Azione**: ✅ Mantenere entrambi, ma rinominare per chiarezza:
- `conversation_service.dart` → `conversation_metadata_service.dart`

---

### 2. **message_bubble.dart** vs **chat_message_bubble.dart** 🔄

**Analisi**:

**message_bubble.dart** (14.4 KB, 476 linee):
- Widget complesso con supporto:
  - Testo
  - Immagini (con fullscreen)
  - Video (con player)
  - Audio (con player)
  - Typing indicator
- **Usato in**: `chat_screen.dart` (chat 1-to-1)

**chat_message_bubble.dart** (6.4 KB, 168 linee):
- Widget semplificato con supporto:
  - Testo
  - Immagini
  - Avatar mittente
  - Nome mittente
- **Usato in**: `group_chat_screen.dart` (chat gruppo)

**Conclusione**: ⚠️ **Parzialmente duplicati**, ma con scopi diversi:
- `message_bubble.dart` → Chat 1-to-1 (feature complete: video, audio)
- `chat_message_bubble.dart` → Chat gruppo (semplificato, con avatar/nome)

**Azione**: 🔄 **Consolidare in un unico widget parametrizzato**

**Soluzione**:
```dart
// Nuovo: lib/widgets/unified_message_bubble.dart
class UnifiedMessageBubble extends StatelessWidget {
  final String content;
  final MessageType type; // text, image, video, audio
  final bool isMe;
  final DateTime? timestamp;
  
  // Per chat gruppo
  final String? senderName;
  final String? avatarUrl;
  final VoidCallback? onAvatarTap;
  
  // Per media
  final String? mediaUrl;
  
  const UnifiedMessageBubble({
    required this.content,
    required this.type,
    required this.isMe,
    this.timestamp,
    this.senderName,
    this.avatarUrl,
    this.onAvatarTap,
    this.mediaUrl,
  });
  
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          // Avatar (solo se non isMe e avatarUrl presente)
          if (!isMe && avatarUrl != null) ...[
            GestureDetector(
              onTap: onAvatarTap,
              child: CircleAvatar(
                radius: 18,
                backgroundImage: NetworkImage(avatarUrl!),
              ),
            ),
            const SizedBox(width: 8),
          ],
          
          // Bolla messaggio
          Flexible(
            child: Column(
              crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                // Nome mittente (solo per chat gruppo)
                if (!isMe && senderName != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 12, bottom: 4),
                    child: Text(
                      senderName!,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[400],
                      ),
                    ),
                  ),
                
                // Contenuto basato su tipo
                Container(
                  padding: _getPadding(),
                  decoration: _getDecoration(),
                  child: _buildContent(),
                ),
                
                // Timestamp
                if (timestamp != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4, left: 12, right: 12),
                    child: Text(
                      _formatTime(timestamp!),
                      style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildContent() {
    switch (type) {
      case MessageType.text:
        return Text(content, style: TextStyle(color: Colors.white, fontSize: 15));
      case MessageType.image:
        return _ImageMessage(url: mediaUrl ?? content);
      case MessageType.video:
        return _VideoMessage(url: mediaUrl ?? content);
      case MessageType.audio:
        return _AudioMessage(url: mediaUrl ?? content);
      default:
        return Text(content);
    }
  }
  
  EdgeInsets _getPadding() {
    return type == MessageType.image 
        ? const EdgeInsets.all(4)
        : const EdgeInsets.symmetric(horizontal: 14, vertical: 10);
  }
  
  BoxDecoration _getDecoration() {
    return BoxDecoration(
      color: isMe ? const Color(0xFFE91E63) : const Color(0xFF2A2A2A),
      borderRadius: BorderRadius.only(
        topLeft: const Radius.circular(18),
        topRight: const Radius.circular(18),
        bottomLeft: Radius.circular(isMe ? 18 : 4),
        bottomRight: Radius.circular(isMe ? 4 : 18),
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.1),
          blurRadius: 4,
          offset: const Offset(0, 2),
        ),
      ],
    );
  }
  
  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);
    if (diff.inMinutes < 1) return 'Ora';
    if (diff.inHours < 1) return '${diff.inMinutes}m fa';
    if (diff.inDays < 1) return '${diff.inHours}h fa';
    return '${time.day}/${time.month}';
  }
}

enum MessageType { text, image, video, audio }
```

**Dopo consolidamento**:
```bash
# Elimina vecchi widget
rm lib/widgets/message_bubble.dart
rm lib/widgets/chat_message_bubble.dart

# Aggiorna import in chat_screen.dart e group_chat_screen.dart
import '../widgets/unified_message_bubble.dart';
```

---

### 3. **message.dart** vs **chat_message.dart** 🔄

**Analisi**:

**message.dart** (3.1 KB):
```dart
class Message {
  final String id;
  final String role;
  final MessageType type;
  final String content;
  final DateTime timestamp;
  final MessageStatus status;
  final ReplyPreview? replyTo;
  // ... metodi fromJson, toJson
}
```

**chat_message.dart** (1.1 KB):
```dart
class ChatMessage {
  final String id;
  final String senderId;
  final String content;
  final DateTime timestamp;
  final bool isMe;
  // ... metodi fromJson
}
```

**Conclusione**: ⚠️ **Duplicati parziali**

**Azione**: 🔄 **Consolidare in message.dart**

**Soluzione**:
```dart
// Estendi message.dart per supportare entrambi i casi
class Message {
  final String id;
  final String role; // 'user' | 'assistant'
  final MessageType type;
  final String content;
  final DateTime timestamp;
  final MessageStatus status;
  final ReplyPreview? replyTo;
  
  // Per chat gruppo
  final String? senderId;
  final String? senderName;
  final String? avatarUrl;
  final bool? isAi;
  
  // Helper
  bool get isMe => role == 'user';
  
  Message({
    required this.id,
    required this.role,
    required this.type,
    required this.content,
    required this.timestamp,
    this.status = MessageStatus.sent,
    this.replyTo,
    this.senderId,
    this.senderName,
    this.avatarUrl,
    this.isAi,
  });
  
  // fromJson supporta entrambi i formati
  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] ?? '',
      role: json['role'] ?? 'user',
      type: _parseType(json['type']),
      content: json['content'] ?? '',
      timestamp: DateTime.parse(json['created_at'] ?? json['timestamp'] ?? DateTime.now().toIso8601String()),
      status: _parseStatus(json['status']),
      senderId: json['sender_id'],
      senderName: json['sender_name'],
      avatarUrl: json['avatar'],
      isAi: json['is_ai'],
    );
  }
}
```

**Dopo consolidamento**:
```bash
# Elimina chat_message.dart
rm lib/models/chat_message.dart

# Aggiorna import
# Sostituisci tutti i ChatMessage con Message
```

---

## 📋 Checklist Consolidamento Flutter

### Fase 1: Analisi Dipendenze ✅
- [x] Scansione TODO
- [x] Identificazione duplicati
- [x] Analisi utilizzo file

### Fase 2: Consolidamento Widget (Settimana 1)
- [ ] Creare `unified_message_bubble.dart`
- [ ] Testare in `chat_screen.dart`
- [ ] Testare in `group_chat_screen.dart`
- [ ] Eliminare `message_bubble.dart`
- [ ] Eliminare `chat_message_bubble.dart`

### Fase 3: Consolidamento Models (Settimana 1)
- [ ] Estendere `message.dart`
- [ ] Aggiornare tutti gli import
- [ ] Eliminare `chat_message.dart`
- [ ] Testare parsing JSON

### Fase 4: Implementazione TODO (Settimana 2)
- [ ] Implementare download immagini
- [ ] Implementare share immagini
- [ ] Implementare statistiche npc
- [ ] Implementare persistenza messaggi random

### Fase 5: Refactoring Services (Settimana 2)
- [ ] Rinominare `conversation_service.dart` → `conversation_metadata_service.dart`
- [ ] Aggiornare import
- [ ] Documentare responsabilità

### Fase 6: Testing (Settimana 3)
- [ ] Test chat 1-to-1
- [ ] Test chat gruppo
- [ ] Test download/share
- [ ] Test statistiche

---

## 🎯 Miglioramenti Consigliati

### 1. **State Management** 🔄

**Problema**: Uso limitato di Riverpod (solo `session_provider.dart`)

**Soluzione**: Creare provider per:
```dart
// lib/providers/npcs_provider.dart
final npcsProvider = FutureProvider<List<NPC>>((ref) async {
  return NPCService().getNPCs();
});

// lib/providers/groups_provider.dart
final groupsProvider = FutureProvider<List<Group>>((ref) async {
  return GroupService().getGroups();
});

// lib/providers/messages_provider.dart
final messagesProvider = StreamProvider.family<List<Message>, String>((ref, npcId) {
  return ChatService().messages.where((msg) => msg.npcId == npcId);
});
```

**Benefici**:
- Caching automatico
- Ricaricamento ottimizzato
- Meno boilerplate

---

### 2. **Error Handling** ⚠️

**Problema**: Error handling inconsistente

**Soluzione**: Creare error handler centralizzato
```dart
// lib/utils/error_handler.dart
class ErrorHandler {
  static void handle(BuildContext context, dynamic error) {
    String message = 'Si è verificato un errore';
    
    if (error is SupabaseException) {
      message = _parseSupabaseError(error);
    } else if (error is WebSocketException) {
      message = 'Errore di connessione. Riprova.';
    }
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        action: SnackBarAction(
          label: 'OK',
          textColor: Colors.white,
          onPressed: () {},
        ),
      ),
    );
  }
  
  static String _parseSupabaseError(SupabaseException error) {
    // Parse error codes
    if (error.message.contains('duplicate')) {
      return 'Elemento già esistente';
    }
    if (error.message.contains('not found')) {
      return 'Elemento non trovato';
    }
    return error.message;
  }
}

// Uso
try {
  await someOperation();
} catch (e) {
  ErrorHandler.handle(context, e);
}
```

---

### 3. **Loading States** ⏳

**Problema**: Loading indicators inconsistenti

**Soluzione**: Widget riutilizzabile
```dart
// lib/widgets/loading_overlay.dart
class LoadingOverlay extends StatelessWidget {
  final bool isLoading;
  final Widget child;
  final String? message;
  
  const LoadingOverlay({
    required this.isLoading,
    required this.child,
    this.message,
  });
  
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (isLoading)
          Container(
            color: Colors.black54,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Colors.pinkAccent),
                  if (message != null) ...[
                    SizedBox(height: 16),
                    Text(
                      message!,
                      style: TextStyle(color: Colors.white),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}

// Uso
LoadingOverlay(
  isLoading: _isLoading,
  message: 'Caricamento...',
  child: YourScreen(),
)
```

---

### 4. **Responsive Design** 📱

**Problema**: Layout fissi, non responsive

**Soluzione**: Usare `LayoutBuilder` e breakpoints
```dart
// lib/utils/responsive.dart
class Responsive {
  static bool isMobile(BuildContext context) {
    return MediaQuery.of(context).size.width < 600;
  }
  
  static bool isTablet(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return width >= 600 && width < 1200;
  }
  
  static bool isDesktop(BuildContext context) {
    return MediaQuery.of(context).size.width >= 1200;
  }
  
  static double getWidth(BuildContext context, {
    required double mobile,
    double? tablet,
    double? desktop,
  }) {
    if (isDesktop(context) && desktop != null) return desktop;
    if (isTablet(context) && tablet != null) return tablet;
    return mobile;
  }
}

// Uso
Container(
  width: Responsive.getWidth(
    context,
    mobile: 100,
    tablet: 150,
    desktop: 200,
  ),
  child: ...
)
```

---

### 5. **Offline Support** 📴

**Problema**: Nessun supporto offline

**Soluzione**: Usare `sqflite` per cache locale
```dart
// Aggiungi dipendenze
dependencies:
  sqflite: ^2.0.0
  path: ^1.8.0

// lib/services/local_database.dart
class LocalDatabase {
  static Database? _database;
  
  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }
  
  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'thrillme.db');
    
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            npc_id TEXT,
            content TEXT,
            type TEXT,
            created_at TEXT,
            synced INTEGER DEFAULT 0
          )
        ''');
      },
    );
  }
  
  Future<void> cacheMessage(Message message) async {
    final db = await database;
    await db.insert('messages', message.toJson(), 
      conflictAlgorithm: ConflictAlgorithm.replace);
  }
  
  Future<List<Message>> getCachedMessages(String npcId) async {
    final db = await database;
    final maps = await db.query(
      'messages',
      where: 'npc_id = ?',
      whereArgs: [npcId],
      orderBy: 'created_at DESC',
    );
    return maps.map((m) => Message.fromJson(m)).toList();
  }
}
```

---

## 📊 Metriche Flutter

### Prima del Consolidamento

```
Widget duplicati:        2 (message_bubble, chat_message_bubble)
Model duplicati:         1 (chat_message)
Service duplicati:       0 (conversation_service è complementare)
TODO non implementati:   6
Linee codice totale:     ~15,000
```

### Dopo il Consolidamento (Target)

```
Widget duplicati:        0 (-100%)
Model duplicati:         0 (-100%)
Service duplicati:       0
TODO implementati:       6/6 (100%)
Linee codice totale:     ~13,500 (-10%)
```

---

## 🚀 Roadmap Implementazione Flutter

### Sprint 1 (Settimana 1-2)
- [ ] Consolidare widget message bubble
- [ ] Consolidare model message
- [ ] Implementare download/share immagini

### Sprint 2 (Settimana 3-4)
- [ ] Implementare statistiche npc
- [ ] Implementare persistenza messaggi random
- [ ] Refactoring services (rename)

### Sprint 3 (Settimana 5-6)
- [ ] Implementare state management (Riverpod)
- [ ] Implementare error handling centralizzato
- [ ] Implementare loading overlay

### Sprint 4 (Settimana 7-8)
- [ ] Responsive design
- [ ] Offline support (cache locale)
- [ ] Testing completo

---

## ✅ Quick Wins Flutter

### Eliminazioni Immediate (< 1 ora)

1. **Rinomina conversation_service.dart**
```bash
mv lib/services/conversation_service.dart lib/services/conversation_metadata_service.dart

# Aggiorna import in chat_screen.dart
sed -i '' 's/conversation_service/conversation_metadata_service/g' lib/screens/chat_screen.dart
```

2. **Aggiungi dipendenze per download/share**
```yaml
# pubspec.yaml
dependencies:
  dio: ^5.0.0
  path_provider: ^2.0.0
  permission_handler: ^10.0.0
  share_plus: ^7.0.0

# Poi
flutter pub get
```

---

## 📞 Integrazione Backend ↔ Flutter

### API Endpoints Usati

```
✅ Implementati:
- GET  /api/chat-history/:userId/:npcId
- GET  /api/npc-gallery/:userId/:npcId
- POST /api/generate-avatar
- GET  /api/groups
- POST /api/groups
- GET  /api/groups/:id/messages
- POST /api/groups/:id/messages
- GET  /api/groups/:id/members
- POST /api/invites
- PATCH /api/invites/:id/respond

⚠️ Da Implementare (Backend):
- GET  /api/npcs/:id/stats (per statistiche)
- POST /api/npcs/:id/favorite (per preferiti)
- GET  /api/messages/random/:npcId (per messaggi random)
```

### WebSocket Events

```
✅ Implementati:
- connect (user_id)
- message (text, traceId, npc_id)
- message (text, traceId, group_id)
- ack
- typing
- group_message
- end

⚠️ Da Implementare:
- invite_notification (per notifiche inviti real-time)
- user_online (presenza utenti)
- user_typing (indicatore typing)
```

---

**Fine Analisi Flutter** - Prossimo step: Implementare consolidamenti e TODO
