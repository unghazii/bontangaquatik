/**
 * ===================================================================
 * crud-api.js — Klien REST generik ke backend Apps Script (CRUD murni)
 * ===================================================================
 * Menggantikan api.js lama yang memanggil "action" bisnis (login,
 * getAllPeserta, dsb). Sekarang backend HANYA mengerti CRUD sederhana per
 * resource: peserta | jadwal | kehadiran | rapor | berita | pelatih | settings
 * dengan operasi: create | update | delete | read.
 *
 * Resource & operasi dikirim sebagai QUERY STRING (?resource=..&op=..) —
 * BUKAN lewat path URL (…/exec/peserta/create) — karena e.pathInfo pada
 * Google Apps Script Web App TIDAK bisa diandalkan (URL /exec melalui
 * redirect internal Google yang sering menghilangkan segmen path
 * tambahan). Query string dibaca Apps Script lewat e.parameter, yang
 * konsisten tersedia baik untuk GET maupun POST.
 *
 * Tidak ada logika bisnis di file ini — hanya transport HTTP.
 */
const CrudApi = {
  async _request(resource, op, payload, opts = {}) {
    const silent = !!opts.silent;
    if (!silent) Utils.showLoader(true);
    try {
      const isRead = op === 'read';
      const qs = `?resource=${encodeURIComponent(resource)}&op=${encodeURIComponent(op)}`;
      const url = `${CONFIG.API_URL}${qs}`;
      const res = await fetch(url, isRead ? {
        method: 'GET',
        redirect: 'follow'
      } : {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ resource, op }, payload || {})),
        redirect: 'follow'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      console.error('CrudApi error:', resource, op, err);
      // "offline: true" menandai kegagalan JARINGAN (bukan penolakan bisnis dari server) —
      // dipakai business-logic.js untuk memutuskan apakah operasi boleh diantre (Outbox).
      return { success: false, offline: true, message: 'Gagal terhubung ke server: ' + err.message };
    } finally {
      if (!silent) Utils.showLoader(false);
    }
  },

  read(resource, opts)            { return this._request(resource, 'read', null, opts); },
  create(resource, payload, opts) { return this._request(resource, 'create', payload, opts); },
  update(resource, payload, opts) { return this._request(resource, 'update', payload, opts); },
  delete(resource, payload, opts) { return this._request(resource, 'delete', payload, opts); }
};
