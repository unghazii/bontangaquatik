/**
 * BACKEND API v3 - Bontang Aquatik Swimming Club
 *
 * SHEET STRUCTURE:
 * Peserta: Id_Peserta | Nama_Lengkap | Username | Password | Nomor_Whatsapp |
 *   Jenis_Kelamin | Tempat_Lahir | Tanggal_Lahir | NISNAS | Asal_Sekolah |
 *   Kelas_Sekolah | Wali_Kelas | Kelompok_Umur | Kelas | Tanggal_Mulai | Tanggal_Akhir | Status_Pembayaran
 *
 * Pelatih: Id_Pelatih | Nama | Username | Password
 *
 * Jadwal: Id_Jadwal | Id_Pelatih | Id_Peserta | Tanggal | Pukul | Lokasi | Kelas | Status
 * Id_Peserta kosong = jadwal kelas; berisi ID = jadwal personal
 *
 * Kehadiran: Id_Kehadiran | Id_Jadwal | Id_Peserta | Status | Catatan
 *
 * Rapor: Id_Rapor | Id_Peserta | Predikat | Catatan |
 *   Waktu_25_Bebas | Waktu_25_Dada | Waktu_25_Kupu | Waktu_25_Punggung |
 *   Waktu_50_Bebas | Waktu_50_Dada | Waktu_50_Kupu | Waktu_50_Punggung |
 *   Tanggal_Rapor | Id_Pelatih
 *
 * Berita: Id_Berita | Judul | Tanggal | Deskripsi | Link
 */

const SPREADSHEET_ID = '1Jvndc1jgdlx4iSw2nNp9ezAM-MbU12Y8o1R_nrmLmQw';

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
      case 'getJadwalPeserta':      result = getJadwalPeserta(params); break;
      case 'absen':                 result = absen(params); break;
      case 'izin':                  result = izin(params); break;
      case 'getKehadiranPeserta':   result = getKehadiranPeserta(params); break;
      case 'getRaporPeserta':       result = getRaporPeserta(params); break;
      case 'getDataLengkapPeserta': result = getDataLengkapPeserta(params); break;
      case 'getAllPeserta':         result = getAllPeserta(); break;
      case 'getPesertaById':        result = getDataLengkapPeserta({ id_peserta: params.id }); break;
      case 'updatePeserta':         result = updatePeserta(params); break;
      case 'deletePeserta':         result = deletePeserta(params); break;
      case 'getAllJadwal':          result = getAllJadwal(); break;
      case 'createJadwal':          result = createJadwal(params); break;
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
      case 'getAllBerita':          result = getAllBerita(); break;
      case 'getActiveBerita':       result = getAllBerita(); break;
      case 'createBerita':          result = createBerita(params); break;
      case 'updateBerita':          result = updateBerita(params); break;
      case 'deleteBerita':          result = deleteBerita(params); break;
      case 'getPelatihList':        result = getPelatihList(); break;
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
  sheet.appendRow([
    id, p.nama_lengkap, p.username, p.password, p.nomor_whatsapp,
    p.jenis_kelamin || '', p.tempat_lahir || '', p.tanggal_lahir || '',
    p.nisnas || '', p.asal_sekolah || '', p.kelas_sekolah || '', p.wali_kelas || '',
    kelompokUmur, p.kelas || '', p.tanggal_mulai || '', p.tanggal_akhir || '', false
  ]);
  return { success: true, message: 'Registrasi berhasil. Lanjutkan via WhatsApp untuk pembayaran.', id: id };
}

function login(p) {
  const admins = sheetToObjects(getSheet('Pelatih'));
  const admin = admins.find(a => a.Username === p.username && String(a.Password) === String(p.password));
  if (admin) return { success: true, role: 'admin', data: { id: admin.Id_Pelatih, nama: admin.Nama || admin.Username, username: admin.Username } };

  const pesertas = sheetToObjects(getSheet('Peserta'));
  const peserta = pesertas.find(x => x.Username === p.username && String(x.Password) === String(p.password));
  if (peserta) {
    if (!isTrue(peserta.Status_Pembayaran)) return { success: false, message: 'Pembayaran belum dikonfirmasi admin. Hubungi admin via WhatsApp.' };
    return { success: true, role: 'peserta', data: { id: peserta.Id_Peserta, nama: peserta.Nama_Lengkap, username: peserta.Username, kelas: peserta.Kelas, tanggal_mulai: formatDate(peserta.Tanggal_Mulai), tanggal_akhir: formatDate(peserta.Tanggal_Akhir) } };
  }
  return { success: false, message: 'Username atau password salah' };
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
  return { success: true, message: 'Absensi berhasil dicatat ✅' };
}

function izin(p) {
  const jadwal = sheetToObjects(getSheet('Jadwal')).find(j => j.Id_Jadwal === p.id_jadwal);
  if (!jadwal) return { success: false, message: 'Jadwal tidak ditemukan' };
  const sheet = getSheet('Kehadiran');
  if (sheetToObjects(sheet).find(k => k.Id_Jadwal === p.id_jadwal && k.Id_Peserta === p.id_peserta)) return { success: false, message: 'Anda sudah memberikan respons untuk jadwal ini' };
  sheet.appendRow([generateId('KHD'), p.id_jadwal, p.id_peserta, false, p.catatan || 'Tidak ada keterangan']);
  return { success: true, message: 'Izin berhasil dikirim ke pelatih 📨' };
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
  const peserta = sheetToObjects(getSheet('Peserta')).find(x => x.Id_Peserta === p.id_peserta);
  if (!peserta) return { success: false, message: 'Peserta tidak ditemukan' };
  return { success: true, data: { ...peserta, Tanggal_Mulai: formatDate(peserta.Tanggal_Mulai), Tanggal_Akhir: formatDate(peserta.Tanggal_Akhir), Tanggal_Lahir: formatDate(peserta.Tanggal_Lahir) } };
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
  const pesertas = sheetToObjects(getSheet('Peserta'));
  const allJadwal = sheetToObjects(getSheet('Jadwal'));
  const allKehadiran = sheetToObjects(getSheet('Kehadiran'));
  return { success: true, data: pesertas.map(p => {
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
    return { ...p, Tanggal_Mulai: formatDate(p.Tanggal_Mulai), Tanggal_Akhir: formatDate(p.Tanggal_Akhir), Tanggal_Lahir: formatDate(p.Tanggal_Lahir), Usia: usia, total_jadwal: totalJadwal, total_hadir: totalHadir, persentase: persentase };
  })};
}

function updatePeserta(p) {
  const sheet = getSheet('Peserta');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Peserta tidak ditemukan' };
  const prevData = sheet.getRange(row, 1, 1, 17).getValues()[0];
  const prevPaid = isTrue(prevData[16]);
  const newPaid = (p.status_pembayaran === true || p.status_pembayaran === 'true');

  if (p.nama_lengkap !== undefined) sheet.getRange(row, 2).setValue(p.nama_lengkap);
  if (p.username !== undefined) sheet.getRange(row, 3).setValue(p.username);
  if (p.password !== undefined && p.password !== '') sheet.getRange(row, 4).setValue(p.password);
  if (p.nomor_whatsapp !== undefined) sheet.getRange(row, 5).setValue(p.nomor_whatsapp);
  if (p.jenis_kelamin !== undefined) sheet.getRange(row, 6).setValue(p.jenis_kelamin);
  if (p.tempat_lahir !== undefined) sheet.getRange(row, 7).setValue(p.tempat_lahir);
  if (p.tanggal_lahir !== undefined) {
    sheet.getRange(row, 8).setValue(p.tanggal_lahir);
    sheet.getRange(row, 13).setValue(calculateKelompokUmur(p.tanggal_lahir));
  }
  if (p.nisnas !== undefined) sheet.getRange(row, 9).setValue(p.nisnas);
  if (p.asal_sekolah !== undefined) sheet.getRange(row, 10).setValue(p.asal_sekolah);
  if (p.kelas_sekolah !== undefined) sheet.getRange(row, 11).setValue(p.kelas_sekolah);
  if (p.wali_kelas !== undefined) sheet.getRange(row, 12).setValue(p.wali_kelas);
  if (p.kelas !== undefined) sheet.getRange(row, 14).setValue(p.kelas);
  if (p.tanggal_mulai !== undefined) sheet.getRange(row, 15).setValue(p.tanggal_mulai);
  if (p.tanggal_akhir !== undefined) sheet.getRange(row, 16).setValue(p.tanggal_akhir);
  if (p.status_pembayaran !== undefined) sheet.getRange(row, 17).setValue(newPaid);

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

/** Data terstruktur untuk export Excel buku absensi */
function getKehadiranForExport(p) {
  if (!p.kelas || !p.tanggal_dari || !p.tanggal_sampai) return { success: false, message: 'Kelas dan periode wajib diisi' };
  const dari = new Date(p.tanggal_dari); dari.setHours(0, 0, 0, 0);
  const sampai = new Date(p.tanggal_sampai); sampai.setHours(23, 59, 59, 999);

  const allPeserta = sheetToObjects(getSheet('Peserta')).filter(x => x.Kelas === p.kelas);
  const allJadwal = sheetToObjects(getSheet('Jadwal')).filter(j => {
    if (j.Id_Peserta) return false; // hanya jadwal kelas
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
    if (p.predikat !== undefined) sheet.getRange(existing, 3).setValue(p.predikat);
    if (p.catatan !== undefined) sheet.getRange(existing, 4).setValue(p.catatan);
    if (p.waktu_25_bebas !== undefined) sheet.getRange(existing, 5).setValue(p.waktu_25_bebas);
    if (p.waktu_25_dada !== undefined) sheet.getRange(existing, 6).setValue(p.waktu_25_dada);
    if (p.waktu_25_kupu !== undefined) sheet.getRange(existing, 7).setValue(p.waktu_25_kupu);
    if (p.waktu_25_punggung !== undefined) sheet.getRange(existing, 8).setValue(p.waktu_25_punggung);
    if (p.waktu_50_bebas !== undefined) sheet.getRange(existing, 9).setValue(p.waktu_50_bebas);
    if (p.waktu_50_dada !== undefined) sheet.getRange(existing, 10).setValue(p.waktu_50_dada);
    if (p.waktu_50_kupu !== undefined) sheet.getRange(existing, 11).setValue(p.waktu_50_kupu);
    if (p.waktu_50_punggung !== undefined) sheet.getRange(existing, 12).setValue(p.waktu_50_punggung);
    sheet.getRange(existing, 13).setValue(new Date());
    if (p.id_pelatih) sheet.getRange(existing, 14).setValue(p.id_pelatih);
    return { success: true, message: 'Rapor diperbarui' };
  }
  sheet.appendRow([generateId('RPR'), p.id_peserta, p.predikat || '', p.catatan || '',
    p.waktu_25_bebas || '', p.waktu_25_dada || '', p.waktu_25_kupu || '', p.waktu_25_punggung || '',
    p.waktu_50_bebas || '', p.waktu_50_dada || '', p.waktu_50_kupu || '', p.waktu_50_punggung || '',
    new Date(), p.id_pelatih || '']);
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
function getAllBerita() {
  const berita = sheetToObjects(getSheet('Berita')).map(b => ({ ...b, Tanggal: formatDate(b.Tanggal) }));
  berita.sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal));
  return { success: true, data: berita };
}

function createBerita(p) {
  const sheet = getSheet('Berita');
  const id = generateId('BRT');
  sheet.appendRow([id, p.judul, p.tanggal || new Date(), p.deskripsi || '', p.link || '']);
  return { success: true, message: 'Berita dibuat', id: id };
}

function updateBerita(p) {
  const sheet = getSheet('Berita');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Berita tidak ditemukan' };
  if (p.judul !== undefined) sheet.getRange(row, 2).setValue(p.judul);
  if (p.tanggal !== undefined) sheet.getRange(row, 3).setValue(p.tanggal);
  if (p.deskripsi !== undefined) sheet.getRange(row, 4).setValue(p.deskripsi);
  if (p.link !== undefined) sheet.getRange(row, 5).setValue(p.link);
  return { success: true, message: 'Berita diperbarui' };
}

function deleteBerita(p) {
  const sheet = getSheet('Berita');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Berita tidak ditemukan' };
  sheet.deleteRow(row);
  return { success: true, message: 'Berita dihapus' };
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
