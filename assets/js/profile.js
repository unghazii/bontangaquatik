/**
 * Profil Peserta — peserta melihat & memperbarui data dirinya sendiri.
 *  - Memuat data via getDataLengkapPeserta
 *  - Menyimpan perubahan via updateProfilePeserta (hanya field yang aman)
 *  - Field pelatihan (kelas, kelompok umur, tanggal) read-only (hanya admin)
 *  - Optimistic: nama yang berubah langsung disinkron ke sesi (Auth.patchUser)
 */
(function () {
  'use strict';

  // Field yang dikirim ke backend (key payload -> id input)
  const EDITABLE = {
    nama_lengkap: 'pf-nama_lengkap',
    nomor_whatsapp: 'pf-nomor_whatsapp',
    jenis_kelamin: 'pf-jenis_kelamin',
    tempat_lahir: 'pf-tempat_lahir',
    tanggal_lahir: 'pf-tanggal_lahir',
    nisnas: 'pf-nisnas',
    asal_sekolah: 'pf-asal_sekolah',
    kelas_sekolah: 'pf-kelas_sekolah',
    wali_kelas: 'pf-wali_kelas',
    pertanyaan_unik_1: 'pf-pertanyaan_unik_1',
    pertanyaan_unik_2: 'pf-pertanyaan_unik_2'
  };

  let original = null; // snapshot untuk "Batalkan Perubahan"

  function getUser() {
    if (typeof Auth.getUser === 'function') return Auth.getUser();
    const s = Auth.getSession();
    return s ? s.data : null;
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? '' : value;
  }

  function fill(data) {
    setVal('pf-nama_lengkap', data.Nama_Lengkap);
    setVal('pf-username', data.Username);
    setVal('pf-nomor_whatsapp', data.Nomor_Whatsapp);
    setVal('pf-jenis_kelamin', data.Jenis_Kelamin || 'Laki-laki');
    setVal('pf-tempat_lahir', data.Tempat_Lahir);
    setVal('pf-tanggal_lahir', toDateInput(data.Tanggal_Lahir));
    setVal('pf-nisnas', data.NISNAS);
    setVal('pf-asal_sekolah', data.Asal_Sekolah);
    setVal('pf-kelas_sekolah', data.Kelas_Sekolah);
    setVal('pf-wali_kelas', data.Wali_Kelas);
    setVal('pf-kelas', data.Kelas);
    setVal('pf-kelompok_umur', data.Kelompok_Umur);
    setVal('pf-tanggal_mulai', data.Tanggal_Mulai);
    setVal('pf-tanggal_akhir', data.Tanggal_Akhir);
    setVal('pf-pertanyaan_unik_1', data.Pertanyaan_Unik_1);
    setVal('pf-pertanyaan_unik_2', data.Pertanyaan_Unik_2);
    document.getElementById('ph-nama').textContent = data.Nama_Lengkap || 'Saya';
    document.getElementById('ph-nomor').textContent = data.Nomor_Peserta || '-';
  }

  /** Konversi nilai tanggal apa pun ke format input[type=date] (YYYY-MM-DD). */
  function toDateInput(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) {
      // mungkin sudah "DD/MM/YYYY" atau "YYYY-MM-DD"
      const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/);
      return m ? m[0] : '';
    }
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function snapshot() {
    const snap = {};
    Object.values(EDITABLE).forEach(id => { snap[id] = document.getElementById(id)?.value || ''; });
    snap['pf-password'] = '';
    snap['pf-password2'] = '';
    snap['pf-jawaban_unik_1'] = '';
    snap['pf-jawaban_unik_2'] = '';
    return snap;
  }

  function restore(snap) {
    Object.entries(snap).forEach(([id, val]) => setVal(id, val));
  }

  async function load() {
    const user = getUser();
    if (!user) { window.location.href = 'login.html'; return; }

    const res = await API.call('getDataLengkapPeserta', { id_peserta: user.id });
    if (!res.success || !res.data) {
      Utils.notify(res.message || 'Gagal memuat profil', 'error');
      document.getElementById('profile-skeleton').innerHTML =
        '<div class="empty-state"><div class="icon">⚠️</div><p>Gagal memuat data profil. Coba muat ulang halaman.</p></div>';
      return;
    }
    fill(res.data);
    original = snapshot();
    document.getElementById('profile-skeleton').classList.add('hidden');
    document.getElementById('profile-form').classList.remove('hidden');
  }

  async function save(e) {
    e.preventDefault();

    const nama = document.getElementById('pf-nama_lengkap').value.trim();
    if (!nama) { Utils.notify('Nama lengkap wajib diisi', 'warning'); return; }

    const wa = document.getElementById('pf-nomor_whatsapp').value.replace(/[^0-9]/g, '');
    if (wa && !/^[0-9]{8,15}$/.test(wa)) { Utils.notify('Nomor WhatsApp tidak valid (8-15 digit)', 'warning'); return; }

    const payload = { id_peserta: getUser().id };
    Object.entries(EDITABLE).forEach(([key, id]) => {
      let v = document.getElementById(id).value;
      if (key === 'nomor_whatsapp') v = wa;
      if (typeof v === 'string') v = v.trim();
      payload[key] = v;
    });

    // Password (opsional)
    const p1 = document.getElementById('pf-password').value;
    const p2 = document.getElementById('pf-password2').value;
    if (p1 || p2) {
      if (p1.length < 6) { Utils.notify('Password baru minimal 6 karakter', 'warning'); return; }
      if (p1 !== p2) { Utils.notify('Konfirmasi password tidak cocok', 'warning'); return; }
      payload.password = p1;
    }

    // Jawaban keamanan (opsional — hanya kirim bila diisi)
    const a1 = document.getElementById('pf-jawaban_unik_1').value.trim();
    const a2 = document.getElementById('pf-jawaban_unik_2').value.trim();
    if (a1) payload.jawaban_unik_1 = a1;
    if (a2) payload.jawaban_unik_2 = a2;

    const btn = document.getElementById('pf-save');
    btn.disabled = true;
    const res = await API.call('updateProfilePeserta', payload);
    btn.disabled = false;

    if (res.success) {
      Utils.notify(res.message || 'Profil berhasil diperbarui', 'success');
      // Sinkronkan nama ke sesi & navbar (optimistic)
      if (typeof Auth.patchUser === 'function') Auth.patchUser({ nama });
      document.getElementById('ph-nama').textContent = nama;
      // Bersihkan kolom sensitif & perbarui snapshot
      ['pf-password', 'pf-password2', 'pf-jawaban_unik_1', 'pf-jawaban_unik_2'].forEach(id => setVal(id, ''));
      original = snapshot();
    } else {
      Utils.notify(res.message || 'Gagal menyimpan profil', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const session = Auth.getSession();
    if (!session || session.role !== 'peserta') { window.location.href = 'login.html'; return; }
    Utils.mountNavbar('profile');

    document.getElementById('profile-form').addEventListener('submit', save);
    document.getElementById('pf-reset').addEventListener('click', () => {
      if (original) { restore(original); Utils.notify('Perubahan dibatalkan', 'info'); }
    });
    document.querySelectorAll('.password-toggle[data-target]').forEach(b => {
      b.addEventListener('click', () => {
        const inp = document.getElementById(b.dataset.target);
        inp.type = inp.type === 'password' ? 'text' : 'password';
        b.textContent = inp.type === 'password' ? '👁️' : '🙈';
      });
    });

    load();
  });
})();
