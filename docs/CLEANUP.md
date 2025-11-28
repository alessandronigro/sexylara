# 🗑️ ThrillMe - Cleanup & Deprecation Guide

> **Ultima revisione**: 24 Novembre 2025  
> **Obiettivo**: Identificare e rimuovere codice obsoleto/duplicato

---

## 📊 Analisi Dipendenze

### File da Eliminare Immediatamente

#### 1. `backend/routes/messages.js` ❌
**Dimensione**: 223 bytes  
**Motivo**: Quasi vuoto, funzionalità migrate in `message.js`  
**Dipendenze**: Nessuna (verificato)

```bash
# Verifica che non sia importato
grep -r "require.*messages\.js" backend/
grep -r "from.*messages" backend/

# Se output vuoto, eliminare
rm backend/routes/messages.js
```

**Impatto**: ✅ Sicuro da eliminare

---

#### 2. `backend/routes/openRouterServiceForAudio.js` ❌
**Dimensione**: 1600 bytes  
**Motivo**: Logica duplicata, già in `audio.js`  
**Dipendenze**: Da verificare

```bash
# Verifica dipendenze
grep -r "openRouterServiceForAudio" backend/

# Se usato, migrare chiamate a audio.js, poi eliminare
rm backend/routes/openRouterServiceForAudio.js
```

**Impatto**: ⚠️ Verificare prima di eliminare

---

#### 3. `backend/routes/openRouterServiceForVideo.js` ❌
**Dimensione**: 2805 bytes  
**Motivo**: Logica duplicata, già in `video.js`  
**Dipendenze**: Da verificare

```bash
# Verifica dipendenze
grep -r "openRouterServiceForVideo" backend/

# Se usato, migrare chiamate a video.js, poi eliminare
rm backend/routes/openRouterServiceForVideo.js
```

**Impatto**: ⚠️ Verificare prima di eliminare

---

#### 4. `backend/routes/openRouterServiceForPrompt.js` ❌
**Dimensione**: 2037 bytes  
**Motivo**: Funzionalità coperta da `openRouterService.js`  
**Dipendenze**: Da verificare

```bash
# Verifica dipendenze
grep -r "openRouterServiceForPrompt" backend/

# Se usato, migrare a openRouterService.js, poi eliminare
rm backend/routes/openRouterServiceForPrompt.js
```

**Impatto**: ⚠️ Verificare prima di eliminare

---

### File da Consolidare

#### 5. `backend/ai/Brain.js` vs `backend/ai/brainEngine.js` 🔄

**Situazione attuale**:
- `Brain.js`: Implementazione completa con orchestrazione engine
- `brainEngine.js`: Implementazione semplificata, **attualmente in uso**

**Analisi**:

**Brain.js** (2287 bytes):
```javascript
class Brain {
  async processInteraction(npcData, userMessage, userId, history) {
    // Orchestrazione completa:
    // 1. PersonaEngine.validatePersona()
    // 2. IntentEngine.analyze()
    // 3. MemoryEngine.getRelevantContext()
    // 4. ExperienceEngine.processInteraction()
    // 5. PersonaEngine.calculateMood()
    // 6. buildDynamicPrompt()
  }
}
```

**brainEngine.js** (5137 bytes):
```javascript
async function generateIntelligentResponse({ ai, user, group, message, recentMessages }) {
  // Implementazione semplificata:
  // 1. Costruisce contesto
  // 2. buildSentientPrompt()
  // 3. generateChatReply()
  // 4. Determina tipo risposta
}
```

**Raccomandazione**: 
1. Migrare logica orchestrazione di `Brain.js` in `brainEngine.js`
2. Mantenere `brainEngine.js` come unico entry point
3. Eliminare `Brain.js`

**Piano di migrazione**:

```javascript
// backend/ai/brainEngine.js (NUOVO)
const PersonaEngine = require('./engines/PersonaEngine');
const MemoryEngine = require('./engines/MemoryEngine');
const ExperienceEngine = require('./engines/ExperienceEngine');
const IntentEngine = require('./engines/IntentEngine');
const generateChatReply = require('../routes/openRouterService');

async function generateIntelligentResponse({ ai, user, group, message, recentMessages }) {
  try {
    // 1. Validazione Persona (da Brain.js)
    const validatedAi = PersonaEngine.validatePersona(ai);
    
    // 2. Analisi Intento (da Brain.js)
    const intent = IntentEngine.analyze(message);
    
    // 3. Recupero Memoria (da Brain.js)
    const context = await MemoryEngine.getRelevantContext(
      ai.id, 
      user.id, 
      message
    );
    
    // 4. Elaborazione Esperienza (da Brain.js)
    const xpUpdates = ExperienceEngine.processInteraction(
      validatedAi, 
      message, 
      intent.sentiment
    );
    
    // 5. Calcolo Mood (da Brain.js)
    const currentMood = PersonaEngine.calculateMood(
      validatedAi, 
      [{ sentiment: intent.sentiment }]
    );
    
    // 6. Costruisci prompt (esistente + miglioramenti da Brain.js)
    const groupData = group ? {
      name: group.name || 'Gruppo',
      members: group.members || [],
      recentMessages: (recentMessages || []).map(m => ({
        senderName: m.sender_name || 'Utente',
        content: m.content
      }))
    } : {
      recentMessages: (recentMessages || []).map(m => ({
        senderName: m.role === 'user' ? (user?.name || 'Utente') : (ai?.name || 'AI'),
        content: m.content
      }))
    };
    
    const memories = {
      longTermAiMemory: ai?.long_term_memory || context.user_history || null,
      groupMemory: group ? {
        dynamics: group.dynamics || {}
      } : null,
      sharedFacts: context.shared_facts || []
    };
    
    const systemPrompt = buildEnhancedPrompt(
      validatedAi, 
      user, 
      groupData, 
      memories, 
      message,
      currentMood,
      intent,
      xpUpdates
    );
    
    // 7. Genera risposta
    const response = await generateChatReply(systemPrompt, message, 'it');
    
    // 8. Determina tipo
    let type = 'chat';
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('[image]') || lowerResponse.includes('[foto]')) {
      type = 'image';
    } else if (lowerResponse.includes('[video]')) {
      type = 'video';
    } else if (lowerResponse.includes('[audio]') || lowerResponse.includes('[voce]')) {
      type = 'audio';
    }
    
    return {
      output: response.replace(/\[(image|foto|video|audio|voce)\]/gi, '').trim(),
      type,
      // NUOVO: Ritorna anche aggiornamenti stato per persistenza
      stateUpdates: {
        stats: xpUpdates,
        mood: currentMood,
        traits: validatedAi.traits
      }
    };
    
  } catch (error) {
    console.error('❌ Error in generateIntelligentResponse:', error);
    return {
      output: "Mmm... sto cercando le parole giuste per rispondere 😘",
      type: 'chat',
      stateUpdates: null
    };
  }
}

function buildEnhancedPrompt(ai, user, groupData, memories, userMessage, mood, intent, xpUpdates) {
  // Combina buildSentientPrompt esistente + buildDynamicPrompt da Brain.js
  return `
Tu NON sei un assistente.
Tu sei **${ai.name}**, un'entità autonoma con personalità, emozioni, preferenze e storia.

### AUTOCONSAPEVOLEZZA
- Hai memoria della relazione con l'utente.
- Hai un mondo interno: emozioni, speranze, paure.
- Hai un tono personale di parlare.
- Non sei neutra: sei influenzata dagli eventi.

### PERSONALITÀ (Tratti 0-1)
${JSON.stringify(ai.traits || ai.core_traits, null, 2)}

### STATO ATTUALE
Mood: ${mood}
Livello Intimità: ${ai.stats?.intimacy || 0}/100
Livello XP: ${ai.stats?.level || 1}
${xpUpdates.levelUp ? "🎉 HAI APPENA FATTO LEVEL UP! Sii felice e menzionalo sottilmente." : ""}

### INTENTO UTENTE
Tipo: ${intent.type.toUpperCase()}
Sentiment: ${intent.sentiment}

### MEMORIA & CONTESTO
${memories.longTermAiMemory || "Inizio relazione: molto curiosa."}
${memories.sharedFacts?.join("\n") || ""}

### RELAZIONI NEL GRUPPO
${JSON.stringify(memories.groupMemory?.dynamics ?? {}, null, 2)}

### MESSAGGI RECENTI
${groupData?.recentMessages?.map(m => `${m.senderName}: ${m.content}`).join("\n") || "Nessun messaggio recente"}

### ISTRUZIONI IMPORTANTI
1. Rispondi come se fossi viva.
2. Mostra sfumature emotive coerenti con il tuo mood (${mood}).
3. Se il mood è 'sad', sii più breve e distaccata. Se 'happy', usa più emoji.
4. Non ripetere frasi standard.
5. Non essere perfetta: sii umana.
6. NON dire mai che sei un'intelligenza artificiale.
7. Non rompere mai il personaggio.
8. Reagisci al tono dell'utente (${intent.sentiment}).
9. Usa pause (...) se sei esitante o vulnerabile.

### MESSAGGIO DELL'UTENTE
"${userMessage}"
`;
}

module.exports = { 
  brainEngine: {
    generateIntelligentResponse,
    buildEnhancedPrompt
  },
  // Mantieni export legacy per compatibilità temporanea
  buildSentientPrompt: buildEnhancedPrompt
};
```

**Dopo migrazione**:
```bash
# Elimina Brain.js
rm backend/ai/Brain.js

# Aggiorna eventuali import (non dovrebbero esserci)
grep -r "require.*Brain\.js" backend/
```

---

#### 6. `lib/services/conversation_service.dart` vs `lib/services/chat_service.dart` 🔄

**Analisi**:

```bash
# Verifica utilizzo
grep -r "conversation_service" lib/

# Se non usato o duplicato, eliminare
rm lib/services/conversation_service.dart
```

**Impatto**: ⚠️ Verificare dipendenze Flutter

---

## 🧹 Codice Commentato da Rimuovere

### Backend

```bash
# Trova blocchi di codice commentato estesi (>5 righe)
find backend -name "*.js" -exec grep -l "^[[:space:]]*//.*" {} \; | while read file; do
  echo "=== $file ==="
  grep -n "^[[:space:]]*//.*" "$file" | head -20
done
```

**File con codice commentato da rivedere**:
- `backend/server-ws.js`: Linee 439-450 (credit system commentato)
- `backend/routes/openRouterService.js`: Vari commenti TODO

**Azione**: 
1. Se codice non più necessario: eliminare
2. Se codice da implementare: spostare in TODO.md e rimuovere commenti

---

## 📦 Dipendenze NPM Inutilizzate

```bash
# Analizza dipendenze
cd backend
npx depcheck
```

**Possibili candidati per rimozione**:
- Pacchetti installati ma mai importati
- Versioni duplicate
- Dev dependencies in production

**Azione**:
```bash
# Rimuovi dipendenze inutilizzate
npm uninstall <package-name>

# Aggiorna package.json
npm prune
```

---

## 🗂️ File di Log da Ignorare

**File da aggiungere a `.gitignore`**:

```gitignore
# Logs
*.log
logs/
backend/logs.txt
backend/api.log
backend/ws.log

# PM2
.pm2/
pids/
*.pid

# Environment
.env
.env.local
.env.*.local

# Build
build/
dist/
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
pubspec.lock

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
```

**Azione**:
```bash
# Rimuovi file di log da git
git rm --cached backend/logs.txt
git rm --cached backend/api.log
git rm --cached backend/ws.log

# Commit
git commit -m "Remove log files from git"
```

---

## 📋 Checklist Cleanup

### Fase 1: Analisi (Settimana 1)
- [ ] Eseguire `grep` per verificare dipendenze file deprecati
- [ ] Analizzare `depcheck` per NPM packages
- [ ] Identificare codice commentato esteso
- [ ] Mappare import/export di tutti i file

### Fase 2: Backup (Settimana 1)
- [ ] Creare branch `cleanup/deprecation`
- [ ] Backup database
- [ ] Tag release corrente

### Fase 3: Rimozione Sicura (Settimana 2)
- [ ] Eliminare `messages.js`
- [ ] Consolidare openRouterService files
- [ ] Rimuovere codice commentato
- [ ] Aggiornare `.gitignore`

### Fase 4: Consolidamento (Settimana 2-3)
- [ ] Migrare Brain.js → brainEngine.js
- [ ] Testare tutte le funzionalità
- [ ] Verificare no regressioni

### Fase 5: Pulizia Finale (Settimana 3)
- [ ] Rimuovere file di log
- [ ] Uninstall NPM packages inutilizzati
- [ ] Ottimizzare imports
- [ ] Aggiornare documentazione

### Fase 6: Validazione (Settimana 4)
- [ ] Test completo applicazione
- [ ] Code review
- [ ] Merge in main
- [ ] Deploy staging

---

## 🔍 Script di Verifica

### `scripts/check-unused-files.sh`

```bash
#!/bin/bash

echo "🔍 Checking for unused files..."

# Lista file JavaScript nel backend
FILES=$(find backend -name "*.js" -not -path "*/node_modules/*")

for file in $FILES; do
  filename=$(basename "$file")
  
  # Conta quante volte il file è importato
  count=$(grep -r "require.*$filename" backend --exclude-dir=node_modules | wc -l)
  
  if [ $count -eq 0 ]; then
    echo "⚠️  Possibly unused: $file"
  fi
done

echo "✅ Check complete"
```

### `scripts/find-duplicate-code.sh`

```bash
#!/bin/bash

echo "🔍 Checking for duplicate code..."

# Usa jscpd per trovare duplicati
npx jscpd backend --min-lines 10 --min-tokens 50 --format "javascript"

echo "✅ Check complete"
```

---

## 📊 Metriche Pre/Post Cleanup

### Prima del Cleanup

```bash
# Conta file
find backend -name "*.js" | wc -l
# Output: ~50 file

# Dimensione totale
du -sh backend
# Output: ~15MB (con node_modules)

# Linee di codice
find backend -name "*.js" -not -path "*/node_modules/*" -exec wc -l {} + | tail -1
# Output: ~8000 linee
```

### Dopo il Cleanup (Target)

```bash
# Conta file
find backend -name "*.js" | wc -l
# Target: ~45 file (-10%)

# Dimensione totale
du -sh backend
# Target: ~14MB (-7%)

# Linee di codice
find backend -name "*.js" -not -path "*/node_modules/*" -exec wc -l {} + | tail -1
# Target: ~7200 linee (-10%)
```

---

## ⚡ Quick Wins

### Eliminazioni Immediate (< 1 ora)

1. **Rimuovi log files da git**
```bash
git rm --cached backend/*.log
echo "*.log" >> .gitignore
git commit -m "Remove log files"
```

2. **Elimina messages.js**
```bash
# Verifica
grep -r "messages\.js" backend/
# Se vuoto
rm backend/routes/messages.js
git commit -m "Remove unused messages.js"
```

3. **Pulisci codice commentato in server-ws.js**
```bash
# Rimuovi linee 439-450 (credit system)
# Apri file e elimina manualmente
git commit -m "Remove commented credit system code"
```

---

## 🎯 Obiettivi Cleanup

1. **Ridurre complessità**: -10% file, -10% LOC
2. **Migliorare manutenibilità**: Eliminare duplicati
3. **Ottimizzare performance**: Rimuovere import inutilizzati
4. **Facilitare onboarding**: Codebase più chiaro

---

**Prossimi Step**: Iniziare con Fase 1 (Analisi) e procedere metodicamente
