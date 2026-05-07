// Logic halaman Registrasi
document.addEventListener('DOMContentLoaded', () => {
  Utils.mountNavbar('registrasi');

  // Default tanggal mulai = hari ini
  const todayStr = Utils.formatDateInput(new Date());
  const startInput = document.getElementById('tanggal_mulai');
  startInput.value = todayStr;
  startInput.min = todayStr;

  // Render info kelas (dinamis dari CONFIG)
  renderClassInfo();

  // Auto-calc end date saat tanggal mulai / durasi berubah
  const durasiInput = document.getElementById('durasi');
  const endDisplay = document.getElementById('tanggal_akhir_display');

  function recalcEnd() {
    const start = startInput.value;
    const durasi = parseInt(durasiInput.value) || 0;
    if (!start || durasi <= 0) {
      endDisplay.value = '';
      return;
    }
    const startDate = new Date(start);
    const endDate = Utils.addMonths(startDate, durasi);
    endDisplay.value = Utils.formatDate(endDate);
    // simpan format YYYY-MM-DD untuk dikirim ke server
    endDisplay.dataset.iso = Utils.formatDateInput(endDate);
  }
  startInput.addEventListener('change', recalcEnd);
  durasiInput.addEventListener('input', recalcEnd);
  recalcEnd();

  // Submit form
  const form = document.getElementById('form-registrasi');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const usia = parseInt(fd.get('usia'));
    if (isNaN(usia) || usia < CONFIG.MIN_AGE) {
      Utils.notify(`Usia minimal ${CONFIG.MIN_AGE} tahun`, 'warning');
      return;
    }
    const password = fd.get('password');
    if (password.length < 6) {
      Utils.notify('Password minimal 6 karakter', 'warning');
      return;
    }
    const wa = fd.get('nomor_whatsapp').replace(/[^0-9]/g, '');
    if (!/^[0-9]{8,15}$/.test(wa)) {
      Utils.notify('Nomor WhatsApp tidak valid', 'warning');
      return;
    }

    const data = {
      nama_lengkap: fd.get('nama_lengkap').trim(),
      username: fd.get('username').trim(),
      password: password,
      nomor_whatsapp: wa,
      usia: usia,
      kelas: fd.get('kelas'),
      tanggal_mulai: startInput.value,
      tanggal_akhir: endDisplay.dataset.iso || ''
    };

    const res = await API.call('register', data);
    if (res.success) {
      Utils.notify('Registrasi berhasil! Mengarahkan ke WhatsApp admin...', 'success', 4000);
      form.reset();

      // Redirect ke WA admin (request 10)
      setTimeout(() => {
        const waUrl = Utils.waLink(CONFIG.CONTACT.whatsapp, CONFIG.WA_REGISTRATION_MESSAGE);
        // Buka di tab baru agar user tetap melihat halaman konfirmasi
        window.open(waUrl, '_blank');
        // Setelah jeda, arahkan ke login
        setTimeout(() => window.location.href = 'login.html', 1500);
      }, 1500);
    } else {
      Utils.notify(res.message, 'error');
    }
  });

  // Toggle password
  const toggleBtn = document.getElementById('toggle-password');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const input = document.getElementById('password');
      input.type = input.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = input.type === 'password' ? '👁️' : '🙈';
    });
  }
});

/**
 * Render info kelas (jadwal & tarif) sebagai referensi user saat registrasi.
 */
function renderClassInfo() {
  const container = document.getElementById('class-info-list');
  if (!container) return;
  const html = Object.entries(CONFIG.KELAS_DETAIL).map(([nama, d]) => `
    <div class="class-info-item ${d.recommended ? 'recommended' : ''}">
      <div class="class-info-head">
        <span class="class-info-mascot">${d.mascot}</span>
        <strong>${nama}</strong>
        ${d.recommended ? '<span class="class-info-badge">⭐ Rekomendasi</span>' : ''}
      </div>
      <div class="class-info-body">
        <div>📍 ${d.lokasi}</div>
        <div>📅 ${d.jadwal_label}</div>
      </div>
    </div>
  `).join('');
  container.innerHTML = html;

  // Populate dropdown kelas
  const select = document.getElementById('kelas');
  if (select) {
    select.innerHTML = '<option value="">- Pilih grup kelas -</option>' +
      Object.keys(CONFIG.KELAS_DETAIL).map(k => {
        const d = CONFIG.KELAS_DETAIL[k];
        return `<option value="${k}">${k}</option>`;
      }).join('');
  }
}
