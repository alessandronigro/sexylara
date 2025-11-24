# 📘 ThrilMe Ecosystem Guide

Questo file contiene le istruzioni essenziali per lavorare sul progetto ThrilMe (SexyLara).
**LEGGERE PRIMA DI OGNI SESSIONE.**

## 📂 Struttura Progetto

*   **Locale (Mac):** `/Applications/wwwroot/sexylara`
    *   `backend/`: Codice Node.js (API + WebSocket).
    *   `lib/`: Codice Flutter.
    *   `run_flutter_wireless.sh`: Script per avviare l'app su dispositivo fisico via WiFi.
*   **VPS (Produzione):** `/var/www/thrilme` (IP: `45.85.146.77`)
    *   Backend Dockerizzato (`thrilme-backend`).
    *   Apache Proxy (`sexylara.chat`).

## ⚙️ Porte e Indirizzi

*   **Backend API:** Porta `4000`
*   **Backend WebSocket:** Porta `5001`
*   **IP Mac Sviluppo:** `192.168.1.42` (usato per test in rete locale)
*   **Dispositivo Android:** `192.168.1.157` (Porta ADB variabile, es. `38723`)

## 🚀 Workflow Sviluppo

### 1. Avvio Backend Locale
```bash
cd backend
pm2 start ecosystem.config.js
pm2 logs
```
*Assicurarsi che le porte 4000 e 5001 siano libere.*

### 2. Avvio App Flutter (Wireless)
Usare SEMPRE lo script dedicato:
```bash
./run_flutter_wireless.sh
```
Questo script gestisce la connessione ADB e l'avvio dell'app con i flag corretti.

### 3. Deploy in Produzione
1.  Copiare backend su VPS: `scp -r backend root@45.85.146.77:/var/www/thrilme/`
2.  Ricostruire Docker su VPS.
3.  Riavviare container.

## 🐛 Troubleshooting Comune

*   **Avatar non generato:** Controllare che l'app chiami `/api/generate-avatar` e non `/generate-avatar`.
*   **ADB device not found:** Verificare IP e porta nel `run_flutter_wireless.sh` o riconnettere via USB per riabilitare TCPIP.
*   **EADDRINUSE:** Killare processi node (`killall node`) e riavviare PM2.

## 📝 Note Importanti
*   Il backend locale usa `192.168.1.42` in `config.dart` per permettere al dispositivo fisico di connettersi.
*   In produzione, `Config.apiBaseUrl` punta a `https://sexylara.chat`.
