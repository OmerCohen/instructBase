/* Service worker for "תקשורת עויינת" — an offline-first, installable PWA.
 *
 * Strategy:
 *   • install  — precache the app shell + the stable icons/manifest.
 *   • navigate — network-first (a fresh deploy wins while online), falling back to
 *                the cached shell so the app still boots with no connection.
 *   • other GETs (hashed JS/CSS, terrain data, radio images) — cache-first, filled
 *                in as they're fetched, so a second visit works fully offline.
 *
 * The app is a self-contained SPA (no backend), so caching same-origin GETs gives
 * complete offline play once a sector/screen has been visited online.
 * Bump CACHE to force a clean re-precache on the next visit.
 */
const CACHE = 'kesher-net-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

async function precache() {
  const cache = await caches.open(CACHE);
  // don't let one 404 abort the whole precache
  await Promise.allSettled(SHELL.map((u) => cache.add(u)));
  // the build's JS/CSS have content-hashed names we can't hard-code, so read them
  // out of index.html and precache them too — this makes the game work offline
  // right after the FIRST online visit, not only the second.
  try {
    const res = await fetch('./index.html', { cache: 'no-cache' });
    const html = await res.text();
    const assets = new Set();
    const re = /(?:src|href)="([^"]+\.(?:js|css|woff2?|png|svg))"/g;
    let m;
    while ((m = re.exec(html))) assets.add(m[1]);
    await Promise.allSettled([...assets].map((u) => cache.add(u)));
  } catch {
    /* best effort — runtime caching still covers assets on the next fetch */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin requests alone

  // navigations: network-first, cached shell as the offline fallback.
  // ignoreVary: an ES-module/CORS request carries an Origin header the cached
  // entry doesn't, which would otherwise miss and blank the page offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(request, { ignoreVary: true })
            .then((hit) => hit || caches.match('./index.html', { ignoreVary: true })),
        ),
    );
    return;
  }

  // everything else: cache-first, then network (and cache what comes back)
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => Response.error());
    }),
  );
});
