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
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta);
    }
    meta.content = theme === 'dark' ? '#0B0F12' : '#FFFFFF';
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
    const themeIcon = Theme.get() === 'dark' ? '☀️' : '🌙';

    let userBlock = '';
    if (session && session.role === 'peserta') {
      userBlock = `
        <div class="user-info"><span>👤 ${this.escapeHtml(session.data.nama || session.data.username)}</span></div>
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
              <img src="assets/images/logo.jpeg" alt="${CONFIG.BRAND_NAME}" onerror="this.style.display='none';this.parentElement.textContent='🏊';">
            </div>
            <span>${CONFIG.BRAND_NAME}</span>
          </a>
          <button class="navbar-toggle" id="navbar-toggle" aria-label="Menu">☰</button>
          <div class="navbar-menu" id="navbar-menu">
            <div class="navbar-links">
              <a href="index.html" class="nav-link ${activeRoute === 'home' ? 'active' : ''}">Home</a>
              ${session && session.role === 'peserta' ? `<a href="peserta.html" class="nav-link ${activeRoute === 'peserta' ? 'active' : ''}">Dashboard</a>` : ''}
              ${session && session.role === 'admin' ? `<a href="admin.html" class="nav-link ${activeRoute === 'admin' ? 'active' : ''}">Admin Panel</a>` : ''}
            </div>
            <div class="navbar-actions">
              <button id="theme-toggle-btn" class="theme-toggle" aria-label="Ganti tema" title="Ganti tema gelap/terang">${themeIcon}</button>
              ${userBlock}
            </div>
          </div>
        </div>
      </nav>`;
    document.body.insertAdjacentHTML('afterbegin', html);

    document.getElementById('navbar-toggle').addEventListener('click', () => {
      document.getElementById('navbar-menu').classList.toggle('show');
    });
    document.getElementById('theme-toggle-btn').addEventListener('click', () => Theme.toggle());
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
