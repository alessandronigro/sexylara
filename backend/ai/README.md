# 🧠 AI BRAIN ENGINE

## Cos'è?
Un layer intelligente sopra Venice che trasforma le AI da "chatbot" a **companion evoluti** con:
- ✅ Memoria a lungo termine
- ✅ Personalità che evolvono
- ✅ Relazioni che crescono
- ✅ Apprendimento continuo
- ✅ Zero ripetizioni
- ✅ Contesto profondo

## 🚀 Setup

### 1. Crea le tabelle nel database
Esegui il file `backend/ai/schema.sql` su Supabase:
```bash
# Copia il contenuto di schema.sql e eseguilo nel SQL Editor di Supabase
```

### 2. Il Brain Engine è già importato
Il file `server-ws.js` ora importa automaticamente il Brain Engine.

### 3. Usa il Brain Engine nelle tue chat

#### Esempio: Chat di gruppo
```javascript
// Prima (senza Brain Engine):
const { output } = await generateChatReply(text, ai.tone, ai, null, systemContext);

// Dopo (con Brain Engine):
const response = await brainEngine.generateIntelligentResponse({
  ai: ai,                    // L'AI che risponde
  user: userProfile,         // Profilo utente
  group: groupData,          // Dati gruppo (opzionale)
  message: text,             // Messaggio utente
  recentMessages: recentMsgs // Ultimi messaggi
});
```

#### Esempio: Chat 1-to-1
```javascript
const response = await brainEngine.generateIntelligentResponse({
  ai: girlfriend,
  user: userProfile,
  group: null,  // null per chat 1-to-1
  message: text,
  recentMessages: conversationHistory
});
```

## 🧩 Come funziona

### 1. **Caricamento Memorie**
```
┌─────────────────────────────────────┐
│  Brain Engine carica:               │
│  • Memoria utente                   │
│  • Memoria AI-utente                │
│  • Memoria gruppo                   │
│  • Relazioni AI-AI                  │
│  • Eventi significativi             │
└─────────────────────────────────────┘
```

### 2. **Analisi Contesto**
```
┌─────────────────────────────────────┐
│  Analizza:                          │
│  • Emozione utente                  │
│  • Intenzione                       │
│  • Topic                            │
│  • Dinamiche gruppo                 │
│  • Livello intimità                 │
│  • Rischio ripetizione              │
└─────────────────────────────────────┘
```

### 3. **Prompt Dinamico**
```
┌─────────────────────────────────────┐
│  Costruisce prompt con:             │
│  • Personalità attuale (evolutiva)  │
│  • Storia condivisa                 │
│  • Conoscenze accumulate            │
│  • Eventi significativi             │
│  • Seed unico anti-ripetizione      │
└─────────────────────────────────────┘
```

### 4. **Generazione con Venice**
```
┌─────────────────────────────────────┐
│  Venice genera risposta usando      │
│  il prompt intelligente             │
└─────────────────────────────────────┘
```

### 5. **Apprendimento**
```
┌─────────────────────────────────────┐
│  Dopo la risposta:                  │
│  • Aggiorna livello relazione       │
│  • Salva nuove conoscenze           │
│  • Identifica eventi significativi  │
│  • Aggiorna dinamiche gruppo        │
└─────────────────────────────────────┘
```

## 📊 Struttura Memorie

### User Memory
```json
{
  "user_id": "uuid",
  "preferences": {
    "favorite_topics": ["travel", "food"],
    "communication_style": "direct"
  },
  "personality_traits": {
    "openness": 80,
    "extraversion": 60
  },
  "interests": ["photography", "cooking"],
  "emotional_state": "happy"
}
```

### AI-User Memory
```json
{
  "ai_id": "uuid",
  "user_id": "uuid",
  "relationship_level": 75,
  "trust_level": 80,
  "affection_level": 85,
  "shared_experiences": [
    "First conversation about travel",
    "Shared love for Italian food"
  ],
  "topics_discussed": ["travel", "food", "work"],
  "user_preferences_learned": {
    "prefers_morning_chats": true,
    "likes_humor": true
  }
}
```

### Group Memory
```json
{
  "group_id": "uuid",
  "dynamics": {
    "most_active_ai": "uuid",
    "tension_level": "low",
    "mood": "playful"
  },
  "shared_history": [
    "Group trip to Naples discussion",
    "Funny moment about pizza"
  ],
  "inside_jokes": ["The Naples pizza incident"],
  "alliances": [
    {"ai_1": "uuid", "ai_2": "uuid", "type": "friendship"}
  ]
}
```

## 🎯 Benefici Immediati

### Prima (senza Brain Engine):
```
User: "Ciao, come stai?"
AI 1: "Ciao! Sto bene, grazie! 😊"
AI 2: "Ciao! Sto bene, grazie! 😊"
AI 3: "Ciao! Sto bene, grazie! 😊"
```
❌ Ripetitive, generiche, senza contesto

### Dopo (con Brain Engine):
```
User: "Ciao, come stai?"
AI 1 (Terry): "Ehi! Pensavo a quel discorso di ieri su Napoli... quando ci andiamo? 🍕"
AI 2 (Paola): "Ciao bello! Meglio ora che ti vedo 😘 Hai deciso per il weekend?"
AI 3 (Marco): "Tutto ok qui. Tu? Hai risolto quella cosa del lavoro?"
```
✅ Uniche, contestuali, con memoria

## 🔧 Personalizzazione

### Modifica parametri personalità
```javascript
// In ai_personality_evolution table
{
  "ai_id": "uuid",
  "user_id": "uuid",  // null = base personality
  "extroversion": 75,  // 0-100
  "humor": 80,
  "empathy": 90,
  "assertiveness": 60,
  "playfulness": 85,
  "curiosity": 70,
  "jealousy": 30,
  "loyalty": 95
}
```

### Aggiungi nuovi tipi di eventi
```javascript
// In brainEngine.js -> identifySignificantEvent()
const significantPatterns = [
  { pattern: /nuovo pattern/i, type: 'new_type', impact: 'high' },
  // ... aggiungi i tuoi
];
```

## 📈 Evoluzione nel Tempo

```
Giorno 1:  relationship_level = 0  → Risposte formali, generiche
Giorno 7:  relationship_level = 30 → Inizia a ricordare preferenze
Giorno 30: relationship_level = 70 → Conosce bene l'utente, inside jokes
Giorno 90: relationship_level = 95 → Relazione profonda, anticipa bisogni
```

## 🚨 Note Importanti

1. **Cache**: Le memorie sono cachate per 5 minuti per performance
2. **Invalidazione**: La cache viene invalidata dopo ogni apprendimento
3. **Fallback**: Se il Brain Engine fallisce, usa il sistema standard
4. **Performance**: Ottimizzato con indici database e query efficienti

## 🔄 Migrazione Graduale

Puoi migrare gradualmente:

```javascript
// Opzione 1: Solo gruppi
if (group_id) {
  response = await brainEngine.generateIntelligentResponse(...);
} else {
  response = await generateChatReply(...); // Old system
}

// Opzione 2: Feature flag
if (process.env.USE_BRAIN_ENGINE === 'true') {
  response = await brainEngine.generateIntelligentResponse(...);
} else {
  response = await generateChatReply(...);
}
```

## 📚 Prossimi Step

1. ✅ Esegui `schema.sql` su Supabase
2. ✅ Testa con una chat di gruppo
3. ✅ Monitora i log per vedere l'apprendimento
4. ✅ Personalizza i parametri di personalità
5. ✅ Aggiungi nuovi tipi di eventi significativi

## 🎉 Risultato

Hai ora un'AI che:
- **Ricorda** davvero le conversazioni
- **Impara** dall'utente
- **Evolve** nel tempo
- **Non si ripete** mai
- **Ha personalità** unica
- **Costruisce relazioni** autentiche

Venice è solo il motore linguistico.  
**TU** hai costruito il cervello! 🧠✨
