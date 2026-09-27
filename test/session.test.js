import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionOrder, toOriginal, correctDisplayPositions } from '../src/session.js';
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
