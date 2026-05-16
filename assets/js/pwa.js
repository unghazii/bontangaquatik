/* ================================================================
   PWA SYSTEM — Bontang Aquatik (v2 — robust & self-diagnostic)
   Perbaikan dari versi sebelumnya:
   - Event delegation (button click selalu tertangkap, bahkan kalau
     section di-render dinamis setelah script load)
   - Self-diagnostic log ke console saat init
   - Toast fallback bawaan (tidak butuh Utils.notify)
   - Self-test untuk memastikan pwa.css ter-load
   - Setiap interaksi penting di-log → mudah debug
   ================================================================ */

const PWA = {
  /* ---------- KONFIGURASI ---------- */
  KEY_DISMISSED:  'pwa_install_dismissed',
  KEY_INSTALLED:  'pwa_installed',
  DISMISS_DAYS:   7,
  BANNER_DELAY:   3000,
  SW_PATH:        'assets/js/service-worker.js',

  /* ---------- STATE ---------- */
  deferredPrompt: null,
  registration:   null,
  lastFocused:    null,

  /* ============================================================
     DETECTORS
     ============================================================ */
  isIOS()        { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; },
  isAndroid()    { return /Android/i.test(navigator.userAgent); },
  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches
        || window.navigator.standalone === true;
  },
  isInstalled()  { return this.isStandalone() || localStorage.getItem(this.KEY_INSTALLED) === '1'; },
  isDismissed()  {
    const t = Number(localStorage.getItem(this.KEY_DISMISSED));
    if (!t) return false;
    return (Date.now() - t) / 86400000 < this.DISMISS_DAYS;
  },
  platform() {
    if (this.isIOS())     return 'ios';
    if (this.isAndroid()) return 'android';
    return 'desktop';
  },

  /* ============================================================
     INIT
     ============================================================ */
  init() {
    console.log('%c[PWA] Initializing…', 'color:#169AC4;font-weight:bold');
    this._diagnose();
    this._testCSSLoaded();
    window.PWA;
    PWA.diagnose();

    this.setupDelegatedClicks();   // PENTING: event delegation pertama
    this.bindGlobalEvents();
    this.registerServiceWorker();
    this.setupConnectionWatch();
    this.refreshUI();

    // Auto-popup banner (sopan: hanya jika belum dismiss & belum terpasang)
    if (!this.isInstalled() && !this.isDismissed()) {
      if (this.isIOS()) setTimeout(() => this.showBanner('ios'), this.BANNER_DELAY);
      // Android banner akan dipicu lewat beforeinstallprompt
    }

    console.log('%c[PWA] Ready ✓', 'color:#16A34A;font-weight:bold');
  },

  _diagnose() {
    const ok  = (b) => b ? '✅' : '⚠️';
    const isSecure = location.protocol === 'https:'
      || ['localhost', '127.0.0.1'].includes(location.hostname);
    const hasManifest = !!document.querySelector('link[rel="manifest"]');
    const swSupport   = 'serviceWorker' in navigator;
    const btnFound    = !!document.getElementById('pwa-install-btn');

    console.group('[PWA] Diagnostic');
    console.log(`${ok(isSecure)}  HTTPS / localhost          : ${isSecure}`);
    console.log(`${ok(hasManifest)}  <link rel="manifest">      : ${hasManifest}`);
    console.log(`${ok(swSupport)}  Service Worker support     : ${swSupport}`);
    console.log(`${ok(btnFound)}  #pwa-install-btn in DOM     : ${btnFound}`);
    console.log(`ℹ️  Platform                   : ${this.platform()}`);
    console.log(`ℹ️  Standalone (running as app): ${this.isStandalone()}`);
    if (!isSecure)    console.warn('[PWA] beforeinstallprompt TIDAK akan fire tanpa HTTPS atau localhost.');
    if (!hasManifest) console.warn('[PWA] Manifest tidak ter-link. Tambahkan <link rel="manifest" href="assets/js/manifest.json"> di <head>.');
    if (!btnFound)    console.warn('[PWA] Button #pwa-install-btn tidak ditemukan saat init. Event delegation tetap aktif.');
    console.groupEnd();
  },

  _testCSSLoaded() {
    // Tes apakah pwa.css ter-load dengan memeriksa property unik
    const probe = document.createElement('div');
    probe.className = 'pwa-banner';
    probe.style.cssText = 'position:absolute !important;visibility:hidden;left:-9999px;';
    document.body.appendChild(probe);
    const pos = getComputedStyle(probe).position;
    probe.remove();
    const loaded = pos === 'fixed'; // .pwa-banner di pwa.css adalah position:fixed
    if (!loaded) {
      console.warn('[PWA] pwa.css sepertinya BELUM ter-load. Banner & modal akan tidak terlihat.');
      console.warn('[PWA] Tambahkan: <link rel="stylesheet" href="pwa.css"> di <head>.');
    }
    return loaded;
  },

  /* ============================================================
     EVENT DELEGATION — bekerja meskipun button belum ada saat init
     ============================================================ */
  setupDelegatedClicks() {
    PWA.diagnose();
    window.PWA;
    document.addEventListener('click', (e) => {
      const installBtn = e.target.closest('#pwa-install-btn');
      if (installBtn) {
        e.preventDefault();
        console.log('[PWA] Install button clicked.');
        this.handleInstallClick();
        return;
      }
      // Action data-pwa-action di dalam banner / modal / update bar
      const actionEl = e.target.closest('[data-pwa-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.pwaAction;
      e.preventDefault();
      if (action === 'install')      this.handleInstallClick();
      else if (action === 'modal')   this.showModal(this.platform());
      else if (action === 'dismiss') this.dismiss();
      else if (action === 'close')   { this.hideModal(); this.hideBanner(); this.hideUpdateBanner(); }
      else if (action === 'update')  this.applyUpdate();
    });
  },

  bindGlobalEvents() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[PWA] beforeinstallprompt fired — aplikasi installable.');
      this.refreshUI();
      if (!this.isDismissed() && !this.isInstalled()) {
        setTimeout(() => this.showBanner('android'), this.BANNER_DELAY);
      }
    });

    window.addEventListener('appinstalled', () => {
      localStorage.setItem(this.KEY_INSTALLED, '1');
      this.deferredPrompt = null;
      this.hideBanner();
      this.hideModal();
      this.refreshUI();
      this.toast('Aplikasi berhasil dipasang! 🎉', 'success');
      console.log('[PWA] App installed.');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('pwa-modal'))  this.hideModal();
        if (document.getElementById('pwa-banner')) this.hideBanner();
      }
    });
  },

  /* ============================================================
     SERVICE WORKER
     ============================================================ */
  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Worker tidak didukung browser ini.');
      return;
    }
    navigator.serviceWorker.register(this.SW_PATH)
      .then((reg) => {
        this.registration = reg;
        console.log('[PWA] Service Worker registered:', reg.scope);

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateBanner();
            }
          });
        });

        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  },

  /* ============================================================
     UI REFRESH
     ============================================================ */
  refreshUI() {
    const btn = document.getElementById('pwa-install-btn');
    if (!btn) return;
    const labelEl  = btn.querySelector('.pwa-btn-label');
    const iconEl   = btn.querySelector('.pwa-btn-icon');
    const statusEl = document.getElementById('pwa-install-status');

    if (this.isInstalled()) {
      if (labelEl)  labelEl.textContent  = 'Aplikasi Sudah Terpasang';
      if (iconEl)   iconEl.textContent   = '✓';
      if (statusEl) statusEl.textContent = 'Terpasang di perangkat ini';
      btn.disabled = true;
      btn.classList.add('pwa-installed');
      return;
    }

    btn.disabled = false;
    btn.classList.remove('pwa-installed');

    if (this.deferredPrompt) {
      if (labelEl)  labelEl.textContent  = 'Download Aplikasi';
      if (iconEl)   iconEl.textContent   = '⬇';
      if (statusEl) statusEl.textContent = 'Gratis · Tanpa Play Store · < 1 MB';
    } else if (this.isIOS()) {
      if (labelEl)  labelEl.textContent  = 'Pasang di iPhone';
      if (iconEl)   iconEl.textContent   = '';
      if (statusEl) statusEl.textContent = 'Lihat panduan singkat untuk iOS';
    } else {
      if (labelEl)  labelEl.textContent  = 'Pasang Aplikasi';
      if (iconEl)   iconEl.textContent   = '⬇';
      if (statusEl) statusEl.textContent = 'Lihat panduan pemasangan';
    }
  },

  /* ============================================================
     INSTALL HANDLER — DIJAMIN selalu memberi reaksi visual
     ============================================================ */
  async handleInstallClick() {
    console.log('[PWA] handleInstallClick →', {
      installed: this.isInstalled(),
      hasDeferredPrompt: !!this.deferredPrompt,
      platform: this.platform()
    });

    if (this.isInstalled()) {
      this.toast('Aplikasi sudah terpasang di perangkat Anda.', 'info');
      return;
    }

    if (this.deferredPrompt) {
      try {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;
        this.toast(
          outcome === 'accepted' ? 'Memasang aplikasi…' : 'Pemasangan dibatalkan.',
          outcome === 'accepted' ? 'info' : 'warning'
        );
        this.refreshUI();
      } catch (err) {
        console.error('[PWA] Install prompt error:', err);
        this.showModal(this.platform());
      }
      return;
    }

    // FALLBACK: selalu tampilkan modal manual instructions
    console.log('[PWA] No native prompt available — showing manual instructions modal.');
    this.showModal(this.platform());
  },

  /* ============================================================
     FLOATING BANNER
     ============================================================ */
  showBanner(platform) {
    if (document.getElementById('pwa-banner')) return;
    if (this.isInstalled()) return;
    const isIOS = platform === 'ios';
    const html = `
      <div id="pwa-banner" class="pwa-banner" role="status" aria-live="polite">
        <button class="pwa-banner-close" data-pwa-action="dismiss" aria-label="Tutup">×</button>
        <div class="pwa-banner-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18"/>
          </svg>
        </div>
        <div class="pwa-banner-body">
          <strong>Pasang aplikasi Bontang Aquatik</strong>
          <span>Akses lebih cepat tanpa membuka browser.</span>
        </div>
        <div class="pwa-banner-actions">
          ${isIOS
            ? `<button class="pwa-banner-btn pwa-banner-btn-primary" data-pwa-action="modal">Cara Pasang</button>`
            : `<button class="pwa-banner-btn pwa-banner-btn-primary" data-pwa-action="install">Pasang</button>`}
          <button class="pwa-banner-btn pwa-banner-btn-ghost" data-pwa-action="dismiss">Nanti</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    requestAnimationFrame(() => document.getElementById('pwa-banner').classList.add('show'));
  },

  hideBanner() {
    const el = document.getElementById('pwa-banner');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 320);
  },

  dismiss() {
    localStorage.setItem(this.KEY_DISMISSED, String(Date.now()));
    this.hideBanner();
  },

  /* ============================================================
     MODAL INSTRUKSI
     ============================================================ */
  showModal(platform) {
    if (document.getElementById('pwa-modal')) return;
    this.lastFocused = document.activeElement;
    const isIOS = platform === 'ios';
    const title = isIOS ? 'Pasang di iPhone / iPad' : 'Pasang di Perangkat Anda';

    const steps = isIOS ? [
      { icon: this._svgShare(), text: 'Ketuk ikon <strong>Share</strong> di bilah bawah Safari.' },
      { icon: '➕',              text: 'Pilih <strong>Add to Home Screen</strong> dari menu.' },
      { icon: '✓',               text: 'Ketuk <strong>Add</strong> di kanan atas untuk konfirmasi.' }
    ] : [
      { icon: '⋮', text: 'Buka menu browser (titik tiga di pojok).' },
      { icon: '⬇', text: 'Pilih <strong>Install app</strong> atau <strong>Add to Home Screen</strong>.' },
      { icon: '✓', text: 'Konfirmasi pemasangan — aplikasi akan muncul di beranda.' }
    ];

    const stepsHTML = steps.map((s, i) => `
      <li class="pwa-modal-step">
        <span class="pwa-modal-step-num">${i + 1}</span>
        <span class="pwa-modal-step-icon">${s.icon}</span>
        <span class="pwa-modal-step-text">${s.text}</span>
      </li>`).join('');

    const html = `
      <div id="pwa-modal" class="pwa-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pwa-modal-title">
        <div class="pwa-modal">
          <button class="pwa-modal-close" data-pwa-action="close" aria-label="Tutup">×</button>
          <div class="pwa-modal-header">
            <div class="pwa-modal-emoji">📲</div>
            <h3 id="pwa-modal-title">${title}</h3>
            <p>Ikuti langkah singkat berikut untuk menambahkan Bontang Aquatik ke beranda perangkat Anda.</p>
          </div>
          <ol class="pwa-modal-steps">${stepsHTML}</ol>
          <div class="pwa-modal-footer">
            <button class="btn btn-primary btn-block" data-pwa-action="close">Mengerti</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    const modal = document.getElementById('pwa-modal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hideModal();
    });
    requestAnimationFrame(() => {
      modal.classList.add('show');
      const focusable = modal.querySelector('button');
      if (focusable) focusable.focus();
    });
    console.log('[PWA] Modal shown for platform:', platform);
  },

  hideModal() {
    const modal = document.getElementById('pwa-modal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
      if (this.lastFocused && this.lastFocused.focus) this.lastFocused.focus();
    }, 280);
  },

  /* ============================================================
     UPDATE BANNER
     ============================================================ */
  showUpdateBanner() {
    if (document.getElementById('pwa-update')) return;
    const html = `
      <div id="pwa-update" class="pwa-update" role="status" aria-live="polite">
        <div class="pwa-update-body">
          <strong>Versi baru tersedia</strong>
          <span>Muat ulang untuk menggunakan versi terbaru aplikasi.</span>
        </div>
        <div class="pwa-update-actions">
          <button class="pwa-banner-btn pwa-banner-btn-primary" data-pwa-action="update">Muat Ulang</button>
          <button class="pwa-banner-btn pwa-banner-btn-ghost" data-pwa-action="close">Nanti</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    requestAnimationFrame(() => document.getElementById('pwa-update').classList.add('show'));
  },

  hideUpdateBanner() {
    const el = document.getElementById('pwa-update');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  },

  applyUpdate() {
    const reg = this.registration;
    if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  },

  /* ============================================================
     CONNECTION
     ============================================================ */
  setupConnectionWatch() {
    window.addEventListener('online',  () => { this.removeOfflineBadge(); this.toast('Koneksi internet kembali pulih.', 'success'); });
    window.addEventListener('offline', () => { this.showOfflineBadge();  this.toast('Anda offline. Konten dari cache tetap tersedia.', 'warning'); });
    if (!navigator.onLine) this.showOfflineBadge();
  },

  showOfflineBadge() {
    if (document.getElementById('pwa-offline')) return;
    const el = document.createElement('div');
    el.id = 'pwa-offline';
    el.className = 'pwa-offline';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="pwa-offline-dot" aria-hidden="true"></span> Offline`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  },

  removeOfflineBadge() {
    const el = document.getElementById('pwa-offline');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  },

  /* ============================================================
     TOAST — fallback bawaan kalau Utils.notify tidak ada
     ============================================================ */
  toast(msg, type = 'info') {
    console.log(`%c[PWA:${type}] ${msg}`, 'color:#0F7FA3');
    if (typeof Utils !== 'undefined' && typeof Utils.notify === 'function') {
      Utils.notify(msg, type);
      return;
    }
    this._inlineToast(msg, type);
  },

  _inlineToast(msg, type) {
    const colors = { success: '#16A34A', warning: '#F59E0B', error: '#DC2626', info: '#169AC4' };
    const div = document.createElement('div');
    div.className = 'pwa-toast-fallback';
    div.style.cssText = `
      position:fixed;top:24px;right:24px;z-index:10003;
      background:#fff;color:#0B0F12;
      border:1px solid #E3EDF5;border-left:4px solid ${colors[type] || colors.info};
      padding:14px 18px;border-radius:10px;max-width:340px;
      font:500 14px Poppins,system-ui,sans-serif;
      box-shadow:0 16px 40px rgba(15,42,68,0.15);
      transform:translateX(120%);opacity:0;
      transition:transform .3s ease,opacity .3s ease;
    `;
    div.textContent = msg;
    document.body.appendChild(div);
    requestAnimationFrame(() => { div.style.transform = 'translateX(0)'; div.style.opacity = '1'; });
    setTimeout(() => {
      div.style.transform = 'translateX(120%)';
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 300);
    }, 3500);
  },

  /* ============================================================
     HELPERS
     ============================================================ */
  _svgShare() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>`;
  },

  /* ============================================================
     PUBLIC DEBUG API — panggil dari console: PWA.diagnose()
     ============================================================ */
    diagnose() { this._diagnose(); this._testCSSLoaded(); }
};

/* ---------- BOOTSTRAP ---------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PWA.init());
} else {
  PWA.init();
  PWA.diagnose()
}

// Ekspos ke window untuk debugging mudah dari DevTools
window.PWA = PWA;