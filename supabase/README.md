# 🧠 Sistema di Memoria Contestuale AI

Questo sistema implementa una **memoria a lungo termine** per le conversazioni AI, permettendo continuità, personalità stabile e contesto persistente sia per **chat individuali** che per **chat di gruppo**.

## 📁 Struttura

```
supabase/
├── tables/
│   ├── chat_memory.sql          # Memoria per chat 1-a-1
│   └── group_memory.sql         # Memoria collettiva di gruppo
├── functions/
│   ├── ai_chat/
│   │   ├── index.ts             # Chat 1-a-1 con memoria
│   │   └── deno.json
│   ├── update_memory/
│   │   ├── index.ts             # Aggiorna memoria 1-a-1
│   │   └── deno.json
│   ├── group_ai_chat/
│   │   ├── index.ts             # Chat di gruppo multi-AI
│   │   └── deno.json
│   ├── update_group_memory/
│   │   ├── index.ts             # Aggiorna memoria gruppo
│   │   └── deno.json
│   └── import_map.json          # Import map condivisa
```

## 🚀 Setup

### 1. Crea la tabella nel database

Esegui il file SQL in Supabase SQL Editor:

```bash
# Oppure usa Supabase CLI
supabase db push
```

### 2. Deploy delle Edge Functions

```bash
# Deploy ai_chat function
supabase functions deploy ai_chat

# Deploy update_memory function
supabase functions deploy update_memory
```

### 3. Configura le variabili d'ambiente

Nel Supabase Dashboard → Settings → Edge Functions → Secrets:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENROUTER_API_KEY=your_openrouter_key
```

## 📡 API Usage

### Chat con memoria contestuale

```typescript
// POST https://your-project.supabase.co/functions/v1/ai_chat
{
  "npcId": "uuid-npc-id",
  "userId": "uuid-user-id",
  "userMessage": "Ciao, come stai?"
}

// Response
{
  "reply": "Ciao! Sto bene, grazie...",
  "messageCount": 15
}
```

### Aggiornamento manuale della memoria

```typescript
// POST https://your-project.supabase.co/functions/v1/update_memory
{
  "chat_id": "uuid-npc-id"
}

// Response
{
  "message": "Memory updated successfully",
  "summary": "L'utente e Lara hanno sviluppato...",
  "messagesAnalyzed": 80
}
```

## 🧩 Come funziona

### 1. **ai_chat** - Chat con contesto
- Recupera gli ultimi 25 messaggi
- Carica la memoria sintetica (se esiste)
- Costruisce un prompt con personalità + memoria + storia recente
- Genera risposta via OpenRouter
- Salva la risposta nel database
- Ogni 10 messaggi, triggera automaticamente `update_memory`

### 2. **update_memory** - Aggiornamento memoria
- Recupera gli ultimi 80 messaggi
- Usa AI per generare un riassunto sintetico (8-10 righe)
- Salva il riassunto nella tabella `chat_memory`
- Il riassunto include: stato emotivo, temi ricorrenti, evoluzione della relazione

### 3. **chat_memory** - Tabella memoria
- `chat_id`: ID della npc (chiave primaria)
- `summary`: Riassunto sintetico della conversazione
- `updated_at`: Timestamp ultimo aggiornamento

## 🔥 Vantaggi

✅ **Continuità**: L'AI ricorda conversazioni passate  
✅ **Personalità stabile**: Mantiene caratteristiche coerenti  
✅ **Costi ridotti**: Usa memoria compressa invece di inviare tutti i messaggi  
✅ **Scalabile**: Funziona con migliaia di messaggi  
✅ **Automatico**: Aggiornamento memoria ogni 10 messaggi  

## 🔧 Integrazione con Flutter

Modifica il tuo `ChatService` per usare la Edge Function invece del backend Node.js:

```dart
Future<String> sendMessage(String npcId, String message) async {
  final response = await http.post(
    Uri.parse('${Config.supabaseUrl}/functions/v1/ai_chat'),
    headers: {
      'Authorization': 'Bearer ${Config.supabaseAnonKey}',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'npcId': npcId,
      'userId': SupabaseService.currentUser?.id,
      'userMessage': message,
    }),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['reply'];
  } else {
    throw Exception('Failed to send message');
  }
}
```

## 📊 Monitoraggio

Controlla i log delle Edge Functions:

```bash
# Logs in tempo reale
supabase functions logs ai_chat --tail

# Logs update_memory
supabase functions logs update_memory --tail
```


## 🎯 Prossimi passi

1. ✅ Deploy delle Edge Functions
2. ✅ Crea tabelle `chat_memory` e `group_memory`
3. ✅ Configura variabili d'ambiente
4. 🔄 Integra nel Flutter app
5. 🔄 Testa la memoria contestuale
6. 🔄 (Opzionale) Aggiungi cron job per aggiornamenti periodici

---

# 👥 CHAT DI GRUPPO MULTI-AI

## 🎭 Caratteristiche

Il sistema di **chat di gruppo** permette conversazioni naturali tra l'utente e **multipli AI** con:

✅ **Personalità individuali** - Ogni AI mantiene il proprio carattere  
✅ **Ruoli sociali** - Leader, mediatori, osservatori, animatori  
✅ **Memoria collettiva** - Il gruppo "ricorda" eventi, battute, tensioni  
✅ **Dinamiche sociali** - Relazioni, simpatie, alleanze, conflitti  
✅ **Risposte intelligenti** - Ogni AI decide se/come rispondere  
✅ **Evoluzione nel tempo** - Le relazioni cambiano con le conversazioni  

## 📡 API Usage - Chat di Gruppo

### Invia messaggio al gruppo

```typescript
// POST https://your-project.supabase.co/functions/v1/group_ai_chat
{
  "group_id": "uuid-group-id",
  "user_id": "uuid-user-id",
  "user_message": "Ciao ragazzi, che ne pensate di andare al mare?"
}

// Response
{
  "success": true,
  "replies": [
    {
      "name": "Lara",
      "message": "Ottima idea! Io adoro il mare 🌊"
    },
    {
      "name": "Sofia",
      "message": "Sì! Potremmo organizzare per il weekend"
    }
  ],
  "totalResponses": 2
}
```

### Aggiorna memoria del gruppo

```typescript
// POST https://your-project.supabase.co/functions/v1/update_group_memory
{
  "group_id": "uuid-group-id"
}

// Response
{
  "success": true,
  "summary": "Il gruppo ha discusso di viaggi al mare...",
  "dynamics": {
    "relationships": {
      "Lara-Sofia": "amiche strette, condividono passione per viaggi"
    },
    "leadership": ["Lara"],
    "topics": ["viaggi", "mare", "weekend"],
    "mood": "entusiasta e collaborativo"
  },
  "messagesAnalyzed": 45
}
```

## 🧩 Come funziona il gruppo

### 1. **group_ai_chat** - Conversazione multi-AI

Quando l'utente invia un messaggio:

1. **Carica membri AI** del gruppo (da `group_members` + `npcs`)
2. **Recupera ultimi 20 messaggi** per contesto
3. **Carica memoria collettiva** (storia, dinamiche, relazioni)
4. **Per ogni AI nel gruppo**:
   - Costruisce prompt personalizzato con:
     - Personalità individuale
     - Ruolo sociale nel gruppo
     - Memoria collettiva
     - Storia recente
   - Genera risposta via OpenRouter
   - L'AI può decidere di NON rispondere (risponde "SKIP")
   - Salva la risposta nel database
5. **Auto-trigger** di `update_group_memory` ogni 15 messaggi

### 2. **update_group_memory** - Analisi sociale

Ogni 15 messaggi (o manualmente):

1. Recupera ultimi 100 messaggi del gruppo
2. Usa AI per analizzare:
   - **Sintesi narrativa** (8-12 frasi sulla storia del gruppo)
   - **Dinamiche sociali** (JSON strutturato):
     - `relationships`: relazioni tra membri
     - `leadership`: chi guida il gruppo
     - `topics`: temi principali
     - `mood`: atmosfera generale
     - `events`: eventi significativi
     - `recurring_jokes`: battute ricorrenti
     - `conflicts`: tensioni o conflitti
     - `alliances`: sottogruppi
3. Salva nella tabella `group_memory`

### 3. **Ruoli sociali automatici**

Ogni AI ha un ruolo basato sulla personalità:

| Personalità | Ruolo nel gruppo |
|------------|------------------|
| `dominant` | Leader naturale |
| `sweet` | Mediatore/pacificatore |
| `shy` | Osservatore silenzioso |
| `playful` | Animatore del gruppo |
| `romantic` | Consigliere emotivo |
| `mysterious` | Presenza enigmatica |
| `sexy` | Provocatore/seduttore |

I ruoli evolvono con la memoria del gruppo.

## 🎯 Esempio di dinamiche

```json
{
  "relationships": {
    "Lara-Sofia": "migliori amiche, condividono passione per viaggi e cucina",
    "Marco-Lara": "tensione leggera, opinioni diverse su politica",
    "Sofia-Marco": "collaborano bene su progetti creativi"
  },
  "leadership": ["Lara", "Sofia"],
  "topics": ["viaggi", "cucina", "tecnologia", "film"],
  "mood": "positivo e collaborativo, con momenti di dibattito vivace",
  "events": [
    "Discussione animata su viaggi in Asia (12/11)",
    "Battuta ricorrente sul caffè di Marco",
    "Progetto comune per organizzare cena di gruppo"
  ],
  "recurring_jokes": [
    "Il caffè di Marco è troppo forte",
    "Lara dice sempre 'andiamo al mare'"
  ],
  "conflicts": [
    "Lieve tensione tra Marco e Lara su temi politici"
  ],
  "alliances": [
    "Lara e Sofia formano un duo affiatato",
    "Marco spesso fa da mediatore"
  ]
}
```

## 🔧 Integrazione Flutter - Chat di Gruppo

```dart
class GroupChatService {
  Future<List<AIReply>> sendGroupMessage(
    String groupId, 
    String message
  ) async {
    final response = await http.post(
      Uri.parse('${Config.supabaseUrl}/functions/v1/group_ai_chat'),
      headers: {
        'Authorization': 'Bearer ${Config.supabaseAnonKey}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'group_id': groupId,
        'user_id': SupabaseService.currentUser?.id,
        'user_message': message,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['replies'] as List)
          .map((r) => AIReply.fromJson(r))
          .toList();
    } else {
      throw Exception('Failed to send group message');
    }
  }
}

class AIReply {
  final String name;
  final String message;

  AIReply({required this.name, required this.message});

  factory AIReply.fromJson(Map<String, dynamic> json) {
    return AIReply(
      name: json['name'],
      message: json['message'],
    );
  }
}
```

## 🎭 Scenari d'uso

### Scenario 1: Gruppo di amici virtuali
- 3-5 AI con personalità diverse
- Discutono di viaggi, hobby, vita quotidiana
- Sviluppano relazioni e inside jokes

### Scenario 2: Team di lavoro AI
- AI con ruoli professionali (manager, designer, developer)
- Collaborano su progetti
- Dinamiche di leadership e decision-making

### Scenario 3: Famiglia virtuale
- AI con ruoli familiari (genitori, fratelli, nonni)
- Conversazioni su eventi familiari
- Supporto emotivo e consigli

## 🔥 Vantaggi del sistema di gruppo

✅ **Realismo sociale** - Conversazioni naturali multi-persona  
✅ **Continuità narrativa** - Il gruppo "ricorda" la propria storia  
✅ **Dinamiche emergenti** - Relazioni che evolvono organicamente  
✅ **Personalità distinte** - Ogni AI mantiene il proprio carattere  
✅ **Scalabile** - Funziona con 2-10+ AI nel gruppo  
✅ **Automatico** - Aggiornamento memoria ogni 15 messaggi  

## 📊 Monitoraggio

```bash
# Logs chat di gruppo
supabase functions logs group_ai_chat --tail

# Logs aggiornamento memoria gruppo
supabase functions logs update_group_memory --tail
```

## 🐛 Troubleshooting - Gruppo

**Errore: "No AI members found in group"**
→ Verifica che il gruppo abbia membri nella tabella `group_members`

**Le AI non rispondono tutte**
→ Normale! Ogni AI decide se rispondere. Controlla i logs per vedere chi ha risposto "SKIP"

**Memoria del gruppo non si aggiorna**
→ Viene aggiornata automaticamente ogni 15 messaggi. Puoi forzare l'aggiornamento chiamando `update_group_memory`

**Dinamiche sociali vuote**
→ Servono almeno 20-30 messaggi per generare dinamiche significative

## 🎯 Prossimi passi



## 🐛 Troubleshooting

**Errore: "Missing OPENROUTER_API_KEY"**
→ Configura la variabile nelle Edge Function Secrets

**Errore: "NPC not found"**
→ Verifica che il `npcId` esista nella tabella `npcs`

**La memoria non si aggiorna**
→ Controlla i logs: `supabase functions logs update_memory`

**Risposte senza contesto**
→ Verifica che la tabella `chat_memory` contenga dati per quel `chat_id`
