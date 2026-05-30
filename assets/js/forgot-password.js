/**
 * Lupa Password — alur 3 langkah:
 *  1. Verifikasi username + nomor WhatsApp  -> getResetQuestions
 *  2. Pilih & jawab pertanyaan keamanan     -> resetPassword (validasi jawaban)
 *  3. Masukkan password baru                -> resetPassword (simpan)
 *
 * Catatan: backend resetPassword memvalidasi jawaban DAN menyimpan password
 * dalam satu panggilan, jadi jawaban disimpan sementara di state lalu dikirim
 * bersama password baru pada langkah terakhir.
 */
(function () {
  'use strict';

  const state = {
    username: '',
    nomor_whatsapp: '',
    question_index: 1,
    answer: ''
  };

  function showStep(id) {
    document.querySelectorAll('.fp-step').forEach(f => f.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const card = document.querySelector('.auth-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- STEP 1: verifikasi identitas ----
  async function handleVerify(e) {
    e.preventDefault();
    const username = document.getElementById('fp-username').value.trim();
    const wa = document.getElementById('fp-wa').value.replace(/[^0-9]/g, '');
    if (!username) { Utils.notify('Masukkan nama/username Anda', 'warning'); return; }
    if (!/^[0-9]{8,15}$/.test(wa)) { Utils.notify('Nomor WhatsApp tidak valid (8-15 digit)', 'warning'); return; }

    const res = await API.call('getResetQuestions', { username, nomor_whatsapp: wa });
    if (!res.success) { Utils.notify(res.message || 'Verifikasi gagal', 'error'); return; }

    state.username = username;
    state.nomor_whatsapp = wa;

    const sel = document.getElementById('fp-question');
    sel.innerHTML = res.data.questions
      .map(q => `<option value="${q.index}">${Utils.escapeHtml(q.text)}</option>`)
      .join('');

    Utils.notify('Identitas ditemukan. Jawab pertanyaan keamanan Anda.', 'success');
    showStep('form-answer');
  }

  // ---- STEP 2: verifikasi jawaban (tanpa simpan password dulu) ----
  async function handleAnswer(e) {
    e.preventDefault();
    const qIndex = Number(document.getElementById('fp-question').value) || 1;
    const answer = document.getElementById('fp-answer').value.trim();
    if (!answer) { Utils.notify('Isi jawaban pertanyaan keamanan', 'warning'); return; }

    // Validasi jawaban dengan placeholder password agar tidak menyimpan apa pun.
    const res = await API.call('resetPassword', {
      username: state.username,
      nomor_whatsapp: state.nomor_whatsapp,
      question_index: qIndex,
      answer,
      new_password: '' // kosong -> backend menolak sebelum menyimpan; kita pakai untuk cek jawaban
    });

    // Backend mengecek jawaban SEBELUM panjang password. Jadi:
    //  - "Jawaban ... salah"      => jawaban salah
    //  - "Password baru minimal"  => jawaban BENAR (lolos cek jawaban)
    if (res.message && /jawaban/i.test(res.message)) {
      Utils.notify(res.message, 'error');
      return;
    }
    // Jawaban benar -> lanjut ke langkah password
    state.question_index = qIndex;
    state.answer = answer;
    Utils.notify('Jawaban benar. Silakan buat password baru.', 'success');
    showStep('form-newpass');
  }

  // ---- STEP 3: simpan password baru ----
  async function handleNewPass(e) {
    e.preventDefault();
    const p1 = document.getElementById('fp-pass1').value;
    const p2 = document.getElementById('fp-pass2').value;
    if (p1.length < 6) { Utils.notify('Password baru minimal 6 karakter', 'warning'); return; }
    if (p1 !== p2) { Utils.notify('Konfirmasi password tidak cocok', 'warning'); return; }

    const res = await API.call('resetPassword', {
      username: state.username,
      nomor_whatsapp: state.nomor_whatsapp,
      question_index: state.question_index,
      answer: state.answer,
      new_password: p1
    });

    if (res.success) {
      Utils.notify(res.message || 'Password berhasil diperbarui. Silakan login.', 'success', 3500);
      setTimeout(() => { window.location.href = 'login.html'; }, 1600);
    } else {
      Utils.notify(res.message || 'Gagal menyimpan password', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('form-verify').addEventListener('submit', handleVerify);
    document.getElementById('form-answer').addEventListener('submit', handleAnswer);
    document.getElementById('form-newpass').addEventListener('submit', handleNewPass);
    document.getElementById('fp-back-1').addEventListener('click', () => showStep('form-verify'));

    // Toggle visibilitas password
    document.querySelectorAll('.password-toggle[data-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById(btn.dataset.target);
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
      });
    });
  });
})();
