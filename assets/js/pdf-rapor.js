/* ============================================================
   PDF RAPOR GENERATOR
   Menggunakan jsPDF + jsPDF-AutoTable (load via CDN di HTML)
   Format mengikuti contoh resmi Bontang Aquatik Swimming Club
   ============================================================ */
const PDFRapor = {

  /** Cache gambar agar tidak fetch berulang kali */
  _imgCache: {},

  /**
   * Load gambar dari path → data URL (base64 PNG).
   * WEBP otomatis di-convert ke PNG via canvas agar kompatibel dengan jsPDF.
   * Hasil di-cache pada PDFRapor._imgCache.
   */
  // async loadImageAsDataURL(path) {
  //   if (this._imgCache[path]) return this._imgCache[path];

  //   return new Promise((resolve, reject) => {
  //     const img = new Image();
  //     img.crossOrigin = 'anonymous';
  //     img.onload = () => {
  //       try {
  //         const canvas = document.createElement('canvas');
  //         canvas.width = img.naturalWidth;
  //         canvas.height = img.naturalHeight;
  //         const ctx = canvas.getContext('2d');
  //         ctx.drawImage(img, 0, 0);
  //         const dataURL = canvas.toDataURL('image/png');
  //         this._imgCache[path] = {
  //           dataURL,
  //           width: img.naturalWidth,
  //           height: img.naturalHeight
  //         };
  //         resolve(this._imgCache[path]);
  //       } catch (err) {
  //         reject(err);
  //       }
  //     };
  //     img.onerror = () => reject(new Error(`Gagal memuat gambar: ${path}`));
  //     img.src = path;
  //   });
  // },

  async loadImageAsDataURL(path) {
  if (this._imgCache[path]) return this._imgCache[path];

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const dataURL = canvas.toDataURL('image/png');

        const result = {
          dataURL,
          width: img.naturalWidth,
          height: img.naturalHeight
        };

        this._imgCache[path] = result;
        resolve(result);

      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error(`Gagal load gambar: ${path}`));
    };

    img.src = path;
  });
  },

  /** Format waktu dari database → display "01.08.12" atau "-" */
  fmtWaktu(v) {
    if (!v || String(v).trim() === '' || String(v).trim() === '-') return '-';
    return String(v).trim();
  },

  /** Pisahkan tempat & tanggal lahir untuk display gabungan */
  fmtTTL(tempat, tanggal) {
    const t = tempat || '-';
    if (!tanggal) return t;
    return `${t}, ${Utils.formatDate(tanggal)}`;
  },

  /** Format tanggal Indonesia "3 Desember 2025" */
  fmtTanggalID(d) {
    if (!d) return '-';
    return Utils.formatDateLong(d);
  },

  /** Get current year for kelompok umur label */
  currentYear() { return new Date().getFullYear(); },

  /**
   * Gambar kop surat (header) di atas dokumen.
   * Layout: [logo bontang kiri]  [judul + alamat + email center]  [logo klub kanan]
   *         ───────────── garis horizontal ─────────────
   * @returns Y-coordinate cursor setelah header (siap untuk konten berikutnya).
   */
  async drawHeader(doc, pageWidth, marginX) {
    const headerTopY = 10;        // jarak header dari atas halaman
    const logoSize   = 22;        // tinggi/lebar maks logo (mm)
    const logoLeftX  = marginX;
    const logoRightX = pageWidth - marginX - logoSize;

    // Coba load kedua logo. Kalau salah satu gagal, tetap lanjut tanpa logo itu.
    let logoKiri = null, logoKanan = null;
    try { logoKiri  = await this.loadImageAsDataURL('assets/images/bontang.png'); } catch (e) { console.warn(e.message); }
    try { logoKanan = await this.loadImageAsDataURL('assets/images/logo.png');   } catch (e) { console.warn(e.message); }

    // Render logo (proporsi terjaga: fit ke kotak logoSize × logoSize)
    const drawLogo = (img, x) => {
      if (!img) return;
      const ratio = img.width / img.height;
      let w = logoSize, h = logoSize;
      if (ratio > 1) { h = logoSize / ratio; } else { w = logoSize * ratio; }
      // Center di dalam slot logoSize × logoSize
      const dx = x + (logoSize - w) / 2;
      const dy = headerTopY + (logoSize - h) / 2;
      // doc.addImage(img.dataURL, 'PNG', dx, dy, w, h);
      const format = img.dataURL.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(img.dataURL, format, dx, dy, w, h);
    };
    drawLogo(logoKiri,  logoLeftX);
    drawLogo(logoKanan, logoRightX);

    // ---- TEKS TENGAH ----
    // Area teks: di antara dua logo (dengan sedikit padding)
    const textPadding = 4;
    const textLeftX   = logoLeftX + logoSize + textPadding;
    const textRightX  = logoRightX - textPadding;
    const textCenterX = (textLeftX + textRightX) / 2;

    // Baris 1: Judul tebal besar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('BONTANG AQUATIK SWIMMING CLUB', textCenterX, headerTopY + 6, { align: 'center' });

    // Baris 2: Alamat
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Gg. Selancar 7C, No. 7, RT 28, Kel. Api-Api, Kec. Bontang Utara, Kota Bontang',
      textCenterX, headerTopY + 12, { align: 'center' });

    // Baris 3: Email (biru, underline) | telepon (hitam)
    const email = 'bontangakuatikswimmingclub@gmail.com';
    const sep   = '  |  ';
    const phone = '+62816679671';

    doc.setFontSize(9.5);
    const emailW = doc.getTextWidth(email);
    const sepW   = doc.getTextWidth(sep);
    const phoneW = doc.getTextWidth(phone);
    const totalW = emailW + sepW + phoneW;

    const lineY  = headerTopY + 18;
    let drawX    = textCenterX - totalW / 2;

    // Email — biru + underline
    doc.setTextColor(30, 90, 200);
    doc.text(email, drawX, lineY);
    doc.setLineWidth(0.2);
    doc.setDrawColor(30, 90, 200);
    doc.line(drawX, lineY + 0.7, drawX + emailW, lineY + 0.7);
    drawX += emailW;

    // Separator — hitam
    doc.setTextColor(0, 0, 0);
    doc.text(sep, drawX, lineY);
    drawX += sepW;

    // Phone — hitam
    doc.text(phone, drawX, lineY);

    // ---- GARIS PEMISAH HORIZONTAL ----
    const dividerY = headerTopY + logoSize + 2; // sedikit di bawah logo
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(marginX, dividerY, pageWidth - marginX, dividerY);

    // Return Y cursor untuk konten berikutnya
    return dividerY + 6;
  },

  /**
   * Generate PDF rapor.
   * @param {Object} peserta - data lengkap peserta (dari getDataLengkapPeserta)
   * @param {Object} rapor - data rapor (dari getRaporPeserta)
   * @param {String} namaPelatih - opsional override nama pelatih
   */
  async generate(peserta, rapor, namaPelatih) {
    if (typeof window.jspdf === 'undefined') {
      Utils.notify('Library PDF belum termuat. Mohon refresh halaman.', 'error');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 20;

    // ============ KOP SURAT ============
    let cursorY = await this.drawHeader(doc, pageWidth, marginX);

    // ============ JUDUL UTAMA ============
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('LAPORAN HASIL LATIHAN RENANG', pageWidth / 2, cursorY + 4, { align: 'center' });
    cursorY += 10;

    // ============ TABEL IDENTITAS (3 kolom, no border) ============
    const identitas = [
      ['Nama', ':', (peserta.Nama_Lengkap || '-').toUpperCase()],
      ['Jenis Kelamin', ':', peserta.Jenis_Kelamin || '-'],
      ['Tempat, Tanggal Lahir', ':', this.fmtTTL(peserta.Tempat_Lahir, peserta.Tanggal_Lahir)],
      ['Kelompok Umur', ':', peserta.Kelompok_Umur || '-'],
      ['NISN', ':', peserta.NISNAS || '-'],
      ['Asal Sekolah', ':', peserta.Asal_Sekolah || '-'],
      ['Kelas, (Wali Kelas)', ':', `${peserta.Kelas_Sekolah || '-'} (${peserta.Wali_Kelas || '-'})`]
    ];

    doc.autoTable({
      startY: cursorY,
      body: identitas,
      theme: 'plain',
      styles: {
        font: 'helvetica', fontSize: 11, cellPadding: { top: 1, bottom: 1, left: 0, right: 2 },
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'normal' },
        1: { cellWidth: 5, halign: 'center' },
        2: { cellWidth: 'auto', fontStyle: 'normal' }
      },
      margin: { left: marginX, right: marginX }
    });

    cursorY = doc.lastAutoTable.finalY + 8;

    // ============ SUBJUDUL CAPAIAN ============
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CAPAIAN HASIL LATIHAN RENANG', pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 7;

    // ============ PERIODE (italic) ============
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    const periodeText = `Periode pengambilan waktu : ${this.fmtTanggalID(peserta.Tanggal_Mulai)} s.d ${this.fmtTanggalID(peserta.Tanggal_Akhir)}`;
    doc.text(periodeText, marginX, cursorY);
    cursorY += 5;

    // ============ TABEL RAPOR (4x5, full border) ============
    const r = rapor || {};
    const tabelRapor = [
      ['1', 'GAYA BEBAS',    this.fmtWaktu(r.Waktu_25_Bebas),    this.fmtWaktu(r.Waktu_50_Bebas)],
      ['2', 'GAYA DADA',     this.fmtWaktu(r.Waktu_25_Dada),     this.fmtWaktu(r.Waktu_50_Dada)],
      ['3', 'GAYA KUPU',     this.fmtWaktu(r.Waktu_25_Kupu),     this.fmtWaktu(r.Waktu_50_Kupu)],
      ['4', 'GAYA PUNGGUNG', this.fmtWaktu(r.Waktu_25_Punggung), this.fmtWaktu(r.Waktu_50_Punggung)]
    ];

    doc.autoTable({
      startY: cursorY,
      head: [['NO.', 'GAYA RENANG', '25 METER', '50 METER']],
      body: tabelRapor,
      theme: 'grid',
      styles: {
        font: 'helvetica', fontSize: 11, halign: 'center', valign: 'middle',
        lineColor: [0, 0, 0], lineWidth: 0.3, textColor: [0, 0, 0], cellPadding: 3
      },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { cellWidth: 18 }, 1: { halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 40 } },
      margin: { left: marginX, right: marginX }
    });

    cursorY = doc.lastAutoTable.finalY + 8;

    // ============ PREDIKAT BOX ============
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('1) PREDIKAT', marginX, cursorY + 5);
    doc.rect(marginX + 30, cursorY, pageWidth - marginX * 2 - 30, 8);
    doc.setFont('helvetica', 'normal');
    doc.text(r.Predikat || '-', marginX + 32, cursorY + 5);
    cursorY += 13;

    // ============ DESKRIPSI BOX ============
    doc.text('2) DESKRIPSI', marginX, cursorY + 5);
    const deskBoxX = marginX + 30;
    const deskBoxW = pageWidth - marginX * 2 - 30;
    const deskBoxH = 18;
    doc.rect(deskBoxX, cursorY, deskBoxW, deskBoxH);
    const catatan = r.Catatan || '-';
    const splitText = doc.splitTextToSize(catatan, deskBoxW - 4);
    doc.text(splitText, deskBoxX + 2, cursorY + 5);
    cursorY += deskBoxH + 12;

    // ============ FOOTER (Tanda tangan) ============
    const tanggalCetak = this.fmtTanggalID(new Date());
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const footerX = pageWidth - marginX - 60;
    doc.text(`Bontang, ${tanggalCetak}`, footerX + 30, cursorY, { align: 'center' });
    cursorY += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('BONTANG AQUATIK SWIMMING CLUB', footerX + 30, cursorY, { align: 'center' });
    cursorY += 18;

    doc.setFont('helvetica', 'bold');
    const pelatih = (namaPelatih || r.Nama_Pelatih || 'Pelatih').toUpperCase();
    doc.text(pelatih, footerX + 30, cursorY, { align: 'center' });

    const textWidth = doc.getTextWidth(pelatih);
    doc.setLineWidth(0.3);
    doc.line(footerX + 30 - textWidth / 2, cursorY + 1, footerX + 30 + textWidth / 2, cursorY + 1);
    cursorY += 5;

    doc.setFont('helvetica', 'normal');
    doc.text('Pelatih', footerX + 30, cursorY, { align: 'center' });

    // Save
    const filename = `Rapor_${(peserta.Nama_Lengkap || 'Peserta').replace(/\s+/g, '_')}_${Utils.formatDateInput(new Date())}.pdf`;
    doc.save(filename);
    Utils.notify('Rapor PDF berhasil diunduh 📄', 'success');
  
      // ============ CATATAN KELOMPOK UMUR ============
    const noteX = marginX;
    const noteY = cursorY;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.text('Catatan :', noteX, noteY);

    const kelompokList = [
      ['Senior', '> 19 tahun'],
      ['Group 1', '16-18 tahun'],
      ['Group 2', '14-15 tahun'],
      ['Group 3', '12-13 tahun'],
      ['Group 4', '10-11 tahun'],
      ['Group 5', '8-9 tahun'],
      ['Group 6', '≤ 7 tahun']
    ];

    let lineY = noteY + 6;

    kelompokList.forEach((item, index) => {
      const no = `${index + 1})`;
      const text = `${item[0]} : ${item[1]}`;

      doc.text(no, noteX + 2, lineY);
      doc.text(text, noteX + 10, lineY);

      lineY += 5;
    });

    // Box seperti contoh gambar
    const boxHeight = 40;
    doc.rect(noteX, noteY + 2, 70, boxHeight);

    cursorY = lineY + 5;
  }
};