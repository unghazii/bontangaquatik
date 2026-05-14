/* ============================================================
   PWA INSTALL PROMPT
   - Android: tangkap event beforeinstallprompt, tampilkan tombol custom
   - iOS: tampilkan banner instruksi manual (karena tidak ada prompt API)
   - Persist dismissal di localStorage agar tidak muncul terus-menerus
   ============================================================ */
const PWA = {
  KEY_DISMISSED: 'pwa_install_dismissed',
  KEY_INSTALLED: 'pwa_installed',
  deferredPrompt: null,

  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  },
  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  },
  isDismissed() {
    const dismissed = localStorage.getItem(this.KEY_DISMISSED);
    if (!dismissed) return false;
    // Tampilkan lagi setelah 7 hari
    const days = (Date.now() - Number(dismissed)) / (1000 * 60 * 60 * 24);
    return days < 7;
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(err => {
        console.log('SW registration failed:', err);
      });
    }
  },

  init() {
    if (this.isStandalone()) {
      localStorage.setItem(this.KEY_INSTALLED, '1');
      return;
    }
    this.registerServiceWorker();

    // Android & desktop browsers
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (!this.isDismissed()) {
        setTimeout(() => this.showBanner('android'), 1500);
      }
    });

    window.addEventListener('appinstalled', () => {
      localStorage.setItem(this.KEY_INSTALLED, '1');
      this.hideBanner();
      if (typeof Utils !== 'undefined') Utils.notify('Aplikasi berhasil dipasang! 🎉', 'success');
    });

    // iOS: tampilkan manual instruction
    if (this.isIOS() && !this.isDismissed()) {
      setTimeout(() => this.showBanner('ios'), 2000);
    }
  },

  showBanner(platform) {
    if (document.getElementById('pwa-banner')) return;
    const icon = platform === 'ios' ? '📲' : '🏊';
    const instructions = platform === 'ios'
      ? `Ketuk tombol <strong>Share</strong> <span style="color:var(--color-primary)">⬆️</span> di Safari, lalu pilih <strong>"Add to Home Screen"</strong> untuk memasang aplikasi.`
      : `Pasang aplikasi <strong>Bontang Aquatik</strong> di beranda ponsel Anda untuk akses lebih cepat dan pengalaman seperti aplikasi native.`;

    const actionBtn = platform === 'ios'
      ? `<button class="pwa-btn-primary" onclick="PWA.dismiss()">Mengerti</button>`
      : `<button class="pwa-btn-primary" onclick="PWA.install()">Pasang Sekarang</button>
         <button class="pwa-btn-ghost" onclick="PWA.dismiss()">Nanti</button>`;

    const html = `
      <div id="pwa-banner" class="pwa-banner" role="dialog" aria-label="Install aplikasi">
        <button class="pwa-close" onclick="PWA.dismiss()" aria-label="Tutup">×</button>
        <div class="pwa-banner-icon">${icon}</div>
        <div class="pwa-banner-body">
          <h4>${platform === 'ios' ? 'Pasang di Beranda' : 'Pasang Aplikasi'}</h4>
          <p>${instructions}</p>
          <div class="pwa-actions">${actionBtn}</div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    requestAnimationFrame(() => {
      const banner = document.getElementById('pwa-banner');
      if (banner) banner.classList.add('show');
    });
  },

  async install() {
    if (!this.deferredPrompt) {
      this.dismiss();
      return;
    }
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    if (outcome === 'accepted') {
      this.hideBanner();
    } else {
      this.dismiss();
    }
  },

  dismiss() {
    localStorage.setItem(this.KEY_DISMISSED, String(Date.now()));
    this.hideBanner();
  },

  hideBanner() {
    const banner = document.getElementById('pwa-banner');
    if (banner) {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 300);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => PWA.init());
