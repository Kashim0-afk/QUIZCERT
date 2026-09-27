// Integrity checks on the real question bank (data/), run in CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuestion } from '../src/schema.js';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const manifest = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8'));
const bank = manifest.files.map((f) => ({ file: f, questions: JSON.parse(readFileSync(join(DATA, f), 'utf8')) }));
const all = bank.flatMap((b) => b.questions.map((q) => ({ ...q, _file: b.file })));

const italianStrings = (q) => [
  q.question, q.explanation, ...q.options, ...q.topics, ...Object.values(q.why_wrong ?? {}),
];

test('every file listed in the manifest exists and is a non-empty array', () => {
  for (const f of manifest.files) {
    assert.ok(existsSync(join(DATA, f)), f);
  }
  for (const b of bank) assert.ok(Array.isArray(b.questions) && b.questions.length > 0, b.file);
});

test('every question passes the schema validator', () => {
  const bad = all.filter((q) => validateQuestion(q).length).map((q) => q.id + ': ' + validateQuestion(q));
  assert.deepEqual(bad, []);
});

test('question ids are unique across files', () => {
  const seen = new Map();
  const dup = [];
  for (const q of all) {
    if (seen.has(q.id)) dup.push(`${q.id} (${seen.get(q.id)} / ${q._file})`);
    seen.set(q.id, q._file);
  }
  assert.deepEqual(dup, []);
});

test('English options match the Italian ones in number', () => {
  const bad = all.filter((q) => q.options_en && q.options_en.length !== q.options.length).map((q) => q.id);
  assert.deepEqual(bad, []);
});

test('true/false questions keep the Vero/Falso order', () => {
  const bad = all.filter((q) => q.type === 'truefalse' && (q.options[0] !== 'Vero' || q.options[1] !== 'Falso')).map((q) => q.id);
  assert.deepEqual(bad, []);
});

test('no "ASCII Italian" accents in Italian fields (e\', piu, puo, perche...)', () => {
  const patterns = [
    /(?:^|[\s("«“])[eE]'(?=[\s.,;:!?)]|$)/,           // e' / E' used for è / È
    /\b(?:piu|puo|perche|poiche|finche|gia|cosi|cioe)\b/i,
    /\b[Qq]ual e\b/,
  ];
  const bad = [];
  for (const q of all) {
    for (const s of italianStrings(q)) {
      const p = patterns.find((re) => re.test(s));
      if (p) { bad.push(`${q.id}: ${s.slice(0, 80)}`); break; }
    }
  }
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} questions with unaccented forms`);
});
