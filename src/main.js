import { loadQuestions } from './data-loader.js';
import { createIndexedDbStore, createMemoryStore } from './storage.js';
import { emptyStats } from './stats.js';
import { startApp } from './ui.js';

async function boot() {
  const root = document.getElementById('app');
  try {
    const { questions, skipped } = await loadQuestions('data/manifest.json');
    let store;
    try {
      store = await createIndexedDbStore();
    } catch {
      store = createMemoryStore(emptyStats()); // fallback if IndexedDB unavailable
    }
    const stats = (await store.load()) ?? emptyStats();
    const today = new Date().toISOString().slice(0, 10);
    startApp(root, { questions, store, stats, today, skipped });
  } catch (err) {
    root.textContent = 'Errore nel caricamento delle domande: ' + err.message;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}
boot();
