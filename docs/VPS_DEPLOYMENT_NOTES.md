# VPS Deployment Notes

## Data: 2025-12-04

### Problemi Risolti

#### 1. Port Mapping Docker
**Problema**: Il frontend non riusciva a comunicare con il backend API.

**Causa**: Discrepanza tra la porta esposta dal Docker container (5000) e la configurazione Apache (4000).

**Soluzione**:
- Aggiornato `scripts/deploy_vps.sh`: mapping porta da `-p 4000:4000` a `-p 5000:4000`
- Aggiornato `scripts/configure-apache.sh`: proxy Apache da `localhost:4000` a `localhost:5000`
- Il container Docker ora espone correttamente: `0.0.0.0:5000->4000/tcp` (API) e `0.0.0.0:5001->5001/tcp` (WS)

#### 2. Errore SyntaxError: Duplicate Declaration
**Problema**: Il server WebSocket non si avviava con errore `SyntaxError: Identifier 'globalScheduler' has already been declared`.

**Causa**: Dichiarazione duplicata di `globalScheduler` in `backend/server-ws.js` (linee 25 e 33).

**Soluzione**: Rimossa la dichiarazione duplicata alla linea 33.

#### 3. Errore LLM: "Only absolute URLs are supported"
**Problema**: Il WebSocket server crashava quando tentava di chiamare il servizio LLM con errore `TypeError: Only absolute URLs are supported`.

**Causa**: Le variabili d'ambiente (`ADDRESS_VENICE`, `API_VENICE`, `MODEL_VENICE`, `REPLICATE_API_TOKEN`) non erano disponibili nel processo PM2 `ws`.

**Soluzione**: 
- Modificato `backend/ecosystem.config.js` per passare esplicitamente le variabili d'ambiente da `.env` ai processi PM2:
  - `ADDRESS_VENICE`
  - `API_VENICE`
  - `MODEL_VENICE`
  - `REPLICATE_API_TOKEN`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Configurazione Attuale

#### Docker Container
- **Nome**: `sexylara-backend`
- **Porte**:
  - `0.0.0.0:5000->4000/tcp` (API server interno su porta 4000, esposto su porta 5000 dell'host)
  - `0.0.0.0:5001->5001/tcp` (WebSocket server)

#### Apache Reverse Proxy
- **API**: `https://thril.me/api` → `http://localhost:5000/api`
- **WebSocket**: `wss://thril.me/ws` → `ws://localhost:5001/ws`

#### PM2 Processes (dentro Docker)
- **api**: `server-api.js` su porta 4000 (interna)
- **ws**: `server-ws.js` su porta 5001

### File Modificati
1. `scripts/deploy_vps.sh` - Port mapping Docker
2. `scripts/configure-apache.sh` - Configurazione proxy Apache + supporto SSH_PASS
3. `backend/server-ws.js` - Rimossa dichiarazione duplicata
4. `backend/ecosystem.config.js` - Aggiunta propagazione variabili d'ambiente

### Comandi Utili

#### Deploy Backend
```bash
SSH_PASS="*Giuseppe78" ./scripts/deploy_vps.sh
```

#### Deploy Frontend
```bash
./scripts/deploy_web.sh
```

#### Configurare Apache
```bash
SSH_PASS="*Giuseppe78" ./scripts/configure-apache.sh
```

#### Monitorare Logs
```bash
# Logs Docker container
sshpass -p "*Giuseppe78" ssh -o StrictHostKeyChecking=no root@45.85.146.77 "docker logs --tail 100 sexylara-backend"

# Logs PM2 API
sshpass -p "*Giuseppe78" ssh -o StrictHostKeyChecking=no root@45.85.146.77 "docker exec sexylara-backend pm2 logs api --lines 20 --nostream"

# Logs PM2 WebSocket
sshpass -p "*Giuseppe78" ssh -o StrictHostKeyChecking=no root@45.85.146.77 "docker exec sexylara-backend pm2 logs ws --lines 20 --nostream"

# Status PM2
sshpass -p "*Giuseppe78" ssh -o StrictHostKeyChecking=no root@45.85.146.77 "docker exec sexylara-backend pm2 list"
```

### Variabili d'Ambiente Critiche

Le seguenti variabili devono essere presenti in `backend/.env` sul VPS:

```env
# Venice AI (LLM)
ADDRESS_VENICE="https://api.venice.ai/api/v1/chat/completions"
API_VENICE=<venice_api_key>
MODEL_VENICE="venice-uncensored"

# Replicate (AI Models)
REPLICATE_API_TOKEN=<replicate_token>
REPLICATE_LLM_MODEL="meta/meta-llama-3-8b-instruct:5a6809ca6288247d06daf6365557e5e429063f32a21146b2a807c682652136b8"

# Supabase
SUPABASE_URL=<supabase_url>
SUPABASE_ANON_KEY=<supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>

# Server
PORT=5000
NODE_ENV=development
```

### Note Importanti

1. **Quotes nelle variabili d'ambiente**: `ADDRESS_VENICE` ha quotes nel file `.env` (`"https://..."`). Questo è gestito correttamente da `dotenv`.

2. **PM2 Environment Propagation**: PM2 non propaga automaticamente tutte le variabili d'ambiente dal processo parent ai processi figli. È necessario specificarle esplicitamente in `ecosystem.config.js` o caricarle tramite `dotenv` nello script dell'applicazione.

3. **Docker Build Cache**: Se si modificano solo variabili d'ambiente, il Docker build potrebbe usare la cache. Per forzare un rebuild completo: `docker build --no-cache -t sexylara-backend:latest .`

4. **Apache Configuration**: Dopo modifiche alla configurazione Apache, è necessario riavviare il servizio: `systemctl restart apache2`

### Prossimi Passi

- Monitorare i logs del WebSocket per verificare che non ci siano più errori LLM
- Testare le chiamate API dal frontend:
  - `/api/users/invites/pending`
  - `/api/users/:id/profile`
  - `/api/npcs/:id/public`
  - `/api/chat-history/:userId/:npcId`
- Verificare la connessione WebSocket e le risposte AI
