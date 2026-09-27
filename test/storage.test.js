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

// ---------- strict import validation ----------
import { ImportError, isIsoDay } from '../src/storage.js';
import { markDailyDone } from '../src/session.js';

const validStats = () => {
  const s = emptyStats();
  recordAttempt(s, { id: 'q1', isCorrect: true, date: '2026-09-26' });
  recordAttempt(s, { id: 'q1', isCorrect: false, date: '2026-09-27' });
  recordAttempt(s, { id: 'q2', isCorrect: true, date: '2026-09-27' });
  markDailyDone(s, '2026-09-27');
  return s;
};
const mutate = (fn) => { const s = JSON.parse(JSON.stringify(validStats())); fn(s); return JSON.stringify(s); };
const rejects = (json, code) => assert.throws(() => importStats(json), (e) => e instanceof ImportError && e.code === code);

test('import keeps a real export intact, including challengeDone', () => {
  const s = validStats();
  assert.deepEqual(importStats(exportStats(s)), s);
});

test('import rejects string / float / negative counters', () => {
  rejects(mutate((s) => { s.history.q1.correct = '5'; }), 'type');
  rejects(mutate((s) => { s.history.q1.wrong = 1.5; }), 'type');
  rejects(mutate((s) => { s.history.q1.seen = -1; }), 'type');
  rejects(mutate((s) => { s.days['2026-09-27'].answered = null; }), 'type');
  rejects(mutate((s) => { s.days['2026-09-27'].challengeDone = 'yes'; }), 'type');
});

test('import rejects inconsistent counters', () => {
  rejects(mutate((s) => { s.history.q1.seen = 7; }), 'range');
  rejects(mutate((s) => { s.history.q2.correctStreak = 9; }), 'range');
  rejects(mutate((s) => { s.days['2026-09-27'].answered = 99; }), 'range');
});

test('import rejects bad dates and keys', () => {
  rejects(mutate((s) => { s.history.q1.lastSeen = 'yesterday'; }), 'type');
  rejects(mutate((s) => { s.days['2026-02-30'] = { answered: 0, correct: 0, wrong: 0 }; }), 'key');
  rejects(mutate((s) => { s.days['not-a-day'] = { answered: 0, correct: 0, wrong: 0 }; }), 'key');
  rejects(mutate((s) => { s.history[''] = { seen: 0, correct: 0, wrong: 0, correctStreak: 0, lastSeen: null }; }), 'key');
});

test('import rejects unknown or missing fields', () => {
  rejects(mutate((s) => { s.history.q1.admin = true; }), 'field');
  rejects(mutate((s) => { delete s.history.q1.wrong; }), 'field');
  rejects(mutate((s) => { s.extra = 1; }), 'field');
  rejects(JSON.stringify({ version: 1, history: {} }), 'field');
});

test('import rejects wrong top-level shapes', () => {
  rejects('{ not json', 'json');
  rejects('[]', 'structure');
  rejects('"hello"', 'structure');
  rejects(JSON.stringify({ version: 1, history: [], days: {} }), 'structure');
  rejects(JSON.stringify({ version: 1, history: { q: [1, 2] }, days: {} }), 'type');
  rejects(JSON.stringify({ version: '1', history: {}, days: {} }), 'version');
});

test('import drops __proto__ tricks by rejecting the file', () => {
  rejects('{"version":1,"history":{"__proto__":{"seen":0,"correct":0,"wrong":0,"correctStreak":0}},"days":{}}', 'key');
});

test('import rejects oversized input', () => {
  rejects(' '.repeat(5 * 1024 * 1024 + 1), 'size');
});

test('error carries the path of the offending field', () => {
  try { importStats(mutate((s) => { s.history.q1.correct = '5'; })); assert.fail('should throw'); }
  catch (e) { assert.equal(e.path, 'history["q1"].correct'); }
});

test('isIsoDay validates real calendar days', () => {
  assert.equal(isIsoDay('2024-02-29'), true);
  assert.equal(isIsoDay('2026-02-29'), false);
  assert.equal(isIsoDay('2026-9-27'), false);
});
