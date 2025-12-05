# 👨‍💻 Guida per Sviluppatori - ThrillMe

> **Guida completa per sviluppatori che vogliono contribuire a ThrillMe**

**Versione**: 2.0  
**Ultima revisione**: Gennaio 2025

---

## 📋 Indice

1. [Setup Ambiente di Sviluppo](#setup-ambiente-di-sviluppo)
2. [Struttura Progetto](#struttura-progetto)
3. [Convenzioni Codice](#convenzioni-codice)
4. [Workflow di Sviluppo](#workflow-di-sviluppo)
5. [Testing](#testing)
6. [Debugging](#debugging)
7. [Contribuire](#contribuire)
8. [FAQ](#faq)

---

## 🛠️ Setup Ambiente di Sviluppo

### Prerequisiti

- **Node.js** 18.x o superiore
- **Flutter** 3.x o superiore
- **Git**
- **PM2** (per process management backend)
- **Supabase** account (database + storage)
- **API Keys**:
  - OpenRouter (LLM)
  - Replicate (immagini/video)
  - ElevenLabs (audio)

### Installazione

#### 1. Clone Repository
```bash
git clone https://github.com/alessandronigro/sexylara.git
cd sexylara
```

#### 2. Setup Backend
```bash
cd backend
npm install

# Crea file .env
cp .env.example .env
# Modifica .env con le tue chiavi API

# Avvia server API
npm run start:api

# In un altro terminale, avvia WebSocket server
npm run start:ws
```

**File `.env` di esempio**:
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

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

#### 3. Setup Frontend
```bash
# Dalla root del progetto
flutter pub get

# Avvia app
flutter run
```

#### 4. Setup Database
```bash
# Applica migrazioni Supabase
cd supabase
# Segui istruzioni in supabase/README.md
```

### Verifica Installazione

#### Backend
```bash
# Test API server
curl http://localhost:4000/api/health

# Test WebSocket (usa un client WebSocket)
ws://localhost:5001/ws?user_id=test
```

#### Frontend
```bash
# Verifica build
flutter build apk --debug
```

---

## 📁 Struttura Progetto

### Backend

```
backend/
├── server-api.js          # Entry point REST API
├── server-ws.js           # Entry point WebSocket
├── routes/                # Endpoint handlers
│   ├── auth.js
│   ├── npc.js
│   ├── message.js
│   └── ...
├── ai/                    # Sistema AI
│   ├── brainEngine.js    # Wrapper principale
│   ├── brain/            # Core engine
│   ├── engines/          # Engine specializzati
│   ├── intent/           # Analisi intenti
│   └── ...
├── services/              # Business logic
├── controllers/          # Controller (legacy)
├── models/               # Data models
├── middleware/           # Express middleware
└── lib/                  # Utilities
```

### Frontend

```
lib/
├── main.dart             # Entry point
├── screens/              # UI screens
├── services/             # Business logic
├── widgets/              # Componenti riutilizzabili
├── models/               # Data models
├── providers/            # Riverpod providers
└── config.dart           # Configurazione
```

### Convenzioni Naming

- **File**: `camelCase.js` (backend), `snake_case.dart` (frontend)
- **Classi**: `PascalCase`
- **Funzioni/Variabili**: `camelCase`
- **Costanti**: `UPPER_SNAKE_CASE`
- **Database**: `snake_case`

---

## 📝 Convenzioni Codice

### Backend (JavaScript)

#### Stile
- Usa `async/await` invece di Promise chains
- Gestisci sempre gli errori con `try/catch`
- Usa `const` per default, `let` solo se necessario
- Evita `var`

#### Esempio
```javascript
// ✅ Buono
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

// ❌ Cattivo
function getUserProfile(userId) {
  supabase.from('user_profile').select('*').eq('id', userId).single()
    .then(({ data, error }) => {
      if (error) {
        console.log(error);
      } else {
        return data;
      }
    });
}
```

#### Logging
```javascript
// Usa emoji per categorizzazione
console.log('✅ Success message');
console.error('❌ Error message');
console.warn('⚠️ Warning message');
console.log('📨 Message received');
console.log('🎨 Generating avatar');
```

#### Error Handling
```javascript
// Sempre gestisci errori esplicitamente
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  // Rilancia solo se necessario
  throw error;
}
```

### Frontend (Dart/Flutter)

#### Stile
- Segui [Effective Dart](https://dart.dev/guides/language/effective-dart)
- Usa `final` per variabili immutabili
- Preferisci named parameters per funzioni con molti parametri

#### Esempio
```dart
// ✅ Buono
class ChatScreen extends ConsumerWidget {
  final String npcId;
  
  const ChatScreen({required this.npcId, Key? key}) : super(key: key);
  
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messages = ref.watch(messagesProvider(npcId));
    
    return Scaffold(
      appBar: AppBar(title: Text('Chat')),
      body: ListView.builder(
        itemCount: messages.length,
        itemBuilder: (context, index) => MessageWidget(message: messages[index]),
      ),
    );
  }
}

// ❌ Cattivo
class ChatScreen extends StatelessWidget {
  String npcId;
  ChatScreen(this.npcId);
  
  Widget build(BuildContext context) {
    return Container();
  }
}
```

#### State Management
- Usa **Riverpod** per state management
- Crea provider per dati condivisi
- Usa `ref.watch()` per ascoltare cambiamenti
- Usa `ref.read()` per azioni one-time

---

## 🔄 Workflow di Sviluppo

### 1. Creare un Branch

```bash
# Dalla main
git checkout -b feature/nome-feature
# o
git checkout -b fix/nome-bug
```

### 2. Sviluppare

- Scrivi codice seguendo le convenzioni
- Aggiungi commenti dove necessario
- Testa localmente

### 3. Commit

Usa [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature
git commit -m "feat: aggiungi supporto notifiche push"

# Fix
git commit -m "fix: risolvi bug caricamento avatar"

# Refactor
git commit -m "refactor: migliora struttura BrainEngine"

# Docs
git commit -m "docs: aggiorna documentazione API"
```

### 4. Push e Pull Request

```bash
git push origin feature/nome-feature
```

Crea una Pull Request su GitHub con:
- Descrizione chiara della feature/fix
- Screenshots (se UI)
- Test effettuati
- Checklist:
  - [ ] Codice testato localmente
  - [ ] Nessun errore di lint
  - [ ] Documentazione aggiornata (se necessario)

---

## 🧪 Testing

### Backend

#### Test Manuale
```bash
# Test API
curl -X GET http://localhost:4000/api/npcs \
  -H "x-user-id: {userId}"

# Test WebSocket (usa un client)
ws://localhost:5001/ws?user_id={userId}
```

#### Unit Tests (da implementare)
```bash
npm test
```

### Frontend

#### Test Widget
```bash
flutter test
```

#### Test Manuale
- Esegui app su emulatore/dispositivo
- Testa flussi principali:
  - Login/Registrazione
  - Creazione NPC
  - Chat 1-to-1
  - Chat gruppo
  - Generazione media

---

## 🐛 Debugging

### Backend

#### Logging
```javascript
// File logs
// - backend/logs.txt
// - backend/api.log
// - backend/ws.log

// Console con emoji
console.log('📨 Message:', message);
console.error('❌ Error:', error);
```

#### Debug WebSocket
```javascript
// In server-ws.js
ws.on('message', (msg) => {
  console.log('📨 Received:', msg.toString());
  // ...
});
```

#### PM2 Logs
```bash
pm2 logs
pm2 logs server-api
pm2 logs server-ws
```

### Frontend

#### Flutter DevTools
```bash
flutter run
# Apri DevTools nel browser
```

#### Debug Print
```dart
debugPrint('Message: $message');
```

#### Riverpod Debug
```dart
// Abilita logging Riverpod
final container = ProviderContainer();
container.listen(messagesProvider(npcId), (prev, next) {
  print('Messages changed: $next');
});
```

---

## 🤝 Contribuire

### Come Contribuire

1. **Fork** il repository
2. **Clone** il tuo fork
3. **Crea** un branch per la feature
4. **Sviluppa** e testa
5. **Commit** con Conventional Commits
6. **Push** e crea Pull Request

### Aree di Contribuzione

#### Priorità Alta
- [ ] Testing suite completa
- [ ] Rate limiting
- [ ] Input sanitization
- [ ] Error handling migliorato

#### Priorità Media
- [ ] Notifiche push
- [ ] Analytics
- [ ] Caching (Redis)
- [ ] Performance optimization

#### Priorità Bassa
- [ ] UI/UX improvements
- [ ] Documentazione esempi
- [ ] Internationalization
- [ ] Accessibility

### Code Review

Tutte le PR richiedono:
- ✅ Review da almeno un maintainer
- ✅ Nessun conflitto con main
- ✅ Test passati
- ✅ Lint passato
- ✅ Documentazione aggiornata (se necessario)

---

## ❓ FAQ

### Come aggiungo una nuova route API?

1. Crea file in `backend/routes/nuova-route.js`
2. Definisci endpoint con Express
3. Aggiungi route in `server-api.js`:
   ```javascript
   const nuovaRoute = require('./routes/nuova-route');
   app.use('/api/nuova', nuovaRoute);
   ```

### Come aggiungo un nuovo engine AI?

1. Crea file in `backend/ai/engines/NuovoEngine.js`
2. Esporta funzioni principali
3. Integra in `brainEngine.js` o `BrainEngine.js`

### Come aggiungo una nuova schermata Flutter?

1. Crea file in `lib/screens/nuova_screen.dart`
2. Aggiungi route in `main.dart`:
   ```dart
   GoRoute(
     path: '/nuova',
     builder: (context, state) => const NuovaScreen(),
   ),
   ```

### Come debuggo problemi WebSocket?

1. Controlla logs: `backend/ws.log`
2. Verifica connessione: `ws://localhost:5001/ws?user_id=test`
3. Aggiungi logging in `server-ws.js`

### Come gestisco errori Supabase?

```javascript
const { data, error } = await supabase
  .from('table')
  .select('*');

if (error) {
  console.error('Supabase error:', error);
  // Gestisci errore appropriatamente
  throw new Error(`Database error: ${error.message}`);
}
```

### Come aggiorno il database schema?

1. Crea migration in `supabase/migrations/`
2. Testa localmente
3. Applica in produzione con cautela

---

## 📚 Risorse

### Documentazione
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architettura sistema
- [API.md](./API.md) - Documentazione API
- [../README.md](../README.md) - Overview progetto
- [backend/DEPLOY.md](./backend/DEPLOY.md) - Guida deployment backend
- [backend/ai/README.md](./backend/ai/README.md) - Documentazione sistema AI

### Link Utili
- [Flutter Docs](https://flutter.dev/docs)
- [Express.js Docs](https://expressjs.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Riverpod Docs](https://riverpod.dev/)

### Supporto
- Apri issue su GitHub per bug/feature requests
- Contatta maintainers per domande

---

**Ultima revisione**: Gennaio 2025  
**Mantenuto da**: Team ThrillMe








