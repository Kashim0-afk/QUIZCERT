# QuizCert App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the QuizCert PWA — a patente-style multiple-choice quiz app for IT/cybersecurity certifications that runs on PC and Android, with instant feedback, wrong-answer explanations, and study statistics.

**Architecture:** Vanilla ESM JavaScript. Pure-logic modules (grading, selection, stats) with zero dependencies, unit-tested via `node --test`. A thin UI layer wires them to the DOM. Questions load from JSON files listed in a manifest. PWA (manifest + service worker) makes it installable and offline on Android. Deployed via GitHub Pages.

**Tech Stack:** HTML5, CSS3, ES modules (browser + Node), IndexedDB (browser storage), `node:test`/`node:assert` (unit tests), GitHub Pages (hosting).

## Global Constraints

- No heavy frameworks or runtime libraries — vanilla JS/CSS/HTML only.
- No external runtime dependencies; charts drawn by hand (canvas/SVG/CSS).
- All source uses ES modules (`export`/`import`) so the same files run in browser and Node.
- Unit tests use only Node built-ins (`node:test`, `node:assert`), no npm install required.
- Language of all user-facing text: Italian.
- Question data conforms exactly to the schema in the design spec (`docs/superpowers/specs/2026-08-21-quizcert-design.md`, section 2).
- One correction logic for all types: an answer is correct iff the set of selected option indices equals the `correct` set.
- App must work offline after first load and be installable on Android.

---

## File Structure

```
QUIZCERT/
  index.html               app shell, loads src/main.js as module
  style.css                all styling
  package.json             defines `npm test` -> `node --test` (no deps)
  src/
    schema.js              question validation (pure)
    engine.js              grading logic (pure)
    select.js              question filtering/mastery/pick (pure)
    stats.js               stats state + aggregation (pure)
    storage.js             persistence (memory + IndexedDB) + export/import
    data-loader.js         fetch manifest + question files, validate, merge
    ui.js                  DOM rendering + mode controllers
    main.js                bootstrap: load data, init storage, start UI
  data/
    manifest.json          { "files": ["questions/sample.json"] }
    questions/
      sample.json          small verified sample set (engine dev + demo)
  icons/
    icon-192.png icon-512.png
  manifest.webmanifest     PWA metadata
  service-worker.js        offline cache
  test/
    schema.test.js
    engine.test.js
    select.test.js
    stats.test.js
    storage.test.js
    data-loader.test.js
  README.md                run + deploy instructions
  docs/superpowers/...     spec + this plan
```

Responsibilities are split by concern: each `src/*.js` module has one job and a small surface. Pure modules (`schema`, `engine`, `select`, `stats`) never touch the DOM or storage, so they are fully unit-testable in Node. `storage` and `data-loader` isolate the two impure boundaries (persistence, network) behind injectable functions. `ui`/`main` are the only DOM-aware files.

---

### Task 1: Project scaffold + question schema validator

**Files:**
- Create: `package.json`
- Create: `src/schema.js`
- Test: `test/schema.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `QUESTION_TYPES: string[]`; `validateQuestion(q) -> string[]` (empty array = valid, otherwise list of error codes).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "quizcert",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing test** (`test/schema.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestion } from '../src/schema.js';

const valid = {
  id: 'sc900-001', cert: ['SC-900'], topics: ['Identity'],
  type: 'single', difficulty: 1,
  question: 'Cos\'e Entra ID?', options: ['A', 'B', 'C', 'D'],
  correct: [0], explanation: 'A e la risposta.', why_wrong: { '1': 'B no' },
  source: 'HACK/x.rtf'
};

test('valid question returns no errors', () => {
  assert.deepEqual(validateQuestion(valid), []);
});

test('missing id is flagged', () => {
  assert.ok(validateQuestion({ ...valid, id: '' }).includes('id'));
});

test('single must have exactly one correct', () => {
  assert.ok(validateQuestion({ ...valid, correct: [0, 1] }).includes('single-one'));
});

test('correct index out of range flagged', () => {
  assert.ok(validateQuestion({ ...valid, correct: [9] }).includes('correct-range'));
});

test('truefalse must be 2 options / 1 correct', () => {
  const tf = { ...valid, type: 'truefalse', options: ['Vero', 'Falso'], correct: [0] };
  assert.deepEqual(validateQuestion(tf), []);
  assert.ok(validateQuestion({ ...tf, options: ['a', 'b', 'c'] }).includes('truefalse-shape'));
});

test('multi allows several correct', () => {
  const m = { ...valid, type: 'multi', correct: [0, 2] };
  assert.deepEqual(validateQuestion(m), []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/schema.test.js`
Expected: FAIL (cannot find module `../src/schema.js`).

- [ ] **Step 4: Write minimal implementation** (`src/schema.js`)

```js
export const QUESTION_TYPES = ['single', 'multi', 'truefalse'];

export function validateQuestion(q) {
  const e = [];
  if (!q || typeof q !== 'object') return ['not-object'];
  if (typeof q.id !== 'string' || !q.id) e.push('id');
  if (!Array.isArray(q.cert) || q.cert.length === 0) e.push('cert');
  if (!Array.isArray(q.topics)) e.push('topics');
  if (!QUESTION_TYPES.includes(q.type)) e.push('type');
  const optsLen = Array.isArray(q.options) ? q.options.length : 0;
  if (optsLen < 2) e.push('options');
  if (!Array.isArray(q.correct) || q.correct.length === 0) e.push('correct');
  else if (q.correct.some(i => !Number.isInteger(i) || i < 0 || i >= optsLen)) e.push('correct-range');
  if (q.type === 'single' && Array.isArray(q.correct) && q.correct.length !== 1) e.push('single-one');
  if (q.type === 'truefalse' && (optsLen !== 2 || (Array.isArray(q.correct) && q.correct.length !== 1))) e.push('truefalse-shape');
  if (typeof q.explanation !== 'string') e.push('explanation');
  return e;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/schema.test.js`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add package.json src/schema.js test/schema.test.js
git commit -m "feat: question schema validator + node test scaffold"
```

---

### Task 2: Grading engine

**Files:**
- Create: `src/engine.js`
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: a question object (schema from Task 1).
- Produces: `grade(question, selected: number[]) -> { isCorrect: boolean, correct: number[], chosen: number[], explanation: string, wrongReasons: {index:number, reason:string|null}[] }`.

- [ ] **Step 1: Write the failing test** (`test/engine.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade } from '../src/engine.js';

const single = { type: 'single', options: ['A','B','C','D'], correct: [1],
  explanation: 'B giusta', why_wrong: { '0': 'A no', '2': 'C no' } };

test('single correct', () => {
  const r = grade(single, [1]);
  assert.equal(r.isCorrect, true);
  assert.deepEqual(r.correct, [1]);
});

test('single wrong returns reason for chosen option', () => {
  const r = grade(single, [0]);
  assert.equal(r.isCorrect, false);
  assert.deepEqual(r.wrongReasons, [{ index: 0, reason: 'A no' }]);
  assert.equal(r.explanation, 'B giusta');
});

test('multi correct only when set matches exactly', () => {
  const multi = { type: 'multi', options: ['A','B','C','D'], correct: [0,2], explanation: '' };
  assert.equal(grade(multi, [2,0]).isCorrect, true);      // order independent
  assert.equal(grade(multi, [0]).isCorrect, false);       // incomplete
  assert.equal(grade(multi, [0,1,2]).isCorrect, false);   // extra
});

test('duplicate selections are ignored', () => {
  assert.equal(grade(single, [1,1]).isCorrect, true);
});

test('missing why_wrong yields null reason', () => {
  const q = { type: 'single', options: ['A','B'], correct: [0], explanation: 'x' };
  assert.deepEqual(grade(q, [1]).wrongReasons, [{ index: 1, reason: null }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation** (`src/engine.js`)

```js
export function grade(question, selected) {
  const correct = [...question.correct].sort((a, b) => a - b);
  const chosen = [...new Set(selected)].sort((a, b) => a - b);
  const isCorrect =
    correct.length === chosen.length && correct.every((v, i) => v === chosen[i]);
  const wrongReasons = chosen
    .filter(i => !correct.includes(i))
    .map(i => ({ index: i, reason: question.why_wrong?.[String(i)] ?? null }));
  return { isCorrect, correct, chosen, explanation: question.explanation ?? '', wrongReasons };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine.js test/engine.test.js
git commit -m "feat: grading engine for single/multi/truefalse"
```

---

### Task 3: Question selection, filtering, mastery

**Files:**
- Create: `src/select.js`
- Test: `test/select.test.js`

**Interfaces:**
- Consumes: array of questions; a `history` map `{ [id]: { seen, correct, wrong, correctStreak, lastSeen } }` (produced by Task 4).
- Produces:
  - `isMastered(history, id, streakNeeded=2) -> boolean`
  - `filterQuestions(questions, { cert?, topic?, mode?, history }) -> question[]` (`mode: 'review'` keeps only answered-wrong, not-mastered)
  - `pickSet(pool, n, rng=Math.random) -> question[]` (shuffled subset, size min(n, pool.length))
  - `listCerts(questions) -> string[]`, `listTopics(questions) -> string[]` (sorted unique)

- [ ] **Step 1: Write the failing test** (`test/select.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMastered, filterQuestions, pickSet, listCerts, listTopics } from '../src/select.js';

const qs = [
  { id: 'a', cert: ['CCNA'], topics: ['NAT'] },
  { id: 'b', cert: ['NSE4'], topics: ['NAT', 'Firewall'] },
  { id: 'c', cert: ['CCNA'], topics: ['OSPF'] },
];

test('filter by cert', () => {
  assert.deepEqual(filterQuestions(qs, { cert: 'CCNA', history: {} }).map(q => q.id), ['a', 'c']);
});

test('filter by topic across certs', () => {
  assert.deepEqual(filterQuestions(qs, { topic: 'NAT', history: {} }).map(q => q.id), ['a', 'b']);
});

test('mix returns all', () => {
  assert.equal(filterQuestions(qs, { history: {} }).length, 3);
});

test('mastery from streak', () => {
  const h = { a: { correctStreak: 2 } };
  assert.equal(isMastered(h, 'a'), true);
  assert.equal(isMastered(h, 'b'), false);
});

test('review keeps answered-wrong not-mastered', () => {
  const history = {
    a: { wrong: 1, correctStreak: 0 },
    b: { wrong: 0, correctStreak: 0 },
    c: { wrong: 3, correctStreak: 2 }, // mastered -> excluded
  };
  assert.deepEqual(filterQuestions(qs, { mode: 'review', history }).map(q => q.id), ['a']);
});

test('pickSet is deterministic with fixed rng and bounded by pool size', () => {
  const rng = () => 0; // stable
  assert.equal(pickSet(qs, 2, rng).length, 2);
  assert.equal(pickSet(qs, 99, rng).length, 3);
});

test('listCerts/listTopics unique sorted', () => {
  assert.deepEqual(listCerts(qs), ['CCNA', 'NSE4']);
  assert.deepEqual(listTopics(qs), ['Firewall', 'NAT', 'OSPF']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/select.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation** (`src/select.js`)

```js
export function isMastered(history, id, streakNeeded = 2) {
  const h = history[id];
  return !!h && (h.correctStreak ?? 0) >= streakNeeded;
}

export function filterQuestions(questions, { cert, topic, mode, history = {} } = {}) {
  let pool = questions;
  if (cert) pool = pool.filter(q => q.cert.includes(cert));
  if (topic) pool = pool.filter(q => q.topics.includes(topic));
  if (mode === 'review') {
    pool = pool.filter(q => {
      const h = history[q.id];
      return h && (h.wrong ?? 0) > 0 && !isMastered(history, q.id);
    });
  }
  return pool;
}

export function pickSet(pool, n, rng = Math.random) {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}

export function listCerts(questions) {
  return [...new Set(questions.flatMap(q => q.cert))].sort();
}

export function listTopics(questions) {
  return [...new Set(questions.flatMap(q => q.topics))].sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/select.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/select.js test/select.test.js
git commit -m "feat: question filtering, mastery, and set selection"
```

---

### Task 4: Statistics module

**Files:**
- Create: `src/stats.js`
- Test: `test/stats.test.js`

**Interfaces:**
- Consumes: nothing (operates on its own state object).
- Produces:
  - `emptyStats() -> { history:{}, days:{}, version:1 }`
  - `recordAttempt(stats, { id, isCorrect, date }) -> stats` (mutates + returns; `date` is `YYYY-MM-DD`)
  - `streak(days, today) -> number` (consecutive days up to `today` with `answered>0`)
  - `globalAccuracy(stats) -> { answered, correct, wrong, pct }`
  - `byField(questions, history, field) -> { [value]: { answered, correct, pct } }` (`field` is `'cert'` or `'topics'`)

- [ ] **Step 1: Write the failing test** (`test/stats.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStats, recordAttempt, streak, globalAccuracy, byField } from '../src/stats.js';

test('recordAttempt updates history and days', () => {
  const s = emptyStats();
  recordAttempt(s, { id: 'a', isCorrect: true, date: '2026-08-21' });
  recordAttempt(s, { id: 'a', isCorrect: false, date: '2026-08-21' });
  assert.equal(s.history.a.seen, 2);
  assert.equal(s.history.a.correct, 1);
  assert.equal(s.history.a.wrong, 1);
  assert.equal(s.history.a.correctStreak, 0); // reset by the wrong answer
  assert.deepEqual(s.days['2026-08-21'], { answered: 2, correct: 1, wrong: 1 });
});

test('correctStreak grows on consecutive correct', () => {
  const s = emptyStats();
  recordAttempt(s, { id: 'a', isCorrect: true, date: '2026-08-21' });
  recordAttempt(s, { id: 'a', isCorrect: true, date: '2026-08-21' });
  assert.equal(s.history.a.correctStreak, 2);
});

test('streak counts consecutive active days ending today', () => {
  const days = { '2026-08-19': { answered: 1 }, '2026-08-20': { answered: 3 }, '2026-08-21': { answered: 2 } };
  assert.equal(streak(days, '2026-08-21'), 3);
  const gap = { '2026-08-18': { answered: 1 }, '2026-08-21': { answered: 2 } };
  assert.equal(streak(gap, '2026-08-21'), 1);
});

test('globalAccuracy aggregates history', () => {
  const s = emptyStats();
  recordAttempt(s, { id: 'a', isCorrect: true, date: '2026-08-21' });
  recordAttempt(s, { id: 'b', isCorrect: false, date: '2026-08-21' });
  assert.deepEqual(globalAccuracy(s), { answered: 2, correct: 1, wrong: 1, pct: 50 });
});

test('byField groups accuracy by cert', () => {
  const questions = [{ id: 'a', cert: ['CCNA'], topics: ['NAT'] }, { id: 'b', cert: ['NSE4'], topics: ['NAT'] }];
  const s = emptyStats();
  recordAttempt(s, { id: 'a', isCorrect: true, date: '2026-08-21' });
  recordAttempt(s, { id: 'b', isCorrect: false, date: '2026-08-21' });
  const byCert = byField(questions, s.history, 'cert');
  assert.equal(byCert.CCNA.pct, 100);
  assert.equal(byCert.NSE4.pct, 0);
  const byTopic = byField(questions, s.history, 'topics');
  assert.equal(byTopic.NAT.answered, 2);
  assert.equal(byTopic.NAT.pct, 50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/stats.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation** (`src/stats.js`)

```js
export function emptyStats() {
  return { history: {}, days: {}, version: 1 };
}

export function recordAttempt(stats, { id, isCorrect, date }) {
  const h = (stats.history[id] ??= { seen: 0, correct: 0, wrong: 0, correctStreak: 0, lastSeen: null });
  h.seen++;
  h.lastSeen = date;
  if (isCorrect) { h.correct++; h.correctStreak++; } else { h.wrong++; h.correctStreak = 0; }
  const d = (stats.days[date] ??= { answered: 0, correct: 0, wrong: 0 });
  d.answered++;
  if (isCorrect) d.correct++; else d.wrong++;
  return stats;
}

function prevDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function streak(days, today) {
  let count = 0;
  let cur = today;
  while (days[cur] && (days[cur].answered ?? 0) > 0) {
    count++;
    cur = prevDay(cur);
  }
  return count;
}

const pct = (correct, answered) => (answered ? Math.round((correct / answered) * 100) : 0);

export function globalAccuracy(stats) {
  let correct = 0, wrong = 0;
  for (const h of Object.values(stats.history)) { correct += h.correct; wrong += h.wrong; }
  const answered = correct + wrong;
  return { answered, correct, wrong, pct: pct(correct, answered) };
}

export function byField(questions, history, field) {
  const out = {};
  for (const q of questions) {
    const h = history[q.id];
    if (!h) continue;
    const values = field === 'cert' ? q.cert : q.topics;
    for (const v of values) {
      const acc = (out[v] ??= { answered: 0, correct: 0, pct: 0 });
      acc.answered += h.correct + h.wrong;
      acc.correct += h.correct;
    }
  }
  for (const acc of Object.values(out)) acc.pct = pct(acc.correct, acc.answered);
  return out;
}
```

Note: `new Date(Date.UTC(...))` with explicit arguments is deterministic and allowed (only argless `Date.now()`/`new Date()` are non-deterministic; those are never used here).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/stats.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stats.js test/stats.test.js
git commit -m "feat: statistics — per-day, streak, global, by cert/topic"
```

---

### Task 5: Storage (persistence + export/import)

**Files:**
- Create: `src/storage.js`
- Test: `test/storage.test.js`

**Interfaces:**
- Consumes: a stats object (Task 4).
- Produces:
  - `createMemoryStore(initial?) -> { load(): stats, save(stats): void }` (sync, for tests/fallback)
  - `exportStats(stats) -> string` (JSON)
  - `importStats(json) -> stats` (throws `Error` on invalid/incompatible version)
  - `createIndexedDbStore(dbName='quizcert') -> Promise<{ load(): Promise<stats>, save(stats): Promise<void> }>` (browser only; not unit-tested)

- [ ] **Step 1: Write the failing test** (`test/storage.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore, exportStats, importStats } from '../src/storage.js';
import { emptyStats, recordAttempt } from '../src/stats.js';

test('memory store round-trips', () => {
  const store = createMemoryStore();
  const s = recordAttempt(emptyStats(), { id: 'a', isCorrect: true, date: '2026-08-21' });
  store.save(s);
  assert.deepEqual(store.load(), s);
});

test('export then import yields equal stats', () => {
  const s = recordAttempt(emptyStats(), { id: 'a', isCorrect: false, date: '2026-08-21' });
  assert.deepEqual(importStats(exportStats(s)), s);
});

test('import rejects malformed json', () => {
  assert.throws(() => importStats('{ not json'));
});

test('import rejects wrong version', () => {
  assert.throws(() => importStats(JSON.stringify({ history: {}, days: {}, version: 999 })));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/storage.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation** (`src/storage.js`)

```js
const SCHEMA_VERSION = 1;

export function createMemoryStore(initial = null) {
  let data = initial;
  return {
    load: () => data,
    save: (stats) => { data = structuredClone(stats); },
  };
}

export function exportStats(stats) {
  return JSON.stringify(stats);
}

export function importStats(json) {
  let obj;
  try { obj = JSON.parse(json); } catch { throw new Error('JSON non valido'); }
  if (!obj || typeof obj !== 'object' || obj.version !== SCHEMA_VERSION) {
    throw new Error('Formato statistiche incompatibile');
  }
  if (typeof obj.history !== 'object' || typeof obj.days !== 'object') {
    throw new Error('Struttura statistiche non valida');
  }
  return obj;
}

// Browser-only. Kept dependency-free; not unit-tested (no IndexedDB in Node).
export async function createIndexedDbStore(dbName = 'quizcert') {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = (mode) => db.transaction('kv', mode).objectStore('kv');
  return {
    load: () => new Promise((resolve, reject) => {
      const r = tx('readonly').get('stats');
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    }),
    save: (stats) => new Promise((resolve, reject) => {
      const r = tx('readwrite').put(structuredClone(stats), 'stats');
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js test/storage.test.js
git commit -m "feat: storage — memory + IndexedDB stores, export/import"
```

---

### Task 6: Data loader + sample data

**Files:**
- Create: `src/data-loader.js`
- Create: `data/manifest.json`
- Create: `data/questions/sample.json`
- Test: `test/data-loader.test.js`

**Interfaces:**
- Consumes: `validateQuestion` (Task 1).
- Produces: `loadQuestions(manifestUrl, fetchFn=fetch) -> Promise<{ questions: question[], skipped: number }>` — fetches manifest, then each listed file (resolved relative to the manifest URL), keeps only schema-valid questions, counts skipped.

- [ ] **Step 1: Write the failing test** (`test/data-loader.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQuestions } from '../src/data-loader.js';

const good = {
  id: 'x1', cert: ['CCNA'], topics: ['NAT'], type: 'single', difficulty: 1,
  question: 'q', options: ['a', 'b'], correct: [0], explanation: 'e'
};
const bad = { id: '', cert: [], topics: [], type: 'single', options: ['a'], correct: [0], explanation: 'e' };

function fakeFetch(map) {
  return async (url) => ({ json: async () => map[url] });
}

test('loads valid questions and skips invalid ones', async () => {
  const fetchFn = fakeFetch({
    'data/manifest.json': { files: ['questions/a.json'] },
    'data/questions/a.json': [good, bad],
  });
  const res = await loadQuestions('data/manifest.json', fetchFn);
  assert.equal(res.questions.length, 1);
  assert.equal(res.questions[0].id, 'x1');
  assert.equal(res.skipped, 1);
});

test('merges multiple files', async () => {
  const fetchFn = fakeFetch({
    'data/manifest.json': { files: ['questions/a.json', 'questions/b.json'] },
    'data/questions/a.json': [good],
    'data/questions/b.json': [{ ...good, id: 'x2' }],
  });
  const res = await loadQuestions('data/manifest.json', fetchFn);
  assert.deepEqual(res.questions.map(q => q.id), ['x1', 'x2']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/data-loader.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation** (`src/data-loader.js`)

```js
import { validateQuestion } from './schema.js';

function resolveRelative(baseUrl, file) {
  const idx = baseUrl.lastIndexOf('/');
  const base = idx >= 0 ? baseUrl.slice(0, idx + 1) : '';
  return base + file;
}

export async function loadQuestions(manifestUrl, fetchFn = fetch) {
  const manifest = await (await fetchFn(manifestUrl)).json();
  const questions = [];
  let skipped = 0;
  for (const file of manifest.files ?? []) {
    const url = resolveRelative(manifestUrl, file);
    const list = await (await fetchFn(url)).json();
    for (const q of list) {
      if (validateQuestion(q).length === 0) questions.push(q);
      else skipped++;
    }
  }
  return { questions, skipped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/data-loader.test.js`
Expected: PASS.

- [ ] **Step 5: Create `data/manifest.json`**

```json
{ "files": ["questions/sample.json"] }
```

- [ ] **Step 6: Create `data/questions/sample.json`** (small verified set covering all three types; used for engine dev and the runnable demo)

```json
[
  {
    "id": "sc900-identity-001",
    "cert": ["SC-900"],
    "topics": ["Identity", "Zero Trust"],
    "type": "single",
    "difficulty": 1,
    "question": "In Microsoft Entra ID, quale componente fornisce l'autenticazione a piu fattori?",
    "options": ["Conditional Access", "MFA", "Defender for Endpoint", "Purview"],
    "correct": [1],
    "explanation": "MFA (Multi-Factor Authentication) richiede piu prove d'identita.",
    "why_wrong": { "0": "Conditional Access applica policy, non e il meccanismo MFA in se.", "2": "Defender for Endpoint protegge i dispositivi.", "3": "Purview riguarda governance e compliance dei dati." },
    "source": "Certificazioni_Link.txt / SC-900"
  },
  {
    "id": "nse4-nat-001",
    "cert": ["Fortinet NSE4"],
    "topics": ["NAT", "Firewall Policy"],
    "type": "multi",
    "difficulty": 2,
    "question": "Quali affermazioni sul NAT sorgente (SNAT) su FortiGate sono corrette? (scegli due)",
    "options": ["Modifica l'IP sorgente in uscita", "Modifica l'IP destinazione in ingresso", "Puo usare l'IP dell'interfaccia in uscita", "Disabilita il logging"],
    "correct": [0, 2],
    "explanation": "SNAT riscrive l'indirizzo sorgente e puo usare l'IP dell'interfaccia in uscita.",
    "why_wrong": { "1": "Quella e DNAT (destinazione).", "3": "Il NAT non disabilita il logging." },
    "source": "HACK/Fortinet Network Security.rtf"
  },
  {
    "id": "ccna-osi-001",
    "cert": ["CCNA"],
    "topics": ["Modello OSI"],
    "type": "truefalse",
    "difficulty": 1,
    "question": "Il livello 3 del modello OSI e il livello di rete (Network).",
    "options": ["Vero", "Falso"],
    "correct": [0],
    "explanation": "Il livello 3 OSI e il Network layer, responsabile dell'instradamento IP.",
    "why_wrong": { "1": "Falso: il livello 3 e proprio Network." },
    "source": "HACK/CCNA"
  }
]
```

- [ ] **Step 7: Commit**

```bash
git add src/data-loader.js test/data-loader.test.js data/manifest.json data/questions/sample.json
git commit -m "feat: data loader + verified sample question set"
```

---

### Task 7: App shell + Allenamento mode (first runnable UI)

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `src/ui.js`
- Create: `src/main.js`

**Interfaces:**
- Consumes: `loadQuestions` (Task 6), `grade` (Task 2), `filterQuestions`/`pickSet`/`listCerts`/`listTopics` (Task 3), `emptyStats`/`recordAttempt` (Task 4), `createIndexedDbStore`/`createMemoryStore`/`exportStats`/`importStats` (Task 5).
- Produces: `startApp(root, { questions, store, stats, today }) -> void` (renders home + Allenamento flow into the `root` element). `today` is injected as `YYYY-MM-DD` so rendering is testable/deterministic.

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>QuizCert</title>
  <link rel="stylesheet" href="style.css" />
  <link rel="manifest" href="manifest.webmanifest" />
  <meta name="theme-color" content="#0f172a" />
</head>
<body>
  <div id="app">Caricamento…</div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/main.js`** (bootstrap; wires real storage + today's date)

```js
import { loadQuestions } from './data-loader.js';
import { createIndexedDbStore } from './storage.js';
import { emptyStats } from './stats.js';
import { startApp } from './ui.js';

async function boot() {
  const root = document.getElementById('app');
  const { questions } = await loadQuestions('data/manifest.json');
  const store = await createIndexedDbStore();
  const stats = (await store.load()) ?? emptyStats();
  const today = new Date().toISOString().slice(0, 10);
  startApp(root, { questions, store, stats, today });
}
boot();
```

- [ ] **Step 3: Create `src/ui.js`** — home screen with mode buttons + scope selectors (cert/topic/mix), and the Allenamento flow: show one question, let the user select option(s), submit, then show green/red feedback with correct answer + `explanation` + per-option `why_wrong`, record the attempt via `recordAttempt`, persist via `store.save`, and advance. Multi-type questions use checkboxes; single/truefalse use radios. Render only via DOM APIs (no innerHTML with question text to avoid injection). Keep functions small: `renderHome`, `renderQuestion`, `renderFeedback`, `renderStats` (stub until Task 11).

Key behaviors to implement:
- Home lists: buttons for the 4 modes (Simulazione/Ripasso/Sfida disabled until their tasks land), a `<select>` for cert (from `listCerts`), a `<select>` for topic (from `listTopics`), and a "Mix" default.
- Allenamento: build the pool with `filterQuestions({cert, topic, history})`, order with `pickSet(pool, pool.length)`, iterate.
- On submit: `const res = grade(q, selected)`, color the chosen/correct options, show `res.explanation` always and each `res.wrongReasons[].reason` when present, then `recordAttempt(stats, { id: q.id, isCorrect: res.isCorrect, date: today })` and `await store.save(stats)`.
- A "Torna alla home" button and a running counter (giuste/sbagliate this session).

- [ ] **Step 4: Create `style.css`** — mobile-first responsive layout: full-width tap targets (min-height 44px), readable type, green (`#16a34a`) / red (`#dc2626`) feedback states, a `max-width: 720px` centered column on desktop, dark theme background `#0f172a` with light text. Use system font stack. Ensure buttons and selects are large enough for touch.

- [ ] **Step 5: Manual verification in browser**

Run a static server from the project root (needed because `fetch` of local files is blocked on `file://`):
`python -m http.server 8000` (or `npx serve`), then open `http://localhost:8000`.
Expected: home screen renders; choosing "Allenamento" + Mix shows the first sample question; selecting an answer and submitting shows correct/wrong feedback with explanation; the giuste/sbagliate counter updates; reloading the page preserves stats (IndexedDB).

- [ ] **Step 6: Commit**

```bash
git add index.html style.css src/ui.js src/main.js
git commit -m "feat: app shell + Allenamento mode (runnable end-to-end)"
```

---

### Task 8: Simulazione esame mode

**Files:**
- Modify: `src/ui.js`

**Interfaces:**
- Consumes: `pickSet`, `grade`, `recordAttempt`.
- Produces: within `ui.js`, a `runExam({ questions, count, scope })` flow reachable from home.

- [ ] **Step 1: Implement exam flow** — from home, an "Simulazione esame" button opens a small config (numero domande: 20/40/custom, ambito: cert/topic/mix, timer minuti). Build the set with `pickSet(filterQuestions(...), count)`. Present questions one at a time WITHOUT per-question feedback; store each `grade(...)` result in memory. Show a countdown timer; auto-submit when it hits zero. At the end show a results screen: punteggio (giuste/totali, %), pass/fail against a configurable soglia (default 70%), and a per-question review list (question, your answer, correct answer, explanation). Record every attempt via `recordAttempt` at submit time.

- [ ] **Step 2: Manual verification in browser**

Serve and open the app. Start a 5-question exam with a 1-minute timer.
Expected: no feedback shown mid-exam; timer counts down; results screen shows score, pass/fail, and a full review; stats reflect the answered questions after finishing.

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: Simulazione esame mode with timer and results review"
```

---

### Task 9: Ripasso errori mode

**Files:**
- Modify: `src/ui.js`

**Interfaces:**
- Consumes: `filterQuestions` with `mode:'review'`, `grade`, `recordAttempt`, `isMastered`.
- Produces: a "Ripasso errori" flow reachable from home.

- [ ] **Step 1: Implement review flow** — build the pool with `filterQuestions(questions, { mode: 'review', history: stats.history })` (optionally scoped by cert/topic). Run it like Allenamento (instant feedback). When a question reaches mastery (`isMastered`), it naturally drops out of future review pools. If the pool is empty, show "Nessun errore da ripassare — ottimo!" and a link home.

- [ ] **Step 2: Manual verification in browser**

Serve the app; in Allenamento deliberately answer a couple of questions wrong; return home; open "Ripasso errori".
Expected: only the wrong, not-yet-mastered questions appear; answering one correctly twice removes it from the review pool; an all-clear message shows when none remain.

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: Ripasso errori mode targeting weak questions"
```

---

### Task 10: Sfida giornaliera mode

**Files:**
- Modify: `src/ui.js`

**Interfaces:**
- Consumes: `pickSet`, `grade`, `recordAttempt`, `streak`.
- Produces: a "Sfida giornaliera" flow + a daily-completion marker stored in stats.

- [ ] **Step 1: Implement daily challenge** — a fixed-size set (default 15) for the day. Use a seeded shuffle so the same day yields the same set: derive a numeric seed from `today` (e.g. sum of char codes) and pass a small seeded PRNG to `pickSet` as its `rng`. Instant feedback like Allenamento. On completion, mark the day done (`stats.days[today].challengeDone = true`, persisted) and show the current `streak(stats.days, today)`. If already done today, show "Sfida di oggi completata" + streak, with an option to repeat for practice (not re-counted).

- [ ] **Step 2: Manual verification in browser**

Serve the app; complete the daily challenge.
Expected: same set on reload for the same day; completion shows the streak; reopening shows the "completata" state.

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: Sfida giornaliera with seeded daily set and streak"
```

---

### Task 11: Statistics view

**Files:**
- Modify: `src/ui.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `globalAccuracy`, `byField`, `streak` (Task 4); `exportStats`/`importStats` (Task 5).
- Produces: a "Statistiche" screen.

- [ ] **Step 1: Implement stats screen** — show: streak giorni + a simple calendar/heat row of the last ~30 days (CSS grid cells colored by `days[date].answered`); global accuracy (giuste/sbagliate/%); per-cert accuracy bars (from `byField(questions, stats.history, 'cert')`); per-topic accuracy bars (`'topics'`), sorted worst-first to surface weak areas; a "Ripassa i punti deboli" button that opens Ripasso errori. Bars drawn with plain CSS width %. Add "Esporta statistiche" (download `exportStats(stats)` as a `.json` file via a Blob + anchor) and "Importa statistiche" (file input → `importStats` → save → reload view), with a confirm before overwriting.

- [ ] **Step 2: Manual verification in browser**

Serve the app; answer several questions across different certs/topics; open "Statistiche".
Expected: streak, global %, and per-cert/per-topic bars reflect the answers; weak topics sort to the top; export downloads a JSON file; importing that file restores the same numbers.

- [ ] **Step 3: Commit**

```bash
git add src/ui.js style.css
git commit -m "feat: statistics screen with streak, accuracy bars, export/import"
```

---

### Task 12: PWA — installable + offline

**Files:**
- Create: `manifest.webmanifest`
- Create: `service-worker.js`
- Create: `icons/icon-192.png`, `icons/icon-512.png`
- Modify: `src/main.js` (register service worker)

**Interfaces:**
- Consumes: nothing new.
- Produces: registered service worker caching the app shell + data for offline use.

- [ ] **Step 1: Create `manifest.webmanifest`**

```json
{
  "name": "QuizCert",
  "short_name": "QuizCert",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create the two PNG icons** — a simple flat icon (dark background `#0f172a`, a light check/quiz glyph) at 192×192 and 512×512. Generate with any tool or a small canvas script; commit the PNG files.

- [ ] **Step 3: Create `service-worker.js`** — cache-first for the app shell and same-origin GET requests; bump `CACHE` name to invalidate on updates.

```js
const CACHE = 'quizcert-v1';
const SHELL = [
  '.', 'index.html', 'style.css',
  'src/main.js', 'src/ui.js', 'src/engine.js', 'src/select.js',
  'src/stats.js', 'src/storage.js', 'src/data-loader.js', 'src/schema.js',
  'data/manifest.json', 'data/questions/sample.json',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
```

Note: as new question files are added in later content waves, they must be appended to `SHELL` and the `CACHE` version bumped.

- [ ] **Step 4: Register the worker in `src/main.js`** (append at end of `boot`)

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}
```

- [ ] **Step 5: Manual verification (PWA)**

Serve over `http://localhost:8000`, open Chrome DevTools → Application: manifest is detected, service worker is activated. Toggle "Offline" and reload — app still loads and works. On an Android phone (once deployed, Task 13), the browser offers "Installa app".
Expected: installable, works offline, launches standalone.

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest service-worker.js icons/ src/main.js
git commit -m "feat: PWA — manifest, offline service worker, icons"
```

---

### Task 13: README + GitHub Pages deploy

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: run/test/deploy documentation; the repo published to GitHub Pages.

- [ ] **Step 1: Write `README.md`** — Italian, covering: cos'e QuizCert; come lanciarlo in locale (`python -m http.server 8000`, apri `http://localhost:8000`); come girare i test (`node --test`); come aggiungere domande (formato JSON, aggiornare `data/manifest.json` e la lista `SHELL` nel service worker + bump `CACHE`); come pubblicare su GitHub Pages; come installarlo su Android (apri il link Pages in Chrome → menu → "Installa app/Aggiungi a schermata Home"); backup statistiche via Esporta/Importa.

- [ ] **Step 2: Publish to GitHub Pages**

```bash
git remote add origin https://github.com/<user>/quizcert.git   # user creates the empty repo first
git branch -M main
git push -u origin main
```
Then in the GitHub repo: Settings → Pages → Source: "Deploy from a branch" → Branch `main` / root `/`. Wait for the published URL.

- [ ] **Step 3: Manual verification (production)**

Open the GitHub Pages URL on PC (app loads, all modes work) and on Android (Chrome offers "Installa"; after install it runs standalone and offline).
Expected: fully working installed PWA on both platforms.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with run, test, and GitHub Pages deploy steps"
```

---

## Post-plan: content waves (separate effort)

Filling the question bank (Ondata 1 HACK material → Ondata 2 fascia 1-2 certs → Ondata 3 all 20) is a distinct content-generation project, not part of this app plan. It runs after the app works, using parallel subagents (one per cert/topic) to draft question JSON, followed by mandatory human/Claude verification of every answer and explanation before the file is added to `data/questions/` and `data/manifest.json` (and the service-worker `SHELL`). Each wave gets its own short plan.

---

## Self-Review

**Spec coverage:**
- PWA architecture → Tasks 7, 12, 13. ✓
- Question JSON schema (cert/topics/type/correct/explanation/why_wrong) → Task 1 validator + Task 6 sample. ✓
- Single/multi/truefalse one-logic correction → Task 2. ✓
- Navigation by topic / cert / mix → Task 3 (`filterQuestions`, `listCerts`, `listTopics`) + Task 7 UI. ✓
- Mode 1 Allenamento (instant feedback + explanation + why_wrong) → Task 7. ✓
- Mode 2 Simulazione esame (fixed N, timer, score at end) → Task 8. ✓
- Mode 3 Ripasso errori (weak/not-mastered) → Task 9. ✓
- Mode 4 Sfida giornaliera + streak → Task 10. ✓
- Stats: per-day + streak, global, per-cert, per-topic → Task 4 + Task 11. ✓
- Export/import backup → Task 5 + Task 11. ✓
- IndexedDB persistence → Task 5 + Task 7 wiring. ✓
- Offline + installable → Task 12. ✓
- GitHub Pages delivery → Task 13. ✓
- Content order HACK→fascia1-2→20 → captured as separate post-plan effort. ✓

**Placeholder scan:** UI tasks (7–11) describe behavior in prose with concrete function calls and injected interfaces rather than full DOM code; each has explicit manual verification and exact consumed signatures. No "TBD"/"add error handling"/vague steps in the pure-logic tasks (1–6), which carry complete test + implementation code.

**Type consistency:** `grade` returns `{isCorrect, correct, chosen, explanation, wrongReasons}` (Task 2) and is consumed with those names in Tasks 7–10. `recordAttempt(stats, {id, isCorrect, date})` signature consistent across Tasks 4, 7–10. `filterQuestions(questions, {cert, topic, mode, history})` consistent across Tasks 3, 7, 9. `stats` shape `{history, days, version}` consistent across Tasks 4, 5, 11. Store interface `{load, save}` consistent across Tasks 5, 7.
