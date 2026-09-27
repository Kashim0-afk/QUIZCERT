import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  optionOrder, toOriginal, correctDisplayPositions,
  localDay, dateBack, seedFromDate, mulberry32, dailyCounts, markDailyDone,
  remainingSeconds, commitPendingAnswer, fmtTime, loadProblems,
} from '../src/session.js';
import { emptyStats, recordAttempt } from '../src/stats.js';
import { grade } from '../src/engine.js';

// Small deterministic LCG so the test is reproducible.
const lcg = (seed = 42) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const single = { type: 'single', options: ['A', 'B', 'C', 'D'], correct: [1], explanation: '' };
const multi = { type: 'multi', options: ['A', 'B', 'C', 'D'], correct: [0, 2], explanation: '' };
const tf = { type: 'truefalse', options: ['Vero', 'Falso'], correct: [1], explanation: '' };

test('optionOrder is a permutation of all option indices', () => {
  for (let k = 0; k < 50; k++) {
    const order = optionOrder(single);
    assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  }
});

test('optionOrder actually shuffles (fixed rng)', () => {
  // rng()=0 always swaps with index 0 -> [1,2,3,0]
  assert.deepEqual(optionOrder(single, () => 0), [1, 2, 3, 0]);
});

test('truefalse keeps Vero/Falso order', () => {
  for (let k = 0; k < 20; k++) assert.deepEqual(optionOrder(tf), [0, 1]);
});

test('toOriginal remaps displayed choice to the original index', () => {
  const order = [2, 0, 3, 1]; // displayed pos 3 shows original option 1 (the right one)
  assert.deepEqual(toOriginal(order, [3]), [1]);
  assert.equal(grade(single, toOriginal(order, [3])).isCorrect, true);
  assert.equal(grade(single, toOriginal(order, [0])).isCorrect, false);
});

test('toOriginal works for multi answers', () => {
  const order = [3, 2, 1, 0];
  // original 0 and 2 are displayed at positions 3 and 1
  assert.deepEqual(toOriginal(order, [3, 1]).sort(), [0, 2]);
  assert.equal(grade(multi, toOriginal(order, [1, 3])).isCorrect, true);
});

test('toOriginal rejects out of range display indices', () => {
  assert.throws(() => toOriginal([0, 1], [2]), RangeError);
});

test('correctDisplayPositions finds where the right answers are shown', () => {
  assert.deepEqual(correctDisplayPositions([2, 0, 3, 1], [1]), [3]);
  assert.deepEqual(correctDisplayPositions([3, 2, 1, 0], [0, 2]), [1, 3]);
});

test('over many shuffles the correct answer lands in every position', () => {
  const rng = lcg(7);
  const seen = new Set();
  for (let k = 0; k < 40; k++) seen.add(correctDisplayPositions(optionOrder(single, rng), single.correct)[0]);
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
});

test('localDay uses the local calendar day, not UTC', () => {
  // 00:30 local time: toISOString() would give the previous day east of UTC.
  assert.equal(localDay(new Date(2026, 0, 5, 0, 30)), '2026-01-05');
  assert.equal(localDay(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(localDay(new Date(2026, 2, 9, 12)), '2026-03-09');
});

test('dateBack crosses month and year boundaries', () => {
  assert.equal(dateBack('2026-03-01', 1), '2026-02-28');
  assert.equal(dateBack('2026-01-01', 1), '2025-12-31');
  assert.equal(dateBack('2026-08-21', 0), '2026-08-21');
});

test('daily seed is deterministic per day', () => {
  const a = mulberry32(seedFromDate('2026-09-27'));
  const b = mulberry32(seedFromDate('2026-09-27'));
  const c = mulberry32(seedFromDate('2026-09-28'));
  const va = [a(), a(), a()];
  assert.deepEqual(va, [b(), b(), b()]);
  assert.notDeepEqual(va, [c(), c(), c()]);
  for (const v of va) assert.ok(v >= 0 && v < 1);
});

test('daily challenge counts once per day', () => {
  const s = emptyStats();
  assert.equal(dailyCounts(s, '2026-09-27'), true);
  recordAttempt(s, { id: 'a', isCorrect: true, date: '2026-09-27' });
  assert.equal(dailyCounts(s, '2026-09-27'), true, 'answering alone does not complete it');
  markDailyDone(s, '2026-09-27');
  assert.equal(dailyCounts(s, '2026-09-27'), false);
  assert.equal(s.days['2026-09-27'].answered, 1, 'existing day counters are kept');
  assert.equal(dailyCounts(s, '2026-09-28'), true, 'a new day counts again');
});

test('remainingSeconds follows the wall clock, not the number of ticks', () => {
  const start = 1_000_000;
  const deadline = start + 20 * 60 * 1000;
  assert.equal(remainingSeconds(deadline, start), 1200);
  assert.equal(remainingSeconds(deadline, start + 400), 1200, 'rounds up partial seconds');
  // tab in background for 5 minutes with no ticks at all: the time still elapsed
  assert.equal(remainingSeconds(deadline, start + 5 * 60 * 1000), 900);
  assert.equal(remainingSeconds(deadline, deadline), 0);
  assert.equal(remainingSeconds(deadline, deadline + 99_999), 0, 'never negative');
});

test('time-up keeps the selected but unconfirmed answer', () => {
  const q0 = { id: 'q0' }, q1 = { id: 'q1' };
  const session = { order: [q0, q1], index: 1, answers: [{ q: q0, selected: [2] }] };
  assert.equal(commitPendingAnswer(session, [3]), true);
  assert.deepEqual(session.answers[1], { q: q1, selected: [3] });
});

test('time-up never overwrites a confirmed answer nor records an empty one', () => {
  const q0 = { id: 'q0' };
  const s1 = { order: [q0], index: 0, answers: [{ q: q0, selected: [1] }] };
  assert.equal(commitPendingAnswer(s1, [2]), false);
  assert.deepEqual(s1.answers[0].selected, [1]);
  const s2 = { order: [q0], index: 0, answers: [] };
  assert.equal(commitPendingAnswer(s2, []), false);
  assert.equal(s2.answers[0], undefined);
  const s3 = { order: [q0], index: 1, answers: [] }; // already past the last question
  assert.equal(commitPendingAnswer(s3, [0]), false);
});

test('fmtTime formats m:ss', () => {
  assert.equal(fmtTime(1200), '20:00');
  assert.equal(fmtTime(61), '1:01');
  assert.equal(fmtTime(0), '0:00');
  assert.equal(fmtTime(null), '');
});

test('loadProblems reports failed files and skipped questions', () => {
  assert.equal(loadProblems({ failedFiles: [], skipped: 0 }), null);
  assert.deepEqual(loadProblems({ failedFiles: ['questions/o1-ccna.json'], skipped: 0 }), { files: ['o1-ccna.json'], skipped: 0 });
  assert.deepEqual(loadProblems({ failedFiles: [], skipped: 3 }), { files: [], skipped: 3 });
});
