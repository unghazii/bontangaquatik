const input = document.querySelector('#password');
const toggle = document.querySelector('#togglePassword');
const eyeOpenIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="M2 12C3.8 7.8 7.5 5 12 5C16.5 5 20.2 7.8 22 12C20.2 16.2 16.5 19 12 19C7.5 19 3.8 16.2 2 12Z"
        stroke="#272424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="12" r="3" fill="#272424"/>
</svg>
`;

const eyeClosedIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="M3 3L21 21" stroke="#FF3B30" stroke-width="2" stroke-linecap="round"/>
  <path d="M10.6 10.7C10.2 11.1 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 12.9 13.8 13.3 13.4"
        stroke="#272424" stroke-width="2" stroke-linecap="round"/>
  <path d="M9.9 5.1C10.6 5 11.3 5 12 5C16.5 5 20.2 7.8 22 12C21.2 13.8 20 15.3 18.5 16.4"
        stroke="#272424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6.2 6.3C4.5 7.5 3.1 9.4 2 12C3.8 16.2 7.5 19 12 19C13.5 19 14.9 18.7 16.2 18.1"
        stroke="#272424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
