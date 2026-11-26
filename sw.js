const CACHE_NAME = 'arcade-world-v11';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/games.html',
  '/blog.html',
  '/library.html',
  '/freeplay.html',
  '/get-games.html',
  '/help.html',
  '/about.html',
  '/contact.html',
  '/404.html',
  '/css/index.css?v=7',
  '/css/games.css?v=4',
  '/css/blog.css',
  '/css/detail.css',
  '/css/library.css',
  '/css/support.css',
  '/css/analytics.css',
  '/main.js?v=8',
  '/home-games.js?v=7',
  '/library.js',
  '/legal-games.js',
  '/analytics-config.js',
  '/analytics.js',
  '/vendor/web-vitals.js',
  '/data/games-data.js',
  '/data/blog-index.js',
  '/data/legal-games-data.js',
  '/img/favcoin.png',
  '/img/games/mercenaries-2-world-in-flames.png',
  '/img/coin.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/404.html')))
  );
});
