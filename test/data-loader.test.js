import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQuestions } from '../src/data-loader.js';

const good = {
  id: 'x1', cert: ['CCNA'], topics: ['NAT'], type: 'single', difficulty: 1,
  question: 'q', options: ['a', 'b'], correct: [0], explanation: 'e'
};
const bad = { id: '', cert: [], topics: [], type: 'single', options: ['a'], correct: [0], explanation: 'e' };

function fakeFetch(map) {
  return async (url) => ({ json: async () => map[url] });
}

test('loads valid questions and skips invalid ones', async () => {
  const fetchFn = fakeFetch({
    'data/manifest.json': { files: ['questions/a.json'] },
    'data/questions/a.json': [good, bad],
  });
  const res = await loadQuestions('data/manifest.json', fetchFn);
  assert.equal(res.questions.length, 1);
  assert.equal(res.questions[0].id, 'x1');
  assert.equal(res.skipped, 1);
});

test('merges multiple files', async () => {
  const fetchFn = fakeFetch({
    'data/manifest.json': { files: ['questions/a.json', 'questions/b.json'] },
    'data/questions/a.json': [good],
    'data/questions/b.json': [{ ...good, id: 'x2' }],
  });
  const res = await loadQuestions('data/manifest.json', fetchFn);
  assert.deepEqual(res.questions.map(q => q.id), ['x1', 'x2']);
});

test('a broken file is skipped, others still load', async () => {
  const good = {
    id: 'x1', cert: ['CCNA'], topics: ['NAT'], type: 'single', difficulty: 1,
    question: 'q', options: ['a', 'b'], correct: [0], explanation: 'e'
  };
  const fetchFn = async (url) => {
    if (url === 'data/manifest.json') return { json: async () => ({ files: ['questions/broken.json', 'questions/good.json'] }) };
    if (url === 'data/questions/broken.json') return { json: async () => { throw new Error('bad json'); } };
    return { json: async () => [good] };
  };
  const res = await loadQuestions('data/manifest.json', fetchFn);
  assert.equal(res.questions.length, 1);
  assert.deepEqual(res.failedFiles, ['questions/broken.json']);
});
