/* ================================================================
   PWA SYSTEM — Bontang Aquatik
   Native-like install experience untuk Android, iOS, dan Desktop.
   ----------------------------------------------------------------
   Fitur:
   - Service Worker registration + deteksi update otomatis
   - Tombol "Download Aplikasi" di section (#pwa-install-btn)
     dinamis sesuai platform dan status pemasangan
   - Floating banner (auto-popup) yang sopan & bisa di-dismiss
   - Modal instruksi visual untuk iOS / browser non-installable
   - Indikator status online/offline
   - Banner update tersedia → reload bersih
   - Aksesibilitas: ARIA, focus trap, ESC to close, keyboard nav
   ================================================================ */

const PWA = {
  /* ---------- KONFIGURASI ---------- */
  KEY_DISMISSED:  'pwa_install_dismissed',
  KEY_INSTALLED:  'pwa_installed',
  DISMISS_DAYS:   7,
  BANNER_DELAY:   3000,
  SW_PATH:        'service-worker.js',

  /* ---------- STATE ---------- */
  deferredPrompt: null,
  registration:   null,
  installBtn:     null,
  statusEl:       null,
  lastFocused:    null,

  /* ============================================================
     DETECTORS
     ============================================================ */
  isIOS()        { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; },
  isAndroid()    { return /Android/i.test(navigator.userAgent); },
  isSafari()     { return /^((?!chrome|android).)*safari/i.test(navigator.userAgent); },
  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches
        || window.navigator.standalone === true;
  },
  isInstalled() {
    return this.isStandalone() || localStorage.getItem(this.KEY_INSTALLED) === '1';
  },
  isDismissed() {
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
    this.cacheElements();
    this.registerServiceWorker();
    this.setupConnectionWatch();
    this.bindInstallButton();
    this.bindGlobalEvents();
    this.refreshUI();

    // Floating banner auto-popup (sopan: hanya jika belum dismiss & belum terpasang)
    if (!this.isInstalled() && !this.isDismissed()) {
      const trigger = this.isIOS() ? 'ios' : null; // android perlu tunggu beforeinstallprompt
      if (trigger) setTimeout(() => this.showBanner(trigger), this.BANNER_DELAY);
    }
  },

  cacheElements() {
    this.installBtn = document.getElementById('pwa-install-btn');
    this.statusEl   = document.getElementById('pwa-install-status');
  },

  /* ============================================================
     SERVICE WORKER
     ============================================================ */
  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register(this.SW_PATH)
      .then(reg => {
        this.registration = reg;

        // Cek update saat ada SW baru terdeteksi
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateBanner();
            }
          });
        });

        // Cek update setiap 1 jam (untuk session panjang)
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(err => console.warn('[PWA] SW registration failed:', err));

    // Reload halaman saat controller baru aktif
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  },

  /* ============================================================
     EVENT BINDINGS
     ============================================================ */
  bindGlobalEvents() {
    // Android & desktop: native install prompt tersedia
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.refreshUI();
      if (!this.isDismissed() && !this.isInstalled()) {
        setTimeout(() => this.showBanner('android'), this.BANNER_DELAY);
      }
    });

    // Saat user berhasil install
    window.addEventListener('appinstalled', () => {
      localStorage.setItem(this.KEY_INSTALLED, '1');
      this.deferredPrompt = null;
      this.hideBanner();
      this.hideModal();
      this.refreshUI();
      this.toast('Aplikasi berhasil dipasang! 🎉', 'success');
    });

    // Tutup modal dengan ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('pwa-modal')) this.hideModal();
        if (document.getElementById('pwa-banner')) this.hideBanner();
      }
    });
  },

  bindInstallButton() {
    if (!this.installBtn) return;
    this.installBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleInstallClick();
    });
  },

  /* ============================================================
     UI REFRESH — Tombol berubah sesuai platform & status
     ============================================================ */
  refreshUI() {
    if (!this.installBtn) return;

    const labelEl = this.installBtn.querySelector('.pwa-btn-label');
    const iconEl  = this.installBtn.querySelector('.pwa-btn-icon');

    if (this.isInstalled()) {
      if (labelEl) labelEl.textContent = 'Aplikasi Sudah Terpasang';
      if (iconEl)  iconEl.textContent  = '✓';
      this.installBtn.disabled = true;
      this.installBtn.classList.add('pwa-installed');
      this.installBtn.setAttribute('aria-label', 'Aplikasi sudah terpasang di perangkat');
      if (this.statusEl) this.statusEl.textContent = 'Terpasang di perangkat ini';
      return;
    }

    this.installBtn.disabled = false;
    this.installBtn.classList.remove('pwa-installed');

    if (this.deferredPrompt) {
      if (labelEl) labelEl.textContent = 'Download Aplikasi';
      if (iconEl)  iconEl.textContent  = '⬇';
      if (this.statusEl) this.statusEl.textContent = 'Gratis · Tanpa Play Store · < 1 MB';
    } else if (this.isIOS()) {
      if (labelEl) labelEl.textContent = 'Pasang di iPhone';
      if (iconEl)  iconEl.textContent  = '';
      if (this.statusEl) this.statusEl.textContent = 'Lihat panduan singkat untuk iOS';
    } else {
      if (labelEl) labelEl.textContent = 'Download Aplikasi';
      if (iconEl)  iconEl.textContent  = '⬇';
      if (this.statusEl) this.statusEl.textContent = 'Gratis · Tanpa Play Store · < 1 MB';
    }
  },

  /* ============================================================
     INSTALL HANDLER
     ============================================================ */
  async handleInstallClick() {
    if (this.isInstalled()) {
      this.toast('Aplikasi sudah terpasang di perangkat Anda.', 'info');
      return;
    }

    // Android / Desktop dengan prompt native
    if (this.deferredPrompt) {
      try {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;
        if (outcome === 'accepted') {
          this.toast('Memasang aplikasi…', 'info');
        } else {
          this.toast('Pemasangan dibatalkan.', 'warning');
        }
        this.refreshUI();
      } catch (err) {
        console.warn('[PWA] install prompt error:', err);
        this.showModal(this.platform());
      }
      return;
    }

    // iOS atau browser tanpa beforeinstallprompt → tampilkan instruksi
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
        <button class="pwa-banner-close" data-pwa-action="dismiss" aria-label="Tutup banner pemasangan">×</button>
        <div class="pwa-banner-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="3"/>
            <line x1="12" y1="18" x2="12.01" y2="18"/>
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

    const banner = document.getElementById('pwa-banner');
    banner.addEventListener('click', (e) => {
      const action = e.target.closest('[data-pwa-action]')?.dataset.pwaAction;
      if (action === 'install') this.handleInstallClick();
      else if (action === 'modal') this.showModal(this.platform());
      else if (action === 'dismiss') this.dismiss();
    });

    requestAnimationFrame(() => banner.classList.add('show'));
  },

  hideBanner() {
    const banner = document.getElementById('pwa-banner');
    if (!banner) return;
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 320);
  },

  dismiss() {
    localStorage.setItem(this.KEY_DISMISSED, String(Date.now()));
    this.hideBanner();
  },

  /* ============================================================
     MODAL INSTRUKSI (iOS / fallback)
     ============================================================ */
  showModal(platform) {
    if (document.getElementById('pwa-modal')) return;
    this.lastFocused = document.activeElement;

    const isIOS = platform === 'ios';
    const title = isIOS ? 'Pasang di iPhone / iPad' : 'Pasang di Perangkat Anda';

    const steps = isIOS ? [
      { icon: this.svgShare(), text: 'Ketuk ikon <strong>Share</strong> di bilah bawah Safari.' },
      { icon: '➕',             text: 'Pilih <strong>Add to Home Screen</strong> dari menu.' },
      { icon: '✓',              text: 'Ketuk <strong>Add</strong> di kanan atas untuk konfirmasi.' }
    ] : [
      { icon: '⋮', text: 'Buka menu browser (titik tiga di pojok).' },
      { icon: '⬇', text: 'Pilih <strong>Install app</strong> atau <strong>Add to Home Screen</strong>.' },
      { icon: '✓', text: 'Konfirmasi pemasangan, aplikasi akan muncul di beranda.' }
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
      if (e.target === modal || e.target.closest('[data-pwa-action="close"]')) this.hideModal();
    });

    // Focus trap sederhana
    requestAnimationFrame(() => {
      modal.classList.add('show');
      const focusable = modal.querySelector('button');
      if (focusable) focusable.focus();
    });
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
     UPDATE BANNER (saat SW baru tersedia)
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
    const el = document.getElementById('pwa-update');
    el.addEventListener('click', (e) => {
      const action = e.target.closest('[data-pwa-action]')?.dataset.pwaAction;
      if (action === 'update') this.applyUpdate();
      else if (action === 'close') { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }
    });
    requestAnimationFrame(() => el.classList.add('show'));
  },

  applyUpdate() {
    const reg = this.registration;
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  },

  /* ============================================================
     CONNECTION WATCH (online/offline indicator)
     ============================================================ */
  setupConnectionWatch() {
    const update = () => {
      if (navigator.onLine) {
        this.removeOfflineBadge();
      } else {
        this.showOfflineBadge();
      }
    };
    window.addEventListener('online', () => {
      this.removeOfflineBadge();
      this.toast('Koneksi internet kembali pulih.', 'success');
    });
    window.addEventListener('offline', () => {
      this.showOfflineBadge();
      this.toast('Anda sedang offline. Konten dari cache tetap tersedia.', 'warning');
    });
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
     HELPERS
     ============================================================ */
  toast(msg, type = 'info') {
    if (typeof Utils !== 'undefined' && typeof Utils.notify === 'function') {
      Utils.notify(msg, type);
      return;
    }
    console.log(`[PWA:${type}] ${msg}`);
  },

  svgShare() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>`;
  }
};

/* ---------- BOOTSTRAP ---------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PWA.init());
} else {
  PWA.init();
}