// Service Worker Bontang Aquatik - minimal cache-first
const CACHE_NAME = 'bontang-aquatik-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './registrasi.html',
  './peserta.html',
  './admin.html',
  './assets/css/global.css',
  './assets/css/navbar.css',
  './assets/css/home.css',
  './assets/css/auth.css',
  './assets/css/peserta.css',
  './assets/css/admin.css',
  './assets/images/logo.jpeg',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Hanya cache GET request untuk static assets, biarkan API request lewat
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Skip Apps Script API & external CDN — biar selalu fresh
  if (url.hostname.includes('googleusercontent.com') ||
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('whatsapp.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache hanya same-origin responses
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
