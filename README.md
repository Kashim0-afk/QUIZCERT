# QuizCert

App di quiz a risposta multipla stile-patente per studiare certificazioni IT / cybersecurity
e networking. Feedback immediato ad ogni risposta, spiegazione degli errori, statistiche per
studiare in modo mirato. Gira su PC (browser) e su Android (installabile come app, offline).

## Modalità

- **Allenamento** — domande in fila, feedback immediato (giusto/sbagliato + spiegazione).
- **Simulazione esame** — numero fisso di domande, a tempo, punteggio solo alla fine.
- **Ripasso errori** — solo le domande sbagliate e non ancora padroneggiate.
- **Sfida giornaliera** — un set al giorno, alimenta lo streak di giorni consecutivi.

Navigazione del pool: per **certificazione**, per **argomento** (trasversale tra cert), o **MIX**
(tutto insieme, lasciando i selettori su "Tutte / Tutti").

## Avvio in locale

Serve un piccolo server web (il caricamento delle domande via `fetch` non funziona aprendo il
file direttamente con `file://`):

```bash
python -m http.server 8000
```

Poi apri `http://localhost:8000` nel browser.

## Test

I moduli di logica (correzione risposte, statistiche, selezione, schema, storage, caricamento)
hanno test unitari con Node (nessuna dipendenza da installare):

```bash
node --test
```

## Aggiungere domande

1. Crea un file JSON in `data/questions/`, es. `data/questions/nse4.json`, con un array di
   domande secondo lo schema (vedi `data/questions/sample.json` e
   `docs/superpowers/specs/2026-08-21-quizcert-design.md`).
2. Aggiungi il nome del file in `data/manifest.json` (lista `files`).
3. Aggiungi lo stesso percorso alla lista `SHELL` in `service-worker.js` **e** incrementa il
   nome della cache (`quizcert-v1` → `quizcert-v2`) così l'offline si aggiorna.

Formato di una domanda:

```json
{
  "id": "nse4-fw-012",
  "cert": ["Fortinet NSE4"],
  "topics": ["Firewall Policy", "NAT"],
  "type": "single",
  "difficulty": 2,
  "question": "Testo della domanda...",
  "options": ["A", "B", "C", "D"],
  "correct": [0],
  "explanation": "Perché la risposta giusta è giusta.",
  "why_wrong": { "1": "Perché B è sbagliata" },
  "source": "HACK/Fortinet Network Security.rtf"
}
```

- `type`: `single` (una giusta), `multi` (scegli 2/3), `truefalse` (2 opzioni, una giusta).
- `correct`: array degli indici giusti (array anche quando è una sola).
- Le domande non valide vengono scartate automaticamente al caricamento.

## Pubblicare su GitHub Pages

1. Crea un repository vuoto su GitHub (es. `quizcert`).
2. Dal progetto:

   ```bash
   git remote add origin https://github.com/<utente>/quizcert.git
   git branch -M main
   git push -u origin main
   ```

3. Sul repo: **Settings → Pages → Source: Deploy from a branch → Branch `main` / `/root`**.
4. Attendi l'URL pubblicato (es. `https://<utente>.github.io/quizcert/`).

Il file `.nojekyll` è già incluso perché GitHub Pages serva tutti i file senza processarli.

## Installare su Android

1. Apri l'URL di GitHub Pages con **Chrome** sul telefono.
2. Menu (⋮) → **Installa app** / **Aggiungi a schermata Home**.
3. L'app compare come icona; si apre a schermo pieno e funziona **offline**.

Su PC basta aprire lo stesso URL (Chrome/Edge mostrano un'icona di installazione nella barra
degli indirizzi, opzionale).

## Backup statistiche

Le statistiche sono salvate sul dispositivo (IndexedDB). Dalla schermata **Statistiche**:

- **Esporta statistiche** — scarica un file `quizcert-stats.json`.
- **Importa statistiche** — ricarica quel file (utile per spostarsi tra dispositivi o dopo aver
  svuotato i dati del browser).

## Struttura

```
index.html            shell
src/                  moduli (schema, engine, select, stats, storage, data-loader, ui, main)
data/manifest.json    elenco file domande
data/questions/       banca domande
test/                 test unitari (node --test)
manifest.webmanifest  metadati PWA
service-worker.js     cache offline
docs/superpowers/     spec di design + piano di implementazione
```
