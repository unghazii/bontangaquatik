/**
 * Registrasi multi-step (4 langkah) — UX premium.
 * Langkah: 1) Akun  2) Data Pribadi  3) Sekolah  4) Grup + Referral(opsional).
 * Ikon mata password & toast memakai komponen reusable global `UI`.
 */
let currentStep = 1;
const TOTAL_STEPS = 4;

document.addEventListener('DOMContentLoaded', () => {
  Utils.mountNavbar('registrasi');

  // Password toggle (SVG eye reusable)
  const passInput = document.getElementById('password');
  const passToggle = document.getElementById('togglePassword');
  if (passInput && passToggle) UI.passwordToggle(passInput, passToggle);

  // Default tanggal mulai = hari ini
  const todayStr = Utils.formatDateInput(new Date());
  const startInput = document.getElementById('tanggal_mulai');
  startInput.value = todayStr;
  startInput.min = todayStr;

  // Max tanggal lahir: hari ini - MIN_AGE tahun
  const tglLahirInput = document.getElementById('tanggal_lahir');
  const maxLahir = new Date(); maxLahir.setFullYear(maxLahir.getFullYear() - CONFIG.MIN_AGE);
  tglLahirInput.max = Utils.formatDateInput(maxLahir);

  tglLahirInput.addEventListener('change', () => {
    const tgl = tglLahirInput.value;
    const preview = document.getElementById('kelompok-umur-preview');
    if (!tgl) { preview.textContent = ''; return; }
    const usia = Utils.calculateUsia(tgl);
    if (usia < CONFIG.MIN_AGE) {
      preview.innerHTML = `<span style="color:var(--color-danger);">⚠️ Usia minimal ${CONFIG.MIN_AGE} tahun</span>`;
      return;
    }
    const kelompok = Utils.calculateKelompokUmur(tgl);
    const info = CONFIG.KELOMPOK_UMUR_INFO[kelompok] || '';
    preview.innerHTML = `🏆 Kelompok Umur: <strong style="color:var(--color-primary);">${kelompok}</strong> (${info}) • Usia ${usia} tahun`;
  });

  renderClassInfo();
  bindReferralField();

  // Auto-calc end date
  const durasiInput = document.getElementById('durasi');
  const endDisplay = document.getElementById('tanggal_akhir_display');
  function recalcEnd() {
    const start = startInput.value;
    const durasi = parseInt(durasiInput.value) || 0;
    if (!start || durasi <= 0) { endDisplay.value = ''; return; }
    const endDate = Utils.addMonths(new Date(start), durasi);
    endDisplay.value = Utils.formatDate(endDate);
    endDisplay.dataset.iso = Utils.formatDateInput(endDate);
  }
  startInput.addEventListener('change', recalcEnd);
  durasiInput.addEventListener('input', recalcEnd);
  recalcEnd();

  document.getElementById('btn-next').addEventListener('click', goNextStep);
  document.getElementById('btn-prev').addEventListener('click', goPrevStep);
  document.getElementById('form-registrasi').addEventListener('submit', submitForm);
});

/** Validasi & feedback realtime kode referral (opsional, harus 6 huruf bila diisi). */
function bindReferralField() {
  const input = document.getElementById('kode_referral');
  const feedback = document.getElementById('referral-feedback');
  if (!input) return;
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);
    const val = input.value.trim();
    if (val === '') {
      feedback.textContent = 'Punya kode dari teman? Masukkan di sini (boleh dikosongkan).';
      feedback.style.color = 'var(--color-text-secondary)';
    } else if (/^[A-Z]{6}$/.test(val)) {
      feedback.innerHTML = '✓ Format kode referral valid';
      feedback.style.color = 'var(--color-success)';
    } else {
      feedback.innerHTML = '⚠️ Kode referral harus terdiri dari tepat 6 huruf';
      feedback.style.color = 'var(--color-danger)';
    }
  });
}

function isReferralValid() {
  const input = document.getElementById('kode_referral');
  const val = (input?.value || '').trim();
  return val === '' || /^[A-Za-z]{6}$/.test(val);
}

function validateStep(step) {
  const stepEl = document.querySelector(`.form-step[data-step="${step}"]`);
  const inputs = stepEl.querySelectorAll('input[required], select[required]');
  for (const inp of inputs) {
    if (!inp.value || inp.value.trim() === '') {
      inp.focus();
      const label = inp.previousElementSibling ? inp.previousElementSibling.textContent.replace('*', '').trim() : 'field ini';
      UI.toast(`Mohon lengkapi: ${label}`, 'warning');
      return false;
    }
  }
  if (step === 1) {
    const password = stepEl.querySelector('[name="password"]').value;
    if (password.length < 6) { UI.toast('Password minimal 6 karakter', 'warning'); return false; }
    const wa = stepEl.querySelector('[name="nomor_whatsapp"]').value.replace(/[^0-9]/g, '');
    if (!/^[0-9]{8,15}$/.test(wa)) { UI.toast('Nomor WhatsApp tidak valid (8-15 digit)', 'warning'); return false; }
  }
  if (step === 2) {
    const tglLahir = stepEl.querySelector('[name="tanggal_lahir"]').value;
    if (Utils.calculateUsia(tglLahir) < CONFIG.MIN_AGE) { UI.toast(`Usia minimal ${CONFIG.MIN_AGE} tahun`, 'warning'); return false; }
    const nisnas = stepEl.querySelector('[name="nisnas"]').value;
    if (!/^[0-9]+$/.test(nisnas)) { UI.toast('NISN harus berupa angka', 'warning'); return false; }
  }
  if (step === 4) {
    if (!isReferralValid()) { UI.toast('Kode referral tidak valid — harus 6 huruf atau kosongkan.', 'warning'); return false; }
  }
  return true;
}

function goNextStep() {
  if (!validateStep(currentStep)) return;
  if (currentStep < TOTAL_STEPS) { currentStep++; updateStepUI(); }
}
function goPrevStep() { if (currentStep > 1) { currentStep--; updateStepUI(); } }

function updateStepUI() {
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.querySelector(`.form-step[data-step="${currentStep}"]`).classList.add('active');
  document.querySelectorAll('.step').forEach(s => {
    const n = Number(s.dataset.step);
    s.classList.toggle('active', n === currentStep);
    s.classList.toggle('completed', n < currentStep);
  });
  document.getElementById('btn-prev').disabled = (currentStep === 1);
  document.getElementById('btn-next').classList.toggle('hidden', currentStep === TOTAL_STEPS);
  document.getElementById('btn-submit').classList.toggle('hidden', currentStep !== TOTAL_STEPS);
  document.getElementById('form-stepper').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitForm(e) {
  e.preventDefault();
  if (!validateStep(currentStep)) return;

  const fd = new FormData(e.target);
  const data = {
    nama_lengkap: fd.get('nama_lengkap').trim(),
    username: fd.get('username').trim(),
    password: fd.get('password'),
    nomor_whatsapp: fd.get('nomor_whatsapp').replace(/[^0-9]/g, ''),
    jenis_kelamin: fd.get('jenis_kelamin'),
    tempat_lahir: fd.get('tempat_lahir').trim(),
    tanggal_lahir: fd.get('tanggal_lahir'),
    nisnas: fd.get('nisnas').trim(),
    asal_sekolah: fd.get('asal_sekolah').trim(),
    kelas_sekolah: fd.get('kelas_sekolah').trim(),
    wali_kelas: fd.get('wali_kelas').trim(),
    kelas: fd.get('kelas'),
    tanggal_mulai: fd.get('tanggal_mulai'),
    tanggal_akhir: document.getElementById('tanggal_akhir_display').dataset.iso || '',
    kode_referral: (fd.get('kode_referral') || '').trim().toUpperCase()
  };

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  const res = await API.call('register', data);
  submitBtn.disabled = false;

  if (res.success) {
    UI.toast('Registrasi berhasil! Mengarahkan ke WhatsApp admin...', 'success', { duration: 4000 });
    e.target.reset();
    setTimeout(() => {
      window.open(Utils.waLink(CONFIG.CONTACT.whatsapp, CONFIG.WA_REGISTRATION_MESSAGE), '_blank');
      setTimeout(() => window.location.href = 'login.html', 1500);
    }, 1500);
  } else {
    UI.toast(res.message || 'Registrasi gagal', 'error');
  }
}

function renderClassInfo() {
  const container = document.getElementById('class-info-list');
  if (container) {
    container.innerHTML = Object.entries(CONFIG.KELAS_DETAIL).map(([nama, d]) => `
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
      </div>`).join('');
  }
  const select = document.getElementById('kelas');
  if (select) {
    select.innerHTML = '<option value="">- Pilih grup kelas -</option>' +
      Object.keys(CONFIG.KELAS_DETAIL).map(k => `<option value="${k}">${k} • ${CONFIG.KELAS_DETAIL[k].lokasi}</option>`).join('');
  }
}
