const API = {
  async call(action, payload = {}) {
    Utils.showLoader(true);
    try {
      const body = JSON.stringify({ action, ...payload });
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        redirect: 'follow'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('API error:', err);
      return { success: false, message: 'Gagal terhubung ke server: ' + err.message };
    } finally {
      Utils.showLoader(false);
    }
  }
};
