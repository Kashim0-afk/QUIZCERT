# QuizCert — Design

Data: 2026-08-21
Autore: (anonimizzato)

## Scopo

App di quiz a risposta multipla stile-patente per studiare certificazioni IT/cybersecurity
e networking. Feedback immediato ad ogni risposta, spiegazione degli errori, statistiche
per studiare in modo mirato. Deve girare bene sia su PC sia su Android.

## 1. Architettura

- **PWA (Progressive Web App)**: HTML + CSS + JavaScript puro, nessun framework pesante.
- PC: si apre in qualsiasi browser da un URL.
- Android: installabile dalla pagina (icona in home, schermo pieno), funziona offline
  tramite service worker.
- Un solo codice = stessa qualità su PC e Android.
- Statistiche salvate localmente sul dispositivo (IndexedDB).
- Backup/ripristino statistiche via export/import file JSON (un tap), per non perdere i
  dati se si svuota il browser.

Motivazione della scelta: per un quiz (testo, bottoni, feedback, statistiche locali) la PWA
è funzionalmente equivalente a un'app nativa, senza i costi di toolchain/build e con
iterazione rapida sull'espansione della banca domande (che è la parte più grossa del
progetto). Flutter è stato valutato e scartato: unico vantaggio la sensazione "app
installata", nessun vantaggio funzionale reale, molto più lavoro.

## 2. Formato dati — schema domanda (JSON)

Ogni domanda è un oggetto JSON:

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
  "why_wrong": {"1": "Perché B è sbagliata", "2": "Perché C è sbagliata"},
  "source": "HACK/Fortinet Network Security.rtf"
}
```

Campi:
- `id`: identificatore univoco stabile.
- `cert`: array di certificazioni in cui la domanda compare → navigazione **per certificazione**.
- `topics`: array di argomenti trasversali (stesso topic può stare in più certificazioni,
  es. un concetto presente sia in Palo Alto sia in Fortinet) → navigazione **per argomento**.
- `type`: `single` (una giusta), `multi` (scegli 2/3), `truefalse` (caso particolare a 2 opzioni).
- `difficulty`: 1-3.
- `question`: testo.
- `options`: array di opzioni (2-6).
- `correct`: array di indici delle opzioni giuste (array anche quando è una sola) → una
  sola logica di correzione per tutti i tipi.
- `explanation`: perché la/le giusta/e sono giuste (mostrata sempre disponibile).
- `why_wrong`: mappa opzionale indice→motivo, per spiegare in modo mirato l'opzione
  sbagliata scelta dall'utente.
- `source`: provenienza (documento HACK o topic ufficiale d'esame).

Tutte le domande entrano automaticamente nel **MIX**.

## 3. Motore & modalità

Quattro modalità, in ordine di priorità:

1. **Allenamento (stile-patente)**: si sceglie l'ambito (argomento / certificazione / mix),
   le domande scorrono una dopo l'altra, feedback immediato appena si segna la risposta
   (verde/rosso). Se sbagliata: evidenzia la giusta, mostra `explanation` e il `why_wrong`
   dell'opzione scelta. È la base richiesta, sempre presente.
2. **Simulazione esame**: numero fisso di domande (configurabile, es. 40), a tempo,
   feedback e punteggio solo alla fine, come esame vero.
3. **Ripasso errori**: ripropone solo le domande sbagliate/non ancora padroneggiate,
   finché non vengono dominate. Studio mirato sui punti deboli.
4. **Sfida giornaliera**: un set di domande al giorno, alimenta le statistiche giornaliere
   e lo streak di giorni consecutivi.

Logica di correzione unica: la risposta è giusta se l'insieme delle opzioni selezionate
coincide esattamente con `correct`.

Stato di "padronanza" di una domanda: derivato dallo storico dei tentativi (es. giusta N
volte di fila → padroneggiata; usato dal Ripasso errori e dalla selezione domande).

## 4. Statistiche

Salvate in IndexedDB:

- **Per giorno**: risposte date, giuste, sbagliate, streak di giorni consecutivi
  (vista calendario).
- **Globale**: percentuale di accuratezza, totale giuste/sbagliate.
- **Per certificazione** e **per argomento**: accuratezza, per far emergere i punti deboli.
- Le aree deboli si collegano direttamente al Ripasso errori.
- Grafici semplici (barre / linea di progresso) disegnati senza librerie esterne pesanti.

Modello dati statistiche:
- Storico per-domanda: tentativi, esiti, ultima volta vista, flag padroneggiata.
- Aggregato per-giorno: data → {risposte, giuste, sbagliate}.
- Aggregati per-cert e per-argomento derivabili dallo storico per-domanda.

## 5. Costruzione contenuto (a ondate)

Definito lo schema, la banca domande si riempie in quest'ordine:

- **Ondata 1** — materiale della cartella HACK (Google, IBM, Microsoft, Fortinet, Palo Alto,
  CCNA, analisi forense, blockchain), trasformato in domande.
- **Ondata 2** — certificazioni fascia 1-2 (evidenza reale negli annunci): CCNA, Fortinet
  NSE4, MD-102, ITIL 4 Foundation, CompTIA Security+, SC-900, AZ-900.
- **Ondata 3** — tutte le 20 certificazioni complete (dai due file
  `Certificazioni_Link.txt` e `TOP20_Certificazioni_Reali.txt`), con aggiunta di altra
  Microsoft, Fortinet, CEH e CompTIA.

Le domande sono generate dal materiale (topic ufficiali d'esame + documenti HACK +
conoscenza), non copiate da banche protette. Ogni ondata aggiunge file JSON in
`data/questions/` registrati in `data/manifest.json`; il motore non va toccato.

## 6. Struttura progetto & consegna

```
QUIZCERT/
  index.html            motore + interfaccia + statistiche
  app.js
  style.css
  manifest.webmanifest  metadati PWA (nome, icone, display)
  service-worker.js     cache offline
  icons/                icone app
  data/
    manifest.json       elenco dei file domande da caricare
    questions/
      *.json            banca domande (aggiunta a ondate)
  docs/superpowers/specs/
    2026-08-21-quizcert-design.md
```

Consegna:
- **Hosting**: GitHub Pages (gratuito). Si pubblica il repo, si apre il link sul telefono e
  si sceglie "Installa"; poi funziona offline. Su PC si apre lo stesso link. L'utente ha già
  un account GitHub.
- Il contenuto (domande generate) può stare in repo pubblico senza problemi: nessun segreto.

Posizione progetto: `Desktop/PROGETTI/QUIZCERT`.

## Decisioni prese

- Piattaforma: PWA (no Flutter, no nativo).
- Formato risposte: singola + multipla; vero/falso come caso particolare.
- Navigazione pool: per argomento, per certificazione, mix.
- Modalità: Allenamento, Simulazione esame, Ripasso errori, Sfida giornaliera (in
  quest'ordine di priorità).
- Statistiche: per giorno + streak, globale, per cert, per argomento.
- Ordine contenuto: HACK → fascia 1-2 → tutte le 20.
- Hosting: GitHub Pages.

## Fuori scope (per ora)

- Sincronizzazione cloud delle statistiche tra dispositivi (solo export/import manuale).
- Account utente / login.
- Immagini/diagrammi nelle domande (si parte da testo; valutabile più avanti).
- Pubblicazione su app store.
