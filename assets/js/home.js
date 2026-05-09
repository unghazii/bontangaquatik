// Logic halaman Home — render section kelas & jadwal dari CONFIG
document.addEventListener('DOMContentLoaded', () => {
  Utils.mountNavbar('home');

  renderClassesSection();
  renderScheduleSection();

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
