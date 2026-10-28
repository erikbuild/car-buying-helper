// ABOUTME: The service worker that keeps every file of the page in one cache named for the release.
// ABOUTME: Answers from that cache before the network; each release downloads every file fresh and deletes the other releases' caches.
const RELEASE = 'development';
const CACHE_PREFIX = 'car-buying-helper-';
const CACHE_NAME = `${CACHE_PREFIX}${RELEASE}`;

// Every file of the page except this worker, which the browser keeps itself and fetches to check whether the release changed.
const FILES = [
  './',
  'app.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'lib/calendar.js',
  'lib/checks.js',
  'lib/contract-checks.js',
  'lib/deal.js',
  'lib/desk-checks.js',
  'lib/display.js',
  'lib/form.js',
  'lib/inputs.js',
  'lib/loan.js',
  'lib/numbers.js',
  'lib/price.js',
  'manifest.webmanifest',
  'rules/connecticut.js',
  'rules/reference.js',
  'styles.css',
];

// Downloads every file fresh, bypassing the browser's HTTP cache, then takes over without waiting.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Deletes the caches of other releases, then takes control of the pages already open.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Answers each GET from this release's cache, and from the network only for files not in it.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(event.request, { ignoreSearch: true }))
      .then((cached) => cached ?? fetch(event.request)),
  );
});
