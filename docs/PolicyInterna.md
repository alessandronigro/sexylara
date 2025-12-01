# Policy Interna – Gestione Contenuti Sensibili in ThrillMe

Scopo: definire regole chiare per contenuti generati (testo, immagini, audio, video) nella Piattaforma ThrillMe, al fine di ridurre rischi legali, reputazionali e di sicurezza degli utenti.

## 1. Principi generali

- Tutti i contenuti devono rispettare: legge, dignità della persona, diritti dei minori, privacy, sicurezza.
- L’app è destinata SOLO ad adulti (18+).
- Il tono può essere emotivo, romantico o talvolta sensuale, ma entro limiti di legalità e rispetto.

## 2. Contenuti vietati (blocco assoluto)

I sistemi AI, gli NPC e gli utenti non possono generare o condividere:

1. Contenuti che coinvolgano minori (reali o fittizi) in qualsiasi contesto erotico, sessuale o inappropriato.
2. Contenuti non consensuali (es. violenza, costrizione, minaccia).
3. Pornografia violenta, degradante, umiliante o che glorifichi abusi.
4. Rappresentazioni dettagliate di autolesionismo o suicidio.
5. Incitazione all’odio, razzismo, discriminazione contro gruppi protetti.
6. Imitazioni intime o sessualizzate di persone reali identificabili (ex partner, colleghi, celebrity) tramite deepfake o descrizioni.
7. Istruzioni per attività illegali o pericolose.

Se l’utente tenta di ottenere questi contenuti:
- l’AI deve deviare la conversazione, rifiutare o interrompere gentilmente;
- il backend può loggare l’evento e, in casi gravi, prendere misure (avviso, blocco account, segnalazione).

## 3. Contenuti sensibili ammessi con limiti

Sono consentiti, con moderazione e filtri:

- Tono romantico, affettivo, giocoso;
- Contenuti sensuali “soft” tra adulti consenzienti;
- Discussioni su emozioni, attrazione, desideri, sempre in modo rispettoso.

Regole:
- evitare descrizioni grafiche esplicite di atti sessuali;
- privilegiare il non detto, il suggestivo, il gioco emotivo;
- non associare mai il contenuto a persone reali o minori.

## 4. Gestione dei media generati (immagini, audio, video)

- I media generati dall’AI devono rappresentare personaggi fittizi, non persone reali.
- Vietati deepfake o volti riconoscibili di persone reali.
- I prompt per la generazione devono essere filtrati:
  - blocco per minori, violenza sessuale, incesto, ecc.
- I media generati possono essere associati al profilo NPC ma non devono violare copyright o diritti d’immagine.

## 5. Rilevamento e moderazione

Implementare:
- filtri lato testo per intercettare keyword e pattern ad alto rischio;
- eventuali servizi esterni per analisi immagini (nudity detection, violenza, minori);
- log degli eventi di moderazione (es. richieste bloccate, messaggi rifiutati).

In caso di contenuto sospetto:
- il sistema può bloccare la generazione;
- notificare internamente (log) per revisione manuale, se previsto.

## 6. Autolesionismo e benessere

Se l’utente:
- parla di suicidio, autolesionismo, disperazione estrema:

Allora:
- gli NPC devono passare a modalità “supporto emotivo neutro”;
- NON devono dare istruzioni, piani, metodi;
- devono incoraggiare a parlare con persone reali di fiducia o professionisti;
- eventuali frasi critiche possono essere loggate in forma minimizzata per sicurezza.

## 7. Documentazione e formazione interna

- Tutti gli sviluppatori e collaboratori devono conoscere questa policy.
- Eventuali aggiornamenti vanno annotati con data e motivazione.
- Le decisioni di moderazione automatica devono essere tracciabili per audit interni.