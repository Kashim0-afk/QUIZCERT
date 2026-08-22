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

const BANNED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

// Rebuild a plain nested map keeping only well-shaped numeric-record entries.
// Drops unexpected/dangerous keys so a hand-edited or malicious import file
// cannot corrupt the stats views (defense-in-depth; JSON.parse already can't
// pollute the prototype, but we sanitize the structure anyway).
function sanitizeRecords(src) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (const [k, v] of Object.entries(src)) {
    if (BANNED_KEYS.has(k)) continue;
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const rec = {};
    for (const [rk, rv] of Object.entries(v)) {
      if (BANNED_KEYS.has(rk)) continue;
      if (typeof rv === 'number' || typeof rv === 'boolean' || rv === null || typeof rv === 'string') rec[rk] = rv;
    }
    out[k] = rec;
  }
  return out;
}

export function importStats(json) {
  let obj;
  try { obj = JSON.parse(json); } catch { throw new Error('JSON non valido'); }
  if (!obj || typeof obj !== 'object' || obj.version !== SCHEMA_VERSION) {
    throw new Error('Formato statistiche incompatibile');
  }
  if (typeof obj.history !== 'object' || obj.history === null ||
      typeof obj.days !== 'object' || obj.days === null) {
    throw new Error('Struttura statistiche non valida');
  }
  // Return a sanitized copy: only the expected shape, no stray/dangerous keys.
  return { version: SCHEMA_VERSION, history: sanitizeRecords(obj.history), days: sanitizeRecords(obj.days) };
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
