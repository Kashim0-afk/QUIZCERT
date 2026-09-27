#!/usr/bin/env node
// Generates service-worker.js from scripts/sw-template.js.
//
// - The precache list is derived from the app files on disk plus data/manifest.json,
//   so a new question file cannot be forgotten.
// - The cache version is a SHA-256 of the template and of every precached file,
//   so ANY content change produces a new worker (and therefore an update prompt).
//
// Usage:
//   node scripts/build-sw.mjs          rewrite service-worker.js
//   node scripts/build-sw.mjs --check  exit 1 if service-worker.js is out of date (CI)
//
// No dependencies: Node built-ins only.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = 'scripts/sw-template.js';
const OUTPUT = 'service-worker.js';

const TEXT_EXT = /\.(js|mjs|css|html|json|webmanifest|svg|txt|md)$/i;

// Read a file for hashing; text files are normalized to LF so the version is the
// same on Windows checkouts (CRLF) and on the Linux CI runner.
function readForHash(root, rel) {
  const buf = readFileSync(join(root, rel));
  return TEXT_EXT.test(rel) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : buf;
}

const listDir = (root, dir, re) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir)).filter((f) => re.test(f)).sort().map((f) => dir + '/' + f)
    : [];

export function precacheList(root = ROOT) {
  const manifest = JSON.parse(readFileSync(join(root, 'data/manifest.json'), 'utf8'));
  const dataFiles = (manifest.files ?? []).map((f) => 'data/' + f);
  for (const f of dataFiles) {
    if (!existsSync(join(root, f))) throw new Error('data/manifest.json lists a missing file: ' + f);
  }
  return [
    'index.html',
    'style.css',
    'manifest.webmanifest',
    ...listDir(root, 'icons', /\.(png|svg|ico)$/i),
    ...listDir(root, 'src', /\.js$/),
    'data/manifest.json',
    ...dataFiles,
  ];
}

export function buildServiceWorker(root = ROOT) {
  const files = precacheList(root);
  const template = readFileSync(join(root, TEMPLATE), 'utf8').replace(/\r\n/g, '\n');
  const h = createHash('sha256');
  h.update(template);
  for (const f of files) {
    h.update('\0' + f + '\0');
    h.update(readForHash(root, f));
  }
  const version = h.digest('hex').slice(0, 12);
  // '.' is the start URL (the directory index); cache it too, it is served as index.html.
  const precache = ['.', ...files];
  const source = template
    .replace('__VERSION__', version)
    .replace('__FILES__', JSON.stringify(precache, null, 2));
  return { version, files: precache, source };
}

export function isUpToDate(root = ROOT) {
  const out = join(root, OUTPUT);
  if (!existsSync(out)) return false;
  const current = readFileSync(out, 'utf8').replace(/\r\n/g, '\n');
  return current === buildServiceWorker(root).source;
}

function main() {
  const check = process.argv.includes('--check');
  const { version, files, source } = buildServiceWorker();
  if (check) {
    if (isUpToDate()) {
      console.log(`service-worker.js is up to date (version ${version}, ${files.length} files).`);
      return;
    }
    console.error('service-worker.js is OUT OF DATE. Run `npm run build:sw` and commit the result.');
    process.exit(1);
  }
  writeFileSync(join(ROOT, OUTPUT), source);
  console.log(`service-worker.js written (version ${version}, ${files.length} files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
