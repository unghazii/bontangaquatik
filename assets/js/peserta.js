// =====================================================================
// Dashboard Peserta — Gabungan:
//   • LOGIKA   : kode pertama (rapor tabel 4 gaya × 2 jarak + PDF,
//                jadwal personal, cache data peserta lengkap)
//   • TAMPILAN : kode kedua (grid card jadwal + modal absen
//                lengkap dengan checklist equipment + counter jadwal)
//
// Filter & sort lengkap (tidak ada yang dihilangkan):
//   - Search           : tanggal / pukul / lokasi / kelas
//   - Filter status    : Aktif / Pending / Cancel        (status jadwal)
//   - Filter kehadiran : hadir / izin / belum             (status saya)
//   - Filter tipe      : kelas / personal                 (is_personal)
//   - Sort tanggal     : newest / oldest / upcoming
// =====================================================================

let cacheJadwalPeserta = [];
let pesertaLengkapCache = null;
let raporCache = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard — toleran terhadap dua gaya API (Auth.requireRole atau Auth.getSession)
  if (typeof Auth.requireRole === 'function') {
    if (!Auth.requireRole('peserta')) return;
  } else {
    const session = Auth.getSession();
    if (!session || session.role !== 'peserta') {
      window.location.href = 'login.html';
      return;
    }
  }
  Utils.mountNavbar('peserta');

  const user = getCurrentUser();
  document.getElementById('user-nama').textContent = user.nama;
  document.getElementById('user-kelas').textContent = user.kelas || 'Belum ditentukan';

  document.getElementById('btn-rapor').addEventListener('click', openRaporModal);

  // Bind semua kontrol toolbar (defensive: tiap elemen dicek dulu agar
  // tidak error kalau ada satu yang belum ada di HTML).
  [
    'search-jadwal-peserta',
    'filter-jadwal-peserta-status',
    'filter-jadwal-peserta-kehadiran',
    'filter-jadwal-peserta-tipe',
    'sort-jadwal-peserta'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', applyJadwalPesertaFilters);
    el.addEventListener('change', applyJadwalPesertaFilters);
  });

  await loadDashboard();
});

/** Ambil user dari salah satu API yang tersedia (Auth.getUser / Auth.getSession). */
function getCurrentUser() {
  if (typeof Auth.getUser === 'function') return Auth.getUser();
  const session = Auth.getSession();
  return session ? session.data : {};
}

async function loadDashboard() {
  const user = getCurrentUser();
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
    document.getElementById('jadwal-list').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>${Utils.escapeHtml(jadwalRes.message || 'Gagal memuat jadwal')}</p></div>`;
    Utils.notify(jadwalRes.message || 'Gagal memuat jadwal', 'error');
  }
}

/* =====================================================================
   FILTER & SORT JADWAL
   ===================================================================== */
function applyJadwalPesertaFilters() {
  const q          = (document.getElementById('search-jadwal-peserta')?.value || '').toLowerCase();
  const statusF    = document.getElementById('filter-jadwal-peserta-status')?.value || '';
  const kehadiranF = document.getElementById('filter-jadwal-peserta-kehadiran')?.value || '';
  const tipeF      = document.getElementById('filter-jadwal-peserta-tipe')?.value || '';
  const sort       = document.getElementById('sort-jadwal-peserta')?.value || 'newest';

  let list = cacheJadwalPeserta.filter(j => {
    // ---- Search ----
    const haystack = [
      Utils.formatDate(j.Tanggal).toLowerCase(),
      String(j.Tanggal || '').toLowerCase(),
      (j.Pukul  || '').toLowerCase(),
      (j.Lokasi || '').toLowerCase(),
      (j.Kelas  || '').toLowerCase()
    ].join(' ');
    if (q && !haystack.includes(q)) return false;

    // ---- Status jadwal (Aktif/Pending/Cancel) ----
    // Toleran terhadap value "all" maupun "" (keduanya = tidak memfilter).
    if (statusF && statusF !== 'all' && j.Status !== statusF) return false;

    // ---- Status kehadiran saya (hadir/izin/belum) ----
    let myStatus = 'belum';
    if (j.sudah_absen) myStatus = j.status_kehadiran; // 'hadir' atau 'izin'
    if (kehadiranF && kehadiranF !== 'all' && myStatus !== kehadiranF) return false;

    // ---- Tipe (kelas/personal) ----
    if (tipeF === 'kelas'    && j.is_personal) return false;
    if (tipeF === 'personal' && !j.is_personal) return false;

    return true;
  });

  // ---- Sort ----
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  list.sort((a, b) => {
    const da = new Date(a.Tanggal);
    const db = new Date(b.Tanggal);

    // Dukung dua skema penamaan agar kompatibel dengan kode lama:
    //   newest    ≡ tanggal-desc
    //   oldest    ≡ tanggal-asc
    //   upcoming  : jadwal ≥ hari ini di atas (asc), lalu yang lewat (desc)
    if (sort === 'oldest' || sort === 'tanggal-asc') return da - db;
    if (sort === 'upcoming') {
      const aFuture = da >= now;
      const bFuture = db >= now;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      return aFuture ? (da - db) : (db - da);
    }
    return db - da; // default: newest / tanggal-desc
  });

  // Counter
  const counter = document.getElementById('jadwal-count');
  if (counter) {
    const total = cacheJadwalPeserta.length;
    counter.textContent = list.length === total
      ? `${total} jadwal`
      : `${list.length} dari ${total} jadwal`;
  }

  renderJadwal(list);
}

/* =====================================================================
   RENDER GRID CARD (gaya kode kedua + badge PERSONAL dari kode pertama)
   ===================================================================== */
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

  container.innerHTML = `
    <div class="jadwal-grid">
      ${jadwals.map(j => {
        const status = String(j.Status).toLowerCase();
        const badgeClass = status === 'aktif' ? 'badge-success'
                         : status === 'pending' ? 'badge-warning'
                         : 'badge-danger';

        const sudahRespond     = j.sudah_absen;
        const kehadiranStatus  = j.status_kehadiran;

        // Action button — sama persis dengan kode kedua
        let actionHtml;
        if (sudahRespond) {
          actionHtml = (kehadiranStatus === 'hadir')
            ? `<button class="btn btn-sm btn-success" disabled>✓ Sudah Absen</button>`
            : `<button class="btn btn-sm btn-secondary" disabled>📝 Sudah Izin</button>`;
        } else if (status === 'aktif') {
          actionHtml = `<button class="btn btn-sm btn-accent" onclick="openAbsenModal('${j.Id_Jadwal}')">Absen / Izin</button>`;
        } else {
          actionHtml = `<button class="btn btn-sm btn-secondary" disabled>Belum Dibuka</button>`;
        }

        // Badge personal — dipertahankan dari kode pertama agar logika
        // personal tetap terlihat oleh user, tanpa mengubah layout card.
        const personalBadge = j.is_personal
          ? `<span class="badge badge-personal" title="Jadwal personal">⭐ PERSONAL</span>`
          : '';

        return `
          <div class="jadwal-card${j.is_personal ? ' is-personal' : ''}">
            <div class="jadwal-date">
              ${Utils.escapeHtml(Utils.formatDate(j.Tanggal))}
              ${personalBadge}
            </div>
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

/* =====================================================================
   MODAL ABSEN — full version dari kode kedua (checklist equipment)
   ===================================================================== */
function openAbsenModal(idJadwal) {
  // Defensive: kalau CONFIG.EQUIPMENT_INFO tidak ada, fallback ke list kosong
  const eq = (typeof CONFIG !== 'undefined' && CONFIG.EQUIPMENT_INFO) ? CONFIG.EQUIPMENT_INFO : {
    pemula: [], lanjut: [], lain: [], tambahan: []
  };

  const html = `
    <div class="modal-backdrop active" id="m-absen" data-jadwal-id="${idJadwal}">
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
          <button class="btn btn-primary" id="btn-confirm-absen" data-jadwal-id="${idJadwal}" onclick="submitAbsen('${idJadwal}')" disabled>✓ Ya, Saya Hadir</button>
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
    btnConfirm.textContent = '📤 Kirim Izin';
    btnConfirm.disabled = false;
    btnConfirm.onclick = () => submitIzin();
    btnIzin.textContent = '↩ Kembali';
  } else {
    btnConfirm.textContent = '✓ Ya, Saya Hadir';
    btnIzin.textContent = '📝 Izin';
    const idJadwal = btnConfirm.dataset.jadwalId;
    btnConfirm.onclick = () => submitAbsen(idJadwal);
    toggleAbsenSubmit();
  }
}

async function submitAbsen(idJadwal) {
  if (!document.getElementById('agree-checkbox').checked) {
    Utils.notify('Mohon centang persetujuan peralatan terlebih dahulu', 'warning');
    return;
  }
  Utils.showLoader && Utils.showLoader(true);
  const user = getCurrentUser();
  const res = await API.call('absen', { id_jadwal: idJadwal, id_peserta: user.id });
  Utils.showLoader && Utils.showLoader(false);
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
  const modal = document.getElementById('m-absen');
  const btn = document.getElementById('btn-confirm-absen');
  const idJadwal = (modal && modal.dataset.jadwalId) || (btn && btn.dataset.jadwalId);
  if (!idJadwal) {
    Utils.notify('Gagal mengidentifikasi jadwal', 'error');
    return;
  }
  Utils.showLoader && Utils.showLoader(true);
  const user = getCurrentUser();
  const res = await API.call('izin', { id_jadwal: idJadwal, id_peserta: user.id, catatan });
  Utils.showLoader && Utils.showLoader(false);
  if (res.success) {
    Utils.notify(res.message, 'success');
    closeAbsenModal();
    await loadDashboard();
  } else {
    Utils.notify(res.message, 'error');
  }
}

/* =====================================================================
   RAPOR — Tabel 4 gaya × 2 jarak + Download PDF (logika dari kode 1)
   ===================================================================== */
async function openRaporModal() {
  Utils.showLoader && Utils.showLoader(true);
  const user = getCurrentUser();

  const [raporRes, pesertaRes] = await Promise.all([
    API.call('getRaporPeserta',        { id_peserta: user.id }),
    API.call('getDataLengkapPeserta',  { id_peserta: user.id })
  ]);
  Utils.showLoader && Utils.showLoader(false);

  if (pesertaRes.success) pesertaLengkapCache = pesertaRes.data;
  raporCache = raporRes.success ? raporRes.data : null;

  if (!raporRes.success) {
    Utils.notify(raporRes.message || 'Gagal memuat rapor', 'error');
    return;
  }

  let modalBody;
  if (!raporRes.data) {
    modalBody = `
      <div class="empty-state">
        <div class="icon">📝</div>
        <h3>Rapor Belum Tersedia</h3>
        <p>Rapor akan tersedia setelah pelatih mengisi data evaluasi. Cek kembali nanti.</p>
      </div>`;
  } else {
    const r = raporRes.data;
    const fmt = v => (v && String(v).trim() !== '' && String(v).trim() !== '-') ? String(v).trim() : '-';
    const periodeStart = pesertaRes.data?.Tanggal_Mulai;
    const periodeEnd   = pesertaRes.data?.Tanggal_Akhir;

    modalBody = `
      <div class="rapor-display">
        <div class="rapor-section">
          <h4 class="rapor-section-title">📊 Capaian Hasil Latihan Renang</h4>
          <p class="rapor-periode">Periode:
            <em>${Utils.formatDateLong(periodeStart)} s.d ${Utils.formatDateLong(periodeEnd)}</em>
          </p>
          <table class="rapor-table">
            <thead>
              <tr><th>NO.</th><th>GAYA RENANG</th><th>25 METER</th><th>50 METER</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Gaya Bebas</td>    <td>${fmt(r.Waktu_25_Bebas)}</td>    <td>${fmt(r.Waktu_50_Bebas)}</td></tr>
              <tr><td>2</td><td>Gaya Dada</td>     <td>${fmt(r.Waktu_25_Dada)}</td>     <td>${fmt(r.Waktu_50_Dada)}</td></tr>
              <tr><td>3</td><td>Gaya Kupu</td>     <td>${fmt(r.Waktu_25_Kupu)}</td>     <td>${fmt(r.Waktu_50_Kupu)}</td></tr>
              <tr><td>4</td><td>Gaya Punggung</td> <td>${fmt(r.Waktu_25_Punggung)}</td> <td>${fmt(r.Waktu_50_Punggung)}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="rapor-section">
          <div class="rapor-field">
            <label>Predikat</label>
            <div class="rapor-value-box">${Utils.escapeHtml(r.Predikat) || '-'}</div>
          </div>
          <div class="rapor-field">
            <label>Deskripsi</label>
            <div class="rapor-value-box tall">${Utils.escapeHtml(r.Catatan) || '-'}</div>
          </div>
        </div>

        <p class="rapor-pelatih">Pelatih: <strong>${Utils.escapeHtml(r.Nama_Pelatih || '-')}</strong></p>
      </div>`;
  }

  const downloadBtn = raporRes.data
    ? `<button class="btn btn-accent" onclick="downloadRaporPDF()">📥 Download PDF</button>`
    : '';

  const html = `
    <div class="modal-backdrop active" id="rapor-modal">
      <div class="modal modal-md">
        <div class="modal-header">
          <h3>📒 Rapor Latihan</h3>
          <button class="modal-close" onclick="document.getElementById('rapor-modal').remove()">×</button>
        </div>
        <div class="modal-body">${modalBody}</div>
        <div class="modal-footer">
          ${downloadBtn}
          <button class="btn btn-secondary" onclick="document.getElementById('rapor-modal').remove()">Tutup</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function downloadRaporPDF() {
  if (!pesertaLengkapCache) {
    const user = getCurrentUser();
    const res = await API.call('getDataLengkapPeserta', { id_peserta: user.id });
    if (!res.success) { Utils.notify('Gagal memuat data peserta', 'error'); return; }
    pesertaLengkapCache = res.data;
  }
  if (!raporCache) { Utils.notify('Data rapor tidak tersedia', 'error'); return; }

  Utils.showLoader && Utils.showLoader(true);
  try {
    await PDFRapor.generate(pesertaLengkapCache, raporCache, raporCache.Nama_Pelatih);
  } catch (err) {
    console.error(err);
    Utils.notify('Gagal generate PDF: ' + err.message, 'error');
  }
  Utils.showLoader && Utils.showLoader(false);
}