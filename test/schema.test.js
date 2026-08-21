import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestion } from '../src/schema.js';

const valid = {
  id: 'sc900-001', cert: ['SC-900'], topics: ['Identity'],
  type: 'single', difficulty: 1,
  question: 'Cos\'e Entra ID?', options: ['A', 'B', 'C', 'D'],
  correct: [0], explanation: 'A e la risposta.', why_wrong: { '1': 'B no' },
  source: 'HACK/x.rtf'
};

test('valid question returns no errors', () => {
  assert.deepEqual(validateQuestion(valid), []);
});

test('missing id is flagged', () => {
  assert.ok(validateQuestion({ ...valid, id: '' }).includes('id'));
});

test('single must have exactly one correct', () => {
  assert.ok(validateQuestion({ ...valid, correct: [0, 1] }).includes('single-one'));
});

test('correct index out of range flagged', () => {
  assert.ok(validateQuestion({ ...valid, correct: [9] }).includes('correct-range'));
});

test('truefalse must be 2 options / 1 correct', () => {
  const tf = { ...valid, type: 'truefalse', options: ['Vero', 'Falso'], correct: [0] };
  assert.deepEqual(validateQuestion(tf), []);
  assert.ok(validateQuestion({ ...tf, options: ['a', 'b', 'c'] }).includes('truefalse-shape'));
});

test('multi allows several correct', () => {
  const m = { ...valid, type: 'multi', correct: [0, 2] };
  assert.deepEqual(validateQuestion(m), []);
});
