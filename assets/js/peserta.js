// Cache jadwal untuk filter/sort tanpa re-fetch ke server
let cacheJadwalPeserta = [];
document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireRole('peserta')) return;
  Utils.mountNavbar('peserta');

  const user = Auth.getUser();
  document.getElementById('user-nama').textContent = user.nama;
  document.getElementById('user-kelas').textContent = user.kelas || 'Belum ditentukan';

  document.getElementById('btn-rapor').addEventListener('click', openRaporModal);
  // Bind filter & sort listeners
    ['search-jadwal-peserta',
    'filter-jadwal-peserta-status',
    'filter-jadwal-peserta-kehadiran',
    'sort-jadwal-peserta'].forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', applyJadwalPesertaFilters);
      el.addEventListener('change', applyJadwalPesertaFilters);
    });

  await loadDashboard();
});

async function loadDashboard() {
  const user = Auth.getUser();
  const [jadwalRes, hadirRes] = await Promise.all([
    API.call('getJadwalPeserta', { id_peserta: user.id }),
    API.call('getKehadiranPeserta', { id_peserta: user.id })
  ]);
  if (hadirRes.success) {
    const d = hadirRes.data;
    document.getElementById('stat-total').textContent = d.total_jadwal;
    document.getElementById('stat-hadir').textContent = d.total_hadir;
    document.getElementById('stat-persen').textContent = d.persentase + '%';
    document.getElementById('progress-fill').style.width = d.persentase + '%';
  }
  if (jadwalRes.success) {
    cacheJadwalPeserta = jadwalRes.data || [];
    applyJadwalPesertaFilters();
  } else {
    Utils.notify(jadwalRes.message || 'Gagal memuat jadwal', 'error');
  }
}

/* ===================== FILTER & SORT JADWAL PESERTA ===================== */
function applyJadwalPesertaFilters() {
  const q = (document.getElementById('search-jadwal-peserta').value || '').toLowerCase();
  const statusF = document.getElementById('filter-jadwal-peserta-status').value;
  const kehadiranF = document.getElementById('filter-jadwal-peserta-kehadiran').value;
  const sort = document.getElementById('sort-jadwal-peserta').value;

  let list = cacheJadwalPeserta.filter(j => {
    // Search: tanggal (tampilan), pukul, lokasi, kelas
    const haystack = [
      Utils.formatDate(j.Tanggal).toLowerCase(),
      String(j.Tanggal || '').toLowerCase(),
      (j.Pukul || '').toLowerCase(),
      (j.Lokasi || '').toLowerCase(),
      (j.Kelas || '').toLowerCase()
    ].join(' ');
    const matchSearch = !q || haystack.includes(q);

    // Status jadwal (Aktif/Pending/Cancel)
    const matchStatus = !statusF || j.Status === statusF;

    // Status kehadiran peserta untuk jadwal ini
    let myStatus = 'belum';
    if (j.sudah_absen) myStatus = j.status_kehadiran; // 'hadir' atau 'izin'
    const matchKehadiran = !kehadiranF || myStatus === kehadiranF;

    return matchSearch && matchStatus && matchKehadiran;
  });

  // Sorting
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  list.sort((a, b) => {
    const da = new Date(a.Tanggal);
    const db = new Date(b.Tanggal);
    if (sort === 'tanggal-asc') return da - db;
    if (sort === 'upcoming') {
      // Yang ≥ hari ini di atas (asc); yang sudah lewat di bawah (desc)
      const aFuture = da >= now;
      const bFuture = db >= now;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      return aFuture ? (da - db) : (db - da);
    }
    return db - da; // default: tanggal-desc
  });

  // Update counter
  const counter = document.getElementById('jadwal-count');
  if (counter) {
    const total = cacheJadwalPeserta.length;
    counter.textContent = list.length === total
      ? `${total} jadwal`
      : `${list.length} dari ${total} jadwal`;
  }

  renderJadwal(list);
}
function renderJadwal(jadwals) {
  const container = document.getElementById('jadwal-list');
    if (!jadwals || jadwals.length === 0) {
      const isFiltered = cacheJadwalPeserta.length > 0;
      container.innerHTML = isFiltered
        ? `<div class="empty-state">
            <div class="icon">🔍</div>
            <p>Tidak ada jadwal yang cocok dengan filter Anda.</p>
            <p class="text-muted" style="font-size:13px;margin-top:6px;">Coba ubah kata kunci atau reset filter.</p>
          </div>`
        : `<div class="empty-state">
            <div class="icon">📅</div>
            <p>Belum ada jadwal pelatihan untuk kelas Anda.</p>
            <p class="text-muted" style="font-size:13px;margin-top:6px;">Jadwal akan otomatis terbuat setelah admin mengkonfirmasi pembayaran.</p>
          </div>`;
      return;
    }

  // jadwals.sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal));

  container.innerHTML = `
    <div class="jadwal-grid">
      ${jadwals.map(j => {
        const status = String(j.Status).toLowerCase();
        const badgeClass = status === 'aktif' ? 'badge-success' : status === 'pending' ? 'badge-warning' : 'badge-danger';
        const sudahRespond = j.sudah_absen;
        const kehadiranStatus = j.status_kehadiran;

        let actionHtml;
        if (sudahRespond) {
          if (kehadiranStatus === 'hadir') {
            actionHtml = `<button class="btn btn-sm btn-success" disabled>✓ Sudah Absen</button>`;
          } else {
            actionHtml = `<button class="btn btn-sm btn-secondary" disabled>📝 Sudah Izin</button>`;
          }
        } else if (status === 'aktif') {
          actionHtml = `<button class="btn btn-sm btn-accent" onclick="openAbsenModal('${j.Id_Jadwal}')">Absen / Izin</button>`;
        } else {
          actionHtml = `<button class="btn btn-sm btn-secondary" disabled>Belum Dibuka</button>`;
        }

        return `
          <div class="jadwal-card">
            <div class="jadwal-date">${Utils.escapeHtml(Utils.formatDate(j.Tanggal))}</div>
            <h4>${Utils.escapeHtml(j.Kelas)}</h4>
            <div class="jadwal-info">
              <span>🕐 ${Utils.escapeHtml(j.Pukul)}</span>
              <span>📍 ${Utils.escapeHtml(j.Lokasi)}</span>
            </div>
            <div class="jadwal-actions">
              <span class="badge ${badgeClass}">${Utils.escapeHtml(j.Status)}</span>
              ${actionHtml}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

/* ===================== ABSEN MODAL ===================== */
function openAbsenModal(idJadwal) {
  const eq = CONFIG.EQUIPMENT_INFO;
  const html = `
    <div class="modal-backdrop active" id="m-absen">
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <h3>📋 Konfirmasi Absensi</h3>
          <button class="modal-close" onclick="closeAbsenModal()">×</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom:14px;">Sebelum melakukan absensi, mohon perhatikan informasi peralatan dan persiapan latihan berikut:</p>

          <div class="equipment-section">
            <h4>🏊 Peralatan Pribadi Selama Latihan</h4>

            <details class="equipment-detail" open>
              <summary><strong>A. Pemula</strong></summary>
              <ul>${eq.pemula.map(i => `<li>${Utils.escapeHtml(i)}</li>`).join('')}</ul>
            </details>

            <details class="equipment-detail">
              <summary><strong>B. Tingkat Lanjut</strong> <small>(menguasai ≥ 2 gaya, 25 m)</small></summary>
              <ul>${eq.lanjut.map(i => `<li>${Utils.escapeHtml(i)}</li>`).join('')}</ul>
            </details>

            <details class="equipment-detail">
              <summary><strong>C. Perlengkapan Lain</strong></summary>
              <ul>${eq.lain.map(i => `<li>${Utils.escapeHtml(i)}</li>`).join('')}</ul>
            </details>

            <details class="equipment-detail">
              <summary><strong>D. Informasi Tambahan</strong></summary>
              <ul>${eq.tambahan.map(i => `<li>${Utils.escapeHtml(i)}</li>`).join('')}</ul>
            </details>
          </div>

          <label class="checkbox-row">
            <input type="checkbox" id="agree-checkbox" onchange="toggleAbsenSubmit()">
            <span>Saya telah memahami dan akan mempersiapkan peralatan yang diperlukan untuk latihan.</span>
          </label>

          <div id="izin-section" class="hidden">
            <hr class="divider">
            <label>Alasan tidak hadir <span class="text-muted">(wajib diisi)</span></label>
            <textarea id="catatan-izin" class="form-control" rows="3" placeholder="Contoh: Sakit, ada acara keluarga, dll..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeAbsenModal()">Batal</button>
          <button class="btn btn-warning" id="btn-izin" onclick="toggleIzinForm()">📝 Izin</button>
          <button class="btn btn-primary" id="btn-confirm-absen" onclick="submitAbsen('${idJadwal}')" disabled>✓ Ya, Saya Hadir</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeAbsenModal() {
  const m = document.getElementById('m-absen');
  if (m) m.remove();
}

function toggleAbsenSubmit() {
  const checked = document.getElementById('agree-checkbox').checked;
  const btn = document.getElementById('btn-confirm-absen');
  // Tombol "Ya, Saya Hadir" hanya aktif jika checkbox dicentang DAN izin section tidak aktif
  const izinActive = !document.getElementById('izin-section').classList.contains('hidden');
  btn.disabled = !(checked && !izinActive);
}

function toggleIzinForm() {
  const sec = document.getElementById('izin-section');
  const btnConfirm = document.getElementById('btn-confirm-absen');
  const btnIzin = document.getElementById('btn-izin');
  const willActivate = sec.classList.contains('hidden');

  sec.classList.toggle('hidden');
  if (willActivate) {
    // mode IZIN aktif: ubah tombol confirm menjadi "Kirim Izin"
    btnConfirm.textContent = '📤 Kirim Izin';
    btnConfirm.disabled = false;
    btnConfirm.onclick = () => submitIzin();
    btnIzin.textContent = '↩ Kembali';
  } else {
    btnConfirm.textContent = '✓ Ya, Saya Hadir';
    btnIzin.textContent = '📝 Izin';
    btnConfirm.onclick = () => submitAbsen(btnConfirm.dataset.jadwalId);
    toggleAbsenSubmit();
  }
}

async function submitAbsen(idJadwal) {
  if (!document.getElementById('agree-checkbox').checked) {
    Utils.notify('Mohon centang persetujuan peralatan terlebih dahulu', 'warning');
    return;
  }
  const user = Auth.getUser();
  const res = await API.call('absen', { id_jadwal: idJadwal, id_peserta: user.id });
  if (res.success) {
    Utils.notify(res.message, 'success');
    closeAbsenModal();
    await loadDashboard();
  } else {
    Utils.notify(res.message, 'error');
  }
}

async function submitIzin() {
  const catatan = document.getElementById('catatan-izin').value.trim();
  if (!catatan) {
    Utils.notify('Mohon isi alasan tidak hadir', 'warning');
    return;
  }
  // Cari ID jadwal dari modal yang sedang terbuka
  const btn = document.getElementById('btn-confirm-absen');
  // Kita simpan ID di parent modal saat open
  const modal = document.getElementById('m-absen');
  const idJadwal = modal.dataset.jadwalId || (btn && btn.dataset.jadwalId);
  if (!idJadwal) {
    Utils.notify('Gagal mengidentifikasi jadwal', 'error');
    return;
  }
  const user = Auth.getUser();
  const res = await API.call('izin', { id_jadwal: idJadwal, id_peserta: user.id, catatan: catatan });
  if (res.success) {
    Utils.notify(res.message, 'success');
    closeAbsenModal();
    await loadDashboard();
  } else {
    Utils.notify(res.message, 'error');
  }
}

// Hook agar dataset.jadwalId tersimpan di modal
const _origOpen = openAbsenModal;
openAbsenModal = function(idJadwal) {
  _origOpen(idJadwal);
  const modal = document.getElementById('m-absen');
  if (modal) modal.dataset.jadwalId = idJadwal;
  const btn = document.getElementById('btn-confirm-absen');
  if (btn) btn.dataset.jadwalId = idJadwal;
};

/* ===================== RAPOR MODAL ===================== */
async function openRaporModal() {
  const user = Auth.getUser();
  const res = await API.call('getRaporPeserta', { id_peserta: user.id });

  let bodyHtml;
  if (!res.success || !res.data) {
    bodyHtml = `
      <div class="rapor-empty">
        <div class="icon">📋</div>
        <h4>Rapor Belum Tersedia</h4>
        <p>Pelatih belum mengunggah rapor latihan Anda. Silakan cek kembali nanti — biasanya rapor diperbarui setelah evaluasi periode latihan.</p>
        <p class="text-muted" style="font-size:13px;">Jika Anda merasa ada kekeliruan, hubungi pelatih melalui WhatsApp.</p>
      </div>`;
  } else {
    const r = res.data;
    bodyHtml = `
      <div class="rapor-content">
        <div class="rapor-section">
          <h4>👤 Identitas Peserta</h4>
          <div class="rapor-row"><span>Nama</span><strong>${Utils.escapeHtml(user.nama)}</strong></div>
          <div class="rapor-row"><span>Usia</span><strong>${Utils.escapeHtml(user.usia || '-')} tahun</strong></div>
          <div class="rapor-row"><span>Kelas</span><strong>${Utils.escapeHtml(user.kelas)}</strong></div>
          <div class="rapor-row"><span>Periode</span><strong>${Utils.escapeHtml(user.tanggal_mulai)} → ${Utils.escapeHtml(user.tanggal_akhir)}</strong></div>
        </div>
        <div class="rapor-section">
          <h4>📊 Penilaian Pelatih</h4>
          <div class="rapor-grade">
            <div class="grade-nilai">${Utils.escapeHtml(r.Nilai || '-')}</div>
            <div class="grade-predikat">${Utils.escapeHtml(r.Predikat || '-')}</div>
          </div>
        </div>
        <div class="rapor-section">
          <h4>📝 Catatan Pelatih</h4>
          <div class="rapor-catatan">${Utils.escapeHtml(r.Catatan || 'Tidak ada catatan').replace(/\n/g, '<br>')}</div>
        </div>
      </div>`;
  }

  const html = `
    <div class="modal-backdrop active" id="m-rapor">
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <h3>📒 Rapor Latihan</h3>
          <button class="modal-close" onclick="document.getElementById('m-rapor').remove()">×</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('m-rapor').remove()">Tutup</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}
