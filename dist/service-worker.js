const CACHE_VERSION = 'v4';
const CACHE_NAME = `hris-lite-${CACHE_VERSION}`;
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

// Network-first untuk navigasi & asset app (index.html + JS/CSS):
// user SELALU mendapat bundle terbaru saat online; cache hanya fallback
// offline. Ini mencegah production berjalan di kode lama berhari-hari.
const NETWORK_FIRST_PATTERNS = [
  /index\.html$/,
  /assets\/.*\.js$/,
  /assets\/.*\.css$/,
  /\.webmanifest$/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('hris-lite-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';
  const isAppAsset = NETWORK_FIRST_PATTERNS.some((p) => p.test(url.pathname));

  if (isNavigation || isAppAsset) {
    // NETWORK FIRST: segar dulu, cache hanya jika offline
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Aset statis lain (ikon dsb): cache-first masih aman
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
      );
    })
  );
});
