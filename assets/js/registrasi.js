// Registrasi multi-step dengan validasi & UX premium
let currentStep = 1;
const TOTAL_STEPS = 4;
const input = document.querySelector('#password');
const toggle = document.querySelector('#togglePassword');
const eyeOpenIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="M2 12C3.8 7.8 7.5 5 12 5C16.5 5 20.2 7.8 22 12C20.2 16.2 16.5 19 12 19C7.5 19 3.8 16.2 2 12Z"
        stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="12" r="3" fill="#34C759"/>
</svg>
`;

const eyeClosedIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="M3 3L21 21" stroke="#FF3B30" stroke-width="2" stroke-linecap="round"/>
  <path d="M10.6 10.7C10.2 11.1 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 12.9 13.8 13.3 13.4"
        stroke="#007AFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M9.9 5.1C10.6 5 11.3 5 12 5C16.5 5 20.2 7.8 22 12C21.2 13.8 20 15.3 18.5 16.4"
        stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6.2 6.3C4.5 7.5 3.1 9.4 2 12C3.8 16.2 7.5 19 12 19C13.5 19 14.9 18.7 16.2 18.1"
        stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

function updateIcon() {
  toggle.innerHTML = input.type === 'password'
    ? eyeOpenIcon
    : eyeClosedIcon;
}

toggle.addEventListener('click', () => {
  input.type = input.type === 'password' ? 'text' : 'password';
  updateIcon();
});

updateIcon();

document.addEventListener('DOMContentLoaded', () => {
  Utils.mountNavbar('registrasi');

  // Setup default values
  const todayStr = Utils.formatDateInput(new Date());
  const startInput = document.getElementById('tanggal_mulai');
  startInput.value = todayStr;
  startInput.min = todayStr;

  // Max tanggal lahir: hari ini - 5 tahun (min usia 5)
  const tglLahirInput = document.getElementById('tanggal_lahir');
  const maxLahir = new Date(); maxLahir.setFullYear(maxLahir.getFullYear() - CONFIG.MIN_AGE);
  tglLahirInput.max = Utils.formatDateInput(maxLahir);

  // Preview kelompok umur saat user pilih tanggal lahir
  tglLahirInput.addEventListener('change', () => {
    const tgl = tglLahirInput.value;
    if (!tgl) {
      document.getElementById('kelompok-umur-preview').textContent = '';
      return;
    }
    const usia = Utils.calculateUsia(tgl);
    if (usia < CONFIG.MIN_AGE) {
      document.getElementById('kelompok-umur-preview').innerHTML = `<span style="color:var(--color-danger);">⚠️ Usia minimal ${CONFIG.MIN_AGE} tahun</span>`;
      return;
    }
    const kelompok = Utils.calculateKelompokUmur(tgl);
    const info = CONFIG.KELOMPOK_UMUR_INFO[kelompok] || '';
    document.getElementById('kelompok-umur-preview').innerHTML = `🏆 Kelompok Umur: <strong style="color:var(--color-primary);">${kelompok}</strong> (${info}) • Usia ${usia} tahun`;
  });

  renderClassInfo();

  // Auto-calc end date
  const durasiInput = document.getElementById('durasi');
  const endDisplay = document.getElementById('tanggal_akhir_display');
  function recalcEnd() {
    const start = startInput.value;
    const durasi = parseInt(durasiInput.value) || 0;
    if (!start || durasi <= 0) { endDisplay.value = ''; return; }
    const startDate = new Date(start);
    const endDate = Utils.addMonths(startDate, durasi);
    endDisplay.value = Utils.formatDate(endDate);
    endDisplay.dataset.iso = Utils.formatDateInput(endDate);
  }
  startInput.addEventListener('change', recalcEnd);
  durasiInput.addEventListener('input', recalcEnd);
  recalcEnd();

  // Stepper navigation
  document.getElementById('btn-next').addEventListener('click', goNextStep);
  document.getElementById('btn-prev').addEventListener('click', goPrevStep);

  // Submit
  document.getElementById('form-registrasi').addEventListener('submit', submitForm);

  // Toggle password
  document.getElementById('toggle-password').addEventListener('click', (e) => {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
    e.target.textContent = input.type === 'password' ? '👁️' : '🙈';
  });
});

function validateStep(step) {
  const stepEl = document.querySelector(`.form-step[data-step="${step}"]`);
  const inputs = stepEl.querySelectorAll('input[required], select[required]');
  for (const inp of inputs) {
    if (!inp.value || inp.value.trim() === '') {
      inp.focus();
      Utils.notify(`Mohon lengkapi: ${inp.previousElementSibling.textContent.replace('*', '').trim()}`, 'warning');
      return false;
    }
  }
  // Custom validations per step
  if (step === 1) {
    const password = stepEl.querySelector('[name="password"]').value;
    if (password.length < 6) { Utils.notify('Password minimal 6 karakter', 'warning'); return false; }
    const wa = stepEl.querySelector('[name="nomor_whatsapp"]').value.replace(/[^0-9]/g, '');
    if (!/^[0-9]{8,15}$/.test(wa)) { Utils.notify('Nomor WhatsApp tidak valid (8-15 digit)', 'warning'); return false; }
  }
  if (step === 2) {
    const tglLahir = stepEl.querySelector('[name="tanggal_lahir"]').value;
    const usia = Utils.calculateUsia(tglLahir);
    if (usia < CONFIG.MIN_AGE) { Utils.notify(`Usia minimal ${CONFIG.MIN_AGE} tahun`, 'warning'); return false; }
    const nisnas = stepEl.querySelector('[name="nisnas"]').value;
    if (!/^[0-9]+$/.test(nisnas)) { Utils.notify('NISN harus berupa angka', 'warning'); return false; }
  }
  return true;
}

function goNextStep() {
  if (!validateStep(currentStep)) return;
  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    updateStepUI();
  }
}

function goPrevStep() {
  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
  }
}

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
  // Scroll to top of form smoothly
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
    tanggal_akhir: document.getElementById('tanggal_akhir_display').dataset.iso || ''
  };

  const res = await API.call('register', data);
  if (res.success) {
    Utils.notify('Registrasi berhasil! Mengarahkan ke WhatsApp admin...', 'success', 4000);
    e.target.reset();
    setTimeout(() => {
      const waUrl = Utils.waLink(CONFIG.CONTACT.whatsapp, CONFIG.WA_REGISTRATION_MESSAGE);
      window.open(waUrl, '_blank');
      setTimeout(() => window.location.href = 'login.html', 1500);
    }, 1500);
  } else {
    Utils.notify(res.message, 'error');
  }
}

function renderClassInfo() {
  const container = document.getElementById('class-info-list');
  if (!container) return;
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
    </div>
  `).join('');

  const select = document.getElementById('kelas');
  if (select) {
    select.innerHTML = '<option value="">- Pilih grup kelas -</option>' +
      Object.keys(CONFIG.KELAS_DETAIL).map(k => {
        const d = CONFIG.KELAS_DETAIL[k];
        return `<option value="${k}">${k} • ${d.lokasi}</option>`;
      }).join('');
  }
}
