'use strict';

const VERSION = '3.2.0';
const ROOT = new URL(self.registration.scope);
// Cache Storage is shared by all repositories on a github.io origin.
// Only remove this app's caches, identified by its complete scope path.
const PREFIX = `psd:${encodeURIComponent(ROOT.pathname)}:`;
const CACHE = `${PREFIX}${VERSION}`;
const ASSETS = [
  './index.html', './app.js?v=3.2.0', './styles.css?v=3.2.0',
  './manifest.webmanifest', './IMG_8813.jpeg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
].map(path => new URL(path, ROOT).href);
const INDEX = new URL('./index.html', ROOT).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'DPS_SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  // Do not intercept API requests, configuration, or update metadata.
  if (request.cache === 'no-store') return;
  const isAppPage = request.mode === 'navigate' && [ROOT.pathname, `${ROOT.pathname}index.html`].includes(url.pathname);
  if (!isAppPage && !ASSETS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(isAppPage ? INDEX : request);
    if (cached) return cached;
    return fetch(request);
  })());
});
