const VERSION       = 'v1.2.0';
const STATIC_CACHE  = `akuatik-static-${VERSION}`;
const RUNTIME_CACHE = `akuatik-runtime-${VERSION}`;
const AUTH_CACHE    = `akuatik-auth`;
const AUTH_URL = '/__auth-role__';
const DASHBOARD = {
  admin:   'admin.html',
  peserta: 'peserta.html',
};
function isAppEntry(url) {
  return url.pathname === '/' || url.pathname.endsWith('/index.html');
}
const PRECACHE_URLS = [
  './',
  './index.html',
  './login.html',
  './peserta.html',
  './admin.html',
  './manifest.json',
  './assets/css/global.css',
  './assets/css/navbar.css',
  './assets/css/home.css',
  './assets/css/pwa.css',
  './assets/css/components.css',
  './assets/css/auth.css',
  './assets/css/peserta.css',
  './assets/css/admin.css',
  './assets/js/config.js',
  './assets/js/utils.js',
  './assets/js/auth.js',
  './assets/js/api.js',
  './assets/js/pwa.js',
  './assets/images/logo.png',
  './assets/images/logo.webp',
];
/* ============================ INSTALL ============================ */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(
      PRECACHE_URLS.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
          console.warn('[SW] Precache gagal untuk', url, err);
        })
      )
    );
    await self.skipWaiting();
  })());
});
/* ============================ ACTIVATE ============================ */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE, AUTH_CACHE].includes(k))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});
/* ============================ MESSAGE ============================ */
self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'SET_ROLE') {
    event.waitUntil(setRole(data.role));
    return;
  }
  if (data.type === 'CLEAR_ROLE') {
    event.waitUntil(setRole(null));
    return;
  }
});
/* -------- Helper role di Cache Storage -------- */
async function setRole(role) {
  const cache = await caches.open(AUTH_CACHE);
  if (role === 'admin' || role === 'peserta') {
    await cache.put(
      AUTH_URL,
      new Response(role, { headers: { 'Content-Type': 'text/plain' } })
    );
  } else {
    await cache.delete(AUTH_URL);
  }
}
async function getRole() {
  try {
    const cache = await caches.open(AUTH_CACHE);
    const res = await cache.match(AUTH_URL);
    if (!res) return null;
    const role = (await res.text()).trim();
    return (role === 'admin' || role === 'peserta') ? role : null;
  } catch (_) {
    return null;
  }
}
/* ============================ FETCH ============================ */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === AUTH_URL) return;
  /* ---------- Navigasi (buka halaman) ---------- */
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(req, url));
    return;
  }
  /* ---------- Aset: stale-while-revalidate ---------- */
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
/* -------- Logika navigasi + auth-aware routing -------- */
async function handleNavigate(req, url) {
  if (isAppEntry(url)) {
    const role = await getRole();
    if (role) {
      const target = new URL(DASHBOARD[role], self.registration.scope).href;
      return Response.redirect(target, 302);
    }
  }
  try {
    const res = await fetch(req);
    const copy = res.clone();
    caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
    return res;
  } catch (_) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (isAppEntry(url)) {
      const role = await getRole();
      if (role) {
        const dash = await caches.match(`./${DASHBOARD[role]}`);
        if (dash) return dash;
      }
    }
    return (await caches.match('./index.html')) || Response.error();
  }
}