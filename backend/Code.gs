/**
 * ===================================================================
 * BACKEND API v4 — Bontang Akuatik Swimming Club
 * Monolithic codebase (Google Apps Script + Google Spreadsheet)
 * ===================================================================
 *
 * SHEET STRUCTURE (kolom baru DITAMBAHKAN DI AKHIR agar data &
 * index lama tetap valid — aman untuk migrasi):
 *
 * Peserta (23 kolom):
 *   1  Id_Peserta        2  Nama_Lengkap      3  Username
 *   4  Password          5  Nomor_Whatsapp    6  Jenis_Kelamin
 *   7  Tempat_Lahir      8  Tanggal_Lahir     9  NISNAS
 *   10 Asal_Sekolah      11 Kelas_Sekolah     12 Wali_Kelas
 *   13 Kelompok_Umur     14 Kelas             15 Tanggal_Mulai
 *   16 Tanggal_Akhir     17 Status_Pembayaran
 *   18 Nomor_Peserta  (wajib sebelum LUNAS)
 *   19 (deprecated)      20 (deprecated)       <- bekas Pertanyaan/Jawaban Unik 1
 *   21 (deprecated)      22 (deprecated)       <- bekas Pertanyaan/Jawaban Unik 2
 *   23 Kode_Referral (BARU — 6 huruf, auto-generate jika kosong)
 *
 *   CATATAN: fitur "pertanyaan keamanan" SUDAH DIHAPUS dari aplikasi.
 *   Kolom 19-22 dipertahankan secara fisik HANYA agar index data lama
 *   tidak bergeser (migrasi aman & non-destruktif). Tidak ada kode yang
 *   membaca/menulis kolom tersebut lagi. Verifikasi lupa-password kini
 *   memakai: Nama_Lengkap + Tanggal_Lahir + Nomor_Whatsapp + NISNAS.
 *
 * Pelatih: Id_Pelatih | Nama | Username | Password
 *
 * Jadwal: Id_Jadwal | Id_Pelatih | Id_Peserta | Tanggal | Pukul | Lokasi | Kelas | Status
 *
 * Kehadiran: Id_Kehadiran | Id_Jadwal | Id_Peserta | Status | Catatan
 *
 * Rapor (18 kolom):
 *   1  Id_Rapor          2  Id_Peserta        3  Predikat
 *   4  Catatan
 *   5  Waktu_25_Bebas    6  Waktu_25_Dada     7  Waktu_25_Kupu     8  Waktu_25_Punggung   (TANPA pelampung)
 *   9  Waktu_50_Bebas    10 Waktu_50_Dada     11 Waktu_50_Kupu     12 Waktu_50_Punggung
 *   13 Tanggal_Rapor     14 Id_Pelatih
 *   15 Waktu_25_Bebas_Pelampung   16 Waktu_25_Dada_Pelampung   (BARU)
 *   17 Waktu_25_Kupu_Pelampung    18 Waktu_25_Punggung_Pelampung
 *
 * Berita: Id_Berita | Judul | Tanggal | Deskripsi | Link | Status (BARU)
 *   Status: Publik | Semua Peserta | Peserta Grup A | Peserta Grup B | Peserta Grup C
 */

const SPREADSHEET_ID = '1Jvndc1jgdlx4iSw2nNp9ezAM-MbU12Y8o1R_nrmLmQw';

/** Header lengkap tiap sheet — dipakai oleh migrateSheets() untuk menambah kolom baru. */
const SHEET_HEADERS = {
  Peserta: [
    'Id_Peserta','Nama_Lengkap','Username','Password','Nomor_Whatsapp','Jenis_Kelamin',
    'Tempat_Lahir','Tanggal_Lahir','NISNAS','Asal_Sekolah','Kelas_Sekolah','Wali_Kelas',
    'Kelompok_Umur','Kelas','Tanggal_Mulai','Tanggal_Akhir','Status_Pembayaran',
    'Nomor_Peserta','Pertanyaan_Unik_1','Jawaban_Unik_1','Pertanyaan_Unik_2','Jawaban_Unik_2',
    'Kode_Referral'
  ],
  Rapor: [
    'Id_Rapor','Id_Peserta','Predikat','Catatan',
    'Waktu_25_Bebas','Waktu_25_Dada','Waktu_25_Kupu','Waktu_25_Punggung',
    'Waktu_50_Bebas','Waktu_50_Dada','Waktu_50_Kupu','Waktu_50_Punggung',
    'Tanggal_Rapor','Id_Pelatih',
    'Waktu_25_Bebas_Pelampung','Waktu_25_Dada_Pelampung','Waktu_25_Kupu_Pelampung','Waktu_25_Punggung_Pelampung'
  ],
  // Berita: kolom 6 (Status) DITAMBAHKAN DI AKHIR — target audiens berita.
  // Opsi: Publik | Semua Peserta | Peserta Grup A | Peserta Grup B | Peserta Grup C
  // (kosong = diperlakukan sebagai 'Publik' demi kompatibilitas data lama).
  Berita: [
    'Id_Berita','Judul','Tanggal','Deskripsi','Link','Status'
  ]
};

/** Index kolom Berita (1-based). */
const BERITA_COL = { Id:1, Judul:2, Tanggal:3, Deskripsi:4, Link:5, Status:6 };

/** Opsi status berita yang valid. */
const BERITA_STATUS = ['Publik', 'Semua Peserta', 'Peserta Grup A', 'Peserta Grup B', 'Peserta Grup C'];

/** Index kolom (1-based) — single source of truth, hindari "magic number". */
const PESERTA_COL = {
  Id:1, Nama:2, Username:3, Password:4, Wa:5, Jk:6, TempatLahir:7, TanggalLahir:8,
  Nisnas:9, Sekolah:10, KelasSekolah:11, Wali:12, KelompokUmur:13, Kelas:14,
  Mulai:15, Akhir:16, Status:17, NomorPeserta:18,
  // 19-22 = legacy (deprecated, tidak dipakai). 23 = Kode_Referral (BARU).
  Referral:23
};
const RAPOR_COL = {
  Id:1, IdPeserta:2, Predikat:3, Catatan:4,
  B25:5, D25:6, K25:7, P25:8, B50:9, D50:10, K50:11, P50:12,
  Tanggal:13, IdPelatih:14, B25P:15, D25P:16, K25P:17, P25P:18
};

const SCHEDULE_RULES = {
  'Grup A': { location: 'Kenari Waterpark Bontang', sessions: [
    { day: 1, startTime: '16:00', endTime: '17:45' },
    { day: 3, startTime: '16:00', endTime: '17:45' },
    { day: 6, startTime: '16:00', endTime: '17:45' }
  ]},
  'Grup B': { location: 'Kenari Waterpark Bontang', sessions: [
    { day: 2, startTime: '16:00', endTime: '17:45' },
    { day: 4, startTime: '16:00', endTime: '17:45' },
    { day: 6, startTime: '07:00', endTime: '08:45' }
  ]},
  'Grup C': { location: 'Grand Equator Hotel Bontang', sessions: [
    { day: 6, startTime: '16:00', endTime: '17:45' },
    { day: 0, startTime: '08:00', endTime: '09:30' }
  ]}
};

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    let params = {};
    if (e.postData && e.postData.contents) params = JSON.parse(e.postData.contents);
    else if (e.parameter) params = e.parameter;
    const action = params.action;
    let result;
    switch (action) {
      case 'register':              result = registerPeserta(params); break;
      case 'login':                 result = login(params); break;
      case 'verifyResetIdentity':   result = verifyResetIdentity(params); break;
      case 'resetPassword':         result = resetPassword(params); break;
      case 'getJadwalPeserta':      result = getJadwalPeserta(params); break;
      case 'absen':                 result = absen(params); break;
      case 'izin':                  result = izin(params); break;
      case 'getKehadiranPeserta':   result = getKehadiranPeserta(params); break;
      case 'getRaporPeserta':       result = getRaporPeserta(params); break;
      case 'getDataLengkapPeserta': result = getDataLengkapPeserta(params); break;
      case 'updateProfilePeserta':  result = updateProfilePeserta(params); break;
      case 'getAllPeserta':         result = getAllPeserta(); break;
      case 'getPesertaById':        result = getDataLengkapPeserta({ id_peserta: params.id }); break;
      case 'updatePeserta':         result = updatePeserta(params); break;
      case 'deletePeserta':         result = deletePeserta(params); break;
      case 'getAllJadwal':          result = getAllJadwal(); break;
      case 'createJadwal':          result = createJadwal(params); break;
      case 'createJadwalBatch':     result = createJadwalBatch(params); break;
      case 'updateJadwal':          result = updateJadwal(params); break;
      case 'deleteJadwal':          result = deleteJadwal(params); break;
      case 'getJadwalAttendees':    result = getJadwalAttendees(params); break;
      case 'getAllKehadiran':       result = getAllKehadiran(params); break;
      case 'updateKehadiran':       result = updateKehadiran(params); break;
      case 'deleteKehadiran':       result = deleteKehadiran(params); break;
      case 'getKehadiranForExport': result = getKehadiranForExport(params); break;
      case 'getAllRapor':           result = getAllRapor(); break;
      case 'upsertRapor':           result = upsertRapor(params); break;
      case 'deleteRapor':           result = deleteRapor(params); break;
      case 'getAllBerita':          result = getAllBerita(params); break;
      case 'getActiveBerita':       result = getActiveBerita(params); break;
      case 'createBerita':          result = createBerita(params); break;
      case 'updateBerita':          result = updateBerita(params); break;
      case 'deleteBerita':          result = deleteBerita(params); break;
      case 'getPelatihList':        result = getPelatihList(); break;
      case 'getSettings':           result = getSettings(); break;
      case 'updateSettings':        result = updateSettings(params); break;
      case 'generateNomorPeserta':  result = generateNomorPeserta(params); break;
      case 'migrate':               result = migrateSheets(); break;
      default: result = { success: false, message: 'Action tidak dikenal: ' + action };
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Server error: ' + err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ====================== HELPERS ======================
function getSheet(name) { return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name); }
function generateId(prefix) { return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000); }
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => { const obj = {}; headers.forEach((h, i) => obj[h] = row[i]); return obj; });
}
function findRowIndex(sheet, idColumn, idValue) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][idColumn]) === String(idValue)) return i + 1;
  return -1;
}
function formatDate(d) {
  if (!d) return '';
  if (d instanceof Date) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return String(d);
}
function isTrue(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

/** Generate kode referral: 6 huruf kapital acak (A-Z). */
function generateReferral() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
  return code;
}

/** Validasi format kode referral: tepat 6 huruf (case-insensitive). */
function isValidReferralFormat(code) {
  return /^[A-Za-z]{6}$/.test(String(code || '').trim());
}

/**
 * Pastikan baris peserta punya Kode_Referral. Jika kosong, generate + simpan
 * ke sheet (idempotent, dipanggil saat baca data). Mengembalikan kode final.
 */
function ensureReferral(sheet, pesertaObj, rowIndex) {
  let code = String(pesertaObj.Kode_Referral || '').trim();
  if (!code) {
    code = generateReferral();
    if (rowIndex && rowIndex > 0) sheet.getRange(rowIndex, PESERTA_COL.Referral).setValue(code);
  }
  return code;
}

/**
 * Migrasi sekali-jalan: pastikan header kolom baru ada di sheet Peserta & Rapor.
 * Aman dijalankan berkali-kali (idempotent). Jalankan dari editor atau action=migrate.
 */
function migrateSheets() {
  const report = [];
  Object.keys(SHEET_HEADERS).forEach(name => {
    const sheet = getSheet(name);
    if (!sheet) { report.push(name + ': sheet tidak ada'); return; }
    const wanted = SHEET_HEADERS[name];
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    let added = 0;
    wanted.forEach((h, i) => {
      if (norm(current[i]) !== norm(h)) {
        sheet.getRange(1, i + 1).setValue(h);
        if (i + 1 > lastCol) added++;
      }
    });
    report.push(name + ': header disinkronkan (' + added + ' kolom baru)');
  });
  return { success: true, message: report.join(' • ') };
}

/** Hitung kelompok umur per 1 Januari tahun ini */
function calculateKelompokUmur(tanggalLahir) {
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
}

// ====================== AUTH ======================
function registerPeserta(p) {
  const sheet = getSheet('Peserta');
  if (sheetToObjects(sheet).some(x => x.Username === p.username)) return { success: false, message: 'Username sudah digunakan' };
  const id = generateId('PST');
  const kelompokUmur = calculateKelompokUmur(p.tanggal_lahir);

  // Kode referral: pakai input jika valid (6 huruf), selain itu generate otomatis.
  let referral = String(p.kode_referral || '').trim().toUpperCase();
  if (!isValidReferralFormat(referral)) referral = generateReferral();

  sheet.appendRow([
    id, p.nama_lengkap, p.username, p.password, p.nomor_whatsapp,
    p.jenis_kelamin || '', p.tempat_lahir || '', p.tanggal_lahir || '',
    p.nisnas || '', p.asal_sekolah || '', p.kelas_sekolah || '', p.wali_kelas || '',
    kelompokUmur, p.kelas || '', p.tanggal_mulai || '', p.tanggal_akhir || '', false,
    '',                 // 18 Nomor_Peserta (diisi admin sebelum LUNAS)
    '', '', '', '',     // 19-22 legacy (deprecated)
    referral            // 23 Kode_Referral
  ]);
  return { success: true, message: 'Registrasi berhasil. Lanjutkan via WhatsApp untuk pembayaran.', id: id, kode_referral: referral };
}

function login(p) {
  const admins = sheetToObjects(getSheet('Pelatih'));
  const admin = admins.find(a => a.Username === p.username && String(a.Password) === String(p.password));
  if (admin) return { success: true, role: 'admin', data: { id: admin.Id_Pelatih, nama: admin.Nama || admin.Username, username: admin.Username } };

  const pesertaSheet = getSheet('Peserta');
  const pesertas = sheetToObjects(pesertaSheet);
  const peserta = pesertas.find(x => x.Username === p.username && String(x.Password) === String(p.password));
  if (peserta) {
    if (!isTrue(peserta.Status_Pembayaran)) return { success: false, message: 'Pembayaran belum dikonfirmasi admin. Hubungi admin via WhatsApp.' };
    const refRow = findRowIndex(pesertaSheet, 0, peserta.Id_Peserta);
    const referral = ensureReferral(pesertaSheet, peserta, refRow);
    return { success: true, role: 'peserta', data: {
      id: peserta.Id_Peserta, nama: peserta.Nama_Lengkap, username: peserta.Username,
      kelas: peserta.Kelas, nomor_peserta: peserta.Nomor_Peserta || '',
      kode_referral: referral,
      tanggal_mulai: formatDate(peserta.Tanggal_Mulai), tanggal_akhir: formatDate(peserta.Tanggal_Akhir)
    } };
  }
  return { success: false, message: 'Username atau password salah' };
}

/**
 * Lupa password — verifikasi identitas pemilik akun.
 * Wajib cocok SEMUA: Nama_Lengkap + Tanggal_Lahir + Nomor_Whatsapp + NISNAS.
 * Dipakai oleh:
 *   - verifyResetIdentity : cek identitas saja (tanpa ubah password)
 *   - resetPassword       : cek identitas + simpan password baru
 */
function findPesertaByIdentity(p) {
  const waInput = String(p.nomor_whatsapp || '').replace(/[^0-9]/g, '');
  const nisnInput = String(p.nisnas || '').replace(/[^0-9A-Za-z]/g, '');
  return sheetToObjects(getSheet('Peserta')).find(x =>
    norm(x.Nama_Lengkap) === norm(p.nama_lengkap) &&
    formatDate(x.Tanggal_Lahir) === String(p.tanggal_lahir || '').trim() &&
    String(x.Nomor_Whatsapp).replace(/[^0-9]/g, '') === waInput &&
    String(x.NISNAS).replace(/[^0-9A-Za-z]/g, '') === nisnInput
  );
}

function verifyResetIdentity(p) {
  if (!p.nama_lengkap || !p.tanggal_lahir || !p.nomor_whatsapp) {
    return { success: false, message: 'Nama lengkap, tanggal lahir, dan nomor WhatsApp wajib diisi.' };
  }
  const peserta = findPesertaByIdentity(p);
  if (!peserta) return { success: false, message: 'Data tidak cocok. Pastikan semua data sesuai dengan saat pendaftaran.' };
  return { success: true, message: 'Identitas terverifikasi.', data: { id_peserta: peserta.Id_Peserta, username: peserta.Username } };
}

function resetPassword(p) {
  if (!p.nama_lengkap || !p.tanggal_lahir || !p.nomor_whatsapp || !p.nisnas) {
    return { success: false, message: 'Semua data verifikasi wajib diisi.' };
  }
  const sheet = getSheet('Peserta');
  const peserta = findPesertaByIdentity(p);
  if (!peserta) return { success: false, message: 'Data tidak cocok. Pastikan semua data sesuai dengan saat pendaftaran.' };
  if (!p.new_password || String(p.new_password).length < 6) return { success: false, message: 'Password baru minimal 6 karakter' };
  const row = findRowIndex(sheet, 0, peserta.Id_Peserta);
  if (row === -1) return { success: false, message: 'Peserta tidak ditemukan' };
  sheet.getRange(row, PESERTA_COL.Password).setValue(p.new_password);
  return { success: true, message: 'Password berhasil diperbarui. Silakan login.' };
}

// ====================== PESERTA - DASHBOARD ======================
function getJadwalPeserta(p) {
  const peserta = sheetToObjects(getSheet('Peserta')).find(x => x.Id_Peserta === p.id_peserta);
  if (!peserta) return { success: false, message: 'Peserta tidak ditemukan' };
  const allJadwal = sheetToObjects(getSheet('Jadwal'));
  const jadwal = allJadwal.filter(j => j.Id_Peserta === p.id_peserta || (!j.Id_Peserta && j.Kelas === peserta.Kelas));
  const kehadiran = sheetToObjects(getSheet('Kehadiran')).filter(k => k.Id_Peserta === p.id_peserta);
  const result = jadwal.map(j => {
    const k = kehadiran.find(x => x.Id_Jadwal === j.Id_Jadwal);
    return { ...j, Tanggal: formatDate(j.Tanggal), is_personal: !!j.Id_Peserta, sudah_absen: !!k, status_kehadiran: k ? (isTrue(k.Status) ? 'hadir' : 'izin') : null, catatan_izin: k ? (k.Catatan || '') : '' };
  });
  return { success: true, data: result, kelas: peserta.Kelas };
}

function absen(p) {
  const jadwal = sheetToObjects(getSheet('Jadwal')).find(j => j.Id_Jadwal === p.id_jadwal);
  if (!jadwal) return { success: false, message: 'Jadwal tidak ditemukan' };
  if (String(jadwal.Status).toLowerCase() !== 'aktif') return { success: false, message: 'Absensi belum dibuka. Status: ' + jadwal.Status };
  const sheet = getSheet('Kehadiran');
  if (sheetToObjects(sheet).find(k => k.Id_Jadwal === p.id_jadwal && k.Id_Peserta === p.id_peserta)) return { success: false, message: 'Anda sudah memberikan respons untuk jadwal ini' };
  sheet.appendRow([generateId('KHD'), p.id_jadwal, p.id_peserta, true, '']);
  return { success: true, message: 'Absensi berhasil dicatat' };
}

function izin(p) {
  const jadwal = sheetToObjects(getSheet('Jadwal')).find(j => j.Id_Jadwal === p.id_jadwal);
  if (!jadwal) return { success: false, message: 'Jadwal tidak ditemukan' };
  const sheet = getSheet('Kehadiran');
  if (sheetToObjects(sheet).find(k => k.Id_Jadwal === p.id_jadwal && k.Id_Peserta === p.id_peserta)) return { success: false, message: 'Anda sudah memberikan respons untuk jadwal ini' };
  sheet.appendRow([generateId('KHD'), p.id_jadwal, p.id_peserta, false, p.catatan || 'Tidak ada keterangan']);
  return { success: true, message: 'Izin berhasil dikirim ke pelatih' };
}

function getKehadiranPeserta(p) {
  const peserta = sheetToObjects(getSheet('Peserta')).find(x => x.Id_Peserta === p.id_peserta);
  if (!peserta) return { success: false, message: 'Peserta tidak ditemukan' };
  const allJadwal = sheetToObjects(getSheet('Jadwal')).filter(j => j.Id_Peserta === p.id_peserta || (!j.Id_Peserta && j.Kelas === peserta.Kelas));
  const kehadiran = sheetToObjects(getSheet('Kehadiran')).filter(k => k.Id_Peserta === p.id_peserta);
  const totalHadir = kehadiran.filter(k => isTrue(k.Status)).length;
  const totalIzin = kehadiran.filter(k => !isTrue(k.Status)).length;
  const persentase = allJadwal.length > 0 ? Math.round((totalHadir / allJadwal.length) * 100) : 0;
  return { success: true, data: { total_jadwal: allJadwal.length, total_hadir: totalHadir, total_izin: totalIzin, persentase: persentase } };
}

function getDataLengkapPeserta(p) {
  const sheet = getSheet('Peserta');
  const peserta = sheetToObjects(sheet).find(x => x.Id_Peserta === p.id_peserta);
  if (!peserta) return { success: false, message: 'Peserta tidak ditemukan' };
  const row = findRowIndex(sheet, 0, peserta.Id_Peserta);
  const referral = ensureReferral(sheet, peserta, row);
  return { success: true, data: { ...peserta, Kode_Referral: referral, Tanggal_Mulai: formatDate(peserta.Tanggal_Mulai), Tanggal_Akhir: formatDate(peserta.Tanggal_Akhir), Tanggal_Lahir: formatDate(peserta.Tanggal_Lahir) } };
}

/** Peserta memperbarui data dirinya sendiri (subset field yang aman). */
function updateProfilePeserta(p) {
  const sheet = getSheet('Peserta');
  const row = findRowIndex(sheet, 0, p.id_peserta);
  if (row === -1) return { success: false, message: 'Peserta tidak ditemukan' };
  if (p.nama_lengkap   !== undefined) sheet.getRange(row, PESERTA_COL.Nama).setValue(p.nama_lengkap);
  if (p.nomor_whatsapp !== undefined) sheet.getRange(row, PESERTA_COL.Wa).setValue(p.nomor_whatsapp);
  if (p.jenis_kelamin  !== undefined) sheet.getRange(row, PESERTA_COL.Jk).setValue(p.jenis_kelamin);
  if (p.tempat_lahir   !== undefined) sheet.getRange(row, PESERTA_COL.TempatLahir).setValue(p.tempat_lahir);
  if (p.tanggal_lahir  !== undefined && p.tanggal_lahir !== '') {
    sheet.getRange(row, PESERTA_COL.TanggalLahir).setValue(p.tanggal_lahir);
    sheet.getRange(row, PESERTA_COL.KelompokUmur).setValue(calculateKelompokUmur(p.tanggal_lahir));
  }
  if (p.nisnas        !== undefined) sheet.getRange(row, PESERTA_COL.Nisnas).setValue(p.nisnas);
  if (p.asal_sekolah  !== undefined) sheet.getRange(row, PESERTA_COL.Sekolah).setValue(p.asal_sekolah);
  if (p.kelas_sekolah !== undefined) sheet.getRange(row, PESERTA_COL.KelasSekolah).setValue(p.kelas_sekolah);
  if (p.wali_kelas    !== undefined) sheet.getRange(row, PESERTA_COL.Wali).setValue(p.wali_kelas);
  if (p.password      !== undefined && p.password !== '') sheet.getRange(row, PESERTA_COL.Password).setValue(p.password);
  return { success: true, message: 'Profil berhasil diperbarui' };
}

function getRaporPeserta(p) {
  const rapor = sheetToObjects(getSheet('Rapor')).find(r => r.Id_Peserta === p.id_peserta);
  if (!rapor) return { success: true, data: null, message: 'Rapor belum diunggah pelatih' };
  let namaPelatih = '';
  if (rapor.Id_Pelatih) {
    const pelatih = sheetToObjects(getSheet('Pelatih')).find(x => x.Id_Pelatih === rapor.Id_Pelatih);
    if (pelatih) namaPelatih = pelatih.Nama || pelatih.Username;
  }
  return { success: true, data: { ...rapor, Tanggal_Rapor: formatDate(rapor.Tanggal_Rapor), Nama_Pelatih: namaPelatih } };
}

// ====================== ADMIN - PESERTA ======================
function getAllPeserta() {
  const pesertaSheet = getSheet('Peserta');
  const pesertas = sheetToObjects(pesertaSheet);
  const allJadwal = sheetToObjects(getSheet('Jadwal'));
  const allKehadiran = sheetToObjects(getSheet('Kehadiran'));
  return { success: true, data: pesertas.map((p, i) => {
    const referral = ensureReferral(pesertaSheet, p, i + 2); // row = index + header(1) + 1-based(1)
    const totalJadwal = allJadwal.filter(j => j.Id_Peserta === p.Id_Peserta || (!j.Id_Peserta && j.Kelas === p.Kelas)).length;
    const totalHadir = allKehadiran.filter(k => k.Id_Peserta === p.Id_Peserta && isTrue(k.Status)).length;
    const persentase = totalJadwal > 0 ? Math.round((totalHadir / totalJadwal) * 100) : 0;
    let usia = '';
    if (p.Tanggal_Lahir) {
      const lahir = new Date(p.Tanggal_Lahir);
      if (!isNaN(lahir.getTime())) {
        const now = new Date();
        usia = now.getFullYear() - lahir.getFullYear();
        const m = now.getMonth() - lahir.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < lahir.getDate())) usia--;
      }
    }
    return { ...p, Kode_Referral: referral, Tanggal_Mulai: formatDate(p.Tanggal_Mulai), Tanggal_Akhir: formatDate(p.Tanggal_Akhir), Tanggal_Lahir: formatDate(p.Tanggal_Lahir), Usia: usia, total_jadwal: totalJadwal, total_hadir: totalHadir, persentase: persentase };
  })};
}

function updatePeserta(p) {
  const sheet = getSheet('Peserta');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Peserta tidak ditemukan' };
  const prevData = sheet.getRange(row, 1, 1, PESERTA_COL.NomorPeserta).getValues()[0];
  const prevPaid = isTrue(prevData[PESERTA_COL.Status - 1]);
  const newPaid = (p.status_pembayaran === true || p.status_pembayaran === 'true');

  // Nomor peserta final (payload jika ada, jika tidak pakai existing)
  const nomorPeserta = (p.nomor_peserta !== undefined)
    ? String(p.nomor_peserta).trim()
    : String(prevData[PESERTA_COL.NomorPeserta - 1] || '').trim();

  // GUARD: tidak boleh LUNAS tanpa Nomor_Peserta
  if (newPaid && !nomorPeserta) {
    return { success: false, code: 'NOMOR_PESERTA_REQUIRED', message: 'Nomor Peserta wajib diisi sebelum status diubah menjadi LUNAS.' };
  }

  if (p.nama_lengkap !== undefined) sheet.getRange(row, PESERTA_COL.Nama).setValue(p.nama_lengkap);
  if (p.username !== undefined) sheet.getRange(row, PESERTA_COL.Username).setValue(p.username);
  if (p.password !== undefined && p.password !== '') sheet.getRange(row, PESERTA_COL.Password).setValue(p.password);
  if (p.nomor_whatsapp !== undefined) sheet.getRange(row, PESERTA_COL.Wa).setValue(p.nomor_whatsapp);
  if (p.jenis_kelamin !== undefined) sheet.getRange(row, PESERTA_COL.Jk).setValue(p.jenis_kelamin);
  if (p.tempat_lahir !== undefined) sheet.getRange(row, PESERTA_COL.TempatLahir).setValue(p.tempat_lahir);
  if (p.tanggal_lahir !== undefined) {
    sheet.getRange(row, PESERTA_COL.TanggalLahir).setValue(p.tanggal_lahir);
    sheet.getRange(row, PESERTA_COL.KelompokUmur).setValue(calculateKelompokUmur(p.tanggal_lahir));
  }
  if (p.nisnas !== undefined) sheet.getRange(row, PESERTA_COL.Nisnas).setValue(p.nisnas);
  if (p.asal_sekolah !== undefined) sheet.getRange(row, PESERTA_COL.Sekolah).setValue(p.asal_sekolah);
  if (p.kelas_sekolah !== undefined) sheet.getRange(row, PESERTA_COL.KelasSekolah).setValue(p.kelas_sekolah);
  if (p.wali_kelas !== undefined) sheet.getRange(row, PESERTA_COL.Wali).setValue(p.wali_kelas);
  if (p.kelas !== undefined) sheet.getRange(row, PESERTA_COL.Kelas).setValue(p.kelas);
  if (p.tanggal_mulai !== undefined) sheet.getRange(row, PESERTA_COL.Mulai).setValue(p.tanggal_mulai);
  if (p.tanggal_akhir !== undefined) sheet.getRange(row, PESERTA_COL.Akhir).setValue(p.tanggal_akhir);
  if (p.nomor_peserta !== undefined) sheet.getRange(row, PESERTA_COL.NomorPeserta).setValue(nomorPeserta);
  if (p.status_pembayaran !== undefined) sheet.getRange(row, PESERTA_COL.Status).setValue(newPaid);

  let extra = '';
  if (newPaid && !prevPaid) {
    const gen = generateScheduleForPeserta(p.id);
    if (gen.success) extra = ' • ' + gen.count + ' jadwal kelas di-generate otomatis';
  }
  return { success: true, message: 'Data peserta diperbarui' + extra };
}

function deletePeserta(p) {
  const sheet = getSheet('Peserta');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Peserta tidak ditemukan' };
  sheet.deleteRow(row);
  return { success: true, message: 'Peserta dihapus' };
}

function generateScheduleForPeserta(idPeserta) {
  const peserta = sheetToObjects(getSheet('Peserta')).find(x => x.Id_Peserta === idPeserta);
  if (!peserta || !peserta.Kelas || !peserta.Tanggal_Mulai || !peserta.Tanggal_Akhir) return { success: false };
  const rules = SCHEDULE_RULES[peserta.Kelas];
  if (!rules) return { success: false };
  const start = new Date(peserta.Tanggal_Mulai), end = new Date(peserta.Tanggal_Akhir);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { success: false };

  const sheet = getSheet('Jadwal');
  const existing = sheetToObjects(sheet).filter(j => j.Kelas === peserta.Kelas && !j.Id_Peserta);
  const existingKeys = new Set(existing.map(j => formatDate(j.Tanggal) + '|' + j.Pukul));
  const admins = sheetToObjects(getSheet('Pelatih'));
  const idPelatih = admins.length > 0 ? admins[0].Id_Pelatih : 'PLT-001';

  let count = 0;
  const cursor = new Date(start.getTime()); cursor.setHours(0, 0, 0, 0);
  const endNorm = new Date(end.getTime()); endNorm.setHours(23, 59, 59, 999);
  const newRows = [];
  while (cursor.getTime() <= endNorm.getTime()) {
    const dow = cursor.getDay();
    rules.sessions.filter(s => s.day === dow).forEach(s => {
      const pukul = s.startTime + ' - ' + s.endTime;
      const key = formatDate(cursor) + '|' + pukul;
      if (!existingKeys.has(key)) {
        newRows.push([generateId('JDW'), idPelatih, '', new Date(cursor.getTime()), pukul, rules.location, peserta.Kelas, 'Pending']);
        existingKeys.add(key); count++;
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (newRows.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 8).setValues(newRows);
  return { success: true, count: count };
}

// ====================== ADMIN - JADWAL ======================
function getAllJadwal() {
  const jadwals = sheetToObjects(getSheet('Jadwal'));
  const pesertas = sheetToObjects(getSheet('Peserta'));
  return { success: true, data: jadwals.map(j => {
    let namaPeserta = '';
    if (j.Id_Peserta) {
      const ps = pesertas.find(x => x.Id_Peserta === j.Id_Peserta);
      if (ps) namaPeserta = ps.Nama_Lengkap;
    }
    return { ...j, Tanggal: formatDate(j.Tanggal), nama_peserta_personal: namaPeserta, is_personal: !!j.Id_Peserta };
  })};
}

function createJadwal(p) {
  const sheet = getSheet('Jadwal');
  let kelas = p.kelas || '';
  if (p.id_peserta) {
    const peserta = sheetToObjects(getSheet('Peserta')).find(x => x.Id_Peserta === p.id_peserta);
    if (peserta) kelas = peserta.Kelas;
  }
  const id = generateId('JDW');
  sheet.appendRow([id, p.id_pelatih, p.id_peserta || '', p.tanggal, p.pukul, p.lokasi, kelas, p.status || 'Pending']);
  return { success: true, message: 'Jadwal dibuat', id: id };
}

/**
 * Buat jadwal personal untuk BANYAK peserta sekaligus dalam 1 panggilan.
 * Efisien: 1x baca Peserta, 1x setValues batch (tidak appendRow per baris).
 * payload: { id_pelatih, tanggal, pukul, lokasi, status, peserta:[id,...] }
 */
function createJadwalBatch(p) {
  const peserta = Array.isArray(p.peserta) ? p.peserta.filter(Boolean) : [];
  if (peserta.length === 0) return { success: false, message: 'Minimal pilih 1 peserta' };
  if (!p.tanggal || !p.pukul || !p.lokasi) return { success: false, message: 'Tanggal, pukul, dan lokasi wajib diisi' };

  const sheet = getSheet('Jadwal');
  const pesertaMap = {};
  sheetToObjects(getSheet('Peserta')).forEach(x => pesertaMap[x.Id_Peserta] = x);

  const rows = peserta.map((idPeserta, i) => {
    const ps = pesertaMap[idPeserta];
    const kelas = ps ? ps.Kelas : (p.kelas || '');
    return [generateId('JDW') + '-' + i, p.id_pelatih, idPeserta, p.tanggal, p.pukul, p.lokasi, kelas, p.status || 'Pending'];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  return { success: true, message: rows.length + ' jadwal personal berhasil dibuat', count: rows.length };
}

function updateJadwal(p) {
  const sheet = getSheet('Jadwal');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Jadwal tidak ditemukan' };
  if (p.id_peserta !== undefined) sheet.getRange(row, 3).setValue(p.id_peserta || '');
  if (p.tanggal !== undefined) sheet.getRange(row, 4).setValue(p.tanggal);
  if (p.pukul !== undefined) sheet.getRange(row, 5).setValue(p.pukul);
  if (p.lokasi !== undefined) sheet.getRange(row, 6).setValue(p.lokasi);
  if (p.kelas !== undefined) sheet.getRange(row, 7).setValue(p.kelas);
  if (p.status !== undefined) sheet.getRange(row, 8).setValue(p.status);
  return { success: true, message: 'Jadwal diperbarui' };
}

function deleteJadwal(p) {
  const sheet = getSheet('Jadwal');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Jadwal tidak ditemukan' };
  sheet.deleteRow(row);
  return { success: true, message: 'Jadwal dihapus' };
}

function getJadwalAttendees(p) {
  const jadwal = sheetToObjects(getSheet('Jadwal')).find(j => j.Id_Jadwal === p.id_jadwal);
  if (!jadwal) return { success: false, message: 'Jadwal tidak ditemukan' };
  const pesertas = sheetToObjects(getSheet('Peserta'));
  let attendees;
  if (jadwal.Id_Peserta) attendees = pesertas.filter(x => x.Id_Peserta === jadwal.Id_Peserta);
  else attendees = pesertas.filter(x => x.Kelas === jadwal.Kelas && isTrue(x.Status_Pembayaran));
  const kehadiran = sheetToObjects(getSheet('Kehadiran')).filter(k => k.Id_Jadwal === p.id_jadwal);
  const data = attendees.map(ps => {
    const k = kehadiran.find(x => x.Id_Peserta === ps.Id_Peserta);
    let status = 'belum';
    if (k) status = isTrue(k.Status) ? 'hadir' : 'izin';
    return { id_peserta: ps.Id_Peserta, nama: ps.Nama_Lengkap, kelas: ps.Kelas, status: status, catatan: k ? (k.Catatan || '') : '' };
  });
  return { success: true, data: data, jadwal: { ...jadwal, Tanggal: formatDate(jadwal.Tanggal), is_personal: !!jadwal.Id_Peserta } };
}

// ====================== ADMIN - KEHADIRAN ======================
function getAllKehadiran(p) {
  const kehadirans = sheetToObjects(getSheet('Kehadiran'));
  const pesertas = sheetToObjects(getSheet('Peserta'));
  const jadwals = sheetToObjects(getSheet('Jadwal'));
  let enriched = kehadirans.map(k => {
    const ps = pesertas.find(x => x.Id_Peserta === k.Id_Peserta);
    const jd = jadwals.find(j => j.Id_Jadwal === k.Id_Jadwal);
    return { ...k, nama_peserta: ps ? ps.Nama_Lengkap : '-', tanggal: jd ? formatDate(jd.Tanggal) : '-', tanggal_raw: jd ? jd.Tanggal : null, pukul: jd ? jd.Pukul : '-', kelas: jd ? jd.Kelas : '-', lokasi: jd ? jd.Lokasi : '-', status_label: isTrue(k.Status) ? 'hadir' : 'izin' };
  });
  if (p && p.periode && p.periode !== 'all') {
    const now = new Date();
    enriched = enriched.filter(k => {
      if (!k.tanggal_raw) return false;
      const tgl = new Date(k.tanggal_raw);
      if (p.periode === 'minggu') return (now - tgl) <= 7 * 86400000 && (now - tgl) >= 0;
      if (p.periode === 'bulan') return tgl.getMonth() === now.getMonth() && tgl.getFullYear() === now.getFullYear();
      if (p.periode === 'tahun') return tgl.getFullYear() === now.getFullYear();
      return true;
    });
  }
  return { success: true, data: enriched };
}

function updateKehadiran(p) {
  const sheet = getSheet('Kehadiran');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Kehadiran tidak ditemukan' };
  if (p.status !== undefined) sheet.getRange(row, 4).setValue(p.status === true || p.status === 'true');
  if (p.catatan !== undefined) sheet.getRange(row, 5).setValue(p.catatan);
  return { success: true, message: 'Kehadiran diperbarui' };
}

function deleteKehadiran(p) {
  const sheet = getSheet('Kehadiran');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Kehadiran tidak ditemukan' };
  sheet.deleteRow(row);
  return { success: true, message: 'Kehadiran dihapus' };
}

function getKehadiranForExport(p) {
  if (!p.kelas || !p.tanggal_dari || !p.tanggal_sampai) return { success: false, message: 'Kelas dan periode wajib diisi' };
  const dari = new Date(p.tanggal_dari); dari.setHours(0, 0, 0, 0);
  const sampai = new Date(p.tanggal_sampai); sampai.setHours(23, 59, 59, 999);

  const allPeserta = sheetToObjects(getSheet('Peserta')).filter(x => x.Kelas === p.kelas);
  const allJadwal = sheetToObjects(getSheet('Jadwal')).filter(j => {
    if (j.Id_Peserta) return false;
    if (j.Kelas !== p.kelas) return false;
    const tgl = new Date(j.Tanggal);
    return tgl >= dari && tgl <= sampai;
  });
  const allKehadiran = sheetToObjects(getSheet('Kehadiran'));

  const dateSet = new Set();
  allJadwal.forEach(j => dateSet.add(formatDate(j.Tanggal)));
  const dates = Array.from(dateSet).sort();

  const peserta = allPeserta.map(ps => {
    const attendance = {};
    dates.forEach(d => {
      const jadwalsForDate = allJadwal.filter(j => formatDate(j.Tanggal) === d);
      if (jadwalsForDate.length === 0) { attendance[d] = ''; return; }
      let status = 'A';
      for (const j of jadwalsForDate) {
        const k = allKehadiran.find(x => x.Id_Jadwal === j.Id_Jadwal && x.Id_Peserta === ps.Id_Peserta);
        if (k) { status = isTrue(k.Status) ? 'H' : 'I'; break; }
      }
      attendance[d] = status;
    });
    return { id: ps.Id_Peserta, nama: ps.Nama_Lengkap, attendance: attendance };
  });
  return { success: true, data: { dates: dates, peserta: peserta, kelas: p.kelas, periode: { dari: p.tanggal_dari, sampai: p.tanggal_sampai } } };
}

// ====================== ADMIN - RAPOR ======================
function getAllRapor() {
  const rapors = sheetToObjects(getSheet('Rapor'));
  const pesertas = sheetToObjects(getSheet('Peserta'));
  return { success: true, data: rapors.map(r => {
    const ps = pesertas.find(x => x.Id_Peserta === r.Id_Peserta);
    return { ...r, nama_peserta: ps ? ps.Nama_Lengkap : '-', Tanggal_Rapor: formatDate(r.Tanggal_Rapor) };
  })};
}

function upsertRapor(p) {
  const sheet = getSheet('Rapor');
  const existing = findRowIndex(sheet, 1, p.id_peserta);
  if (existing !== -1) {
    if (p.predikat !== undefined) sheet.getRange(existing, RAPOR_COL.Predikat).setValue(p.predikat);
    if (p.catatan !== undefined) sheet.getRange(existing, RAPOR_COL.Catatan).setValue(p.catatan);
    if (p.waktu_25_bebas !== undefined) sheet.getRange(existing, RAPOR_COL.B25).setValue(p.waktu_25_bebas);
    if (p.waktu_25_dada !== undefined) sheet.getRange(existing, RAPOR_COL.D25).setValue(p.waktu_25_dada);
    if (p.waktu_25_kupu !== undefined) sheet.getRange(existing, RAPOR_COL.K25).setValue(p.waktu_25_kupu);
    if (p.waktu_25_punggung !== undefined) sheet.getRange(existing, RAPOR_COL.P25).setValue(p.waktu_25_punggung);
    if (p.waktu_50_bebas !== undefined) sheet.getRange(existing, RAPOR_COL.B50).setValue(p.waktu_50_bebas);
    if (p.waktu_50_dada !== undefined) sheet.getRange(existing, RAPOR_COL.D50).setValue(p.waktu_50_dada);
    if (p.waktu_50_kupu !== undefined) sheet.getRange(existing, RAPOR_COL.K50).setValue(p.waktu_50_kupu);
    if (p.waktu_50_punggung !== undefined) sheet.getRange(existing, RAPOR_COL.P50).setValue(p.waktu_50_punggung);
    if (p.waktu_25_bebas_pelampung !== undefined) sheet.getRange(existing, RAPOR_COL.B25P).setValue(p.waktu_25_bebas_pelampung);
    if (p.waktu_25_dada_pelampung !== undefined) sheet.getRange(existing, RAPOR_COL.D25P).setValue(p.waktu_25_dada_pelampung);
    if (p.waktu_25_kupu_pelampung !== undefined) sheet.getRange(existing, RAPOR_COL.K25P).setValue(p.waktu_25_kupu_pelampung);
    if (p.waktu_25_punggung_pelampung !== undefined) sheet.getRange(existing, RAPOR_COL.P25P).setValue(p.waktu_25_punggung_pelampung);
    sheet.getRange(existing, RAPOR_COL.Tanggal).setValue(new Date());
    if (p.id_pelatih) sheet.getRange(existing, RAPOR_COL.IdPelatih).setValue(p.id_pelatih);
    return { success: true, message: 'Rapor diperbarui' };
  }
  sheet.appendRow([generateId('RPR'), p.id_peserta, p.predikat || '', p.catatan || '',
    p.waktu_25_bebas || '', p.waktu_25_dada || '', p.waktu_25_kupu || '', p.waktu_25_punggung || '',
    p.waktu_50_bebas || '', p.waktu_50_dada || '', p.waktu_50_kupu || '', p.waktu_50_punggung || '',
    new Date(), p.id_pelatih || '',
    p.waktu_25_bebas_pelampung || '', p.waktu_25_dada_pelampung || '',
    p.waktu_25_kupu_pelampung || '', p.waktu_25_punggung_pelampung || '']);
  return { success: true, message: 'Rapor dibuat' };
}

function deleteRapor(p) {
  const sheet = getSheet('Rapor');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Rapor tidak ditemukan' };
  sheet.deleteRow(row);
  return { success: true, message: 'Rapor dihapus' };
}

// ====================== BERITA ======================
/** Pastikan kolom header 'Status' ada di sheet Berita (self-heal, idempotent). */
function ensureBeritaStatusHeader() {
  const sheet = getSheet('Berita');
  if (!sheet) return;
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (norm(headers[BERITA_COL.Status - 1]) !== norm('Status')) {
    sheet.getRange(1, BERITA_COL.Status).setValue('Status');
  }
}

/** Normalisasi status berita; nilai kosong/legacy diperlakukan sebagai 'Publik'. */
function normBeritaStatus(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return 'Publik';
  const found = BERITA_STATUS.find(opt => norm(opt) === norm(s));
  return found || 'Publik';
}

/**
 * Tentukan apakah sebuah berita boleh tampil untuk audiens tertentu.
 * @param status   status berita (sudah dinormalisasi)
 * @param audience 'public' | 'peserta' | nama kelas ('Grup A' dst.) | 'admin'
 */
function beritaVisibleFor(status, audience) {
  if (audience === 'admin') return true;
  if (audience === 'public') return status === 'Publik';
  // Peserta (punya kelas) — Publik & Semua Peserta selalu tampil; berita grup hanya untuk grupnya.
  if (status === 'Publik' || status === 'Semua Peserta') return true;
  const kelas = String(audience || '').trim();        // mis. 'Grup A'
  return status === 'Peserta ' + kelas;
}

/**
 * Ambil berita sesuai audiens.
 *   - admin (default, tanpa param)   : SEMUA berita (untuk panel admin).
 *   - p.audience='public'            : hanya berita Publik (index.html).
 *   - p.kelas='Grup A' (peserta)     : Publik + Semua Peserta + Peserta Grup A.
 */
function getAllBerita(p) {
  p = p || {};
  ensureBeritaStatusHeader();
  let audience = 'admin';
  if (p.audience === 'public') audience = 'public';
  else if (p.kelas) audience = String(p.kelas).trim();

  const berita = sheetToObjects(getSheet('Berita')).map(b => {
    const status = normBeritaStatus(b.Status);
    return Object.assign({}, b, { Tanggal: formatDate(b.Tanggal), Status: status });
  }).filter(b => beritaVisibleFor(b.Status, audience));

  berita.sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal));
  return { success: true, data: berita };
}

/** Khusus index.html (publik) — hanya berita berstatus Publik. */
function getActiveBerita(p) {
  return getAllBerita({ audience: 'public' });
}

function createBerita(p) {
  const sheet = getSheet('Berita');
  ensureBeritaStatusHeader();
  const id = generateId('BRT');
  const status = normBeritaStatus(p.status);
  sheet.appendRow([id, p.judul, p.tanggal || new Date(), p.deskripsi || '', p.link || '', status]);
  return { success: true, message: 'Berita dibuat', id: id };
}

function updateBerita(p) {
  const sheet = getSheet('Berita');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Berita tidak ditemukan' };
  if (p.judul !== undefined) sheet.getRange(row, BERITA_COL.Judul).setValue(p.judul);
  if (p.tanggal !== undefined) sheet.getRange(row, BERITA_COL.Tanggal).setValue(p.tanggal);
  if (p.deskripsi !== undefined) sheet.getRange(row, BERITA_COL.Deskripsi).setValue(p.deskripsi);
  if (p.link !== undefined) sheet.getRange(row, BERITA_COL.Link).setValue(p.link);
  if (p.status !== undefined) sheet.getRange(row, BERITA_COL.Status).setValue(normBeritaStatus(p.status));
  return { success: true, message: 'Berita diperbarui' };
}

function deleteBerita(p) {
  const sheet = getSheet('Berita');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Berita tidak ditemukan' };
  sheet.deleteRow(row);
  return { success: true, message: 'Berita dihapus' };
}

// ====================== SETTINGS (ScriptProperties) ======================
/**
 * Dua variabel penyimpan nomor urut TERAKHIR yang dipakai untuk men-generate
 * Nomor_Peserta otomatis:
 *   - seq_ac : nomor urut terakhir untuk Grup A & Grup C (berbagi counter)
 *   - seq_b  : nomor urut terakhir untuk Grup B (counter tersendiri)
 * Disimpan di Script Properties agar persisten & dapat diubah admin.
 */
const SETTINGS_KEYS = { ac: 'NOMOR_SEQ_AC', b: 'NOMOR_SEQ_B' };

function getSettings() {
  const props = PropertiesService.getScriptProperties();
  const ac = parseInt(props.getProperty(SETTINGS_KEYS.ac), 10);
  const b = parseInt(props.getProperty(SETTINGS_KEYS.b), 10);
  return { success: true, data: {
    seq_ac: isNaN(ac) ? 0 : ac,
    seq_b: isNaN(b) ? 0 : b
  }};
}

function updateSettings(p) {
  const props = PropertiesService.getScriptProperties();
  if (p.seq_ac !== undefined) {
    const n = parseInt(p.seq_ac, 10);
    if (isNaN(n) || n < 0) return { success: false, message: 'Nomor urut Grup A/C harus berupa angka ≥ 0.' };
    props.setProperty(SETTINGS_KEYS.ac, String(n));
  }
  if (p.seq_b !== undefined) {
    const n = parseInt(p.seq_b, 10);
    if (isNaN(n) || n < 0) return { success: false, message: 'Nomor urut Grup B harus berupa angka ≥ 0.' };
    props.setProperty(SETTINGS_KEYS.b, String(n));
  }
  return { success: true, message: 'Pengaturan nomor peserta disimpan', data: getSettings().data };
}

/** Counter key (ac/b) berdasarkan kelas peserta. */
function counterKeyForKelas(kelas) {
  return (String(kelas).trim() === 'Grup B') ? 'b' : 'ac'; // Grup A & C -> ac
}

/** Bagian ddmmyy (6 digit) dari tanggal lahir. */
function ddmmyyFromDate(tanggalLahir) {
  const d = new Date(tanggalLahir);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return dd + mm + yy;
}

/** Semua Nomor_Peserta yang sudah terpakai (untuk jaminan unik). */
function existingNomorSet(excludeId) {
  const set = {};
  sheetToObjects(getSheet('Peserta')).forEach(p => {
    if (excludeId && p.Id_Peserta === excludeId) return;
    const n = String(p.Nomor_Peserta || '').trim();
    if (n) set[n] = true;
  });
  return set;
}

/**
 * Generate Nomor_Peserta otomatis untuk seorang peserta:
 *   format = ddmmyy(6) + urut(4).
 * Counter diambil dari Script Properties (ac/b), di-increment, dijamin unik,
 * lalu disimpan kembali. Nomor ditulis ke baris peserta.
 */
function generateNomorPeserta(p) {
  const sheet = getSheet('Peserta');
  const row = findRowIndex(sheet, 0, p.id_peserta);
  if (row === -1) return { success: false, message: 'Peserta tidak ditemukan' };

  const peserta = sheetToObjects(sheet).find(x => x.Id_Peserta === p.id_peserta);
  const tgl = peserta.Tanggal_Lahir;
  const ddmmyy = ddmmyyFromDate(tgl);
  if (!ddmmyy) return { success: false, message: 'Tanggal lahir peserta tidak valid sehingga nomor tidak dapat dibuat.' };

  const kelas = peserta.Kelas;
  const which = counterKeyForKelas(kelas);
  const propKey = SETTINGS_KEYS[which];
  const props = PropertiesService.getScriptProperties();

  let seq = parseInt(props.getProperty(propKey), 10);
  if (isNaN(seq) || seq < 0) seq = 0;

  const used = existingNomorSet(p.id_peserta);
  let nomor = '';
  // Increment hingga ditemukan nomor unik (urut + ddmmyy).
  for (let i = 0; i < 100000; i++) {
    seq += 1;
    const urut = String(seq).padStart(4, '0');
    nomor = ddmmyy + urut;
    if (!used[nomor]) break;
  }

  props.setProperty(propKey, String(seq));
  sheet.getRange(row, PESERTA_COL.NomorPeserta).setValue(nomor);

  return { success: true, message: 'Nomor peserta dibuat: ' + nomor, data: {
    nomor_peserta: nomor, counter: which, seq: seq
  }};
}

function getPelatihList() {
  const list = sheetToObjects(getSheet('Pelatih')).map(p => ({ id: p.Id_Pelatih, nama: p.Nama || p.Username, username: p.Username }));
  return { success: true, data: list };
}

function setupAdminDefault() {
  const sheet = getSheet('Pelatih');
  if (sheet.getLastRow() < 2) {
    sheet.appendRow(['PLT-001', 'Muhtar', 'admin', 'admin123']);
    Logger.log('Admin default: admin / admin123');
  }
}
