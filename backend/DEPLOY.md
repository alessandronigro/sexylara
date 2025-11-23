# 🚀 Guida al Deployment del Backend

Il backend è composto da due servizi:
1.  **API Server**: Gestisce le richieste HTTP (utenti, messaggi, pagamenti).
2.  **WebSocket Server**: Gestisce le chat in tempo reale.

## Opzione 1: Deployment su VPS (Docker) - Consigliato

Questa opzione ti permette di avere il controllo completo su un server (es. DigitalOcean, Hetzner, AWS).

### Prerequisiti
- Un server Linux (Ubuntu 22.04 consigliato)
- Docker e Docker Compose installati

### Passaggi

1.  **Costruisci l'immagine Docker**:
    ```bash
    docker build -t sexylara-backend .
    ```

2.  **Esegui il container**:
    Assicurati di passare le variabili d'ambiente necessarie (puoi usare un file .env).

    ```bash
    docker run -d \
      --name backend \
      -p 4000:4000 \
      -p 5001:5001 \
      --env-file .env \
      sexylara-backend
    ```

    Il container userà `pm2` internamente per avviare entrambi i processi.

## Opzione 2: Deployment su PaaS (Railway, Render, Heroku)

Queste piattaforme gestiscono l'infrastruttura per te. Solitamente richiedono di deployare un servizio per porta.

### Deployment API
1.  Crea un nuovo servizio collegato a questa repo.
2.  Imposta il comando di start: `npm run start:api`
3.  Imposta le variabili d'ambiente (SUPABASE_URL, ecc.).
4.  La piattaforma assegnerà automaticamente una porta (es. 8080) che l'app userà grazie a `process.env.PORT`.

### Deployment WebSocket
1.  Crea un **secondo** servizio collegato alla stessa repo.
2.  Imposta il comando di start: `npm run start:ws`
3.  Imposta le stesse variabili d'ambiente.
4.  Questo servizio avrà il suo URL pubblico dedicato (es. `wss://tuo-progetto-ws.up.railway.app`).

## Variabili d'Ambiente Richieste

Assicurati che queste variabili siano configurate nel server di produzione:

- `SUPABASE_URL`
- `SUPABASE_KEY` (Service Role Key per il backend)
- `API_VENICE`
- `ADDRESS_VENICE`
- `MODEL_VENICE`
- `REPLICATE_API_TOKEN`
- `STRIPE_SECRET_KEY` (se usi pagamenti)
