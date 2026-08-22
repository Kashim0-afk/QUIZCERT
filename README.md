# QuizCert

🇬🇧 **[English](#english)** · 🇮🇹 **[Italiano](#italiano)**

---

## English

Driving-test-style multiple-choice quiz app to study IT / cybersecurity and networking
certifications. Instant feedback on every answer, explanation of mistakes, and study
statistics. Runs on PC (browser) and Android (installable as an app, works offline).

**Live app:** https://kashim0-afk.github.io/QUIZCERT/ · **1665 questions · 43 exam areas**

### Modes

- **Allenamento (Training)** — questions in a row, instant feedback (right/wrong + explanation).
- **Simulazione esame (Exam simulation)** — fixed number of questions, timed, score at the end.
- **Ripasso errori (Mistake review)** — only the questions you got wrong and haven't mastered yet.
- **Sfida giornaliera (Daily challenge)** — one set per day, feeds the consecutive-days streak.
- **Studio (Study)** — read every question with its correct answer and explanation, no quiz.

Pool navigation: by **certification**, by **topic** (cross-certification), or **MIX** (everything
together, leaving the selectors on "All").

### Run it

- **Easiest:** open the live link above in Chrome/Edge.
- **Install as an app (PC):** open the link, then click *Install* in the address bar.
- **Install on Android:** open the link in Chrome → menu → *Install app / Add to Home screen*.
  Works offline after the first load.
- **Local/offline from the folder:** double-click `Avvia-QuizCert.bat` (starts a local server and
  opens the app). Opening `index.html` directly with a double-click does **not** work: browsers
  block loading the question files over `file://`, so a small web server is required.

### Tests

Pure-logic modules (grading, statistics, selection, schema, storage, loader) have unit tests
using Node built-ins (no dependencies to install):

```bash
node --test
```

### Add questions

1. Create a JSON file in `data/questions/` with an array of questions (see any existing file).
2. Add the file name to `data/manifest.json` (the `files` list).
3. Add the same path to the `SHELL` list in `service-worker.js` **and** bump the cache name
   (`quizcert-vN` → `quizcert-vN+1`) so the offline cache refreshes.

Question schema:

```json
{
  "id": "nse4-fw-012",
  "cert": ["Fortinet NSE4"],
  "topics": ["Firewall Policy", "NAT"],
  "type": "single",
  "difficulty": 2,
  "question": "…",
  "options": ["A", "B", "C", "D"],
  "correct": [0],
  "explanation": "Why the right answer is right.",
  "why_wrong": { "1": "Why B is wrong" },
  "source": "…"
}
```

- `type`: `single` (one correct), `multi` (choose 2/3), `truefalse` (2 options, one correct).
- `correct`: array of correct 0-based indices (array even when there is only one).
- Invalid questions are automatically skipped at load time.

### Deploy (GitHub Pages)

The app is deployed from the `main` branch (root) via GitHub Pages. Any `git push` updates the
live site in about a minute.

### Backup your statistics

Statistics are stored on the device (IndexedDB). From the **Statistiche (Statistics)** screen:
**Esporta (Export)** downloads a `quizcert-stats.json`; **Importa (Import)** restores it (useful
when moving between devices or after clearing browser data).

---

## Italiano

App di quiz a risposta multipla stile-patente per studiare certificazioni IT / cybersecurity
e networking. Feedback immediato ad ogni risposta, spiegazione degli errori, statistiche per
studiare in modo mirato. Gira su PC (browser) e su Android (installabile come app, offline).

**App online:** https://kashim0-afk.github.io/QUIZCERT/ · **1665 domande · 43 aree d'esame**

### Modalità

- **Allenamento** — domande in fila, feedback immediato (giusto/sbagliato + spiegazione).
- **Simulazione esame** — numero fisso di domande, a tempo, punteggio solo alla fine.
- **Ripasso errori** — solo le domande sbagliate e non ancora padroneggiate.
- **Sfida giornaliera** — un set al giorno, alimenta lo streak di giorni consecutivi.
- **Studio** — leggi ogni domanda con la risposta giusta e la spiegazione, senza quiz.

Navigazione del pool: per **certificazione**, per **argomento** (trasversale tra cert), o **MIX**
(tutto insieme, lasciando i selettori su "Tutte / Tutti").

### Come si avvia

- **Più semplice:** apri il link online qui sopra in Chrome/Edge.
- **Installa come app (PC):** apri il link, poi clicca *Installa* nella barra degli indirizzi.
- **Installa su Android:** apri il link in Chrome → menu → *Installa app / Aggiungi a schermata
  Home*. Funziona offline dopo il primo caricamento.
- **Locale/offline dalla cartella:** doppio click su `Avvia-QuizCert.bat` (avvia un server locale
  e apre l'app). Aprire `index.html` col doppio click **non** funziona: i browser bloccano il
  caricamento dei file delle domande via `file://`, quindi serve un piccolo server web.

### Test

I moduli di logica (correzione, statistiche, selezione, schema, storage, caricamento) hanno test
unitari con Node (nessuna dipendenza da installare):

```bash
node --test
```

### Aggiungere domande

1. Crea un file JSON in `data/questions/` con un array di domande (vedi un file esistente).
2. Aggiungi il nome del file in `data/manifest.json` (lista `files`).
3. Aggiungi lo stesso percorso alla lista `SHELL` in `service-worker.js` **e** incrementa il nome
   della cache (`quizcert-vN` → `quizcert-vN+1`) così l'offline si aggiorna.

### Pubblicazione (GitHub Pages)

L'app è pubblicata dal branch `main` (root) via GitHub Pages. Ogni `git push` aggiorna il sito
in circa un minuto.

### Backup statistiche

Le statistiche sono salvate sul dispositivo (IndexedDB). Dalla schermata **Statistiche**:
**Esporta** scarica un `quizcert-stats.json`; **Importa** lo ricarica (utile per spostarsi tra
dispositivi o dopo aver svuotato i dati del browser).

### Struttura

```
index.html            shell
src/                  moduli (schema, engine, select, stats, storage, data-loader, ui, main)
data/manifest.json    elenco file domande
data/questions/       banca domande (1665 domande, 43 aree)
test/                 test unitari (node --test)
manifest.webmanifest  metadati PWA
service-worker.js     cache offline
Avvia-QuizCert.bat    avvio locale su Windows
```
