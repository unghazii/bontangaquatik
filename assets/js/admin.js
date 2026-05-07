// Admin Dashboard
let cachePeserta = [];
let cacheJadwal = [];
let cacheKehadiran = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireRole('admin')) return;
  Utils.mountNavbar('admin');

  document.getElementById('admin-username').textContent = Auth.getUser().username;

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Filter & search listeners — Peserta
  ['search-peserta', 'filter-peserta-kelas', 'filter-peserta-paid', 'sort-peserta'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => applyPesertaFilters());
    document.getElementById(id).addEventListener('change', () => applyPesertaFilters());
  });

  // Filter & search listeners — Jadwal
  ['search-jadwal', 'filter-jadwal-kelas', 'filter-jadwal-status', 'sort-jadwal'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => applyJadwalFilters());
    document.getElementById(id).addEventListener('change', () => applyJadwalFilters());
  });

  // Filter & search listeners — Kehadiran
  ['search-kehadiran', 'filter-periode', 'filter-kehadiran-kelas', 'filter-kehadiran-status', 'sort-kehadiran'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => applyKehadiranFilters());
    document.getElementById(id).addEventListener('change', () => loadKehadiran());
  });

  document.getElementById('btn-add-jadwal').addEventListener('click', () => openJadwalModal());
  document.getElementById('btn-refresh').addEventListener('click', loadAll);

  await loadAll();
});

async function loadAll() {
  await Promise.all([loadPeserta(), loadJadwal(), loadKehadiran()]);
  updateStats();
}

function updateStats() {
  document.getElementById('stat-total-peserta').textContent = cachePeserta.length;
  document.getElementById('stat-aktif-peserta').textContent = cachePeserta.filter(p =>
    p.Status_Pembayaran === true || String(p.Status_Pembayaran).toUpperCase() === 'TRUE'
  ).length;
  document.getElementById('stat-total-jadwal').textContent = cacheJadwal.length;
  document.getElementById('stat-total-kehadiran').textContent = cacheKehadiran.length;
}

/* ============================================================
   PESERTA — Filter kompleks (kelas, pembayaran, sort)
   ============================================================ */
async function loadPeserta() {
  const res = await API.call('getAllPeserta');
  if (res.success) {
    cachePeserta = res.data;
    applyPesertaFilters();
  } else { Utils.notify(res.message, 'error'); }
}

function applyPesertaFilters() {
  const q = document.getElementById('search-peserta').value.toLowerCase();
  const kelasFilter = document.getElementById('filter-peserta-kelas').value;
  const paidFilter = document.getElementById('filter-peserta-paid').value;
  const sort = document.getElementById('sort-peserta').value;

  let list = cachePeserta.filter(p => {
    const matchSearch = (p.Nama_Lengkap || '').toLowerCase().includes(q) ||
                        (p.Username || '').toLowerCase().includes(q) ||
                        (p.Kelas || '').toLowerCase().includes(q) ||
                        String(p.Nomor_Whatsapp || '').includes(q);
    const matchKelas = !kelasFilter || p.Kelas === kelasFilter;
    const isPaid = p.Status_Pembayaran === true || String(p.Status_Pembayaran).toUpperCase() === 'TRUE';
    const matchPaid = !paidFilter || (paidFilter === 'paid' ? isPaid : !isPaid);
    return matchSearch && matchKelas && matchPaid;
  });

  list.sort((a, b) => {
    if (sort === 'nama-asc') return (a.Nama_Lengkap || '').localeCompare(b.Nama_Lengkap || '');
    if (sort === 'nama-desc') return (b.Nama_Lengkap || '').localeCompare(a.Nama_Lengkap || '');
    if (sort === 'persen-desc') return (b.persentase || 0) - (a.persentase || 0);
    if (sort === 'persen-asc') return (a.persentase || 0) - (b.persentase || 0);
    if (sort === 'usia-asc') return (a.Usia || 0) - (b.Usia || 0);
    if (sort === 'usia-desc') return (b.Usia || 0) - (a.Usia || 0);
    return 0;
  });

  renderPeserta(list);
}

function renderPeserta(list) {
  const tbody = document.getElementById('tbody-peserta');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:30px;">Tidak ada data sesuai filter</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => {
    const isPaid = p.Status_Pembayaran === true || String(p.Status_Pembayaran).toUpperCase() === 'TRUE';
    const persenClass = p.persentase >= 75 ? 'high' : p.persentase >= 40 ? 'mid' : 'low';
    return `
      <tr>
        <td>${Utils.escapeHtml(p.Nama_Lengkap)}</td>
        <td>${Utils.escapeHtml(p.Username)}</td>
        <td>${Utils.escapeHtml(p.Usia || '-')}</td>
        <td>${Utils.escapeHtml(p.Nomor_Whatsapp)}</td>
        <td>${Utils.escapeHtml(p.Kelas || '-')}</td>
        <td>${Utils.escapeHtml(p.Tanggal_Mulai || '-')}</td>
        <td>${Utils.escapeHtml(p.Tanggal_Akhir || '-')}</td>
        <td><span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">${isPaid ? 'LUNAS' : 'BELUM'}</span></td>
        <td>${p.total_hadir} / ${p.total_jadwal}</td>
        <td>
          <div class="persen-cell">
            <div class="persen-bar"><div class="persen-fill ${persenClass}" style="width:${p.persentase}%"></div></div>
            <span class="persen-text">${p.persentase}%</span>
          </div>
        </td>
        <td>
          <div class="action-btns">
            <button class="icon-btn edit" onclick="openPesertaModal('${p.Id_Peserta}')" title="Edit Data">✏️</button>
            <button class="icon-btn rapor" onclick="openRaporAdminModal('${p.Id_Peserta}', '${Utils.escapeHtml(p.Nama_Lengkap)}')" title="Edit Rapor">📋</button>
            <button class="icon-btn delete" onclick="deletePeserta('${p.Id_Peserta}')" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function openPesertaModal(id) {
  const p = cachePeserta.find(x => x.Id_Peserta === id);
  if (!p) return;
  const isPaid = p.Status_Pembayaran === true || String(p.Status_Pembayaran).toUpperCase() === 'TRUE';

  const html = `
    <div class="modal-backdrop active" id="m-peserta">
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Peserta</h3>
          <button class="modal-close" onclick="closeModal('m-peserta')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Nama Lengkap</label>
            <input class="form-control" id="ep-nama" value="${Utils.escapeHtml(p.Nama_Lengkap)}"></div>
          <div style="display:grid;grid-template-columns:1fr 100px;gap:12px;">
            <div class="form-group"><label>Username</label>
              <input class="form-control" id="ep-username" value="${Utils.escapeHtml(p.Username)}"></div>
            <div class="form-group"><label>Usia</label>
              <input type="number" class="form-control" id="ep-usia" value="${Utils.escapeHtml(p.Usia || '')}" min="5"></div>
          </div>
          <div class="form-group"><label>Password Baru <small>(kosongkan jika tidak diubah)</small></label>
            <input type="password" class="form-control" id="ep-password" placeholder="•••••••"></div>
          <div class="form-group"><label>Nomor WhatsApp</label>
            <input class="form-control" id="ep-wa" value="${Utils.escapeHtml(p.Nomor_Whatsapp)}"></div>
          <div class="form-group"><label>Kelas</label>
            <select class="form-control" id="ep-kelas">
              <option value="">- Pilih Kelas -</option>
              ${CONFIG.KELAS_OPTIONS.map(k => `<option value="${k}" ${p.Kelas === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="form-group"><label>Tanggal Mulai</label>
              <input type="date" class="form-control" id="ep-mulai" value="${Utils.formatDateInput(p.Tanggal_Mulai)}"></div>
            <div class="form-group"><label>Tanggal Akhir</label>
              <input type="date" class="form-control" id="ep-akhir" value="${Utils.formatDateInput(p.Tanggal_Akhir)}"></div>
          </div>
          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" id="ep-paid" ${isPaid ? 'checked' : ''}>
              <span>Status Pembayaran <strong>LUNAS</strong></span>
            </label>
            <p class="form-helper" style="color:var(--color-accent);">⚡ Saat pembayaran dikonfirmasi pertama kali, jadwal akan otomatis di-generate sesuai grup & periode peserta.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('m-peserta')">Batal</button>
          <button class="btn btn-primary" onclick="savePeserta('${id}')">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function savePeserta(id) {
  const data = {
    id,
    nama_lengkap: document.getElementById('ep-nama').value.trim(),
    username: document.getElementById('ep-username').value.trim(),
    password: document.getElementById('ep-password').value,
    nomor_whatsapp: document.getElementById('ep-wa').value.trim(),
    usia: document.getElementById('ep-usia').value,
    kelas: document.getElementById('ep-kelas').value,
    tanggal_mulai: document.getElementById('ep-mulai').value,
    tanggal_akhir: document.getElementById('ep-akhir').value,
    status_pembayaran: document.getElementById('ep-paid').checked
  };
  const res = await API.call('updatePeserta', data);
  if (res.success) {
    Utils.notify(res.message, 'success', 5000);
    closeModal('m-peserta');
    await loadAll();
  } else {
    Utils.notify(res.message, 'error');
  }
}

async function deletePeserta(id) {
  const ok = await Utils.confirm('Yakin ingin menghapus peserta ini?');
  if (!ok) return;
  const res = await API.call('deletePeserta', { id });
  if (res.success) { Utils.notify(res.message, 'success'); await loadAll(); }
  else Utils.notify(res.message, 'error');
}

/* ============================================================
   RAPOR — Admin manage rapor per peserta
   ============================================================ */
async function openRaporAdminModal(idPeserta, nama) {
  const res = await API.call('getRaporPeserta', { id_peserta: idPeserta });
  const r = res.data || { Nilai: '', Predikat: '', Catatan: '' };

  const html = `
    <div class="modal-backdrop active" id="m-rapor-admin">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <h3>📋 Rapor: ${Utils.escapeHtml(nama)}</h3>
          <button class="modal-close" onclick="closeModal('m-rapor-admin')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nilai <small>(angka 0-100)</small></label>
            <input type="number" min="0" max="100" class="form-control" id="rp-nilai" value="${Utils.escapeHtml(r.Nilai || '')}">
          </div>
          <div class="form-group">
            <label>Predikat</label>
            <select class="form-control" id="rp-predikat">
              <option value="">- Pilih -</option>
              <option value="A - Sangat Baik"  ${r.Predikat === 'A - Sangat Baik' ? 'selected' : ''}>A - Sangat Baik</option>
              <option value="B - Baik"         ${r.Predikat === 'B - Baik' ? 'selected' : ''}>B - Baik</option>
              <option value="C - Cukup"        ${r.Predikat === 'C - Cukup' ? 'selected' : ''}>C - Cukup</option>
              <option value="D - Perlu Latihan" ${r.Predikat === 'D - Perlu Latihan' ? 'selected' : ''}>D - Perlu Latihan</option>
            </select>
          </div>
          <div class="form-group">
            <label>Catatan Pelatih</label>
            <textarea class="form-control" id="rp-catatan" rows="5" placeholder="Tulis evaluasi, kemajuan, dan saran untuk peserta...">${Utils.escapeHtml(r.Catatan || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('m-rapor-admin')">Batal</button>
          <button class="btn btn-primary" onclick="saveRapor('${idPeserta}')">Simpan Rapor</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveRapor(idPeserta) {
  const data = {
    id_peserta: idPeserta,
    nilai: document.getElementById('rp-nilai').value,
    predikat: document.getElementById('rp-predikat').value,
    catatan: document.getElementById('rp-catatan').value
  };
  const res = await API.call('upsertRapor', data);
  if (res.success) { Utils.notify(res.message, 'success'); closeModal('m-rapor-admin'); }
  else Utils.notify(res.message, 'error');
}

/* ============================================================
   JADWAL — Filter kompleks + click row → attendees modal
   ============================================================ */
async function loadJadwal() {
  const res = await API.call('getAllJadwal');
  if (res.success) { cacheJadwal = res.data; applyJadwalFilters(); }
  else Utils.notify(res.message, 'error');
}

function applyJadwalFilters() {
  const q = document.getElementById('search-jadwal').value.toLowerCase();
  const kelasF = document.getElementById('filter-jadwal-kelas').value;
  const statusF = document.getElementById('filter-jadwal-status').value;
  const sort = document.getElementById('sort-jadwal').value;

  let list = cacheJadwal.filter(j => {
    const matchSearch = (j.Kelas || '').toLowerCase().includes(q) ||
                        (j.Lokasi || '').toLowerCase().includes(q) ||
                        String(j.Tanggal || '').toLowerCase().includes(q) ||
                        (j.Pukul || '').toLowerCase().includes(q);
    const matchKelas = !kelasF || j.Kelas === kelasF;
    const matchStatus = !statusF || j.Status === statusF;
    return matchSearch && matchKelas && matchStatus;
  });

  list.sort((a, b) => {
    const da = new Date(a.Tanggal); const db = new Date(b.Tanggal);
    if (sort === 'tanggal-desc') return db - da;
    if (sort === 'tanggal-asc') return da - db;
    if (sort === 'kelas') return (a.Kelas || '').localeCompare(b.Kelas || '');
    return 0;
  });

  renderJadwal(list);
}

function renderJadwal(list) {
  const tbody = document.getElementById('tbody-jadwal');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;">Tidak ada jadwal sesuai filter</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(j => {
    const status = String(j.Status).toLowerCase();
    const badgeClass = status === 'aktif' ? 'badge-success' : status === 'pending' ? 'badge-warning' : 'badge-danger';
    return `
      <tr class="clickable-row" onclick="openAttendeesModal('${j.Id_Jadwal}')">
        <td>${Utils.escapeHtml(Utils.formatDate(j.Tanggal))}</td>
        <td>${Utils.escapeHtml(j.Pukul)}</td>
        <td>${Utils.escapeHtml(j.Kelas)}</td>
        <td>${Utils.escapeHtml(j.Lokasi)}</td>
        <td><span class="badge ${badgeClass}">${Utils.escapeHtml(j.Status)}</span></td>
        <td onclick="event.stopPropagation()">
          <div class="action-btns">
            <button class="icon-btn view" onclick="openAttendeesModal('${j.Id_Jadwal}')" title="Lihat Peserta">👁️</button>
            <button class="icon-btn edit" onclick="openJadwalModal('${j.Id_Jadwal}')" title="Edit">✏️</button>
            <button class="icon-btn delete" onclick="deleteJadwal('${j.Id_Jadwal}')" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function openJadwalModal(id) {
  const isEdit = !!id;
  const j = isEdit ? cacheJadwal.find(x => x.Id_Jadwal === id) : {};
  const html = `
    <div class="modal-backdrop active" id="m-jadwal">
      <div class="modal">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit' : 'Tambah'} Jadwal</h3>
          <button class="modal-close" onclick="closeModal('m-jadwal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Tanggal *</label>
            <input type="date" class="form-control" id="ej-tanggal" value="${isEdit ? Utils.formatDateInput(j.Tanggal) : ''}"></div>
          <div class="form-group"><label>Pukul *</label>
            <input class="form-control" id="ej-pukul" placeholder="16:00 - 17:45" value="${isEdit ? Utils.escapeHtml(j.Pukul) : ''}"></div>
          <div class="form-group"><label>Lokasi *</label>
            <input class="form-control" id="ej-lokasi" placeholder="Kenari Waterpark Bontang" value="${isEdit ? Utils.escapeHtml(j.Lokasi) : ''}"></div>
          <div class="form-group"><label>Kelas *</label>
            <select class="form-control" id="ej-kelas">
              ${CONFIG.KELAS_OPTIONS.map(k => `<option value="${k}" ${isEdit && j.Kelas === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Status *</label>
            <select class="form-control" id="ej-status">
              ${CONFIG.STATUS_JADWAL.map(s => `<option value="${s}" ${(isEdit && j.Status === s) || (!isEdit && s === 'Pending') ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('m-jadwal')">Batal</button>
          <button class="btn btn-primary" onclick="saveJadwal('${id || ''}')">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveJadwal(id) {
  const data = {
    tanggal: document.getElementById('ej-tanggal').value,
    pukul: document.getElementById('ej-pukul').value.trim(),
    lokasi: document.getElementById('ej-lokasi').value.trim(),
    kelas: document.getElementById('ej-kelas').value,
    status: document.getElementById('ej-status').value
  };
  if (!data.tanggal || !data.pukul || !data.lokasi) {
    Utils.notify('Tanggal, pukul, dan lokasi wajib diisi', 'warning');
    return;
  }
  const res = id
    ? await API.call('updateJadwal', { id, ...data })
    : await API.call('createJadwal', { id_pelatih: Auth.getUser().id, ...data });
  if (res.success) { Utils.notify(res.message, 'success'); closeModal('m-jadwal'); await loadAll(); }
  else Utils.notify(res.message, 'error');
}

async function deleteJadwal(id) {
  const ok = await Utils.confirm('Yakin ingin menghapus jadwal ini?');
  if (!ok) return;
  const res = await API.call('deleteJadwal', { id });
  if (res.success) { Utils.notify(res.message, 'success'); await loadAll(); }
  else Utils.notify(res.message, 'error');
}

/* ATTENDEES — Modal saat jadwal di-klik (request 18) */
async function openAttendeesModal(idJadwal) {
  const res = await API.call('getJadwalAttendees', { id_jadwal: idJadwal });
  if (!res.success) { Utils.notify(res.message, 'error'); return; }
  const j = res.jadwal;
  const list = res.data || [];

  const stats = {
    hadir: list.filter(p => p.status === 'hadir').length,
    izin: list.filter(p => p.status === 'izin').length,
    belum: list.filter(p => p.status === 'belum').length
  };

  const rowsHtml = list.length === 0
    ? `<div class="empty-state"><p>Belum ada peserta di kelas ini</p></div>`
    : `<div class="attendees-list">
        ${list.map(p => {
          const badge = p.status === 'hadir' ? '<span class="badge badge-success">✓ HADIR</span>'
                      : p.status === 'izin' ? '<span class="badge badge-warning">📝 IZIN</span>'
                      : '<span class="badge badge-danger">✗ BELUM</span>';
          return `
            <div class="attendee-item">
              <div>
                <strong>${Utils.escapeHtml(p.nama)}</strong>
                ${p.catatan ? `<div class="attendee-note">📝 ${Utils.escapeHtml(p.catatan)}</div>` : ''}
              </div>
              ${badge}
            </div>`;
        }).join('')}
      </div>`;

  const html = `
    <div class="modal-backdrop active" id="m-attendees">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h3>👥 Peserta Jadwal</h3>
          <button class="modal-close" onclick="closeModal('m-attendees')">×</button>
        </div>
        <div class="modal-body">
          <div class="attendees-summary">
            <div><strong>${Utils.escapeHtml(j.Kelas)}</strong> • ${Utils.escapeHtml(j.Tanggal)} • ${Utils.escapeHtml(j.Pukul)}</div>
            <div class="text-muted" style="font-size:13px;">📍 ${Utils.escapeHtml(j.Lokasi)}</div>
          </div>
          <div class="attendees-stats">
            <div class="stat-pill stat-hadir">✓ Hadir: <strong>${stats.hadir}</strong></div>
            <div class="stat-pill stat-izin">📝 Izin: <strong>${stats.izin}</strong></div>
            <div class="stat-pill stat-belum">✗ Belum: <strong>${stats.belum}</strong></div>
          </div>
          ${rowsHtml}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('m-attendees')">Tutup</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

/* ============================================================
   KEHADIRAN — Filter kompleks
   ============================================================ */
async function loadKehadiran() {
  const periode = document.getElementById('filter-periode').value;
  const res = await API.call('getAllKehadiran', { periode });
  if (res.success) {
    cacheKehadiran = res.data;
    applyKehadiranFilters();
    updateStats();
  } else { Utils.notify(res.message, 'error'); }
}

function applyKehadiranFilters() {
  const q = document.getElementById('search-kehadiran').value.toLowerCase();
  const kelasF = document.getElementById('filter-kehadiran-kelas').value;
  const statusF = document.getElementById('filter-kehadiran-status').value;
  const sort = document.getElementById('sort-kehadiran').value;

  let list = cacheKehadiran.filter(k => {
    const matchSearch = (k.nama_peserta || '').toLowerCase().includes(q) ||
                        (k.kelas || '').toLowerCase().includes(q) ||
                        (k.lokasi || '').toLowerCase().includes(q);
    const matchKelas = !kelasF || k.kelas === kelasF;
    const matchStatus = !statusF || k.status_label === statusF;
    return matchSearch && matchKelas && matchStatus;
  });

  list.sort((a, b) => {
    const da = new Date(a.tanggal_raw); const db = new Date(b.tanggal_raw);
    if (sort === 'tanggal-desc') return db - da;
    if (sort === 'tanggal-asc') return da - db;
    if (sort === 'nama') return (a.nama_peserta || '').localeCompare(b.nama_peserta || '');
    return 0;
  });

  renderKehadiran(list);
}

function renderKehadiran(list) {
  const tbody = document.getElementById('tbody-kehadiran');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;">Tidak ada data sesuai filter</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(k => {
    const isHadir = k.status_label === 'hadir';
    return `
      <tr>
        <td>${Utils.escapeHtml(k.tanggal)}</td>
        <td>${Utils.escapeHtml(k.pukul)}</td>
        <td>${Utils.escapeHtml(k.nama_peserta)}</td>
        <td>${Utils.escapeHtml(k.kelas)}</td>
        <td>${Utils.escapeHtml(k.lokasi)}</td>
        <td><span class="badge ${isHadir ? 'badge-success' : 'badge-warning'}">${isHadir ? '✓ HADIR' : '📝 IZIN'}</span></td>
        <td>${Utils.escapeHtml(k.Catatan || '-')}</td>
        <td>
          <div class="action-btns">
            <button class="icon-btn delete" onclick="deleteKehadiran('${k.Id_Kehadiran}')" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function deleteKehadiran(id) {
  const ok = await Utils.confirm('Yakin ingin menghapus data kehadiran ini?');
  if (!ok) return;
  const res = await API.call('deleteKehadiran', { id });
  if (res.success) { Utils.notify(res.message, 'success'); await loadKehadiran(); }
  else Utils.notify(res.message, 'error');
}

function closeModal(id) { const el = document.getElementById(id); if (el) el.remove(); }
