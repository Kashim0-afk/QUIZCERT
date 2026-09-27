const SCHEMA_VERSION = 1;

export function createMemoryStore(initial = null) {
  let data = initial;
  return {
    load: () => data,
    save: (stats) => { data = structuredClone(stats); },
  };
}

export function exportStats(stats) {
  return JSON.stringify(stats);
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_COUNT = 10_000_000;
const MAX_ID_LEN = 200;
const BANNED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

// Import errors carry a code (localized by the UI) and the path of the bad field.
export class ImportError extends Error {
  constructor(code, path = '') {
    super(code + (path ? ' @ ' + path : ''));
    this.name = 'ImportError';
    this.code = code;
    this.path = path;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isCount = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_COUNT;

// Real calendar date in YYYY-MM-DD form (rejects 2026-02-30, 2026-13-01, ...).
export function isIsoDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function checkKeys(obj, allowed, required, path) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) throw new ImportError('field', path + '.' + k);
  for (const k of required) if (!(k in obj)) throw new ImportError('field', path + '.' + k);
}

function validateHistory(history) {
  const out = {};
  for (const [id, h] of Object.entries(history)) {
    const path = 'history[' + JSON.stringify(id) + ']';
    if (!id || id.length > MAX_ID_LEN || BANNED_KEYS.has(id)) throw new ImportError('key', path);
    if (!isPlainObject(h)) throw new ImportError('type', path);
    checkKeys(h, ['seen', 'correct', 'wrong', 'correctStreak', 'lastSeen'], ['seen', 'correct', 'wrong', 'correctStreak'], path);
    for (const k of ['seen', 'correct', 'wrong', 'correctStreak']) {
      if (!isCount(h[k])) throw new ImportError('type', path + '.' + k);
    }
    const lastSeen = h.lastSeen ?? null;
    if (lastSeen !== null && !isIsoDay(lastSeen)) throw new ImportError('type', path + '.lastSeen');
    if (h.seen !== h.correct + h.wrong) throw new ImportError('range', path + '.seen');
    if (h.correctStreak > h.correct) throw new ImportError('range', path + '.correctStreak');
    out[id] = { seen: h.seen, correct: h.correct, wrong: h.wrong, correctStreak: h.correctStreak, lastSeen };
  }
  return out;
}

function validateDays(days) {
  const out = {};
  for (const [day, d] of Object.entries(days)) {
    const path = 'days[' + JSON.stringify(day) + ']';
    if (!isIsoDay(day)) throw new ImportError('key', path);
    if (!isPlainObject(d)) throw new ImportError('type', path);
    checkKeys(d, ['answered', 'correct', 'wrong', 'challengeDone'], ['answered', 'correct', 'wrong'], path);
    for (const k of ['answered', 'correct', 'wrong']) {
      if (!isCount(d[k])) throw new ImportError('type', path + '.' + k);
    }
    if (d.answered !== d.correct + d.wrong) throw new ImportError('range', path + '.answered');
    if ('challengeDone' in d && typeof d.challengeDone !== 'boolean') throw new ImportError('type', path + '.challengeDone');
    out[day] = { answered: d.answered, correct: d.correct, wrong: d.wrong };
    if (d.challengeDone) out[day].challengeDone = true;
  }
  return out;
}

// Strict validation: a file that does not match the exported format exactly
// (types, ranges, consistency, unknown fields) is rejected as a whole, so the
// stats can never be half-imported or corrupted (e.g. "correct": "5").
export function importStats(json) {
  if (typeof json !== 'string') throw new ImportError('json');
  if (json.length > MAX_IMPORT_BYTES) throw new ImportError('size');
  let obj;
  try { obj = JSON.parse(json); } catch { throw new ImportError('json'); }
  if (!isPlainObject(obj)) throw new ImportError('structure');
  if (obj.version !== SCHEMA_VERSION) throw new ImportError('version');
  checkKeys(obj, ['version', 'history', 'days'], ['version', 'history', 'days'], '$');
  if (!isPlainObject(obj.history)) throw new ImportError('structure', 'history');
  if (!isPlainObject(obj.days)) throw new ImportError('structure', 'days');
  return { version: SCHEMA_VERSION, history: validateHistory(obj.history), days: validateDays(obj.days) };
}

// Browser-only. Dependency-free; not unit-tested (no IndexedDB in Node).
export async function createIndexedDbStore(dbName = 'quizcert') {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = (mode) => db.transaction('kv', mode).objectStore('kv');
  return {
    load: () => new Promise((resolve, reject) => {
      const r = tx('readonly').get('stats');
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    }),
    save: (stats) => new Promise((resolve, reject) => {
      const r = tx('readwrite').put(structuredClone(stats), 'stats');
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    }),
  };
}
