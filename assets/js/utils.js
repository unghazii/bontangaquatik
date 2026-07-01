/* ============================================
   THEME SWITCHER (anti-FOUC: apply sebelum DOM ready)
   ============================================ */
const Theme = {
  KEY: 'swim_theme',
  get() { return localStorage.getItem(this.KEY) || this.systemPreference(); },
  systemPreference() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  },
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.KEY, theme);
    const isDark = theme === 'dark';
    // Backward-compat: tombol emoji lama (jika masih ada di halaman).
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = isDark ? '☀️' : '🌙';
    // Switch modern: perbarui state aria + kelas untuk animasi thumb.
    document.querySelectorAll('.theme-switch').forEach(sw => {
      sw.classList.toggle('is-dark', isDark);
      sw.setAttribute('aria-checked', isDark ? 'true' : 'false');
    });
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta);
    }
    meta.content = isDark ? '#0B0F12' : '#FFFFFF';
  },
  toggle() {
    const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    this.apply(next);
  },
  init() { this.apply(this.get()); }
};
Theme.init();

/* ============================================
    UTILS
   ============================================ */
const Utils = {
  notify(msg, type = 'info', duration = 3500) {
    let container = document.getElementById('notif-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notif-container';
      document.body.appendChild(container);
    }
    const notif = document.createElement('div');
    notif.className = `notif ${type}`;
    notif.textContent = msg;
    container.appendChild(notif);
    setTimeout(() => {
      notif.classList.add('fadeout');
      setTimeout(() => notif.remove(), 300);
    }, duration);
  },

  showLoader(show = true) {
    let loader = document.getElementById('loader-overlay');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'loader-overlay';
      loader.className = 'loader-overlay';
      loader.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(loader);
    }
    loader.classList.toggle('active', show);
  },

  formatDate(d) {
    if (!d) return '-';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date.getTime())) return d;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  },

  formatDateLong(d) {
    if (!d) return '-';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date.getTime())) return d;
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  },

  formatDateInput(d) {
    if (!d) return '';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  /** Tambahkan N bulan ke sebuah Date dan return Date baru. */
  addMonths(date, months) {
    const d = new Date(date.getTime());
    const targetMonth = d.getMonth() + months;
    d.setMonth(targetMonth);
    // handle overflow (mis. 31 Jan + 1 bulan → 28/29 Feb, bukan 3 Mar)
    if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) d.setDate(0);
    return d;
  },

  /** Hitung usia (tahun) dari tanggal lahir */
  calculateUsia(tanggalLahir) {
    if (!tanggalLahir) return 0;
    const lahir = new Date(tanggalLahir);
    if (isNaN(lahir.getTime())) return 0;
    const now = new Date();
    let usia = now.getFullYear() - lahir.getFullYear();
    const m = now.getMonth() - lahir.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < lahir.getDate())) usia--;
    return usia;
  },

  /** Hitung kelompok umur per 1 Jan tahun ini */
  calculateKelompokUmur(tanggalLahir) {
    if (!tanggalLahir) return '';
    const lahir = new Date(tanggalLahir);
    if (isNaN(lahir.getTime())) return '';
    const refDate = new Date(new Date().getFullYear(), 0, 1);
    let umur = refDate.getFullYear() - lahir.getFullYear();
    const m = refDate.getMonth() - lahir.getMonth();
    if (m < 0 || (m === 0 && refDate.getDate() < lahir.getDate())) umur--;
    if (umur > 19) return 'Senior';
    if (umur >= 16) return 'Group 1';
    if (umur >= 14) return 'Group 2';
    if (umur >= 12) return 'Group 3';
    if (umur >= 10) return 'Group 4';
    if (umur >= 8)  return 'Group 5';
    return 'Group 6';
  },

  /** Validasi & normalisasi waktu mm:ss:ms (digit auto-pad) */
  normalizeWaktu(input) {
    if (!input) return '';
    const cleaned = String(input).trim();
    if (cleaned === '' || cleaned === '-') return '';
    // Accept: mm:ss:ms / mm.ss.ms / mm:ss / single number etc
    const parts = cleaned.split(/[:.]/);
    if (parts.length < 2) return cleaned;
    const mm = String(parts[0] || '00').padStart(2, '0');
    const ss = String(parts[1] || '00').padStart(2, '0');
    const ms = String(parts[2] || '00').padStart(2, '0');
    return `${mm}.${ss}.${ms}`;
  },

  formatBool(v) { return (v === true || String(v).toUpperCase() === 'TRUE') ? 'TRUE' : 'FALSE'; },

  confirm(message) {
    return new Promise(resolve => {
      const html = `
        <div class="modal-backdrop active" id="confirm-modal">
          <div class="modal" style="max-width:400px;">
            <div class="modal-body"><p style="font-size:15px;">${message}</p></div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-confirm="no">Batal</button>
              <button class="btn btn-danger" data-confirm="yes">Ya, Lanjutkan</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      const modal = document.getElementById('confirm-modal');
      modal.querySelectorAll('[data-confirm]').forEach(b => {
        b.addEventListener('click', () => {
          modal.remove();
          resolve(b.dataset.confirm === 'yes');
        });
      });
    });
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  /** WhatsApp link helper */
  waLink(phone, message) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  },

  /* ============================================
      NAVBAR
     ============================================ */
  mountNavbar(activeRoute = '') {
    const session = Auth.getSession();
    const isDark = Theme.get() === 'dark';

    const themeSwitchHtml = (!session) ? `
<button
    type="button"
    id="theme-switch"
    class="theme-switch ${isDark ? 'is-dark' : ''}"
    aria-label="Toggle Theme"
    title="Toggle Theme">

    <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">

        <circle cx="12" cy="12" r="5"/>

        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>

        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>

        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>

        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>

    </svg>

    <svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor">

        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z"/>

    </svg>

</button>
` : '';

    let userBlock = '';
    if (session && session.role === 'peserta') {
      const gearSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
      userBlock = `
        <a href="profile.html" class="user-info user-info-link ${activeRoute === 'profile' ? 'active' : ''}" title="Lihat & ubah profil"><span> ${this.escapeHtml(session.data.nama || session.data.username)}</span></a>
        <button class="theme-toggle nav-settings-btn" onclick="window.PesertaSettings && PesertaSettings.open()" title="Pengaturan" aria-label="Pengaturan">${gearSvg}</button>
        <button class="btn btn-sm btn-secondary" onclick="Auth.logout()">Logout</button>`;
    } else if (session && session.role === 'admin') {
      userBlock = `
        <div class="user-info"><span> ${this.escapeHtml(session.data.username)}</span></div>
        <button class="btn btn-sm btn-secondary" onclick="Auth.logout()">Logout</button>`;
    } else {
      userBlock = `
        <a href="login.html" class="nav-link ${activeRoute === 'login' ? 'active' : ''}">Login</a>
        <a href="registrasi.html" class="btn btn-accent btn-sm nav-cta">Daftar Sekarang</a>`;
    }

    const html = `
      <nav class="navbar">
        <div class="navbar-inner">
          <a href="index.html" class="navbar-brand">
            <div class="navbar-brand-logo">
              <img src="assets/images/logo.webp" alt="${CONFIG.BRAND_NAME}" onerror="this.style.display='none';this.parentElement.textContent='🏊';">
            </div>
            <span>${CONFIG.BRAND_NAME}</span>
          </a>
          <div class="navbar-menu" id="navbar-menu">
            <div class="navbar-links">
              <a href="index.html" class="nav-link ${activeRoute === 'home' ? 'active' : ''}">Home</a>
              ${session && session.role === 'peserta' ? `<a href="peserta.html" class="nav-link ${activeRoute === 'peserta' ? 'active' : ''}">Dashboard</a>` : ''}
              ${session && session.role === 'admin' ? `<a href="admin.html" class="nav-link ${activeRoute === 'admin' ? 'active' : ''}">Admin Panel</a>` : ''}
            </div>
            <div class="navbar-actions">
              ${userBlock}
            </div>
          </div>
          <div class="navbar-end">
            ${themeSwitchHtml}
            <button class="navbar-toggle" id="navbar-toggle" aria-label="Menu" aria-expanded="false">☰</button>
          </div>
        </div>
      </nav>`;
    document.body.insertAdjacentHTML('afterbegin', html);

    const toggleBtn = document.getElementById('navbar-toggle');
    if (toggleBtn) toggleBtn.addEventListener('click', () => {
      const menu = document.getElementById('navbar-menu');
      const shown = menu.classList.toggle('show');
      toggleBtn.setAttribute('aria-expanded', shown ? 'true' : 'false');
    });
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) themeSwitch.addEventListener('click', () => Theme.toggle());
  },

  /* ============================================
      FOOTER (dengan maps carousel — request 5)
     ============================================ */
  mountFooter() {
    const locs = CONFIG.LOCATIONS;
    const slides = locs.map((loc, i) => `
      <div class="map-slide" data-index="${i}">
        <div class="map-frame">
          <iframe src="${loc.embedSrc}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${loc.name}"></iframe>
          <a href="${loc.mapsUrl}" target="_blank" rel="noopener" class="map-open-btn">
            📍 Buka di Google Maps
          </a>
        </div>
        <div class="map-caption">
          <strong>${loc.name}</strong>
          <span>${loc.address}</span>
        </div>
      </div>`).join('');

    const dots = locs.map((_, i) =>
      `<button class="map-dot ${i === 0 ? 'active' : ''}" data-target="${i}" aria-label="Lokasi ${i + 1}"></button>`
    ).join('');

    const html = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-about">
              <h4>${CONFIG.BRAND_NAME}</h4>
              <p>Klub pelatihan renang profesional di Bontang dengan pelatih berpengalaman. Latihan lebih terstruktur dan menyenangkan bersama Bontang Aquatik Swimming Club.</p>
              <p>📱 ${CONFIG.CONTACT.whatsapp}<br>✉️ ${CONFIG.CONTACT.email}</p>
            </div>
            <div class="footer-maps">
              <h4>📍 Lokasi Latihan</h4>
              <div class="maps-carousel" id="maps-carousel">${slides}</div>
              <div class="map-dots" id="map-dots">${dots}</div>
            </div>
          </div>
          <div class="footer-bottom">
            © ${new Date().getFullYear()} ${CONFIG.BRAND_NAME} • Klub Renang Bontang • All rights reserved.
          </div>
        </div>
      </footer>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Maps carousel logic
    const carousel = document.getElementById('maps-carousel');
    const dotEls = document.querySelectorAll('#map-dots .map-dot');
    if (carousel && dotEls.length) {
      // Klik dot → scroll ke slide
      dotEls.forEach(dot => {
        dot.addEventListener('click', () => {
          const idx = Number(dot.dataset.target);
          const slide = carousel.querySelector(`.map-slide[data-index="${idx}"]`);
          if (slide) carousel.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
        });
      });
      // Update dot saat di-swipe
      carousel.addEventListener('scroll', () => {
        const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
        dotEls.forEach((d, i) => d.classList.toggle('active', i === idx));
      });
    }
  }
};
