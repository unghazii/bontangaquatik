const Auth = {
  KEY: 'swim_session',
  AUTH_URL: '/__auth-role__',
  async _syncRoleToSW(role) {
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open('akuatik-auth');
        if (role === 'admin' || role === 'peserta') {
          await cache.put(
            this.AUTH_URL,
            new Response(role, { headers: { 'Content-Type': 'text/plain' } })
          );
        } else {
          await cache.delete(this.AUTH_URL);
        }
      } catch (e) {}
    }
    try {
      const ctrl = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (ctrl) {
        ctrl.postMessage(role ? { type: 'SET_ROLE', role } : { type: 'CLEAR_ROLE' });
      }
    } catch (e) {}
  },

  setSession(role, data) {
    const payload = JSON.stringify({ role, data, timestamp: Date.now() });
    try { localStorage.setItem(this.KEY, payload); } catch (e) {}
    try { sessionStorage.removeItem(this.KEY); } catch (e) {}
    this._syncRoleToSW(role);
  },

  getSession() {
    let raw = null;
    try { raw = localStorage.getItem(this.KEY); } catch (e) {}
    if (!raw) {
      try {
        const legacy = sessionStorage.getItem(this.KEY);
        if (legacy) { localStorage.setItem(this.KEY, legacy); sessionStorage.removeItem(this.KEY); raw = legacy; }
      } catch (e) {}
    }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  isLoggedIn() { return this.getSession() !== null; },
  getRole() { const s = this.getSession(); return s ? s.role : null; },
  getUser() { const s = this.getSession(); return s ? s.data : null; },
  patchUser(partial) {
    const s = this.getSession();
    if (!s) return;
    s.data = { ...s.data, ...partial };
    this.setSession(s.role, s.data);
  },
  async logout() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
    try { sessionStorage.removeItem(this.KEY); } catch (e) {}
    await this._syncRoleToSW(null);
    window.location.href = 'index.html';
  },
  requireRole(role) {
    const s = this.getSession();
    if (!s || s.role !== role) {
      Utils.notify('Anda harus login terlebih dahulu', 'warning');
      setTimeout(() => window.location.href = 'login.html', 1200);
      return false;
    }
    return true;
  }
};
(function () {
  try {
    const s = Auth.getSession();
    Auth._syncRoleToSW(s ? s.role : null);
  } catch (e) {}
})();