import { loadQuestions } from './data-loader.js';
import { createIndexedDbStore, createMemoryStore } from './storage.js';
import { emptyStats } from './stats.js';
import { startApp } from './ui.js';
import { t } from './i18n.js';

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
    startApp(root, { questions, store, stats, skipped });
  } catch (err) {
    root.textContent = t('loadError', err.message);
  }

  registerServiceWorker();
}

// ---------- service worker + "new version available" prompt ----------
function showUpdateBanner(worker) {
  if (document.getElementById('updateBanner')) return;
  const bar = document.createElement('div');
  bar.id = 'updateBanner';
  bar.className = 'update-banner';
  bar.setAttribute('role', 'status');
  const msg = document.createElement('span');
  msg.textContent = t('updateAvailable');
  const btn = document.createElement('button');
  btn.className = 'update-btn';
  btn.textContent = t('updateNow');
  btn.addEventListener('click', () => {
    btn.disabled = true;
    updateRequested = true;
    worker.postMessage('SKIP_WAITING');
  });
  bar.append(msg, btn);
  document.body.append(bar);
}

let updateRequested = false;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let reg;
  try {
    // updateViaCache:'none' -> the browser always re-checks service-worker.js on the network.
    reg = await navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' });
  } catch { return; }

  // Reload once the new worker has taken control, but only when the user asked for it
  // (the very first install also fires controllerchange because of clients.claim()).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) location.reload();
  });

  const watch = (worker) => {
    if (!worker) return;
    const check = () => {
      // "installed" + an existing controller = an update is waiting (not the first install).
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
    };
    check();
    worker.addEventListener('statechange', check);
  };
  watch(reg.waiting);
  watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));

  // Installed PWAs can stay open for days: look for a new version when they come back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reg.update().catch(() => {});
  });
}

boot();
