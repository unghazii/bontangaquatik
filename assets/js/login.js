document.addEventListener('DOMContentLoaded', () => {
  Utils.mountNavbar('login');

  const session = Auth.getSession();
  if (session) {
    window.location.href = session.role === 'admin' ? 'admin.html' : 'peserta.html';
    return;
  }

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { username: fd.get('username').trim(), password: fd.get('password') };
    if (!data.username || !data.password) {
      Utils.notify('Username dan password wajib diisi', 'warning');
      return;
    }
    const res = await API.call('login', data);
    if (res.success) {
      Auth.setSession(res.role, res.data);
      Utils.notify(`Selamat datang, ${res.data.nama || res.data.username}!`, 'success');
      setTimeout(() => {
        window.location.href = res.role === 'admin' ? 'admin.html' : 'peserta.html';
      }, 800);
    } else {
      Utils.notify(res.message || 'Login gagal', 'error');
    }
  });

  const toggleBtn = document.getElementById('toggle-password');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const input = document.getElementById('password');
      input.type = input.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = input.type === 'password' ? '👁️' : '🙈';
    });
  }
});
