/**
 * ===================================================================
 * BACKEND API v2 - Bontang Aquatik
 *
 * SETUP SPREADSHEET:
 * Buat 5 sheet (nama HARUS persis):
 *
 * Sheet "Peserta": 10 kolom (A-J)
 *   Id_Peserta | Nama_Lengkap | Username | Password | Nomor_Whatsapp |
 *   Usia | Kelas | Tanggal_Mulai | Tanggal_Akhir | Status_Pembayaran
 *
 * Sheet "Pelatih": 3 kolom (A-C)
 *   Id_Pelatih | Username | Password
 *
 * Sheet "Jadwal": 7 kolom (A-G)
 *   Id_Jadwal | Id_Pelatih | Tanggal | Pukul | Lokasi | Kelas | Status
 *
 * Sheet "Kehadiran": 5 kolom (A-E)
 *   Id_Kehadiran | Id_Jadwal | Id_Peserta | Status | Catatan
 *
 * Sheet "Rapor": 5 kolom (A-E)
 *   Id_Rapor | Id_Peserta | Nilai | Predikat | Catatan
 * ===================================================================
 */

// ⚠️ GANTI dengan ID Spreadsheet Anda
const SPREADSHEET_ID = '1Jvndc1jgdlx4iSw2nNp9ezAM-MbU12Y8o1R_nrmLmQw';

// ⚠️ Aturan Jadwal Per Kelas (untuk auto-generate)
// Day: 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
const SCHEDULE_RULES = {
  'Grup A': {
    location: 'Kenari Waterpark Bontang',
    sessions: [
      { day: 1, startTime: '16:00', endTime: '17:45' }, // Senin
      { day: 3, startTime: '16:00', endTime: '17:45' }, // Rabu
      { day: 6, startTime: '16:00', endTime: '17:45' }  // Sabtu
    ]
  },
  'Grup B': {
    location: 'Kenari Waterpark Bontang',
    sessions: [
      { day: 2, startTime: '16:00', endTime: '17:45' }, // Selasa
      { day: 4, startTime: '16:00', endTime: '17:45' }, // Kamis
      { day: 6, startTime: '07:00', endTime: '08:45' }  // Sabtu pagi
    ]
  },
  'Grup C': {
    location: 'Grand Equator Hotel Bontang',
    sessions: [
      { day: 6, startTime: '16:00', endTime: '17:30' }, // Sabtu
      { day: 0, startTime: '08:00', endTime: '09:30' }  // Minggu
    ]
  }
};

// ====================== ENTRY POINTS ======================

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    let params = {};
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
    }
    const action = params.action;
    let result;

    switch (action) {
      // AUTH
      case 'register':              result = registerPeserta(params); break;
      case 'login':                 result = login(params); break;

      // PESERTA - dashboard
      case 'getJadwalPeserta':      result = getJadwalPeserta(params); break;
      case 'absen':                 result = absen(params); break;
      case 'izin':                  result = izin(params); break;
      case 'getKehadiranPeserta':   result = getKehadiranPeserta(params); break;
      case 'getRaporPeserta':       result = getRaporPeserta(params); break;

      // ADMIN - PESERTA
      case 'getAllPeserta':         result = getAllPeserta(); break;
      case 'updatePeserta':         result = updatePeserta(params); break;
      case 'deletePeserta':         result = deletePeserta(params); break;

      // ADMIN - JADWAL
      case 'getAllJadwal':          result = getAllJadwal(); break;
      case 'createJadwal':          result = createJadwal(params); break;
      case 'updateJadwal':          result = updateJadwal(params); break;
      case 'deleteJadwal':          result = deleteJadwal(params); break;
      case 'getJadwalAttendees':    result = getJadwalAttendees(params); break;

      // ADMIN - KEHADIRAN
      case 'getAllKehadiran':       result = getAllKehadiran(params); break;
      case 'updateKehadiran':       result = updateKehadiran(params); break;
      case 'deleteKehadiran':       result = deleteKehadiran(params); break;

      // ADMIN - RAPOR
      case 'getAllRapor':           result = getAllRapor(); break;
      case 'upsertRapor':           result = upsertRapor(params); break;
      case 'deleteRapor':           result = deleteRapor(params); break;

      default:
        result = { success: false, message: 'Action tidak dikenal: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, message: 'Server error: ' + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ====================== HELPERS ======================

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}
function generateId(prefix) {
  // Microseconds + random untuk hindari tabrakan saat batch generate
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
}
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}
function findRowIndex(sheet, idColumn, idValue) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColumn]) === String(idValue)) return i + 1;
  }
  return -1;
}
function formatDate(d) {
  if (!d) return '';
  if (d instanceof Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }
  return String(d);
}
function isTrue(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

// ====================== AUTH ======================

function registerPeserta(p) {
  const sheet = getSheet('Peserta');
  const all = sheetToObjects(sheet);
  if (all.some(x => x.Username === p.username)) {
    return { success: false, message: 'Username sudah digunakan' };
  }
  const id = generateId('PST');
  // Simpan kelas/tanggal yang dipilih saat registrasi (admin masih bisa ubah)
  sheet.appendRow([
    id,
    p.nama_lengkap,
    p.username,
    p.password,
    p.nomor_whatsapp,
    Number(p.usia) || '',
    p.kelas || '',
    p.tanggal_mulai || '',
    p.tanggal_akhir || '',
    false
  ]);
  return {
    success: true,
    message: 'Registrasi berhasil. Silakan lanjutkan via WhatsApp untuk konfirmasi pembayaran.',
    id: id
  };
}

function login(p) {
  const adminSheet = getSheet('Pelatih');
  const admins = sheetToObjects(adminSheet);
  const admin = admins.find(a => a.Username === p.username && String(a.Password) === String(p.password));
  if (admin) {
    return { success: true, role: 'admin', data: { id: admin.Id_Pelatih, username: admin.Username } };
  }

  const pesertas = sheetToObjects(getSheet('Peserta'));
  const peserta = pesertas.find(x => x.Username === p.username && String(x.Password) === String(p.password));
  if (peserta) {
    if (!isTrue(peserta.Status_Pembayaran)) {
      return { success: false, message: 'Pembayaran belum dikonfirmasi admin. Silakan hubungi admin via WhatsApp.' };
    }
    return {
      success: true, role: 'peserta',
      data: {
        id: peserta.Id_Peserta,
        nama: peserta.Nama_Lengkap,
        username: peserta.Username,
        usia: peserta.Usia,
        kelas: peserta.Kelas,
        tanggal_mulai: formatDate(peserta.Tanggal_Mulai),
        tanggal_akhir: formatDate(peserta.Tanggal_Akhir)
      }
    };
  }
  return { success: false, message: 'Username atau password salah' };
}

// ====================== PESERTA - DASHBOARD ======================

function getJadwalPeserta(p) {
  const peserta = sheetToObjects(getSheet('Peserta')).find(x => x.Id_Peserta === p.id_peserta);
  if (!peserta) return { success: false, message: 'Peserta tidak ditemukan' };

  const jadwal = sheetToObjects(getSheet('Jadwal')).filter(j => j.Kelas === peserta.Kelas);
  const kehadiran = sheetToObjects(getSheet('Kehadiran')).filter(k => k.Id_Peserta === p.id_peserta);

  const result = jadwal.map(j => {
    const k = kehadiran.find(x => x.Id_Jadwal === j.Id_Jadwal);
    return {
      ...j,
      Tanggal: formatDate(j.Tanggal),
      sudah_absen: !!k,
      status_kehadiran: k ? (isTrue(k.Status) ? 'hadir' : 'izin') : null,
      catatan_izin: k ? (k.Catatan || '') : ''
    };
  });
  return { success: true, data: result, kelas: peserta.Kelas };
}

function absen(p) {
  const jadwal = sheetToObjects(getSheet('Jadwal')).find(j => j.Id_Jadwal === p.id_jadwal);
  if (!jadwal) return { success: false, message: 'Jadwal tidak ditemukan' };
  if (String(jadwal.Status).toLowerCase() !== 'aktif') {
    return { success: false, message: 'Absensi belum dibuka. Status jadwal: ' + jadwal.Status };
  }
  const sheet = getSheet('Kehadiran');
  const existing = sheetToObjects(sheet).find(k => k.Id_Jadwal === p.id_jadwal && k.Id_Peserta === p.id_peserta);
  if (existing) return { success: false, message: 'Anda sudah memberikan respons untuk jadwal ini' };

  const id = generateId('KHD');
  sheet.appendRow([id, p.id_jadwal, p.id_peserta, true, '']);
  return { success: true, message: 'Absensi berhasil dicatat ✅' };
}

function izin(p) {
  const jadwal = sheetToObjects(getSheet('Jadwal')).find(j => j.Id_Jadwal === p.id_jadwal);
  if (!jadwal) return { success: false, message: 'Jadwal tidak ditemukan' };
  const sheet = getSheet('Kehadiran');
  const existing = sheetToObjects(sheet).find(k => k.Id_Jadwal === p.id_jadwal && k.Id_Peserta === p.id_peserta);
  if (existing) return { success: false, message: 'Anda sudah memberikan respons untuk jadwal ini' };

  const id = generateId('KHD');
  sheet.appendRow([id, p.id_jadwal, p.id_peserta, false, p.catatan || 'Tidak ada keterangan']);
  return { success: true, message: 'Izin berhasil dikirim ke pelatih 📨' };
}

function getKehadiranPeserta(p) {
  const peserta = sheetToObjects(getSheet('Peserta')).find(x => x.Id_Peserta === p.id_peserta);
  if (!peserta) return { success: false, message: 'Peserta tidak ditemukan' };

  const allJadwal = sheetToObjects(getSheet('Jadwal')).filter(j => j.Kelas === peserta.Kelas);
  const kehadiran = sheetToObjects(getSheet('Kehadiran')).filter(k => k.Id_Peserta === p.id_peserta);
  const totalHadir = kehadiran.filter(k => isTrue(k.Status)).length;
  const totalIzin = kehadiran.filter(k => !isTrue(k.Status)).length;
  const totalJadwal = allJadwal.length;
  const persentase = totalJadwal > 0 ? Math.round((totalHadir / totalJadwal) * 100) : 0;

  return {
    success: true,
    data: {
      total_jadwal: totalJadwal,
      total_hadir: totalHadir,
      total_izin: totalIzin,
      persentase: persentase
    }
  };
}

function getRaporPeserta(p) {
  const rapor = sheetToObjects(getSheet('Rapor')).find(r => r.Id_Peserta === p.id_peserta);
  if (!rapor) {
    return { success: true, data: null, message: 'Rapor belum diunggah pelatih' };
  }
  return { success: true, data: rapor };
}

// ====================== ADMIN - PESERTA ======================

function getAllPeserta() {
  const pesertas = sheetToObjects(getSheet('Peserta'));
  const allJadwal = sheetToObjects(getSheet('Jadwal'));
  const allKehadiran = sheetToObjects(getSheet('Kehadiran'));

  const enriched = pesertas.map(p => {
    const totalJadwal = allJadwal.filter(j => j.Kelas === p.Kelas).length;
    const totalHadir = allKehadiran.filter(k => k.Id_Peserta === p.Id_Peserta && isTrue(k.Status)).length;
    const persentase = totalJadwal > 0 ? Math.round((totalHadir / totalJadwal) * 100) : 0;
    return {
      ...p,
      Tanggal_Mulai: formatDate(p.Tanggal_Mulai),
      Tanggal_Akhir: formatDate(p.Tanggal_Akhir),
      total_jadwal: totalJadwal,
      total_hadir: totalHadir,
      persentase: persentase
    };
  });
  return { success: true, data: enriched };
}

function updatePeserta(p) {
  const sheet = getSheet('Peserta');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Peserta tidak ditemukan' };

  // Cek apakah pembayaran berubah dari FALSE ke TRUE → trigger generate jadwal
  const prevData = sheet.getRange(row, 1, 1, 10).getValues()[0];
  const prevPaid = isTrue(prevData[9]);
  const newPaid = (p.status_pembayaran === true || p.status_pembayaran === 'true');

  // Kolom: B=Nama, C=Username, D=Password, E=WA, F=Usia, G=Kelas, H=TglMulai, I=TglAkhir, J=Status
  if (p.nama_lengkap !== undefined) sheet.getRange(row, 2).setValue(p.nama_lengkap);
  if (p.username !== undefined) sheet.getRange(row, 3).setValue(p.username);
  if (p.password !== undefined && p.password !== '') sheet.getRange(row, 4).setValue(p.password);
  if (p.nomor_whatsapp !== undefined) sheet.getRange(row, 5).setValue(p.nomor_whatsapp);
  if (p.usia !== undefined && p.usia !== '') sheet.getRange(row, 6).setValue(Number(p.usia));
  if (p.kelas !== undefined) sheet.getRange(row, 7).setValue(p.kelas);
  if (p.tanggal_mulai !== undefined) sheet.getRange(row, 8).setValue(p.tanggal_mulai);
  if (p.tanggal_akhir !== undefined) sheet.getRange(row, 9).setValue(p.tanggal_akhir);
  if (p.status_pembayaran !== undefined) sheet.getRange(row, 10).setValue(newPaid);

  let extra = '';
  if (newPaid && !prevPaid) {
    // Auto-generate jadwal saat pembayaran dikonfirmasi pertama kali
    const genResult = generateScheduleForPeserta(p.id);
    if (genResult.success) {
      extra = ' • ' + genResult.count + ' jadwal di-generate otomatis';
    }
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

// ====================== AUTO-GENERATE SCHEDULE ======================

/**
 * Generate jadwal otomatis untuk peserta sesuai SCHEDULE_RULES.
 * Hanya menambah tanggal yang BELUM ada (skip duplikat).
 */
function generateScheduleForPeserta(idPeserta) {
  const peserta = sheetToObjects(getSheet('Peserta')).find(x => x.Id_Peserta === idPeserta);
  if (!peserta) return { success: false, message: 'Peserta tidak ditemukan' };
  if (!peserta.Kelas || !peserta.Tanggal_Mulai || !peserta.Tanggal_Akhir) {
    return { success: false, message: 'Kelas / tanggal mulai / tanggal akhir belum diisi' };
  }
  const rules = SCHEDULE_RULES[peserta.Kelas];
  if (!rules) return { success: false, message: 'Kelas tidak dikenali: ' + peserta.Kelas };

  const start = new Date(peserta.Tanggal_Mulai);
  const end = new Date(peserta.Tanggal_Akhir);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { success: false, message: 'Format tanggal tidak valid' };
  }

  const sheet = getSheet('Jadwal');
  const existing = sheetToObjects(sheet).filter(j => j.Kelas === peserta.Kelas);
  const existingKeys = new Set(
    existing.map(j => formatDate(j.Tanggal) + '|' + j.Pukul)
  );

  // Pakai pelatih pertama
  const admins = sheetToObjects(getSheet('Pelatih'));
  const idPelatih = admins.length > 0 ? admins[0].Id_Pelatih : 'PLT-001';

  let count = 0;
  const cursor = new Date(start.getTime());
  const tzOffset = cursor.getTimezoneOffset() * 60000;
  cursor.setHours(0, 0, 0, 0);
  const endNorm = new Date(end.getTime());
  endNorm.setHours(23, 59, 59, 999);

  // Batch rows untuk efisiensi
  const newRows = [];
  while (cursor.getTime() <= endNorm.getTime()) {
    const dow = cursor.getDay();
    const sessions = rules.sessions.filter(s => s.day === dow);
    sessions.forEach(s => {
      const pukul = s.startTime + ' - ' + s.endTime;
      const key = formatDate(cursor) + '|' + pukul;
      if (!existingKeys.has(key)) {
        const id = generateId('JDW');
        newRows.push([id, idPelatih, new Date(cursor.getTime()), pukul, rules.location, peserta.Kelas, 'Pending']);
        existingKeys.add(key);
        count++;
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 7).setValues(newRows);
  }
  return { success: true, count: count };
}

// ====================== ADMIN - JADWAL ======================

function getAllJadwal() {
  const jadwals = sheetToObjects(getSheet('Jadwal')).map(j => ({
    ...j,
    Tanggal: formatDate(j.Tanggal)
  }));
  return { success: true, data: jadwals };
}

function createJadwal(p) {
  const sheet = getSheet('Jadwal');
  const id = generateId('JDW');
  sheet.appendRow([id, p.id_pelatih, p.tanggal, p.pukul, p.lokasi, p.kelas, p.status || 'Pending']);
  return { success: true, message: 'Jadwal dibuat', id: id };
}

function updateJadwal(p) {
  const sheet = getSheet('Jadwal');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Jadwal tidak ditemukan' };
  if (p.tanggal !== undefined) sheet.getRange(row, 3).setValue(p.tanggal);
  if (p.pukul !== undefined) sheet.getRange(row, 4).setValue(p.pukul);
  if (p.lokasi !== undefined) sheet.getRange(row, 5).setValue(p.lokasi);
  if (p.kelas !== undefined) sheet.getRange(row, 6).setValue(p.kelas);
  if (p.status !== undefined) sheet.getRange(row, 7).setValue(p.status);
  return { success: true, message: 'Jadwal diperbarui' };
}

function deleteJadwal(p) {
  const sheet = getSheet('Jadwal');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Jadwal tidak ditemukan' };
  sheet.deleteRow(row);
  return { success: true, message: 'Jadwal dihapus' };
}

/**
 * Ambil daftar peserta + status kehadiran untuk satu jadwal.
 */
function getJadwalAttendees(p) {
  const jadwal = sheetToObjects(getSheet('Jadwal')).find(j => j.Id_Jadwal === p.id_jadwal);
  if (!jadwal) return { success: false, message: 'Jadwal tidak ditemukan' };

  const pesertasInClass = sheetToObjects(getSheet('Peserta')).filter(x =>
    x.Kelas === jadwal.Kelas && isTrue(x.Status_Pembayaran)
  );
  const kehadiran = sheetToObjects(getSheet('Kehadiran')).filter(k => k.Id_Jadwal === p.id_jadwal);

  const data = pesertasInClass.map(ps => {
    const k = kehadiran.find(x => x.Id_Peserta === ps.Id_Peserta);
    let status = 'belum';
    if (k) status = isTrue(k.Status) ? 'hadir' : 'izin';
    return {
      id_peserta: ps.Id_Peserta,
      nama: ps.Nama_Lengkap,
      kelas: ps.Kelas,
      status: status,
      catatan: k ? (k.Catatan || '') : ''
    };
  });
  return {
    success: true,
    data: data,
    jadwal: {
      ...jadwal,
      Tanggal: formatDate(jadwal.Tanggal)
    }
  };
}

// ====================== ADMIN - KEHADIRAN ======================

function getAllKehadiran(p) {
  const kehadirans = sheetToObjects(getSheet('Kehadiran'));
  const pesertas = sheetToObjects(getSheet('Peserta'));
  const jadwals = sheetToObjects(getSheet('Jadwal'));

  let enriched = kehadirans.map(k => {
    const ps = pesertas.find(x => x.Id_Peserta === k.Id_Peserta);
    const jd = jadwals.find(j => j.Id_Jadwal === k.Id_Jadwal);
    return {
      ...k,
      nama_peserta: ps ? ps.Nama_Lengkap : '-',
      tanggal: jd ? formatDate(jd.Tanggal) : '-',
      tanggal_raw: jd ? jd.Tanggal : null,
      pukul: jd ? jd.Pukul : '-',
      kelas: jd ? jd.Kelas : '-',
      lokasi: jd ? jd.Lokasi : '-',
      status_label: isTrue(k.Status) ? 'hadir' : 'izin'
    };
  });

  if (p && p.periode && p.periode !== 'all') {
    const now = new Date();
    enriched = enriched.filter(k => {
      if (!k.tanggal_raw) return false;
      const tgl = new Date(k.tanggal_raw);
      if (p.periode === 'minggu') {
        const seminggu = 7 * 24 * 60 * 60 * 1000;
        return (now - tgl) <= seminggu && (now - tgl) >= 0;
      }
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

// ====================== ADMIN - RAPOR ======================

function getAllRapor() {
  const rapors = sheetToObjects(getSheet('Rapor'));
  const pesertas = sheetToObjects(getSheet('Peserta'));
  const enriched = rapors.map(r => {
    const ps = pesertas.find(x => x.Id_Peserta === r.Id_Peserta);
    return { ...r, nama_peserta: ps ? ps.Nama_Lengkap : '-' };
  });
  return { success: true, data: enriched };
}

/**
 * Insert atau update rapor.
 * - Jika rapor untuk Id_Peserta sudah ada → update.
 * - Jika belum → insert baru.
 */
function upsertRapor(p) {
  const sheet = getSheet('Rapor');
  const existing = findRowIndex(sheet, 1, p.id_peserta); // kolom B = Id_Peserta
  if (existing !== -1) {
    if (p.nilai !== undefined) sheet.getRange(existing, 3).setValue(p.nilai);
    if (p.predikat !== undefined) sheet.getRange(existing, 4).setValue(p.predikat);
    if (p.catatan !== undefined) sheet.getRange(existing, 5).setValue(p.catatan);
    return { success: true, message: 'Rapor diperbarui' };
  }
  const id = generateId('RPR');
  sheet.appendRow([id, p.id_peserta, p.nilai || '', p.predikat || '', p.catatan || '']);
  return { success: true, message: 'Rapor dibuat', id: id };
}

function deleteRapor(p) {
  const sheet = getSheet('Rapor');
  const row = findRowIndex(sheet, 0, p.id);
  if (row === -1) return { success: false, message: 'Rapor tidak ditemukan' };
  sheet.deleteRow(row);
  return { success: true, message: 'Rapor dihapus' };
}

// ====================== SETUP ======================

/**
 * Jalankan SEKALI dari editor untuk membuat admin default.
 */
function setupAdminDefault() {
  const sheet = getSheet('Pelatih');
  if (sheet.getLastRow() < 2) {
    sheet.appendRow(['PLT-001', 'admin', 'admin123']);
    Logger.log('Admin default: admin / admin123');
  } else {
    Logger.log('Admin sudah ada');
  }
}
