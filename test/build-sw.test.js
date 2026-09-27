import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServiceWorker, precacheList, isUpToDate } from '../scripts/build-sw.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'quizcert-sw-'));
  const w = (rel, content) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), content); };
  w('scripts/sw-template.js', readFileSync(join(REPO, 'scripts/sw-template.js'), 'utf8'));
  w('index.html', '<!doctype html>');
  w('style.css', 'body{}');
  w('manifest.webmanifest', '{}');
  w('icons/icon-192.png', 'png');
  w('src/main.js', 'console.log(1)');
  w('data/manifest.json', JSON.stringify({ files: ['questions/a.json'] }));
  w('data/questions/a.json', '[]');
  return { root, w };
}

test('precache list comes from disk + data manifest', () => {
  const { root } = fixture();
  try {
    assert.deepEqual(precacheList(root), [
      'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon-192.png',
      'src/main.js', 'data/manifest.json', 'data/questions/a.json',
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('version changes when any precached file changes', () => {
  const { root, w } = fixture();
  try {
    const v1 = buildServiceWorker(root).version;
    assert.equal(buildServiceWorker(root).version, v1, 'deterministic');
    w('data/questions/a.json', '[{"id":"x"}]');
    const v2 = buildServiceWorker(root).version;
    assert.notEqual(v2, v1);
    w('src/main.js', 'console.log(2)');
    assert.notEqual(buildServiceWorker(root).version, v2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CRLF vs LF checkouts give the same version', () => {
  const { root, w } = fixture();
  try {
    w('src/main.js', 'a\nb\n');
    const v1 = buildServiceWorker(root).version;
    w('src/main.js', 'a\r\nb\r\n');
    assert.equal(buildServiceWorker(root).version, v1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing question file listed in the manifest is an error', () => {
  const { root, w } = fixture();
  try {
    w('data/manifest.json', JSON.stringify({ files: ['questions/a.json', 'questions/missing.json'] }));
    assert.throws(() => buildServiceWorker(root), /missing/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('isUpToDate detects a stale service-worker.js', () => {
  const { root, w } = fixture();
  try {
    assert.equal(isUpToDate(root), false, 'no file yet');
    w('service-worker.js', buildServiceWorker(root).source);
    assert.equal(isUpToDate(root), true);
    w('style.css', 'body{color:red}');
    assert.equal(isUpToDate(root), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('generated worker contains version and file list', () => {
  const { root } = fixture();
  try {
    const { source, version } = buildServiceWorker(root);
    assert.match(source, new RegExp(`const VERSION = '${version}'`));
    assert.match(source, /"data\/questions\/a\.json"/);
    assert.doesNotMatch(source, /__VERSION__|__FILES__/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
