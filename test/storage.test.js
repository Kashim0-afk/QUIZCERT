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
