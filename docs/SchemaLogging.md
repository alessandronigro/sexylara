# Schema di Logging & Sicurezza – ThrillMe

Obiettivo: garantire tracciabilità delle azioni critiche, sicurezza dei dati e supporto ad audit interni, nel rispetto del principio di minimizzazione GDPR.

## 1. Cosa loggare

### 1.1 Eventi di autenticazione
- login riusciti / falliti (userId o hash, timestamp, IP ridotto, device).
- logout.
- refresh token / scadenza sessione.

### 1.2 Eventi di sicurezza
- errori di autorizzazione (tentativi di accesso a risorse non permesse).
- superamento rate-limit.
- tentativi anomali (es. flood di richieste, pattern di abuso).

### 1.3 Interazioni ai fini di debug e safety
- ID messaggio utente (non necessariamente contenuto integrale, se non strettamente necessario).
- ID NPC, tipo di risposta generata (es. “safe”, “blocked”, “fallback”).
- flag per contenuto sensibile rilevato/filtrato (no dettaglio se non serve).

### 1.4 Operazioni amministrative
- modifiche a ruoli, permessi, configurazioni di moderazione.
- creazione/ban di account.

## 2. Dove e come loggare

- Logs applicativi su file o sistema centralizzato (es. Elastic, Loki, ecc.).
- Accesso ai log limitato solo a personale autorizzato (ruoli interni).
- Rotazione e retention dei log (es. 30–90 giorni per eventi standard, più a lungo solo per motivi di sicurezza/legali).

## 3. Principi GDPR di minimizzazione

- Non loggare interi contenuti di chat se non necessario: meglio metadati o sample minimali.
- Evitare di loggare media (foto, audio) se non strettamente richiesto per analisi forense.
- Pseudonimizzare dove possibile (es. usare userId non direttamente riconducibile alla persona senza la base dati principale).

## 4. Sicurezza dei dati

- HTTPS obbligatorio per tutte le API.
- Token JWT o simili per autenticare client–backend.
- Crittografia lato server per dati sensibili riposanti (es. chiavi, token, segreti).
- Politica di password sicure (se usi login proprio) o affidarsi a OAuth (Google, ecc.).

## 5. Controlli di accesso

- Ruoli interni (es. admin, support, dev, read-only).
- Solo alcuni ruoli possono:
  - accedere a log completi;
  - vedere dati identificativi;
  - eseguire ban o modifiche critiche.

## 6. Gestione incidenti

- Definire una procedura per:
  - rilevamento sospetto data breach;
  - analisi;
  - mitigazione;
  - eventuale notifica agli utenti e al Garante (se richiesto dalla normativa).

## 7. Backup

- Backup regolari del database (criptati).
- Test periodico del ripristino.
- Accesso ai backup limitato.