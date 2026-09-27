// Pure session logic used by the UI (no DOM access, unit-tested in test/session.test.js).
import { grade } from './engine.js';

// Display order of a question's options, as a list of ORIGINAL option indices.
// Options are shuffled on every presentation so the position of the right answer
// carries no information. True/false keeps the natural "Vero / Falso" order.
export function optionOrder(q, rng = Math.random) {
  const n = Array.isArray(q.options) ? q.options.length : 0;
  const order = Array.from({ length: n }, (_, i) => i);
  if (q.type === 'truefalse') return order;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Map indices of the options as DISPLAYED back to the original indices used by
// `q.correct` / `q.why_wrong` (grading always works on original indices).
export function toOriginal(order, displayed) {
  return displayed.map((d) => {
    if (!Number.isInteger(d) || d < 0 || d >= order.length) throw new RangeError('display index out of range: ' + d);
    return order[d];
  });
}

// Display positions of the correct answers (useful to highlight them).
export function correctDisplayPositions(order, correct) {
  return order.map((orig, pos) => (correct.includes(orig) ? pos : -1)).filter((p) => p >= 0);
}

// ---------- dates ----------
// Calendar day in the user's LOCAL time zone (YYYY-MM-DD). Never cache it: an
// installed PWA can stay open across midnight, so call it when you need it.
export function localDay(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// YYYY-MM-DD minus n days (pure calendar arithmetic, time-zone independent).
export function dateBack(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

// ---------- daily challenge ----------
export function seedFromDate(d) {
  let s = 0;
  for (const ch of d) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return s;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The daily challenge counts (attempts recorded, streak, "done" flag) only once per day.
export function dailyCounts(stats, day) {
  return !stats.days?.[day]?.challengeDone;
}

export function markDailyDone(stats, day) {
  const d = (stats.days[day] ??= { answered: 0, correct: 0, wrong: 0 });
  d.challengeDone = true;
  return stats;
}

// ---------- exam timer ----------
// Seconds left before an absolute deadline (ms since epoch). Based on the wall
// clock, so throttled timers in background tabs / suspended PWAs cannot slow it down.
export function remainingSeconds(deadline, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

// When time runs out, keep the answer selected on the current question even if
// it was not confirmed with "Next". Never overwrites an answer already given.
export function commitPendingAnswer(session, selectedOriginal) {
  const i = session.index;
  if (i >= session.order.length || session.answers[i] != null) return false;
  if (!selectedOriginal || selectedOriginal.length === 0) return false;
  session.answers[i] = { q: session.order[i], selected: [...selectedOriginal] };
  return true;
}

export function fmtTime(s) {
  if (s == null) return '';
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

// ---------- load problems ----------
// Summary of what the loader could not use, or null when everything loaded.
export function loadProblems({ failedFiles = [], skipped = 0 } = {}) {
  if (failedFiles.length === 0 && skipped === 0) return null;
  return { files: failedFiles.map((f) => f.replace(/^.*\//, '')), skipped };
}

// ---------- training length ----------
export const PRACTICE_LENGTHS = [10, 20, 50];
export const DEFAULT_PRACTICE_LENGTH = 20;

export function normalizePracticeLength(v) {
  const n = Number(v);
  return PRACTICE_LENGTHS.includes(n) ? n : DEFAULT_PRACTICE_LENGTH;
}

// ---------- scoring ----------
export const PASS_THRESHOLD = 70;

export const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);

// Grade a finished exam. Unanswered questions count as wrong.
export function scoreExam(order, answers, threshold = PASS_THRESHOLD) {
  const review = order.map((q, i) => {
    const ans = answers[i]?.selected ?? [];
    return { q, ans, res: grade(q, ans) };
  });
  const correct = review.filter((r) => r.res.isCorrect).length;
  const total = order.length;
  const pct = percent(correct, total);
  return { review, correct, total, pct, passed: pct >= threshold };
}

// ---------- study view ----------
// What the Study screen shows for a question, following the (shuffled) display order:
// the right options, then the wrong options that have an explanation.
export function studyEntries(q, order, whyWrong) {
  const right = order.filter((i) => q.correct.includes(i));
  const wrong = order
    .filter((i) => !q.correct.includes(i) && whyWrong?.[String(i)])
    .map((i) => ({ index: i, reason: whyWrong[String(i)] }));
  return { right, wrong };
}

// ---------- stats view ----------
// Calendar heat level for the number of answers given in a day.
export function calendarLevel(n) {
  return n <= 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3;
}

// Weakest first (lowest accuracy), ties broken by more answers.
export function sortByWeakest(byName) {
  return Object.entries(byName).sort((a, b) => a[1].pct - b[1].pct || b[1].answered - a[1].answered);
}
