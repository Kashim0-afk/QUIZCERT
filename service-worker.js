const CACHE = 'quizcert-v2';
const SHELL = [
  ".",
  "index.html",
  "style.css",
  "src/main.js",
  "src/ui.js",
  "src/engine.js",
  "src/select.js",
  "src/stats.js",
  "src/storage.js",
  "src/data-loader.js",
  "src/schema.js",
  "data/manifest.json",
  "data/questions/o1-ccna.json",
  "data/questions/o1-crypto.json",
  "data/questions/o1-forense.json",
  "data/questions/o1-fortinet.json",
  "data/questions/o1-google.json",
  "data/questions/o1-ibm.json",
  "data/questions/o1-microsoft.json",
  "data/questions/o1-paloalto.json",
  "data/questions/sample.json",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png"
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
