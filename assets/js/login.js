/**
 * Login. Sesi disimpan persisten (localStorage via Auth) sehingga user tidak
 * perlu login ulang tiap membuka PWA. Setelah login, route default langsung
 * ke dashboard (peserta) / admin panel (admin) — tidak kembali ke index.
 */
document.addEventListener('DOMContentLoaded', () => {
  Utils.mountNavbar('login');

  // Sudah login -> langsung ke dashboard/admin (hindari halaman login).
  const session = Auth.getSession();
  if (session) {
    window.location.replace(session.role === 'admin' ? 'admin.html' : 'peserta.html');
    return;
  }

  // SVG eye toggle reusable
  const passInput = document.getElementById('password');
  const passToggle = document.getElementById('togglePassword');
  if (passInput && passToggle) UI.passwordToggle(passInput, passToggle);

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { username: fd.get('username').trim(), password: fd.get('password') };
    if (!data.username || !data.password) {
      UI.toast('Username dan password wajib diisi', 'warning');
      return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    const res = await API.call('login', data);
    if (btn) btn.disabled = false;

    if (res.success) {
      Auth.setSession(res.role, res.data);
      UI.toast(`Selamat datang, ${res.data.nama || res.data.username}!`, 'success');
      setTimeout(() => {
        window.location.href = res.role === 'admin' ? 'admin.html' : 'peserta.html';
      }, 700);
    } else {
      UI.toast(res.message || 'Login gagal', 'error');
    }
  });
});
