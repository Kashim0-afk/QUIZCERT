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

export function importStats(json) {
  let obj;
  try { obj = JSON.parse(json); } catch { throw new Error('JSON non valido'); }
  if (!obj || typeof obj !== 'object' || obj.version !== SCHEMA_VERSION) {
    throw new Error('Formato statistiche incompatibile');
  }
  if (typeof obj.history !== 'object' || typeof obj.days !== 'object') {
    throw new Error('Struttura statistiche non valida');
  }
  return obj;
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
