import { grade } from './engine.js';
import { filterQuestions, pickSet, listCerts, listTopics } from './select.js';
import { recordAttempt, streak, globalAccuracy, byField } from './stats.js';
import { exportStats, importStats, MAX_IMPORT_BYTES } from './storage.js';
import { getLang, toggleLang, t, qText, qOptions, qExplanation, qWhyWrong } from './i18n.js';
import { optionOrder, toOriginal, localDay, dateBack, seedFromDate, mulberry32, dailyCounts, markDailyDone,
  remainingSeconds, commitPendingAnswer, fmtTime, loadProblems } from './session.js';

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

const PASS_THRESHOLD = 70;
const DAILY_SIZE = 15;

// ==================================================
export function startApp(root, ctx) {
  const app = {
    root,
    questions: ctx.questions,
    store: ctx.store,
    stats: ctx.stats,
    problems: loadProblems(ctx),
    scope: { cert: '', topic: '' },
    screen: '',
    homeDay: '',
  };
  // An installed PWA can be resumed after midnight: refresh the home (streak, daily).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && app.screen === 'home' && app.homeDay !== localDay()) renderHome(app);
  });
  renderHome(app);
}

async function persist(app) {
  try { await app.store.save(app.stats); } catch { /* ignore persistence errors */ }
}

// ---------- HOME ----------
function renderHome(app) {
  // Cancel any exam timer still running from an abandoned simulation.
  if (app.examCleanup) { app.examCleanup(); app.examCleanup = null; }
  const certs = listCerts(app.questions);
  const topics = listTopics(app.questions);

  const certSel = el('select', { 'aria-label': t('certLabel') },
    el('option', { value: '' }, t('allCerts')),
    ...certs.map(c => el('option', { value: c, ...(app.scope.cert === c ? { selected: 'selected' } : {}) }, c)));
  const topicSel = el('select', { 'aria-label': t('topicLabel') },
    el('option', { value: '' }, t('allTopics')),
    ...topics.map(x => el('option', { value: x, ...(app.scope.topic === x ? { selected: 'selected' } : {}) }, x)));

  certSel.addEventListener('change', () => { app.scope.cert = certSel.value; });
  topicSel.addEventListener('change', () => { app.scope.topic = topicSel.value; });

  const today = localDay();
  app.homeDay = today;
  const doneToday = !dailyCounts(app.stats, today);

  const langBtn = el('button', { class: 'lang-btn', 'aria-label': 'Language', onClick: () => { toggleLang(); renderHome(app); } },
    getLang() === 'it' ? 'IT | en' : 'it | EN');

  const screen = el('div', { class: 'screen' },
    el('div', { class: 'home-top' },
      el('h1', { class: 'title' }, 'QuizCert'),
      langBtn),
    el('p', { class: 'subtitle' }, t('subtitle', app.questions.length, streak(app.stats.days, today))),
    app.problems ? el('div', { class: 'card warn-card', role: 'alert' },
      el('p', { class: 'warn-title' }, t('loadWarnTitle')),
      app.problems.files.length ? el('p', {}, t('loadWarnFiles', app.problems.files.length, app.problems.files.join(', '))) : null,
      app.problems.skipped ? el('p', {}, t('loadWarnSkipped', app.problems.skipped)) : null,
      el('p', { class: 'hint' }, t('loadWarnHint'))) : null,

    el('div', { class: 'card' },
      el('h2', {}, t('studyScope')),
      el('label', { class: 'field' }, t('certLabel'), certSel),
      el('label', { class: 'field' }, t('topicLabel'), topicSel),
      el('p', { class: 'hint' }, t('mixHint'))),

    el('div', { class: 'modes' },
      modeBtn(t('mTraining'), t('mTrainingD'), () => startPractice(app, 'practice')),
      modeBtn(t('mExam'), t('mExamD'), () => renderExamConfig(app)),
      modeBtn(t('mReview'), t('mReviewD'), () => startPractice(app, 'review')),
      modeBtn(doneToday ? t('mDailyDone') : t('mDaily'), doneToday ? t('mDailyDoneD') : t('mDailyD'), () => startDaily(app)),
      modeBtn(t('mStudy'), t('mStudyD'), () => renderStudy(app))),

    el('button', { class: 'link-btn', onClick: () => renderStats(app) }, t('statistics')),
  );
  show(app, 'home', screen);
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
    return renderMessage(app, mode === 'review' ? t('noReview') : t('noQuestions'));
  }
  const order = pickSet(pool, pool.length);
  runQuiz(app, {
    order, index: 0, correct: 0, wrong: 0,
    label: mode === 'review' ? t('mReview') : t('mTraining'),
    daily: false,
  });
}

function startDaily(app) {
  const day = localDay();
  const pool = filterQuestions(app.questions, { history: app.stats.history });
  const rng = mulberry32(seedFromDate(day));
  const order = pickSet(pool, DAILY_SIZE, rng);
  // Already completed today: it can be replayed, but it is not recorded again.
  const counted = dailyCounts(app.stats, day);
  runQuiz(app, {
    order, index: 0, correct: 0, wrong: 0,
    label: counted ? t('mDaily') : t('mDailyReplay'), daily: true, day, counted,
  });
}

function runQuiz(app, session) {
  if (session.index >= session.order.length) return finishQuiz(app, session);

  const q = session.order[session.index];
  const isMulti = q.type === 'multi';
  const opts = qOptions(q);
  const choice = buildOptions(q, opts, 'opt');
  const { optionEls, selected, order } = choice;

  const feedback = el('div', { class: 'feedback' });
  const submitBtn = el('button', { class: 'primary-btn' }, isMulti ? t('confirmMulti') : t('confirm'));
  const nextBtn = el('button', { class: 'primary-btn hidden' }, t('next'));

  submitBtn.addEventListener('click', async () => {
    if (selected.size === 0) { feedback.textContent = t('selectAnswer'); return; }
    const res = grade(q, choice.selectedOriginal());
    optionEls.forEach((lab, pos) => {
      const orig = order[pos];
      lab.querySelector('input').disabled = true;
      if (res.correct.includes(orig)) lab.classList.add('correct');
      else if (res.chosen.includes(orig)) lab.classList.add('wrong');
    });
    if (res.isCorrect) session.correct++; else session.wrong++;

    const why = qWhyWrong(q);
    const nodes = [el('p', { class: res.isCorrect ? 'verdict ok' : 'verdict ko' }, res.isCorrect ? t('correct') : t('wrong'))];
    if (!res.isCorrect) {
      for (const w of res.wrongReasons) {
        const reason = why?.[String(w.index)];
        if (reason) nodes.push(el('p', { class: 'why-wrong' }, t('whyWrong', opts[w.index], reason)));
      }
    }
    nodes.push(el('p', { class: 'explain' }, qExplanation(q)));
    feedback.replaceChildren(...nodes);
    submitBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');

    if (!session.daily || session.counted) {
      recordAttempt(app.stats, { id: q.id, isCorrect: res.isCorrect, date: localDay() });
      await persist(app);
    }
  });

  nextBtn.addEventListener('click', () => { session.index++; runQuiz(app, session); });

  const screen = el('div', { class: 'screen' },
    topBar(app, session.label, (session.index + 1) + '/' + session.order.length, '✓ ' + session.correct + '  ✗ ' + session.wrong),
    el('div', { class: 'card question-card' },
      el('div', { class: 'meta' }, q.cert.join(', ') + ' · ' + q.topics.join(', ')),
      el('p', { class: 'question' }, qText(q)),
      isMulti ? el('p', { class: 'hint' }, t('multiHint')) : null,
      el('div', { class: 'options' }, ...optionEls),
      feedback, submitBtn, nextBtn),
  );
  show(app, 'quiz', screen);
}

async function finishQuiz(app, session) {
  if (session.daily && session.counted) {
    markDailyDone(app.stats, session.day);
    await persist(app);
  }
  const total = session.correct + session.wrong;
  const pct = total ? Math.round((session.correct / total) * 100) : 0;
  renderMessage(app,
    t('quizDone', session.label, session.correct, total, pct) +
    (session.daily ? t('streakSuffix', streak(app.stats.days, localDay())) : ''));
}

// ---------- EXAM (no feedback until end) ----------
function renderExamConfig(app) {
  const countSel = el('select', {},
    el('option', { value: '10' }, t('nQuestions', 10)),
    el('option', { value: '20', selected: 'selected' }, t('nQuestions', 20)),
    el('option', { value: '40' }, t('nQuestions', 40)));
  const timeSel = el('select', {},
    el('option', { value: '5' }, t('nMinutes', 5)),
    el('option', { value: '10' }, t('nMinutes', 10)),
    el('option', { value: '20', selected: 'selected' }, t('nMinutes', 20)),
    el('option', { value: '40' }, t('nMinutes', 40)));

  const start = el('button', { class: 'primary-btn' }, t('startExam'));
  start.addEventListener('click', () => {
    const pool = filterQuestions(app.questions, {
      cert: app.scope.cert || undefined, topic: app.scope.topic || undefined, history: app.stats.history,
    });
    if (pool.length === 0) return renderMessage(app, t('noQuestions'));
    const order = pickSet(pool, Number(countSel.value));
    runExam(app, { order, index: 0, answers: [], seconds: Number(timeSel.value) * 60 });
  });

  show(app, 'examConfig', el('div', { class: 'screen' },
    topBar(app, t('mExam'), '', ''),
    el('div', { class: 'card' },
      el('h2', {}, t('examConfigTitle')),
      el('label', { class: 'field' }, t('numQuestions'), countSel),
      el('label', { class: 'field' }, t('time'), timeSel),
      el('p', { class: 'hint' }, t('examScopeHint', app.scope.cert || t('allCertsShort'), app.scope.topic || t('allTopicsShort'), PASS_THRESHOLD)),
      start)));
}

function runExam(app, session) {
  if (!session.deadline) {
    // Absolute deadline: the countdown is recomputed from the clock on every tick,
    // so it keeps running while the tab is in background or the PWA is suspended.
    session.deadline = Date.now() + session.seconds * 1000;
    session.remaining = session.seconds;
    const tick = () => {
      if (session.finished) return;
      session.remaining = remainingSeconds(session.deadline);
      const tt = document.getElementById('examTimer');
      if (tt) {
        tt.textContent = fmtTime(session.remaining);
        tt.classList.toggle('timer-warning', session.remaining <= 60); // allerta ultimo minuto
      }
      if (session.remaining <= 0) timeUp(app, session);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    session.timer = setInterval(tick, 500);
    document.addEventListener('visibilitychange', onVisible);
    // so navigation away (Home) can cancel it
    app.examCleanup = session.cleanup = () => {
      clearInterval(session.timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }
  if (session.index >= session.order.length) return finishExam(app, session);

  const q = session.order[session.index];
  const isMulti = q.type === 'multi';
  const opts = qOptions(q);
  const choice = buildOptions(q, opts, 'exopt');
  const { optionEls } = choice;
  session.currentChoice = choice; // read by timeUp() if time runs out on this question

  const nextLabel = session.index === session.order.length - 1 ? t('finish') : t('forward');
  const next = el('button', { class: 'primary-btn' }, nextLabel);
  next.addEventListener('click', () => {
    if (remainingSeconds(session.deadline) <= 0) return timeUp(app, session);
    session.answers[session.index] = { q, selected: choice.selectedOriginal() };
    session.index++;
    runExam(app, session);
  });

  show(app, 'exam', el('div', { class: 'screen' },
    topBar(app, t('mExam'), (session.index + 1) + '/' + session.order.length, el('span', { id: 'examTimer', class: 'timer' }, fmtTime(session.remaining))),
    el('div', { class: 'card question-card' },
      el('div', { class: 'meta' }, q.cert.join(', ') + ' · ' + q.topics.join(', ')),
      el('p', { class: 'question' }, qText(q)),
      isMulti ? el('p', { class: 'hint' }, t('multiHintShort')) : null,
      el('div', { class: 'options' }, ...optionEls),
      next)));
}

function timeUp(app, session) {
  if (session.finished) return;
  commitPendingAnswer(session, session.currentChoice?.selectedOriginal() ?? []);
  finishExam(app, session);
}

async function finishExam(app, session) {
  if (session.finished) return; // idempotent: guard against timer/click race
  session.finished = true;
  session.cleanup?.();
  app.examCleanup = null;
  let correct = 0;
  const review = [];
  for (let i = 0; i < session.order.length; i++) {
    const q = session.order[i];
    const ans = session.answers[i]?.selected ?? [];
    const res = grade(q, ans);
    if (res.isCorrect) correct++;
    recordAttempt(app.stats, { id: q.id, isCorrect: res.isCorrect, date: localDay() });
    review.push({ q, res, ans });
  }
  await persist(app);

  const total = session.order.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const passed = pct >= PASS_THRESHOLD;

  const reviewList = review.map(({ q, res, ans }) => {
    const opts = qOptions(q);
    return el('div', { class: 'review-item' },
      el('p', { class: 'question' }, qText(q)),
      el('p', { class: res.isCorrect ? 'verdict ok' : 'verdict ko' },
        res.isCorrect ? t('correct') : t('yourAns', (ans.map(i => opts[i]).join(', ') || t('none')))),
      el('p', { class: 'explain' }, t('correctAns', res.correct.map(i => opts[i]).join(', '), qExplanation(q))));
  });

  show(app, 'examResult', el('div', { class: 'screen' },
    topBar(app, t('result'), '', ''),
    el('div', { class: 'card' },
      el('h2', { class: passed ? 'verdict ok' : 'verdict ko' }, (passed ? t('passed') : t('notPassed')) + ' — ' + correct + '/' + total + ' (' + pct + '%)'),
      el('p', { class: 'hint' }, t('threshold', PASS_THRESHOLD))),
    el('div', { class: 'card' }, el('h2', {}, t('review')), ...reviewList)));
}

// ---------- STUDIO (read question + answer) ----------
function renderStudy(app) {
  const pool = filterQuestions(app.questions, {
    cert: app.scope.cert || undefined,
    topic: app.scope.topic || undefined,
    history: app.stats.history,
  });

  const ambito = (app.scope.cert || t('allCerts')) + ' · ' + (app.scope.topic || t('allTopicsShort'));

  const buildItem = (q, n) => {
    const opts = qOptions(q);
    // Same shuffled presentation as the quiz modes, so position is never a hint.
    const order = optionOrder(q);
    const rightAns = order.filter(i => q.correct.includes(i)).map(i => opts[i]).join('  |  ');
    const why = qWhyWrong(q);
    const parts = [
      el('p', { class: 'study-q' }, (n + 1) + '. ' + qText(q)),
      el('p', { class: 'study-opt ok' }, '✓ ' + rightAns),
      el('p', { class: 'study-exp' }, qExplanation(q)),
    ];
    if (why) {
      for (const oi of order) {
        const reason = why[String(oi)];
        if (!q.correct.includes(oi) && reason) {
          parts.push(el('p', { class: 'study-wrong' }, '✗ "' + opts[oi] + '": ' + reason));
        }
      }
    }
    parts.push(el('p', { class: 'study-meta' }, q.cert.join(', ') + ' · ' + q.topics.join(', ')));
    return el('div', { class: 'study-item' }, ...parts);
  };

  // Paginazione: renderizza a blocchi per non generare migliaia di nodi in una volta (mobile).
  const BATCH = 40;
  const list = el('div', { class: 'card study-list' });
  let shown = 0;
  const moreBtn = el('button', { class: 'link-btn' });
  const renderMore = () => {
    const next = pool.slice(shown, shown + BATCH);
    next.forEach((q, i) => list.append(buildItem(q, shown + i)));
    shown += next.length;
    if (shown >= pool.length) { moreBtn.remove(); }
    else { moreBtn.textContent = t('loadMore', Math.min(BATCH, pool.length - shown), pool.length - shown); }
  };
  moreBtn.addEventListener('click', renderMore);
  if (pool.length) renderMore();

  show(app, 'study', el('div', { class: 'screen' },
    topBar(app, t('mStudy'), '', t('nQuestionsShort', pool.length)),
    el('div', { class: 'card' },
      el('h2', {}, t('studyMaterial')),
      el('p', { class: 'hint' }, t('studyScopeHint', ambito))),
    pool.length
      ? list
      : el('div', { class: 'card' }, el('p', { class: 'hint' }, t('noQuestions'))),
    (pool.length > BATCH) ? moreBtn : null));
}

// ---------- STATS ----------
function renderStats(app, notice = '') {
  const g = globalAccuracy(app.stats);
  const byCert = byField(app.questions, app.stats.history, 'cert');
  const byTopic = byField(app.questions, app.stats.history, 'topics');

  const today = localDay();
  const cal = [];
  for (let i = 29; i >= 0; i--) {
    const day = dateBack(today, i);
    const n = app.stats.days[day]?.answered ?? 0;
    const lvl = n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3;
    cal.push(el('div', { class: 'cal-cell lvl' + lvl, title: day + ': ' + n }));
  }

  const sortWorst = (obj) => Object.entries(obj).sort((a, b) => a[1].pct - b[1].pct || b[1].answered - a[1].answered);
  const bars = (obj) => sortWorst(obj).map(([name, v]) => el('div', { class: 'bar-row' },
    el('span', { class: 'bar-label' }, name + ' (' + v.correct + '/' + v.answered + ')'),
    el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: 'width:' + v.pct + '%' })),
    el('span', { class: 'bar-pct' }, v.pct + '%')));

  const exportBtn = el('button', { class: 'primary-btn' }, t('exportStats'));
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([exportStats(app.stats)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'quizcert-stats.json' });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  const importMsg = el('p', { class: 'import-msg', role: 'status', 'aria-live': 'polite' });
  const importInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = ''; // allow re-selecting the same file after fixing it
    if (!file) return;
    importMsg.className = 'import-msg';
    try {
      if (file.size > MAX_IMPORT_BYTES) throw Object.assign(new Error('size'), { code: 'size' });
      const imported = importStats(await file.text());
      if (!confirm(t('confirmOverwrite'))) return;
      app.stats = imported;
      await persist(app);
      renderStats(app, t('importOk'));
    } catch (e) {
      importMsg.classList.add('ko');
      importMsg.textContent = t('importFailed', e.code ? t('importErr', e.code, e.path) : e.message);
    }
  });
  const importBtn = el('button', { class: 'primary-btn' }, t('importStats'));
  importBtn.addEventListener('click', () => importInput.click());

  const weakBtn = el('button', { class: 'link-btn', onClick: () => startPractice(app, 'review') }, t('reviewWeak'));

  const certCard = el('div', { class: 'card' }, el('h2', {}, t('byCert')));
  if (Object.keys(byCert).length) bars(byCert).forEach(b => certCard.append(b));
  else certCard.append(el('p', { class: 'hint' }, t('noData')));

  const topicCard = el('div', { class: 'card' }, el('h2', {}, t('byTopic')));
  if (Object.keys(byTopic).length) bars(byTopic).forEach(b => topicCard.append(b));
  else topicCard.append(el('p', { class: 'hint' }, t('noData')));
  topicCard.append(weakBtn);

  show(app, 'stats', el('div', { class: 'screen' },
    topBar(app, t('statistics'), '', ''),
    el('div', { class: 'card' },
      el('h2', {}, t('streakTitle', streak(app.stats.days, today))),
      el('div', { class: 'calendar' }, ...cal),
      el('div', { class: 'cal-legend' },
        el('span', {}, el('span', { class: 'dot lvl1' }), '1-4'),
        el('span', {}, el('span', { class: 'dot lvl2' }), '5-14'),
        el('span', {}, el('span', { class: 'dot lvl3' }), '15+')),
      el('p', { class: 'hint' }, t('last30'))),
    el('div', { class: 'card' },
      el('h2', {}, t('overall')),
      el('p', {}, t('overallLine', g.correct, g.wrong, g.pct))),
    certCard,
    topicCard,
    el('div', { class: 'card' }, el('h2', {}, t('backup')), el('div', { class: 'row' }, exportBtn, importBtn), importInput, importMsg)));
  if (notice) { importMsg.classList.add('ok'); importMsg.textContent = notice; }
}

// ---------- shared bits ----------
// Swap the visible screen (single place for screen bookkeeping).
function show(app, name, screen) {
  app.screen = name;
  app.root.replaceChildren(screen);
}

// Build the (shuffled) option inputs for a question. Inputs carry their DISPLAY
// position; selectedOriginal() maps the selection back to original indices.
function buildOptions(q, opts, name) {
  const isMulti = q.type === 'multi';
  const order = optionOrder(q);
  const selected = new Set(); // display positions
  const optionEls = order.map((orig, pos) => {
    const input = el('input', { type: isMulti ? 'checkbox' : 'radio', name, value: String(pos) });
    input.addEventListener('change', () => {
      if (isMulti) { input.checked ? selected.add(pos) : selected.delete(pos); }
      else { selected.clear(); selected.add(pos); }
    });
    return el('label', { class: 'option' }, input, el('span', {}, opts[orig]));
  });
  return { order, selected, optionEls, selectedOriginal: () => toOriginal(order, [...selected]) };
}

function topBar(app, title, center, right) {
  return el('div', { class: 'topbar' },
    el('button', { class: 'back-btn', onClick: () => renderHome(app) }, t('home')),
    el('span', { class: 'topbar-title' }, title),
    el('span', { class: 'topbar-center' }, center || ''),
    el('span', { class: 'topbar-right' }, right || ''));
}

function renderMessage(app, msg) {
  show(app, 'message', el('div', { class: 'screen' },
    topBar(app, 'QuizCert', '', ''),
    el('div', { class: 'card' }, el('p', { class: 'big-msg' }, msg),
      el('button', { class: 'primary-btn', onClick: () => renderHome(app) }, t('backHome')))));
}
