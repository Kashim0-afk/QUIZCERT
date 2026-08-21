import { grade } from './engine.js';
import { filterQuestions, pickSet, listCerts, listTopics } from './select.js';
import { recordAttempt, streak, globalAccuracy, byField } from './stats.js';
import { exportStats, importStats } from './storage.js';

// ---------- tiny DOM helper ----------
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

// ---------- date + rng helpers ----------
function dateBack(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}
function seedFromDate(d) {
  let s = 0;
  for (const ch of d) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return s;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PASS_THRESHOLD = 70;
const DAILY_SIZE = 15;

// ==================================================
export function startApp(root, ctx) {
  const app = {
    root,
    questions: ctx.questions,
    store: ctx.store,
    stats: ctx.stats,
    today: ctx.today,
    scope: { cert: '', topic: '' },
  };
  renderHome(app);
}

async function persist(app) {
  try { await app.store.save(app.stats); } catch { /* ignore persistence errors */ }
}

// ---------- HOME ----------
function renderHome(app) {
  // Cancel any exam timer still running from an abandoned simulation:
  // leaving the exam via "← Home" must stop the countdown, otherwise it keeps
  // ticking and eventually hijacks the screen + records phantom attempts.
  if (app.examTimer) { clearInterval(app.examTimer); app.examTimer = null; }
  const certs = listCerts(app.questions);
  const topics = listTopics(app.questions);

  const certSel = el('select', { 'aria-label': 'Certificazione' },
    el('option', { value: '' }, 'Tutte le certificazioni'),
    ...certs.map(c => el('option', { value: c, ...(app.scope.cert === c ? { selected: 'selected' } : {}) }, c)));
  const topicSel = el('select', { 'aria-label': 'Argomento' },
    el('option', { value: '' }, 'Tutti gli argomenti'),
    ...topics.map(t => el('option', { value: t, ...(app.scope.topic === t ? { selected: 'selected' } : {}) }, t)));

  certSel.addEventListener('change', () => { app.scope.cert = certSel.value; });
  topicSel.addEventListener('change', () => { app.scope.topic = topicSel.value; });

  const doneToday = app.stats.days[app.today]?.challengeDone;

  const screen = el('div', { class: 'screen' },
    el('h1', { class: 'title' }, 'QuizCert'),
    el('p', { class: 'subtitle' }, app.questions.length + ' domande disponibili · streak ' + streak(app.stats.days, app.today) + ' giorni'),

    el('div', { class: 'card' },
      el('h2', {}, 'Ambito di studio'),
      el('label', { class: 'field' }, 'Certificazione', certSel),
      el('label', { class: 'field' }, 'Argomento', topicSel),
      el('p', { class: 'hint' }, 'Lascia su "Tutte / Tutti" per la modalità MIX (tutto insieme).')),

    el('div', { class: 'modes' },
      modeBtn('Allenamento', 'Domande in fila, feedback immediato', () => startPractice(app, 'practice')),
      modeBtn('Simulazione esame', 'A tempo, punteggio finale', () => renderExamConfig(app)),
      modeBtn('Ripasso errori', 'Solo le domande sbagliate', () => startPractice(app, 'review')),
      modeBtn(doneToday ? 'Sfida giornaliera ✓' : 'Sfida giornaliera', doneToday ? 'Completata oggi' : 'Set del giorno', () => startDaily(app)),
      modeBtn('Studio', 'Leggi domande e risposte', () => renderStudy(app))),

    el('button', { class: 'link-btn', onClick: () => renderStats(app) }, 'Statistiche'),
  );
  app.root.replaceChildren(screen);
}

function modeBtn(title, desc, onClick) {
  return el('button', { class: 'mode-btn', onClick },
    el('span', { class: 'mode-title' }, title),
    el('span', { class: 'mode-desc' }, desc));
}

// ---------- PRACTICE / REVIEW / DAILY (instant feedback) ----------
function startPractice(app, mode) {
  const pool = filterQuestions(app.questions, {
    cert: app.scope.cert || undefined,
    topic: app.scope.topic || undefined,
    mode: mode === 'review' ? 'review' : undefined,
    history: app.stats.history,
  });
  if (pool.length === 0) {
    const msg = mode === 'review' ? 'Nessun errore da ripassare — ottimo!' : 'Nessuna domanda per questo ambito.';
    return renderMessage(app, msg);
  }
  const order = pickSet(pool, pool.length);
  runQuiz(app, {
    order, index: 0, correct: 0, wrong: 0,
    label: mode === 'review' ? 'Ripasso errori' : 'Allenamento',
    daily: false,
  });
}

function startDaily(app) {
  const pool = filterQuestions(app.questions, { history: app.stats.history });
  const rng = mulberry32(seedFromDate(app.today));
  const order = pickSet(pool, DAILY_SIZE, rng);
  runQuiz(app, {
    order, index: 0, correct: 0, wrong: 0,
    label: 'Sfida giornaliera', daily: true,
  });
}

function runQuiz(app, session) {
  if (session.index >= session.order.length) return finishQuiz(app, session);

  const q = session.order[session.index];
  const isMulti = q.type === 'multi';
  const selected = new Set();

  const optionEls = q.options.map((opt, i) => {
    const input = el('input', { type: isMulti ? 'checkbox' : 'radio', name: 'opt', value: String(i) });
    input.addEventListener('change', () => {
      if (isMulti) { input.checked ? selected.add(i) : selected.delete(i); }
      else { selected.clear(); selected.add(i); }
    });
    return el('label', { class: 'option' }, input, el('span', {}, opt));
  });

  const feedback = el('div', { class: 'feedback' });
  const submitBtn = el('button', { class: 'primary-btn' }, isMulti ? 'Conferma (scegli tutte le giuste)' : 'Conferma');
  const nextBtn = el('button', { class: 'primary-btn hidden' }, 'Prossima →');

  submitBtn.addEventListener('click', async () => {
    if (selected.size === 0) { feedback.textContent = 'Seleziona una risposta.'; return; }
    const res = grade(q, [...selected]);
    optionEls.forEach((lab, i) => {
      lab.querySelector('input').disabled = true;
      if (res.correct.includes(i)) lab.classList.add('correct');
      else if (res.chosen.includes(i)) lab.classList.add('wrong');
    });
    if (res.isCorrect) session.correct++; else session.wrong++;

    const nodes = [el('p', { class: res.isCorrect ? 'verdict ok' : 'verdict ko' }, res.isCorrect ? '✓ Corretta' : '✗ Sbagliata')];
    if (!res.isCorrect) {
      for (const w of res.wrongReasons) {
        if (w.reason) nodes.push(el('p', { class: 'why-wrong' }, 'Perché "' + q.options[w.index] + '" è sbagliata: ' + w.reason));
      }
    }
    nodes.push(el('p', { class: 'explain' }, res.explanation));
    feedback.replaceChildren(...nodes);
    submitBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');

    recordAttempt(app.stats, { id: q.id, isCorrect: res.isCorrect, date: app.today });
    await persist(app);
  });

  nextBtn.addEventListener('click', () => { session.index++; runQuiz(app, session); });

  const screen = el('div', { class: 'screen' },
    topBar(app, session.label, (session.index + 1) + '/' + session.order.length, '✓ ' + session.correct + '  ✗ ' + session.wrong),
    el('div', { class: 'card question-card' },
      el('div', { class: 'meta' }, q.cert.join(', ') + ' · ' + q.topics.join(', ')),
      el('p', { class: 'question' }, q.question),
      isMulti ? el('p', { class: 'hint' }, 'Risposta multipla: seleziona tutte le opzioni corrette.') : null,
      el('div', { class: 'options' }, ...optionEls),
      feedback, submitBtn, nextBtn),
  );
  app.root.replaceChildren(screen);
}

async function finishQuiz(app, session) {
  if (session.daily) {
    const d = (app.stats.days[app.today] ??= { answered: 0, correct: 0, wrong: 0 });
    d.challengeDone = true;
    await persist(app);
  }
  const total = session.correct + session.wrong;
  const pct = total ? Math.round((session.correct / total) * 100) : 0;
  renderMessage(app,
    session.label + ' completato: ' + session.correct + '/' + total + ' corrette (' + pct + '%).' +
    (session.daily ? ' Streak: ' + streak(app.stats.days, app.today) + ' giorni.' : ''));
}

// ---------- EXAM (no feedback until end) ----------
function renderExamConfig(app) {
  const countSel = el('select', {},
    el('option', { value: '10' }, '10 domande'),
    el('option', { value: '20', selected: 'selected' }, '20 domande'),
    el('option', { value: '40' }, '40 domande'));
  const timeSel = el('select', {},
    el('option', { value: '5' }, '5 minuti'),
    el('option', { value: '10' }, '10 minuti'),
    el('option', { value: '20', selected: 'selected' }, '20 minuti'),
    el('option', { value: '40' }, '40 minuti'));

  const start = el('button', { class: 'primary-btn' }, 'Inizia simulazione');
  start.addEventListener('click', () => {
    const pool = filterQuestions(app.questions, {
      cert: app.scope.cert || undefined, topic: app.scope.topic || undefined, history: app.stats.history,
    });
    if (pool.length === 0) return renderMessage(app, 'Nessuna domanda per questo ambito.');
    const order = pickSet(pool, Number(countSel.value));
    runExam(app, { order, index: 0, answers: [], seconds: Number(timeSel.value) * 60 });
  });

  app.root.replaceChildren(el('div', { class: 'screen' },
    topBar(app, 'Simulazione esame', '', ''),
    el('div', { class: 'card' },
      el('h2', {}, 'Configura la simulazione'),
      el('label', { class: 'field' }, 'Numero domande', countSel),
      el('label', { class: 'field' }, 'Tempo', timeSel),
      el('p', { class: 'hint' }, 'Ambito: ' + (app.scope.cert || 'tutte le cert') + ' · ' + (app.scope.topic || 'tutti gli argomenti') + '. Soglia superamento ' + PASS_THRESHOLD + '%.'),
      start)));
}

function runExam(app, session) {
  if (!session.timer) {
    session.remaining = session.seconds;
    session.timer = setInterval(() => {
      session.remaining--;
      const t = document.getElementById('examTimer');
      if (t) t.textContent = fmtTime(session.remaining);
      if (session.remaining <= 0) finishExam(app, session);
    }, 1000);
    app.examTimer = session.timer; // so navigation away can cancel it
  }
  if (session.index >= session.order.length) return finishExam(app, session);

  const q = session.order[session.index];
  const isMulti = q.type === 'multi';
  const selected = new Set();
  const optionEls = q.options.map((opt, i) => {
    const input = el('input', { type: isMulti ? 'checkbox' : 'radio', name: 'exopt', value: String(i) });
    input.addEventListener('change', () => {
      if (isMulti) { input.checked ? selected.add(i) : selected.delete(i); }
      else { selected.clear(); selected.add(i); }
    });
    return el('label', { class: 'option' }, input, el('span', {}, opt));
  });

  const nextLabel = session.index === session.order.length - 1 ? 'Termina' : 'Avanti →';
  const next = el('button', { class: 'primary-btn' }, nextLabel);
  next.addEventListener('click', () => {
    session.answers[session.index] = { q, selected: [...selected] };
    session.index++;
    runExam(app, session);
  });

  app.root.replaceChildren(el('div', { class: 'screen' },
    topBar(app, 'Simulazione esame', (session.index + 1) + '/' + session.order.length, el('span', { id: 'examTimer', class: 'timer' }, fmtTime(session.remaining))),
    el('div', { class: 'card question-card' },
      el('div', { class: 'meta' }, q.cert.join(', ') + ' · ' + q.topics.join(', ')),
      el('p', { class: 'question' }, q.question),
      isMulti ? el('p', { class: 'hint' }, 'Risposta multipla.') : null,
      el('div', { class: 'options' }, ...optionEls),
      next)));
}

async function finishExam(app, session) {
  if (session.finished) return; // idempotent: guard against timer/click race
  session.finished = true;
  if (session.timer) { clearInterval(session.timer); session.timer = null; }
  app.examTimer = null;
  let correct = 0;
  const review = [];
  for (let i = 0; i < session.order.length; i++) {
    const q = session.order[i];
    const ans = session.answers[i]?.selected ?? [];
    const res = grade(q, ans);
    if (res.isCorrect) correct++;
    recordAttempt(app.stats, { id: q.id, isCorrect: res.isCorrect, date: app.today });
    review.push({ q, res, ans });
  }
  await persist(app);

  const total = session.order.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const passed = pct >= PASS_THRESHOLD;

  const reviewList = review.map(({ q, res, ans }) => el('div', { class: 'review-item' },
    el('p', { class: 'question' }, q.question),
    el('p', { class: res.isCorrect ? 'verdict ok' : 'verdict ko' },
      res.isCorrect ? '✓ Corretta' : '✗ Sbagliata — la tua: ' + (ans.map(i => q.options[i]).join(', ') || '(nessuna)')),
    el('p', { class: 'explain' }, 'Giusta: ' + res.correct.map(i => q.options[i]).join(', ') + '. ' + res.explanation)));

  app.root.replaceChildren(el('div', { class: 'screen' },
    topBar(app, 'Risultato', '', ''),
    el('div', { class: 'card' },
      el('h2', { class: passed ? 'verdict ok' : 'verdict ko' }, (passed ? 'SUPERATO' : 'NON superato') + ' — ' + correct + '/' + total + ' (' + pct + '%)'),
      el('p', { class: 'hint' }, 'Soglia: ' + PASS_THRESHOLD + '%')),
    el('div', { class: 'card' }, el('h2', {}, 'Revisione'), ...reviewList)));
}

// ---------- STUDIO (lettura domande + risposte) ----------
function renderStudy(app) {
  const pool = filterQuestions(app.questions, {
    cert: app.scope.cert || undefined,
    topic: app.scope.topic || undefined,
    history: app.stats.history,
  });

  const ambito = (app.scope.cert || 'Tutte le certificazioni') + ' · ' + (app.scope.topic || 'tutti gli argomenti');

  const items = pool.map((q, n) => {
    const rispostaGiusta = q.correct.map(i => q.options[i]).join('  |  ');
    const parts = [
      el('p', { class: 'study-q' }, (n + 1) + '. ' + q.question),
      el('p', { class: 'study-opt ok' }, '✓ ' + rispostaGiusta),
      el('p', { class: 'study-exp' }, q.explanation),
    ];
    if (q.why_wrong) {
      for (const [idx, reason] of Object.entries(q.why_wrong)) {
        const oi = Number(idx);
        if (!q.correct.includes(oi) && reason) {
          parts.push(el('p', { class: 'study-wrong' }, '✗ "' + q.options[oi] + '": ' + reason));
        }
      }
    }
    parts.push(el('p', { class: 'study-meta' }, q.cert.join(', ') + ' · ' + q.topics.join(', ')));
    return el('div', { class: 'study-item' }, ...parts);
  });

  app.root.replaceChildren(el('div', { class: 'screen' },
    topBar(app, 'Studio', '', pool.length + ' domande'),
    el('div', { class: 'card' },
      el('h2', {}, 'Materiale di studio'),
      el('p', { class: 'hint' }, 'Ambito: ' + ambito + '. Cambia certificazione o argomento dalla home per filtrare.')),
    pool.length
      ? el('div', { class: 'card study-list' }, ...items)
      : el('div', { class: 'card' }, el('p', { class: 'hint' }, 'Nessuna domanda per questo ambito.'))));
}

// ---------- STATS ----------
function renderStats(app) {
  const g = globalAccuracy(app.stats);
  const byCert = byField(app.questions, app.stats.history, 'cert');
  const byTopic = byField(app.questions, app.stats.history, 'topics');

  const cal = [];
  for (let i = 29; i >= 0; i--) {
    const day = dateBack(app.today, i);
    const n = app.stats.days[day]?.answered ?? 0;
    const lvl = n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3;
    cal.push(el('div', { class: 'cal-cell lvl' + lvl, title: day + ': ' + n }));
  }

  const sortWorst = (obj) => Object.entries(obj).sort((a, b) => a[1].pct - b[1].pct || b[1].answered - a[1].answered);
  const bars = (obj) => sortWorst(obj).map(([name, v]) => el('div', { class: 'bar-row' },
    el('span', { class: 'bar-label' }, name + ' (' + v.correct + '/' + v.answered + ')'),
    el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: 'width:' + v.pct + '%' })),
    el('span', { class: 'bar-pct' }, v.pct + '%')));

  const exportBtn = el('button', { class: 'primary-btn' }, 'Esporta statistiche');
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([exportStats(app.stats)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'quizcert-stats.json' });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  const importInput = el('input', { type: 'file', accept: 'application/json', class: 'hidden' });
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importStats(text);
      if (!confirm('Sovrascrivere le statistiche attuali con quelle importate?')) return;
      app.stats = imported;
      await persist(app);
      renderStats(app);
    } catch (e) { alert('Import fallito: ' + e.message); }
  });
  const importBtn = el('button', { class: 'primary-btn' }, 'Importa statistiche');
  importBtn.addEventListener('click', () => importInput.click());

  const weakBtn = el('button', { class: 'link-btn', onClick: () => startPractice(app, 'review') }, 'Ripassa i punti deboli');

  const certCard = el('div', { class: 'card' }, el('h2', {}, 'Per certificazione'));
  if (Object.keys(byCert).length) bars(byCert).forEach(b => certCard.append(b));
  else certCard.append(el('p', { class: 'hint' }, 'Ancora nessun dato.'));

  const topicCard = el('div', { class: 'card' }, el('h2', {}, 'Per argomento (punti deboli in alto)'));
  if (Object.keys(byTopic).length) bars(byTopic).forEach(b => topicCard.append(b));
  else topicCard.append(el('p', { class: 'hint' }, 'Ancora nessun dato.'));
  topicCard.append(weakBtn);

  app.root.replaceChildren(el('div', { class: 'screen' },
    topBar(app, 'Statistiche', '', ''),
    el('div', { class: 'card' },
      el('h2', {}, 'Streak: ' + streak(app.stats.days, app.today) + ' giorni'),
      el('div', { class: 'calendar' }, ...cal),
      el('p', { class: 'hint' }, 'Ultimi 30 giorni (colore = quante risposte).')),
    el('div', { class: 'card' },
      el('h2', {}, 'Globale'),
      el('p', {}, g.correct + ' giuste · ' + g.wrong + ' sbagliate · ' + g.pct + '% accuratezza')),
    certCard,
    topicCard,
    el('div', { class: 'card' }, el('h2', {}, 'Backup'), el('div', { class: 'row' }, exportBtn, importBtn), importInput)));
}

// ---------- shared bits ----------
function topBar(app, title, center, right) {
  return el('div', { class: 'topbar' },
    el('button', { class: 'back-btn', onClick: () => renderHome(app) }, '← Home'),
    el('span', { class: 'topbar-title' }, title),
    el('span', { class: 'topbar-center' }, center || ''),
    el('span', { class: 'topbar-right' }, right || ''));
}

function renderMessage(app, msg) {
  app.root.replaceChildren(el('div', { class: 'screen' },
    topBar(app, 'QuizCert', '', ''),
    el('div', { class: 'card' }, el('p', { class: 'big-msg' }, msg),
      el('button', { class: 'primary-btn', onClick: () => renderHome(app) }, 'Torna alla home'))));
}

function fmtTime(s) {
  if (s == null) return '';
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}
