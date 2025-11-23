# SexyLara Flutter

Questo è un avvio per riprodurre l'app React/Vite "Sexy Lara" in Flutter.
Il progetto trascina il flusso originale con autenticazione via Supabase, chat in tempo reale (WebSocket), preferenze utente e acquisti.

## Architettura proposta

- **Supabase**: `supabase_flutter` gestisce stato di login, profilo utente e sottoscrizioni.
- **Routing**: `GoRouter` ricrea le rotte React (`/`, `/login`, `/preferenze`, `/subscription`, `/success`).
- **Stato**: Riverpod mantiene sessioni, messaggi e caricamento.
- **Chat**: `web_socket_channel` per la connessione a `wss://sexylara.chat/ws`; `ChatService` fornisce uno stream di `Message` e `sendMessage`.
- **Pagamenti**: schermata di acquisto che invia richieste a un endpoint `/api/create-checkout-session` analogo.

## Prossimi passi

1. Impostare variabili `SUPABASE_URL` e `SUPABASE_ANON_KEY` nel file di build Flutter o usare `--dart-define`.
2. Collegare la logica di checkout Stripe/Pagamenti al backend esistente.
3. Rifinire temi e componenti con gli asset del progetto React originale.

## Comandi utili

```bash
cd flutter_app
flutter pub get
flutter run
```

## Google Sign-In

- L'app usa `google_sign_in` per scambiare i token con Supabase, quindi bisogna configurare due client OAuth su Google Cloud:
  1. **Web client:** serve l'`ID Token` richiesto da Supabase (`GOOGLE_WEB_CLIENT_ID`).
  2. **Android client:** serve il client ID nativo se vuoi evitare popup compromettenti (`GOOGLE_ANDROID_CLIENT_ID`), ma il Web client è obbligatorio.
- Esporta gli ID generati dal progetto Google con `--dart-define`:
  ```bash
  flutter run \
    --dart-define=SUPABASE_URL=https://<tuo-progetto>.supabase.co \
    --dart-define=SUPABASE_ANON_KEY=<anon-key> \
    --dart-define=GOOGLE_WEB_CLIENT_ID=<web-client-id> \
    --dart-define=GOOGLE_ANDROID_CLIENT_ID=<android-client-id>
  ```
- Controlla che i redirect configurati sul progetto Google Cloud includano il package name/app bundle ID e SHA (per Android) o il bundle identifier (per iOS), così `google_sign_in` può ritornare un `idToken` valido.

## Avvio rapido

Per non ripetere il medesimo comando ogni volta, esegui:

```bash
./run_flutter.sh
```

Se vuoi usare un altro dispositivo, passa l'ID come primo argomento:

```bash
./run_flutter.sh MY_DEVICE_ID
```

Lo script seta già `BACKEND_BASE_URL`, `AI_SERVICE_URL` e `WS_BASE_URL` verso `http://192.168.1.42`/`ws://192.168.1.42`, quindi verifica che il tuo backend e il servizio AI siano raggiungibili su quella IP. Se devi cambiare l'indirizzo (es. usi un altro PC), esporta prima `BACKEND_HOST`:

```bash
BACKEND_HOST=192.168.1.99 ./run_flutter.sh
```
