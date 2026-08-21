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
  assert.equal(s.history.a.correctStreak, 0);
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
