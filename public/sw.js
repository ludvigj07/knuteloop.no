// Knuteloop service worker
// Endre versjon når du vil tvinge oppdatering hos brukerne
const SW_VERSION = 'v1';
const STATIC_CACHE = `knuteloop-static-${SW_VERSION}`;
const RUNTIME_CACHE = `knuteloop-runtime-${SW_VERSION}`;
const IMAGE_CACHE = `knuteloop-img-${SW_VERSION}`;

// Filer vi vil ha tilgjengelig offline
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  const allowed = new Set([STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (allowed.has(key) ? null : caches.delete(key))))
      )
      .then(() => self.clients.claim())
  );
});

// Lytt etter SKIP_WAITING-melding fra appen for å aktivere ny SW umiddelbart
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isUploadRequest(url) {
  return url.pathname.startsWith('/uploads/');
}

function isImageRequest(request) {
  return (
    request.destination === 'image' ||
    /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(new URL(request.url).pathname)
  );
}

// Network-first for navigering — fallback til offline.html
async function networkFirstNav(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (err) {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match('/offline.html');
    if (offline) return offline;
    throw err;
  }
}

// Stale-while-revalidate for bilder/uploads
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Aldri cache API-kall (auth, mutasjoner, dynamic data)
  if (isApiRequest(url)) return;

  // Navigering → network-first med offline-fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }

  // Brukeropplastede bilder/videoer → SWR
  if (isUploadRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // Statiske bilder → SWR
  if (isImageRequest(request)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // Same-origin assets (JS/CSS/fonts) → SWR
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});
