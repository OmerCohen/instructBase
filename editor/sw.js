/* sw.js — offline support for the editor (installable PWA).
 *
 * Only the editor's own files are handled (same origin, inside this scope).
 * The lesson files themselves never go through here: the editor reads and
 * writes them through the File System Access API, not over HTTP.
 *
 *  install  — precache every file the editor needs, so it starts with no server.
 *  fetch    — network first (a newer editor wins while the local server runs),
 *             with a short timeout, then the cache. Navigations fall back to
 *             the cached index.html.
 *  activate — drop caches of older versions.
 * Bump VERSION when the list of files changes.
 */
const VERSION = 'ib-editor-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/editor.css',
  './js/htmlscan.js', './js/docmodel.js', './js/zip.js', './js/richtext.js', './js/slide-editor.js',
  './js/fs.js', './js/preview-agent.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './templates/deck-template.html', './templates/guide-template.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // one missing file must not abort the rest
    await Promise.allSettled(ASSETS.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ib-editor-') && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([fetch(req), timeout(3000)]);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true })) ||
        (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      if (hit) return hit;
      throw err;
    }
  })());
});
