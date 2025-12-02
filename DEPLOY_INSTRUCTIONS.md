# Istruzioni Deploy VPS

Il sistema è pronto per il deploy. Poiché è la prima volta che ti connetti o la chiave host è cambiata, devi eseguire il deploy manualmente la prima volta o accettare la chiave.

## Opzione 1: Deploy Manuale (Consigliato)

Esegui questi comandi nel tuo terminale:

```bash
cd /Applications/wwwroot/sexylara
./scripts/deploy-vps.sh
```

Quando richiesto:
`Are you sure you want to continue connecting (yes/no/[fingerprint])?`
Digita: `yes`

## Opzione 2: Deploy Manuale Step-by-Step

Se lo script non funziona, accedi al VPS e aggiorna manualmente:

```bash
ssh root@176.97.114.247

# Una volta dentro:
cd /root/sexylara/backend
git pull origin main
pm2 restart all
pm2 logs --lines 50
```

## Verifica Post-Deploy

Controlla che nei log appaia:
1. `🔌 WebSocket server attivo`
2. `🧠 Memory consolidation scheduler started`

Se vedi questi messaggi, l'aggiornamento v2.1 è attivo!
