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
  assert.equal(grade(multi, [2,0]).isCorrect, true);
  assert.equal(grade(multi, [0]).isCorrect, false);
  assert.equal(grade(multi, [0,1,2]).isCorrect, false);
});

test('duplicate selections are ignored', () => {
  assert.equal(grade(single, [1,1]).isCorrect, true);
});

test('missing why_wrong yields null reason', () => {
  const q = { type: 'single', options: ['A','B'], correct: [0], explanation: 'x' };
  assert.deepEqual(grade(q, [1]).wrongReasons, [{ index: 1, reason: null }]);
});
