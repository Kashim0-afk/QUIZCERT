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
    c: { wrong: 3, correctStreak: 2 },
  };
  assert.deepEqual(filterQuestions(qs, { mode: 'review', history }).map(q => q.id), ['a']);
});

test('pickSet is deterministic with fixed rng and bounded by pool size', () => {
  const rng = () => 0;
  assert.equal(pickSet(qs, 2, rng).length, 2);
  assert.equal(pickSet(qs, 99, rng).length, 3);
});

test('listCerts/listTopics unique sorted', () => {
  assert.deepEqual(listCerts(qs), ['CCNA', 'NSE4']);
  assert.deepEqual(listTopics(qs), ['Firewall', 'NAT', 'OSPF']);
});
