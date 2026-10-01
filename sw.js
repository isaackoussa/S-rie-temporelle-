/*
 * sw.js — service worker : rend l'application installable et utilisable hors ligne.
 * Stratégie « cache d'abord » pour les fichiers de l'application, réseau pour le reste (polices).
 * Changer VERSION à chaque publication pour forcer la mise à jour du cache.
 */
const VERSION = 'atelier-v8';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/stats.js', 'js/data.js', 'js/charts.js', 'js/ui.js',
  'js/ch-fondations.js', 'js/ch-modeles.js', 'js/ch-pratique.js', 'js/ch-cas.js', 'js/ch-exercices.js', 'js/app.js',
  'cours-m2graf.html', 'js/cours/data-cours.js', 'js/cours/data-tp.js', 'js/cours/commun.js', 'js/cours/c-intro.js', 'js/cours/c-lissage.js',
  'js/cours/c-tendance.js', 'js/cours/c-arma.js', 'js/cours/c-garch.js',
  'vendor/tex-svg-full.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Polices Google : réseau, puis copie en cache pour le hors-ligne
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })).catch(() => caches.match('index.html')));
});
