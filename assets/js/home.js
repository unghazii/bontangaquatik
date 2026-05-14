// Logic halaman Home — render section kelas & jadwal dari CONFIG
document.addEventListener('DOMContentLoaded', () => {
  Utils.mountNavbar('home');

  renderClassesSection();
  renderScheduleSection();
  loadBerita();

  Utils.mountFooter();

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // Update kontak
  document.querySelectorAll('[data-wa]').forEach(a => {
    a.href = Utils.waLink(CONFIG.CONTACT.whatsapp, 'Halo Bontang Aquatik, saya tertarik untuk bergabung kelas pelatihan renang. Mohon informasinya.');
  });
});

/* ===================== KELAS TERSEDIA ===================== */
function renderClassesSection() {
  const container = document.getElementById('classes-grid');
  if (!container) return;

  container.innerHTML = Object.entries(CONFIG.KELAS_DETAIL).map(([nama, d]) => `
    <div class="class-card class-${d.color} ${d.recommended ? 'class-recommended' : ''}">
      ${d.recommended ? '<div class="class-ribbon">⭐ PALING POPULER</div>' : ''}
      <div class="class-card-head">
        <div class="class-mascot">${d.mascot}</div>
        <h3>${nama}</h3>
        <p class="class-team">${d.mascot_name}</p>
      </div>
      <ul class="class-features">
        ${d.fasilitas.map(f => `<li>✓ ${f}</li>`).join('')}
      </ul>
      <div class="class-meta">
        <div>📍 ${d.lokasi}</div>
        <div>📅 ${d.frekuensi}</div>
        <div>🕐 ${d.jadwal_label}</div>
      </div>
      <a href="registrasi.html" class="btn btn-block ${d.recommended ? 'btn-accent' : 'btn-primary'}">
        Pilih ${nama}
      </a>
    </div>
  `).join('');
}

/* ===================== JADWAL LATIHAN (KIDS-FRIENDLY) ===================== */
function renderScheduleSection() {
  const container = document.getElementById('schedule-grid');
  if (!container) return;

  // Day name → emoji
  const dayEmoji = {
    'Senin': '🌅', 'Selasa': '☀️', 'Rabu': '🌤️',
    'Kamis': '⛅', 'Jumat': '🌟', 'Sabtu': '🎉', 'Minggu': '🌈'
  };

  container.innerHTML = Object.entries(CONFIG.WEEKLY_SCHEDULE).map(([nama, sesi]) => {
    const detail = CONFIG.KELAS_DETAIL[nama];
    return `
      <div class="team-card team-${detail.color} ${detail.recommended ? 'team-recommended' : ''}">
        ${detail.recommended ? '<div class="team-ribbon">🏆 FAVORIT</div>' : ''}
        <div class="team-mascot-big">${detail.mascot}</div>
        <h3 class="team-name">${detail.mascot_name}</h3>
        <div class="team-grup">${nama}</div>
        <ul class="team-schedule">
          ${sesi.map(s => `
            <li class="schedule-item">
              <span class="schedule-day">${dayEmoji[s.hari] || '📅'} ${s.hari}</span>
              <span class="schedule-time">${s.jam}</span>
            </li>
          `).join('')}
        </ul>
        <div class="team-location">📍 ${detail.lokasi}</div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   SECTION BERITA — Carousel horizontal
   - Section hidden by default; ditampilkan hanya jika ada data
   - Auto-loop swipe via scroll-snap
   ============================================================ */
async function loadBerita() {
  const section = document.getElementById('berita');
  const carousel = document.getElementById('news-carousel');
  if (!section || !carousel) return;

  const res = await API.call('getActiveBerita');
  if (!res.success || !res.data || res.data.length === 0) {
    // Hide section seluruhnya jika tidak ada berita (Request 4)
    section.classList.add('hidden');
    return;
  }

  const berita = res.data;
  carousel.innerHTML = berita.map((b, i) => `
    <article class="news-card" data-index="${i}">
      <div class="news-card-head">
        <div class="news-date">${Utils.escapeHtml(Utils.formatDateLong(b.Tanggal))}</div>
        <div class="news-badge">📢 Berita</div>
      </div>
      <h3 class="news-title">${Utils.escapeHtml(b.Judul)}</h3>
      <p class="news-desc">${Utils.escapeHtml(b.Deskripsi || '').substring(0, 200)}${(b.Deskripsi || '').length > 200 ? '…' : ''}</p>
      ${b.Link ? `<a href="${Utils.escapeHtml(b.Link)}" target="_blank" rel="noopener" class="btn btn-accent btn-sm news-link">Baca Selengkapnya →</a>` : `<span class="text-muted" style="font-size:12px;">Tidak ada link lanjutan</span>`}
    </article>
  `).join('');

  // Render dots
  const dotsContainer = document.getElementById('news-dots');
  dotsContainer.innerHTML = berita.map((_, i) =>
    `<button class="news-dot ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="Berita ${i + 1}"></button>`
  ).join('');

  // Show section
  section.classList.remove('hidden');

  // Carousel logic
  const dots = dotsContainer.querySelectorAll('.news-dot');
  const cards = carousel.querySelectorAll('.news-card');

  const scrollToIdx = (idx) => {
    const card = cards[idx];
    if (card) carousel.scrollTo({ left: card.offsetLeft - 12, behavior: 'smooth' });
  };

  dots.forEach(d => d.addEventListener('click', () => scrollToIdx(Number(d.dataset.idx))));

  // Update dot active on scroll
  let scrollTimer;
  carousel.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      let activeIdx = 0;
      let minDist = Infinity;
      cards.forEach((c, i) => {
        const dist = Math.abs(c.offsetLeft - carousel.scrollLeft - 12);
        if (dist < minDist) { minDist = dist; activeIdx = i; }
      });
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
    }, 100);
  });

  // Nav buttons
  document.getElementById('news-prev').addEventListener('click', () => {
    const active = Array.from(dots).findIndex(d => d.classList.contains('active'));
    scrollToIdx(Math.max(0, active - 1));
  });
  document.getElementById('news-next').addEventListener('click', () => {
    const active = Array.from(dots).findIndex(d => d.classList.contains('active'));
    scrollToIdx(Math.min(berita.length - 1, active + 1));
  });
}