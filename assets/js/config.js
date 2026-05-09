/**
 * ===================================================================
 * KONFIGURASI APLIKASI — Bontang Aquatik
 * ===================================================================
 */

const CONFIG = {
  // ⚠️ GANTI dengan URL Web App dari Apps Script
  API_URL: 'https://script.google.com/macros/s/AKfycbyNTcjN9PU3LH1HqOZRpCD7wqI4ehjhHMSC9q3Jyx5_9Cb0AOQ-KAVs6VNVaYw4IkJZ9g/exec',

  // Brand
  BRAND_NAME: 'Bontang Aquatik',
  BRAND_TAGLINE: 'Klub Pelatihan Renang Profesional di Bontang',

  // Kontak
  CONTACT: {
    whatsapp: '62816679671',         // nomor admin (untuk redirect setelah registrasi)
    email: 'bontangakuatikswimmingclub@gmail.com',
    alamat: 'Bontang, Kalimantan Timur'
  },

  // Pesan otomatis ke admin setelah registrasi (request 10)
  WA_REGISTRATION_MESSAGE:
    'Halo, saya telah melakukan pendaftaran pelatihan renang Bontang Aquatik. ' +
    'Apakah bisa dibantu untuk melanjutkan sistem pembayaran. Terima Kasih',

  // Pilihan kelas
  KELAS_OPTIONS: ['Grup A', 'Grup B', 'Grup C'],
  STATUS_JADWAL: ['Aktif', 'Pending', 'Cancel'],

  // Detail kelas (untuk section "Kelas Tersedia") — request 6
  KELAS_DETAIL: {
    'Grup A': {
      lokasi: 'Kenari Waterpark Bontang',
      jadwal_label: 'Senin, Rabu, Sabtu',
      jam_label: '16:00 - 17:45 WITA',
      frekuensi: '3x seminggu',
      tarif: 400000,
      tarif_label: 'Rp 400.000',
      mascot: '🐬',
      mascot_name: 'Tim Lumba-Lumba',
      color: 'blue',
      recommended: false,
      fasilitas: ['Pelatih profesional', 'Laporan kemajuan', 'Pendampingan event lomba']
    },
    'Grup B': {
      lokasi: 'Kenari Waterpark Bontang',
      jadwal_label: 'Selasa, Kamis, Sabtu',
      jam_label: 'Sel/Kam 16:00 • Sab 07:00 WITA',
      frekuensi: '3x seminggu',
      tarif: 400000,
      tarif_label: 'Rp 400.000',
      mascot: '🦈',
      mascot_name: 'Tim Hiu',
      color: 'orange',
      recommended: true,                // ⭐ HIGHLIGHT
      fasilitas: ['Pelatih profesional', 'Laporan kemajuan', 'Pendampingan event lomba']
    },
    'Grup C': {
      lokasi: 'Grand Equator Hotel Bontang',
      jadwal_label: 'Sabtu & Minggu',
      jam_label: 'Sab 16:00 • Min 08:00 WITA',
      frekuensi: '2x seminggu',
      tarif: 100000,
      tarif_label: 'Rp 100.000',
      mascot: '🐢',
      mascot_name: 'Tim Kura-Kura',
      color: 'green',
      recommended: false,
      fasilitas: ['Pelatih profesional', 'Laporan kemajuan', 'Pendampingan event lomba']
    }
  },

  // Jadwal mingguan per grup (untuk visualisasi schedule section — request 7)
  WEEKLY_SCHEDULE: {
    'Grup A': [
      { hari: 'Senin',  jam: '16:00 - 17:45' },
      { hari: 'Rabu',   jam: '16:00 - 17:45' },
      { hari: 'Sabtu',  jam: '16:00 - 17:45' }
    ],
    'Grup B': [
      { hari: 'Selasa', jam: '16:00 - 17:45' },
      { hari: 'Kamis',  jam: '16:00 - 17:45' },
      { hari: 'Sabtu',  jam: '07:00 - 08:45' }
    ],
    'Grup C': [
      { hari: 'Sabtu',  jam: '16:00 - 17:30' },
      { hari: 'Minggu', jam: '08:00 - 09:30' }
    ]
  },

  // Lokasi maps (untuk footer carousel — request 5)
  LOCATIONS: [
    {
      name: 'Kenari Waterpark Bontang',
      address: 'Bontang, Kalimantan Timur',
      mapsUrl: 'https://maps.app.goo.gl/CJRNytfi6htyRrYWA',
      embedSrc: 'https://maps.google.com/maps?q=Kolam+Renang+Kenari+Bontang&z=16&output=embed'
    },
    {
      name: 'Grand Equator Hotel Bontang',
      address: 'Bontang, Kalimantan Timur',
      mapsUrl: 'https://maps.app.goo.gl/pAW9yPUd2trFCzqG8',
      embedSrc: 'https://maps.google.com/maps?q=Kolam+Renang+Ekuator+Bontang&z=16&output=embed'
    }
  ],

  // Peralatan latihan untuk modal absensi (request 11)
  EQUIPMENT_INFO: {
    pemula: ['Pakaian renang', 'Kacamata renang', 'Papan pelampung'],
    lanjut: ['Pakaian renang', 'Kacamata renang', 'Papan pelampung', 'Pull buoy', 'Hand paddles', 'Fins (ukuran pendek)'],
    lain: ['Perlengkapan mandi untuk bilas'],
    tambahan: [
      'Awali & akhiri latihan dengan doa dan stretching',
      'Jeda makan besar ≥ 1 jam sebelum latihan; makan setelah latihan',
      'Bawa air minum (tidak dingin), disarankan air hangat'
    ]
  },

  // Usia minimum
  MIN_AGE: 5
};

/**
 * Helper format Rupiah.
 */
function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
