/* Berkah Absen — aplikasi absensi & laporan karyawan (frontend) */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var API = CFG.API_URL || '';
  var DEMO_MODE = !API;
  var APP_NAME = CFG.APP_NAME || 'Berkah Absen';
  var JABATAN = ['Product Manager', 'Retail Manager', 'Operasional Manager', 'Head Store (HS)', 'PIC IT', 'Kasir'];
  var KATEGORI_REIMB = ['Transport', 'Bensin', 'Tol', 'Parkir', 'Makan', 'Akomodasi', 'Lainnya'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var DEFAULT_CENTER = [-7.9666, 112.6326]; // Malang

  var app = document.getElementById('app');
  var S = loadSession();
  var cleanups = [];

  /* ================= util ================= */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function wibNow() { return new Date(Date.now() + 7 * 3600000); } // pakai getUTC*
  function today() { var d = wibNow(); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function parseD(s) { var p = String(s).slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function fmtLong(s) { var d = parseD(s); return HARI[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function fmtDate(s) { var d = parseD(s); return d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCFullYear(); }
  function fmtDMY(s) { return s ? s.slice(8, 10) + '-' + s.slice(5, 7) + '-' + s.slice(0, 4) : ''; }
  function dayShort(s) { return HARI[parseD(s).getUTCDay()].slice(0, 3).toUpperCase(); }
  function monShort(s) { return BULAN[parseD(s).getUTCMonth()].slice(0, 3).toUpperCase(); }
  function addDays(s, n) { var d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function rupiah(n) { return 'Rp ' + String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000, t = Math.PI / 180, dLat = (lat2 - lat1) * t, dLng = (lng2 - lng1) * t;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m) + ' meter'; }
  function photoSrc(u, size) {
    if (!u) return '';
    if (u.indexOf('data:') === 0) return u;
    var m = u.match(/\/d\/([\w-]+)/) || u.match(/[?&]id=([\w-]+)/);
    return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w' + (size || 1000) : u;
  }
  function mapsLink(lat, lng) { return 'https://www.google.com/maps?q=' + lat + ',' + lng; }
  function statusTag(s) {
    var c = s === 'Disetujui' ? 'ok' : s === 'Ditolak' ? 'no' : 'wait';
    return '<span class="tag ' + c + '">' + esc(s) + '</span>';
  }

  function loadSession() { try { return JSON.parse(localStorage.getItem('ba-session') || '{}'); } catch (e) { return {}; } }
  function saveSession() { try { localStorage.setItem('ba-session', JSON.stringify(S)); } catch (e) { } }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  /* ================= icons ================= */
  var I = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 6.5V12l4 2.5"/></svg>',
    clockO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2.5h6M19 6l1.5-1.5" stroke-linecap="round"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    arrowC: '<svg viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M13 8.5l3.5 3.5-3.5 3.5"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5"/></svg>',
    data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="6" y="3" width="13" height="17" rx="1.5"/><path d="M4 6v15h13M9 8h7M9 11.5h7M9 15h4"/><path d="m13.5 4.5 1.3 1.3 2.4-2.6" stroke-linecap="round"/></svg>',
    finger: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round"><path d="M6.2 5.4A9 9 0 0 1 19.7 8"/><path d="M4.2 9.5A8.2 8.2 0 0 1 5 7.8M20.4 12.5c0 1.6-.2 3.2-.6 4.6"/><path d="M7 19.5c-.6-1.6-1-3.6-1-6a6 6 0 0 1 12 0c0 1.8-.1 3.5-.5 5"/><path d="M9.5 21a17 17 0 0 1-1.3-7.4 3.8 3.8 0 0 1 7.6 0c0 2.6-.3 4.9-1 7"/><path d="M12 13.6c0 3 .4 5.6 1.4 7.9"/><path d="M4 13.5c0 1.6.2 3.1.6 4.4"/></svg>',
    hourglass: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="2.4" rx=".6" fill="#1565d8"/><rect x="5" y="19.6" width="14" height="2.4" rx=".6" fill="#1565d8"/><path d="M7 4.4h10c0 4-3 5.3-3 7.6s3 3.6 3 7.6H7c0-4 3-5.3 3-7.6S7 8.4 7 4.4z" fill="#e3eefc" stroke="#1565d8" stroke-width="1"/><path d="M9 7.5h6c-.6 1.6-2.2 2.4-3 3.6-.8-1.2-2.4-2-3-3.6zM8.5 18.6c.3-2 2.2-3 3.5-3.6 1.3.6 3.2 1.6 3.5 3.6z" fill="#f9a825"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15h6M9 18h4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>'
  };
  var MI = { // ikon menu utama (dua warna)
    izin: '<svg viewBox="0 0 48 48"><path d="M11 5h19l8 8v27a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="#e8f1fd" stroke="#1565d8" stroke-width="2.2"/><path d="M30 5v8h8" fill="none" stroke="#1565d8" stroke-width="2.2"/><rect x="12" y="10" width="12" height="6" rx="1" fill="#1565d8"/><text x="18" y="15" font-size="4.6" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">IZIN</text><path d="M13 22h20M13 27h20M13 32h12" stroke="#1565d8" stroke-width="2.2" stroke-linecap="round"/><path d="m29 36 4 4 8-9" fill="none" stroke="#f9a825" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lembur: '<svg viewBox="0 0 48 48"><rect x="11" y="5" width="26" height="4" rx="1" fill="#1565d8"/><rect x="11" y="39" width="26" height="4" rx="1" fill="#1565d8"/><path d="M14 9h20c0 9-7 10-7 15s7 6 7 15H14c0-9 7-10 7-15s-7-6-7-15z" fill="#eaf2fd" stroke="#1565d8" stroke-width="1.8"/><path d="M17 14h14c-1.5 3.5-5.5 5-7 7-1.5-2-5.5-3.5-7-7zM16.5 37c.8-4.5 5-6 7.5-7.5 2.5 1.5 6.7 3 7.5 7.5z" fill="#f9a825"/></svg>',
    shift: '<svg viewBox="0 0 48 48"><circle cx="22" cy="23" r="17" fill="#fff" stroke="#1565d8" stroke-width="3.5"/><circle cx="22" cy="23" r="12.5" fill="#e8f1fd"/><path d="M22 23 31 15" stroke="#f9a825" stroke-width="3" stroke-linecap="round"/><path d="M22 23 13 28" stroke="#1565d8" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="23" r="2.6" fill="#0d47a1"/><circle cx="37" cy="37" r="8" fill="#fff" stroke="#1565d8" stroke-width="1.6"/><path d="M33.5 35.5a4 4 0 0 1 7-1.2M40.5 38.5a4 4 0 0 1-7 1.2" fill="none" stroke="#f9a825" stroke-width="2" stroke-linecap="round"/><path d="m40.8 31.8-.3 2.8-2.7-.6M33.2 42.2l.3-2.8 2.7.6" fill="none" stroke="#f9a825" stroke-width="1.6" stroke-linecap="round"/></svg>',
    reimburse: '<svg viewBox="0 0 48 48"><rect x="9" y="6" width="30" height="20" rx="2" fill="#e3f0fd"/><circle cx="29" cy="10" r="6" fill="#f9a825"/><text x="29" y="12.3" font-size="5.5" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">Rp</text><path d="M21 18c0-2 3-2 3 0v8l5-1c2-.4 3.6 1 3.4 3l-.8 6H20l-4-6c-1-1.5.6-3.4 2.3-2.4L21 27z" fill="#ffccbc" stroke="#e59a83" stroke-width=".8"/><rect x="18" y="35" width="15" height="6" fill="#1565d8"/></svg>',
    aktivitas: '<svg viewBox="0 0 48 48"><rect x="8" y="9" width="26" height="32" rx="2" fill="#e8f1fd" stroke="#1565d8" stroke-width="2.2"/><path d="M8 9h26v5H8z" fill="#1565d8"/><path d="M11 6v6M17 6v6M23 6v6M29 6v6" stroke="#1565d8" stroke-width="2" stroke-linecap="round"/><path d="M13 20h12M13 25h16M13 30h8M13 35h10" stroke="#1565d8" stroke-width="2" stroke-linecap="round"/><path d="m22 35 3-1 15-15-2-2-15 15z" fill="#f9a825" stroke="#1565d8" stroke-width="1.4"/></svg>',
    pengumuman: '<svg viewBox="0 0 48 48"><rect x="7" y="8" width="34" height="32" rx="2" fill="#fff" stroke="#1565d8" stroke-width="2.2"/><rect x="11" y="12" width="26" height="6" fill="#f9a825"/><text x="24" y="16.6" font-size="4.6" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">BERITA</text><rect x="11" y="22" width="11" height="9" fill="#e8f1fd" stroke="#1565d8" stroke-width="1.6"/><path d="M26 23h11M26 27h11M26 31h8M11 35h26" stroke="#1565d8" stroke-width="1.8" stroke-linecap="round"/></svg>',
    karyawan: '<svg viewBox="0 0 48 48"><circle cx="18" cy="17" r="7" fill="#e8f1fd" stroke="#1565d8" stroke-width="2.2"/><path d="M5 40c1-8 6-12 13-12s12 4 13 12z" fill="#e8f1fd" stroke="#1565d8" stroke-width="2.2"/><circle cx="34" cy="19" r="5" fill="#f9a825"/><path d="M28 30c2-1.5 4-2 6-2 5 0 8.5 3.5 9 9h-10" fill="#f9a825"/></svg>',
    laporan: '<svg viewBox="0 0 48 48"><rect x="8" y="6" width="32" height="36" rx="3" fill="#e8f1fd" stroke="#1565d8" stroke-width="2.2"/><path d="M15 34V26M22 34V18M29 34v-11M36 34v-5" stroke="#1565d8" stroke-width="3.5" stroke-linecap="round"/><path d="m14 20 7-6 7 4 8-7" fill="none" stroke="#f9a825" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    approval: '<svg viewBox="0 0 48 48"><rect x="9" y="8" width="30" height="34" rx="3" fill="#e8f1fd" stroke="#1565d8" stroke-width="2.2"/><rect x="17" y="5" width="14" height="6" rx="2" fill="#1565d8"/><circle cx="24" cy="26" r="9" fill="#43a047"/><path d="m19.5 26 3.2 3.2 6-6.4" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lokasi: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="40" rx="13" ry="4" fill="#e8f1fd" stroke="#1565d8" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M24 40s12-10.5 12-20a12 12 0 1 0-24 0c0 9.5 12 20 12 20z" fill="#1565d8"/><circle cx="24" cy="20" r="5" fill="#f9a825"/></svg>',
    setelan: '<svg viewBox="0 0 48 48"><path d="M24 6l4 2 4.5-1 2 4 4 2-1 4.5 2 4-2 4 1 4.5-4 2-2 4-4.5-1-4 2-4-2-4.5 1-2-4-4-2 1-4.5-2-4 2-4-1-4.5 4-2 2-4 4.5 1z" fill="#e8f1fd" stroke="#1565d8" stroke-width="2.2" stroke-linejoin="round"/><circle cx="24" cy="24" r="6" fill="#f9a825"/></svg>'
  };
  function logoSvg(color) {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="' + (color || '#fff') + '" opacity=".16"/>' +
      '<path d="M32 9c-10 0-18 8-18 18 0 13 18 29 18 29s18-16 18-29c0-10-8-18-18-18z" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round"/>' +
      '<path d="m24 27 6 6 11-12" fill="none" stroke="#ffd54f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* ================= UI helpers ================= */
  var toastT;
  function toast(msg, type, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + (type || '');
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = ''; }, ms || (type === 'err' ? 5500 : 3000));
  }
  function loading(on, text) {
    document.getElementById('loading').hidden = !on;
    document.getElementById('loadingText').textContent = text || 'Memuat…';
  }
  function modal(html, cls) {
    var m = document.createElement('div');
    m.className = 'modal ' + (cls || '');
    m.innerHTML = html;
    document.body.appendChild(m);
    var close = function () { if (m.parentNode) m.parentNode.removeChild(m); };
    m.addEventListener('click', function (e) { if (e.target === m && cls === 'sheet-wrap') close(); });
    return { el: m, close: close };
  }
  function sheet(title, body) {
    return modal('<div class="sheet"><div class="grip"></div><h2>' + esc(title) + '</h2>' + body + '</div>', 'sheet-wrap');
  }
  function confirmBox(msg, okText, danger) {
    return new Promise(function (res) {
      var m = modal('<div class="dlg"><p>' + esc(msg) + '</p><div class="acts"><button data-v="0">Batal</button><button data-v="1" style="' + (danger ? 'color:#e53935' : '') + '">' + esc(okText || 'Ya') + '</button></div></div>');
      $$('button', m.el).forEach(function (b) { b.onclick = function () { m.close(); res(b.dataset.v === '1'); }; });
    });
  }
  function promptBox(msg, placeholder) {
    return new Promise(function (res) {
      var m = modal('<div class="dlg"><p>' + esc(msg) + '</p><label class="f"><input id="pb" placeholder="' + esc(placeholder || '') + '"></label><div class="acts"><button data-v="0">Batal</button><button data-v="1">OK</button></div></div>');
      $$('button', m.el).forEach(function (b) { b.onclick = function () { var v = $('#pb', m.el).value; m.close(); res(b.dataset.v === '1' ? v : null); }; });
      $('#pb', m.el).focus();
    });
  }
  function viewPhoto(url) {
    var v = document.createElement('div');
    v.className = 'viewer';
    v.innerHTML = '<img src="' + esc(photoSrc(url, 1600)) + '" alt="Foto"><button aria-label="Tutup">✕</button>' +
      (url.indexOf('data:') === 0 ? '' : '<a href="' + esc(url) + '" target="_blank" rel="noopener">Buka di Google Drive</a>');
    v.onclick = function (e) { if (e.target.tagName !== 'A') v.remove(); };
    document.body.appendChild(v);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-photo]');
    if (t) { e.preventDefault(); viewPhoto(t.dataset.photo); }
  });
  function thumbs(list) {
    var h = list.filter(function (x) { return x[0]; }).map(function (x) {
      return '<img loading="lazy" src="' + esc(photoSrc(x[0], 300)) + '" data-photo="' + esc(x[0]) + '" alt="' + esc(x[1] || 'Foto') + '" title="' + esc(x[1] || '') + '">';
    }).join('');
    return h ? '<div class="thumbs">' + h + '</div>' : '';
  }
  function pwToggle(root) {
    $$('.pw button', root).forEach(function (b) {
      b.onclick = function () { var i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Lihat' : 'Sembunyi'; };
    });
  }
  function formData(form) {
    var o = {};
    $$('input,select,textarea', form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') { (o[el.name] = o[el.name] || []); if (el.checked) o[el.name].push(el.value); }
      else if (el.type !== 'file') o[el.name] = el.value;
    });
    return o;
  }
  function emptyState(text) { return '<div class="empty">' + I.doc + esc(text) + '</div>'; }

  /* ================= API ================= */
  function api(action, data, silent) {
    var body = Object.assign({}, data || {}, { action: action, token: S.token || '' });
    var p;
    if (DEMO_MODE) {
      p = sleep(250).then(function () { return DEMO.call(JSON.parse(JSON.stringify(body))); });
    } else {
      p = fetch(API, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
        .then(function (r) { return r.json(); })
        .catch(function () { throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'); });
    }
    return p.then(function (j) {
      if (!j || !j.ok) {
        var e = new Error((j && j.error) || 'Gagal memproses permintaan.');
        e.code = j && j.code;
        if (e.code === 'AUTH') { logout(true); if (!silent) toast(e.message, 'err'); }
        throw e;
      }
      return j.data;
    });
  }
  function run(promise, okMsg) {
    return promise.then(function (d) { loading(false); if (okMsg) toast(okMsg, 'ok'); return d; })
      .catch(function (e) { loading(false); if (e.code !== 'AUTH') toast(e.message, 'err'); throw e; });
  }

  /* ================= foto ================= */
  function pickPhoto(facing) {
    return new Promise(function (res) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      if (facing) inp.setAttribute('capture', facing);
      inp.style.display = 'none';
      inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); res(f || null); };
      document.body.appendChild(inp);
      inp.click();
    });
  }
  function loadImg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Foto tidak bisa dibaca.')); };
      img.src = url;
    });
  }
  // kecilkan + cap waktu/lokasi di foto (bukti)
  function processPhoto(file, stampLines) {
    return loadImg(file).then(function (img) {
      var max = DEMO_MODE ? 560 : 1280;
      var sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, w, h);
      if (stampLines && stampLines.length) {
        var fs = Math.max(11, Math.round(Math.min(w, h) * 0.034)), lh = fs * 1.35, padd = fs * 0.8;
        var bh = lh * stampLines.length + padd * 2;
        var grd = g.createLinearGradient(0, h - bh - fs * 2, 0, h);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.35, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,.7)');
        g.fillStyle = grd; g.fillRect(0, h - bh - fs * 2, w, bh + fs * 2);
        g.fillStyle = '#fff'; g.textBaseline = 'top';
        stampLines.forEach(function (t, i) {
          g.font = (i === 0 ? '700 ' : '400 ') + (i === 0 ? fs * 1.15 : fs) + 'px Roboto, Arial, sans-serif';
          var s = String(t);
          while (g.measureText(s).width > w - padd * 2 && s.length > 4) s = s.slice(0, -2);
          g.fillText(s === String(t) ? s : s + '…', padd, h - bh + padd + i * lh);
        });
      }
      return c.toDataURL('image/jpeg', DEMO_MODE ? 0.6 : 0.8);
    });
  }
  function stampFor(pos, extra) {
    var d = wibNow();
    var lines = [HARI[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + '  ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ' WIB'];
    if (pos) lines.push(pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6) + (pos.acc ? '  (±' + Math.round(pos.acc) + ' m)' : ''));
    if (extra) lines.push(extra);
    lines.push((S.user && S.user.nama || '') + ' · ' + (S.perusahaan || APP_NAME));
    return lines;
  }
  function photoField(label, required) {
    return '<div class="f"><span>' + esc(label) + (required ? ' *' : ' (opsional)') + '</span><button type="button" class="photo-pick" data-pick>' +
      I.cam.replace('<svg', '<svg width="30" height="30"') + '<span>Ambil / pilih foto</span></button></div>';
  }
  function bindPhotoField(root, holder) {
    var b = $('[data-pick]', root);
    if (!b) return;
    b.onclick = function () {
      pickPhoto().then(function (f) {
        if (!f) return;
        loading(true, 'Memproses foto…');
        return processPhoto(f, stampFor(null)).then(function (d) {
          loading(false);
          holder.photo = d;
          b.innerHTML = '<img src="' + d + '" alt=""><span>Foto siap · ketuk untuk ganti</span>';
        });
      }).catch(function (e) { loading(false); toast(e.message, 'err'); });
    };
  }

  /* ================= GPS ================= */
  function watchGps(onPos, onErr) {
    if (!navigator.geolocation) { onErr(new Error('Perangkat tidak mendukung GPS.')); return function () { }; }
    var id = navigator.geolocation.watchPosition(function (p) {
      onPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() });
    }, function (e) {
      var msg = e.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin lokasi untuk aplikasi ini di pengaturan browser.' :
        e.code === 3 ? 'GPS belum mendapat sinyal. Pastikan GPS aktif dan coba di tempat terbuka.' : 'Lokasi tidak tersedia. Aktifkan GPS.';
      onErr(new Error(msg));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 });
    return function () { navigator.geolocation.clearWatch(id); };
  }
  function reverseGeocode(lat, lng) {
    return fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=id&lat=' + lat + '&lon=' + lng)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var a = j.address || {};
        var parts = [j.name, a.road, a.village || a.suburb || a.neighbourhood, a.city || a.town || a.county].filter(Boolean);
        var seen = {};
        return parts.filter(function (p) { if (seen[p]) return false; seen[p] = 1; return true; }).join(', ');
      }).catch(function () { return ''; });
  }
  function nearestArea(areas, pos) {
    var best = null;
    (areas || []).forEach(function (a) {
      var d = haversine(pos.lat, pos.lng, +a.lat, +a.lng);
      if (!best || d < best.dist) best = { area: a, dist: d, radius: +a.radius > 0 ? +a.radius : 10 };
    });
    return best;
  }
  function tiles(map) {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  }

  /* ================= router ================= */
  var ROUTES = {};
  function go(r) { if (location.hash === '#' + r) render(); else location.hash = r; }
  function back() { if (history.length > 1) history.back(); else go(S.role === 'admin' ? 'admin' : 'home'); }
  window.addEventListener('hashchange', render);

  function render() {
    cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) { } });
    $$('.modal,.viewer').forEach(function (m) { m.remove(); });
    window.scrollTo(0, 0);
    if (!S.token) return viewLogin();
    var r = location.hash.slice(1);
    if (S.role === 'admin') { if (!/^admin/.test(r) && r !== 'profil') r = 'admin'; }
    else if (!r || /^admin/.test(r) || !ROUTES[r]) r = 'home';
    (ROUTES[r] || ROUTES.home)();
  }

  function page(title, body, opts) {
    opts = opts || {};
    app.innerHTML = '<div class="page"><header class="bar"><button class="ib" data-back aria-label="Kembali">' + I.back + '</button><h1>' + esc(title) + '</h1>' +
      (opts.plus ? '<button class="ib" data-plus aria-label="Tambah">' + I.plus + '</button>' : '<span class="ib"></span>') +
      '</header><main class="content">' + body + '</main></div>' + (opts.nav ? bottomNav(opts.nav) : '');
    $('[data-back]', app).onclick = back;
    if (opts.plus) $('[data-plus]', app).onclick = opts.plus;
    if (opts.nav) bindNav();
    return $('.content', app);
  }

  function bottomNav(on) {
    return '<nav class="bnav"><button data-go="home" class="' + (on === 'home' ? 'on' : '') + '">' + I.home + 'BERANDA</button>' +
      '<button data-go="absen" class="fp"><div class="circ"><span>' + I.finger + '</span></div>ABSENSI</button>' +
      '<button data-go="data" class="' + (on === 'data' ? 'on' : '') + '">' + I.data + 'DATA ABSENSI</button></nav>';
  }
  function bindNav() { $$('[data-go]', app).forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; }); }

  function logout(silent) {
    S = {}; saveSession();
    lsSet('ba-me', '');
    if (!silent) toast('Anda telah keluar.');
    location.hash = '';
    render();
  }

  /* ================= LOGIN ================= */
  function viewLogin() {
    app.innerHTML = '<div class="login"><div class="logo">' + logoSvg() + '<h1>' + esc(APP_NAME) + '</h1><p>' + esc(S.perusahaan || lsGet('ba-perusahaan') || 'Berkah Media Technology') + '</p></div>' +
      '<form id="lf" autocomplete="on">' +
      (DEMO_MODE ? '<div class="demo-note"><b>Mode demo</b> — server belum disambungkan (API_URL di config.js kosong). Data hanya tersimpan di perangkat ini. Login admin: <b>admin</b> + password default.</div>' : '') +
      '<label class="f"><span>Email (atau "admin")</span><input name="email" type="text" inputmode="email" autocomplete="username" required placeholder="nama@perusahaan.com"></label>' +
      '<label class="f"><span>Password</span><div class="pw"><input name="password" type="password" autocomplete="current-password" required><button type="button">Lihat</button></div></label>' +
      '<button class="btn" type="submit">Masuk</button></form>' +
      '<div class="foot">Khusus karyawan ' + esc(S.perusahaan || lsGet('ba-perusahaan') || 'Berkah Media Technology') + '<br>Lupa password? Hubungi admin.<br><br>Dibuat oleh Amajing Labs</div></div>';
    pwToggle(app);
    $('#lf').onsubmit = function (e) {
      e.preventDefault();
      var d = formData(e.target);
      loading(true, 'Masuk…');
      run(api('login', d)).then(function (r) {
        S = { token: r.token, role: r.role, user: r.user, perusahaan: r.perusahaan };
        saveSession(); lsSet('ba-perusahaan', r.perusahaan || '');
        location.hash = r.role === 'admin' ? 'admin' : 'home';
        render();
      }).catch(function () { });
    };
  }

  /* ================= HOME (karyawan) ================= */
  ROUTES.home = function () {
    var cached = null;
    try { cached = JSON.parse(lsGet('ba-me') || 'null'); } catch (e) { }
    drawHome(cached);
    api('me').then(function (me) {
      lsSet('ba-me', JSON.stringify(me));
      S.user = me.user; S.perusahaan = me.perusahaan; saveSession();
      if (location.hash.slice(1) === 'home' || !location.hash) drawHome(me);
    }).catch(function (e) { if (e.code !== 'AUTH') toast(e.message, 'err'); });
  };

  function drawHome(me) {
    var u = (me && me.user) || S.user || {};
    var sh = (me && me.shift) || { nama: 'Reguler', masuk: '--:--', pulang: '--:--' };
    var td = me && me.today;
    var rk = (me && me.rekap) || { hadir: '-', izin: '-', saldo_cuti: '-' };
    var now = (me && me.now && me.now.date) || today();
    var unread = me && me.pengumuman_terakhir && me.pengumuman_terakhir !== lsGet('ba-peng-seen');
    var tiles = [['izin', 'Izin'], ['lembur', 'Lembur'], ['shift', 'Shift'], ['reimburse', 'Reimbursement'], ['aktivitas', 'Aktivitas'], ['pengumuman', 'Pengumuman']];
    app.innerHTML = '<div class="home"><section class="hero"><div class="dots" style="left:4px;top:120px"></div><div class="dots" style="right:10px;top:4px"></div>' +
      '<div class="prof"><button class="avatar" data-go="profil" aria-label="Profil">' + esc(initials(u.nama)) + '</button>' +
      '<div class="grow"><b>' + esc(u.nama || '…') + '</b><small>' + esc(u.jabatan || 'karyawan') + '</small></div>' +
      '<button class="bell" data-go="pengumuman" aria-label="Pengumuman">' + I.bell + (unread ? '<i class="dot"></i>' : '') + '</button></div>' +
      '<div class="brandmark">' + logoSvg() + '<div class="t"><b>' + esc(APP_NAME) + '</b><span>' + esc(S.perusahaan || '') + '</span></div></div></section>' +
      '<section class="card today"><div class="top"><div class="clock">' + I.clock + '</div>' +
      '<div class="l">' + esc(sh.nama) + '<br><b>' + esc(sh.masuk) + ' - ' + esc(sh.pulang) + '</b><br><span class="st">Masuk : ' + (td && td.jam_masuk ? esc(td.jam_masuk) + ' WIB' : '-') + '</span></div>' +
      '<div class="r"><span class="day">' + HARI[parseD(now).getUTCDay()] + '</span><br>' + fmtLong(now).split(', ')[1] + '<br><span class="st">Pulang : ' + (td && td.jam_pulang ? esc(td.jam_pulang) + ' WIB' : '-') + '</span></div></div>' +
      '<h3>Rekap Absensi Bulan ini</h3><div class="rekap">' +
      '<div><div class="h">HADIR<button data-go="data" aria-label="Data hadir">' + I.arrowC + '</button></div><div class="v c-green">' + rk.hadir + ' Hari</div><div class="rbar bg-green"></div></div>' +
      '<div><div class="h">IZIN<button data-go="izin" aria-label="Data izin">' + I.arrowC + '</button></div><div class="v c-cyan">' + rk.izin + ' Hari</div><div class="rbar bg-cyan"></div></div>' +
      '<div><div class="h">SALDO CUTI<button data-go="izin" aria-label="Data cuti">' + I.arrowC + '</button></div><div class="v c-orange">' + rk.saldo_cuti + ' Hari</div><div class="rbar bg-orange"></div></div>' +
      '</div></section><h2 class="sec-title">Menu Utama</h2><div class="menu">' +
      tiles.map(function (t) { return '<button class="tile" data-go="' + t[0] + '"><span class="ic">' + MI[t[0]] + '</span>' + t[1] + '</button>'; }).join('') +
      '</div></div>' + bottomNav('home');
    bindNav();
  }

  /* ================= PETA: ABSEN & AKTIVITAS ================= */
  ROUTES.absen = function () { mapScreen('absen'); };
  ROUTES['aktivitas-baru'] = function () { mapScreen('aktivitas'); };

  function mapScreen(mode) {
    var me = null;
    try { me = JSON.parse(lsGet('ba-me') || 'null'); } catch (e) { }
    var pos = null, busy = false, gotMe = false;
    app.innerHTML = '<div class="mapscreen"><div id="map"></div>' +
      '<button class="fab l" data-back aria-label="Kembali">' + I.chev + '</button>' +
      '<button class="fab r" data-refresh aria-label="Perbarui lokasi">' + I.refresh + '</button>' +
      '<div class="mapcards"><div class="infocard"><div class="r">' + I.clockO + '<div><small>Tanggal</small><b>' + fmtLong(today()) + '</b></div></div>' +
      '<div class="r">' + I.pin + '<div><small>Lokasi</small><b id="locText">Mencari lokasi GPS…</b></div></div></div>' +
      '<div class="actcard"><span class="ico">' + I.hourglass + '</span><span class="lbl" id="actLbl">…</span><button class="go off" id="goBtn"><span id="goTxt">Tunggu GPS</span><i>›</i></button></div></div></div>';
    $('[data-back]', app).onclick = back;

    var map = L.map('map', { zoomControl: false, attributionControl: true }).setView(DEFAULT_CENTER, 17);
    tiles(map);
    cleanups.push(function () { map.remove(); });
    var meMarker = null, accCircle = null, areaLayer = L.layerGroup().addTo(map), centered = false;

    function kind() {
      if (mode === 'aktivitas') return 'aktivitas';
      var td = me && me.today;
      if (!td || !td.jam_masuk) return 'masuk';
      if (!td.jam_pulang) return 'pulang';
      return 'selesai';
    }
    function drawAreas() {
      areaLayer.clearLayers();
      ((me && me.areas) || []).forEach(function (a) {
        L.circle([+a.lat, +a.lng], { radius: +a.radius || 10, color: '#1565d8', weight: 2, fillOpacity: .15 }).addTo(areaLayer).bindTooltip(a.nama);
        L.circleMarker([+a.lat, +a.lng], { radius: 4, color: '#e53935', fillOpacity: 1 }).addTo(areaLayer);
      });
      if (!pos && me && me.areas && me.areas.length) map.setView([+me.areas[0].lat, +me.areas[0].lng], 17);
    }
    function update() {
      var k = kind();
      var lbl = { masuk: 'Absen Masuk', pulang: 'Absen Pulang', selesai: 'Aktivitas', aktivitas: 'Aktivitas' }[k];
      $('#actLbl').textContent = k === 'selesai' ? 'Absen hari ini selesai' : lbl;
      var btn = $('#goBtn'), txt = $('#goTxt'), loc = $('#locText');
      btn.className = 'go';
      if (!pos) { btn.className = 'go off'; txt.textContent = 'Tunggu GPS'; return; }
      var accTxt = pos.acc > 25 ? ' · akurasi GPS ±' + Math.round(pos.acc) + ' m' : '';
      if (k === 'masuk' || k === 'pulang') {
        if (!gotMe) { btn.className = 'go off'; txt.textContent = 'Memuat…'; return; }
        var n = nearestArea(me && me.areas, pos);
        if (!n) { loc.innerHTML = '<span class="out">Admin belum menentukan lokasi absen</span>'; btn.className = 'go off'; txt.textContent = lbl; return; }
        if (n.dist <= n.radius) {
          loc.innerHTML = '<span class="in">Anda berada di area ' + esc(n.area.nama) + '</span><span class="muted" style="font-weight:400"> (' + Math.round(n.dist) + ' m)' + accTxt + '</span>';
          txt.textContent = lbl; if (k === 'pulang') btn.className = 'go pulang';
        } else {
          loc.innerHTML = '<span class="out">Anda berada di luar radius kantor</span><br><span style="font-weight:400">Masih ' + fmtDist(n.dist) + ' dari ' + esc(n.area.nama) + accTxt + '</span>';
          btn.className = 'go off'; txt.textContent = lbl;
        }
      } else {
        var n2 = nearestArea(me && me.areas, pos);
        loc.innerHTML = n2 && n2.dist <= Math.max(n2.radius, 50) ? esc(n2.area.nama) + '<span class="muted" style="font-weight:400">' + accTxt + '</span>' :
          '<span>' + pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5) + '</span><span class="muted" style="font-weight:400">' + accTxt + '</span>';
        txt.textContent = 'Aktivitas';
      }
    }
    function onPos(p) {
      pos = p;
      var ll = [p.lat, p.lng];
      if (!meMarker) {
        meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
        accCircle = L.circle(ll, { radius: p.acc, color: '#2196f3', weight: 1, fillOpacity: .08 }).addTo(map);
      } else { meMarker.setLatLng(ll); accCircle.setLatLng(ll).setRadius(p.acc); }
      if (!centered) { map.setView(ll, 18); centered = true; }
      $('[data-refresh]').classList.remove('spin');
      update();
    }
    var stop = null;
    function startGps() {
      if (stop) stop();
      $('[data-refresh]').classList.add('spin');
      stop = watchGps(onPos, function (e) {
        $('[data-refresh]').classList.remove('spin');
        if (!pos) $('#locText').innerHTML = '<span class="out">' + esc(e.message) + '</span>';
        toast(e.message, 'err');
      });
    }
    startGps();
    cleanups.push(function () { if (stop) stop(); });
    $('[data-refresh]').onclick = function () { centered = false; startGps(); api('me').then(setMe).catch(function () { }); };

    function setMe(m) { me = m; gotMe = true; lsSet('ba-me', JSON.stringify(m)); drawAreas(); update(); }
    if (me) drawAreas();
    api('me').then(setMe).catch(function (e) { if (e.code !== 'AUTH') toast(e.message, 'err'); });
    update();

    $('#goBtn').onclick = function () {
      if (busy) return;
      var k = kind();
      if (!pos) { toast('Menunggu sinyal GPS… pastikan GPS aktif.', 'err'); return; }
      if (k === 'selesai') { mode = 'aktivitas'; update(); return; }
      if (k === 'masuk' || k === 'pulang') {
        if (!gotMe) return;
        var n = nearestArea(me.areas, pos);
        if (!n) { toast('Admin belum menentukan lokasi absen. Hubungi admin.', 'err'); return; }
        if (n.dist > n.radius) {
          toast('Titik lokasi Anda masih berjarak ' + fmtDist(n.dist) + ' dari titik absen "' + n.area.nama + '". Absen hanya bisa dalam radius ' + n.radius + ' meter.', 'err', 7000);
          return;
        }
      }
      var snap = Object.assign({}, pos);
      busy = true;
      pickPhoto(k === 'aktivitas' ? 'environment' : 'user').then(function (f) {
        if (!f) { busy = false; return; }
        loading(true, 'Memproses foto…');
        var n = nearestArea(me && me.areas, snap);
        var place = n && n.dist <= Math.max(n.radius, 50) ? n.area.nama : '';
        var label = k === 'masuk' ? 'ABSEN MASUK' : k === 'pulang' ? 'ABSEN PULANG' : 'AKTIVITAS';
        return processPhoto(f, stampFor(snap, label + (place ? ' · ' + place : ''))).then(function (dataUrl) {
          loading(false); busy = false;
          submitDialog(k, dataUrl, snap, place);
        });
      }).catch(function (e) { busy = false; loading(false); toast(e.message, 'err'); });
    };

    function submitDialog(k, dataUrl, snap, place) {
      var akt = k === 'aktivitas';
      var m = modal('<div class="dlg"><img class="shot" src="' + dataUrl + '" alt="Foto">' +
        (akt ? '<label class="f" style="margin-top:16px"><span>Lokasi</span><input id="dLok" value="' + esc(place) + '" placeholder="Nama toko / tempat"></label>' : '') +
        '<label class="f" style="margin-top:' + (akt ? 0 : 16) + 'px"><span>Keterangan' + (akt ? ' *' : '') + '</span>' +
        (akt ? '<textarea id="dKet" rows="4" placeholder="Contoh: PM | TUMPANG | 12.58&#10;DOI : …&#10;ACTION : …"></textarea>' : '<input id="dKet" placeholder="Keterangan (opsional)">') +
        '</label><div class="acts"><button data-x>Batal</button><button data-ok>Kirim</button></div></div>');
      if (akt && !place) reverseGeocode(snap.lat, snap.lng).then(function (a) { var el = $('#dLok', m.el); if (el && !el.value && a) el.value = a; });
      $('[data-x]', m.el).onclick = m.close;
      $('[data-ok]', m.el).onclick = function () {
        var ket = $('#dKet', m.el).value.trim();
        if (akt && !ket) { toast('Keterangan wajib diisi.', 'err'); return; }
        var body = { lat: snap.lat, lng: snap.lng, acc: snap.acc, photo: dataUrl, keterangan: ket };
        var action = akt ? 'aktivitas_add' : 'absen';
        if (akt) body.lokasi = $('#dLok', m.el).value.trim(); else body.type = k;
        $('[data-ok]', m.el).disabled = true;
        loading(true, 'Mengirim foto & lokasi…');
        run(api(action, body)).then(function (r) {
          m.close();
          toast(akt ? 'Laporan aktivitas terkirim.' : r.message, 'ok', 4500);
          lsSet('ba-me', '');
          go(akt ? 'aktivitas' : 'home');
        }).catch(function () { var b = $('[data-ok]', m.el); if (b) b.disabled = false; });
      };
    }
  }

  /* ================= AKTIVITAS ================= */
  var aktFilter = null;
  ROUTES.aktivitas = function () {
    if (!aktFilter) aktFilter = { from: today(), to: today() };
    var c = page('Laporan Aktivitas', '<div id="list">' + emptyState('Memuat…') + '</div>', { plus: function () { go('aktivitas-baru'); } });
    app.insertAdjacentHTML('beforeend', '<button class="fab-filter" id="ff"><b>Filter Tanggal Pengajuan</b><span>' + fmtDMY(aktFilter.from) + ' s/d ' + fmtDMY(aktFilter.to) + ' ▾</span></button>');
    $('#ff').onclick = function () {
      dateFilterSheet(aktFilter, function () { ROUTES.aktivitas(); });
    };
    api('aktivitas_list', aktFilter).then(function (rows) {
      $('#list', c).innerHTML = rows.length ? rows.map(aktCard).join('') : emptyState('Belum ada laporan aktivitas pada tanggal ini. Ketuk + untuk membuat laporan.');
      bindExpand(c);
    }).catch(function (e) { $('#list', c).innerHTML = emptyState(e.message); });
  };
  function aktCard(r, admin) {
    return '<div class="item" data-exp><div class="hd"><div class="dt">' + dayShort(r.tanggal) + '<b>' + r.tanggal.slice(8, 10) + '</b>' + monShort(r.tanggal) + '</div>' +
      '<div class="tm"><b>' + esc(r.jam) + ' WIB</b><span>' + (admin ? '<strong style="color:#1f2430">' + esc(r.nama) + '</strong> · ' : '') + esc(r.lokasi) + '</span></div></div>' +
      '<div class="bd"><small>Keterangan</small><p>' + esc(r.keterangan) + '</p>' + thumbs([[r.foto, 'Foto aktivitas']]) +
      '<div class="meta"><a href="' + mapsLink(r.lat, r.lng) + '" target="_blank" rel="noopener">📍 ' + (+r.lat).toFixed(6) + ', ' + (+r.lng).toFixed(6) + '</a>' + (r.akurasi ? ' · ±' + esc(r.akurasi) + ' m' : '') + '</div></div></div>';
  }
  function bindExpand(root) {
    $$('[data-exp] p', root).forEach(function (p) {
      p.onclick = function () { p.style.webkitLineClamp = p.style.webkitLineClamp === 'unset' ? '' : 'unset'; };
    });
  }
  function dateFilterSheet(f, done) {
    var m = sheet('Filter Tanggal', '<div class="row2"><label class="f"><span>Dari</span><input type="date" id="fFrom" value="' + f.from + '"></label>' +
      '<label class="f"><span>Sampai</span><input type="date" id="fTo" value="' + f.to + '"></label></div>' +
      '<div class="seg"><button data-q="0">Hari ini</button><button data-q="7">7 hari</button><button data-q="30">30 hari</button><button data-q="m">Bulan ini</button></div>' +
      '<button class="btn" id="fOk">Terapkan</button>');
    $$('[data-q]', m.el).forEach(function (b) {
      b.onclick = function () {
        var t = today();
        $('#fTo', m.el).value = t;
        $('#fFrom', m.el).value = b.dataset.q === 'm' ? t.slice(0, 8) + '01' : addDays(t, -(+b.dataset.q));
      };
    });
    $('#fOk', m.el).onclick = function () {
      f.from = $('#fFrom', m.el).value; f.to = $('#fTo', m.el).value;
      if (f.from > f.to) { var x = f.from; f.from = f.to; f.to = x; }
      m.close(); done();
    };
  }

  /* ================= DATA ABSENSI ================= */
  var dataMonth = null;
  ROUTES.data = function () {
    if (!dataMonth) dataMonth = today().slice(0, 7);
    var c = page('Data Absensi', '<div class="toolbar"><label class="f"><span>Bulan</span><input type="month" id="mon" value="' + dataMonth + '"></label></div><div id="list">' + emptyState('Memuat…') + '</div>', { nav: 'data' });
    $('#mon', c).onchange = function () { dataMonth = this.value || today().slice(0, 7); ROUTES.data(); };
    api('absensi_list', { from: dataMonth + '-01', to: dataMonth + '-31' }).then(function (rows) {
      $('#list', c).innerHTML = rows.length ? rows.map(function (r) { return absenCard(r); }).join('') : emptyState('Belum ada data absensi di bulan ini.');
    }).catch(function (e) { $('#list', c).innerHTML = emptyState(e.message); });
  };
  function absenCard(r, admin) {
    var late = /Terlambat|Cepat/.test(r.status);
    return '<div class="item"><div class="hd"><div class="dt">' + dayShort(r.tanggal) + '<b>' + r.tanggal.slice(8, 10) + '</b>' + monShort(r.tanggal) + '</div>' +
      '<div class="tm">' + (admin ? '<b style="font-size:16px">' + esc(r.nama) + '</b>' : '') +
      '<b style="font-size:' + (admin ? 15 : 17) + 'px;font-weight:400">Masuk <strong>' + esc(r.jam_masuk || '-') + '</strong> · Pulang <strong>' + esc(r.jam_pulang || '-') + '</strong></b>' +
      '<span>' + esc(r.area_masuk || '') + ' · ' + esc(r.shift || '') + '</span></div></div>' +
      '<div class="bd"><span class="tag ' + (late ? 'late' : 'ok') + '">' + esc(r.status) + '</span>' +
      thumbs([[r.foto_masuk, 'Foto masuk ' + r.jam_masuk], [r.foto_pulang, 'Foto pulang ' + r.jam_pulang]]) +
      '<div class="meta">' + (r.lat_masuk ? '<a href="' + mapsLink(r.lat_masuk, r.lng_masuk) + '" target="_blank" rel="noopener">📍 Masuk (' + esc(r.jarak_masuk) + ' m)</a>' : '') +
      (r.lat_pulang ? ' · <a href="' + mapsLink(r.lat_pulang, r.lng_pulang) + '" target="_blank" rel="noopener">📍 Pulang (' + esc(r.jarak_pulang) + ' m)</a>' : '') +
      (r.ket_masuk ? '<br>Ket. masuk: ' + esc(r.ket_masuk) : '') + (r.ket_pulang ? '<br>Ket. pulang: ' + esc(r.ket_pulang) : '') + '</div></div></div>';
  }

  /* ================= PENGAJUAN (izin/lembur/reimburse) ================= */
  function requestPage(cfg) {
    var c = page(cfg.title, (cfg.top || '') + '<div id="list">' + emptyState('Memuat…') + '</div>', { plus: function () { openForm(); } });
    function load() {
      api(cfg.list, {}).then(function (rows) {
        $('#list', c).innerHTML = rows.length ? rows.map(cfg.card).join('') : emptyState(cfg.empty);
      }).catch(function (e) { $('#list', c).innerHTML = emptyState(e.message); });
    }
    function openForm() {
      var holder = {};
      var m = sheet(cfg.formTitle, '<form>' + cfg.form() + '<button class="btn" type="submit">Kirim Pengajuan</button></form>');
      bindPhotoField(m.el, holder);
      if (cfg.bind) cfg.bind(m.el);
      $('form', m.el).onsubmit = function (e) {
        e.preventDefault();
        var d = formData(e.target);
        if (holder.photo) d.photo = holder.photo;
        loading(true, 'Mengirim…');
        run(api(cfg.add, d), 'Pengajuan terkirim, menunggu persetujuan admin.').then(function () { m.close(); lsSet('ba-me', ''); load(); }).catch(function () { });
      };
    }
    load();
    if (cfg.after) cfg.after(c);
    return c;
  }
  function reqCard(head, sub, body, r, photos) {
    return '<div class="item"><div class="hd"><div class="tm" style="flex:1"><b style="font-size:17px">' + head + '</b><span>' + sub + '</span></div><div>' + statusTag(r.status) + '</div></div>' +
      '<div class="bd">' + body + thumbs(photos || []) + (r.catatan ? '<div class="meta">Catatan admin: ' + esc(r.catatan) + '</div>' : '') +
      '<div class="meta">Diajukan ' + esc(r.dibuat) + (r.diproses ? ' · Diproses ' + esc(r.diproses) : '') + '</div></div></div>';
  }

  ROUTES.izin = function () {
    var me = null; try { me = JSON.parse(lsGet('ba-me') || 'null'); } catch (e) { }
    requestPage({
      title: 'Izin & Cuti', list: 'izin_list', add: 'izin_add', formTitle: 'Ajukan Izin / Cuti',
      top: me ? '<div class="info-box">Saldo cuti Anda: <b>' + me.rekap.saldo_cuti + ' hari</b> · Izin bulan ini: <b>' + me.rekap.izin + ' hari</b></div>' : '',
      empty: 'Belum ada pengajuan izin. Ketuk + untuk mengajukan.',
      form: function () {
        return '<label class="f"><span>Jenis</span><select name="jenis" required><option>Izin</option><option>Sakit</option><option>Cuti</option></select></label>' +
          '<div class="row2"><label class="f"><span>Mulai</span><input type="date" name="mulai" value="' + today() + '" required></label>' +
          '<label class="f"><span>Selesai</span><input type="date" name="selesai" value="' + today() + '" required></label></div>' +
          '<label class="f"><span>Alasan</span><textarea name="alasan" required></textarea></label>' + photoField('Lampiran (surat dokter, dll.)', false);
      },
      card: function (r) {
        return reqCard(esc(r.jenis) + ' · ' + esc(r.hari) + ' hari', fmtDate(r.mulai) + (r.selesai !== r.mulai ? ' – ' + fmtDate(r.selesai) : ''), '<p>' + esc(r.alasan) + '</p>', r, [[r.foto, 'Lampiran']]);
      }
    });
  };

  ROUTES.lembur = function () {
    requestPage({
      title: 'Lembur', list: 'lembur_list', add: 'lembur_add', formTitle: 'Ajukan Lembur', empty: 'Belum ada pengajuan lembur.',
      form: function () {
        return '<label class="f"><span>Tanggal</span><input type="date" name="tanggal" value="' + today() + '" required></label>' +
          '<div class="row2"><label class="f"><span>Jam mulai</span><input type="time" name="jam_mulai" value="18:00" required></label>' +
          '<label class="f"><span>Jam selesai</span><input type="time" name="jam_selesai" value="20:00" required></label></div>' +
          '<label class="f"><span>Keterangan pekerjaan</span><textarea name="keterangan" required></textarea></label>' + photoField('Foto bukti', false);
      },
      card: function (r) {
        return reqCard(fmtDate(r.tanggal), esc(r.jam_mulai) + ' – ' + esc(r.jam_selesai) + ' (' + esc(r.durasi) + ')', '<p>' + esc(r.keterangan) + '</p>', r, [[r.foto, 'Bukti lembur']]);
      }
    });
  };

  ROUTES.reimburse = function () {
    requestPage({
      title: 'Reimbursement', list: 'reimburse_list', add: 'reimburse_add', formTitle: 'Ajukan Reimbursement', empty: 'Belum ada pengajuan reimbursement.',
      form: function () {
        return '<label class="f"><span>Tanggal transaksi</span><input type="date" name="tanggal" value="' + today() + '" required></label>' +
          '<label class="f"><span>Kategori</span><select name="kategori">' + KATEGORI_REIMB.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></label>' +
          '<label class="f"><span>Nominal (Rp)</span><input name="nominal" inputmode="numeric" required placeholder="50000"></label>' +
          '<label class="f"><span>Keterangan</span><textarea name="keterangan"></textarea></label>' + photoField('Foto struk / bukti', true);
      },
      card: function (r) {
        return reqCard(rupiah(r.nominal), esc(r.kategori) + ' · ' + fmtDate(r.tanggal), r.keterangan ? '<p>' + esc(r.keterangan) + '</p>' : '', r, [[r.foto, 'Struk']]);
      }
    });
  };

  ROUTES.shift = function () {
    var shifts = [];
    var c = requestPage({
      title: 'Shift', list: 'tukarshift_list', add: 'tukarshift_add', formTitle: 'Ajukan Tukar Shift', empty: 'Belum ada pengajuan tukar shift.',
      top: '<div id="shInfo"></div><h3 style="font-weight:500;margin:18px 4px 10px">Riwayat pengajuan tukar shift</h3>',
      form: function () {
        return '<label class="f"><span>Tanggal</span><input type="date" name="tanggal" value="' + addDays(today(), 1) + '" required></label>' +
          '<label class="f"><span>Pindah ke shift</span><select name="shift_id">' + shifts.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.nama + ' ' + s.masuk + '-' + s.pulang) + '</option>'; }).join('') + '</select></label>' +
          '<label class="f"><span>Alasan</span><textarea name="alasan" required></textarea></label>';
      },
      card: function (r) { return reqCard(fmtDate(r.tanggal), 'Ke shift ' + esc(r.shift), '<p>' + esc(r.alasan) + '</p>', r); }
    });
    api('shift_info').then(function (d) {
      shifts = d.semua;
      $('#shInfo', c).innerHTML = '<div class="item"><div class="hd"><div class="clock">' + I.clock + '</div><div class="tm"><span>Shift Anda</span><b>' + esc(d.saya.nama) + ' · ' + esc(d.saya.masuk) + ' - ' + esc(d.saya.pulang) + '</b>' +
        (d.hari_ini.id !== d.saya.id ? '<span>Hari ini: ' + esc(d.hari_ini.nama + ' ' + d.hari_ini.masuk + '-' + d.hari_ini.pulang) + '</span>' : '') + '</div></div>' +
        '<div class="bd"><small>Daftar shift perusahaan</small>' + d.semua.map(function (s) { return '<div>' + esc(s.nama) + ' — ' + esc(s.masuk) + ' s/d ' + esc(s.pulang) + '</div>'; }).join('') + '</div></div>';
    }).catch(function () { });
  };

  ROUTES.pengumuman = function () {
    var c = page('Pengumuman', '<div id="list">' + emptyState('Memuat…') + '</div>');
    api('pengumuman_list').then(function (rows) {
      if (rows[0]) lsSet('ba-peng-seen', rows[0].tanggal + '|' + rows[0].id);
      $('#list', c).innerHTML = rows.length ? rows.map(function (r) {
        return '<div class="item"><div class="hd"><div class="tm"><b>' + esc(r.judul) + '</b><span>' + fmtLong(r.tanggal) + ' · ' + esc(r.tanggal.slice(11, 16)) + '</span></div></div><div class="bd"><p style="font-weight:400;-webkit-line-clamp:unset">' + esc(r.isi) + '</p></div></div>';
      }).join('') : emptyState('Belum ada pengumuman.');
    }).catch(function (e) { $('#list', c).innerHTML = emptyState(e.message); });
  };

  /* ================= PROFIL ================= */
  ROUTES.profil = function () {
    var u = S.user || {};
    var adm = S.role === 'admin';
    var c = page('Profil', '<div class="item"><div class="hd" style="align-items:center"><div class="av-s" style="width:56px;height:56px;font-size:20px">' + esc(initials(u.nama)) + '</div>' +
      '<div class="tm"><b>' + esc(u.nama) + '</b><span>' + esc(u.jabatan || '') + '</span></div></div>' +
      (adm ? '' : '<div class="bd"><div>📧 ' + esc(u.email) + '</div><div>📱 ' + esc(u.telepon) + '</div><div class="meta">' + esc(S.perusahaan || '') + '</div></div>') + '</div>' +
      '<div class="item"><div class="bd" style="border:0"><h3 style="margin:4px 0 12px;font-weight:500">Ganti Password</h3><form id="pf">' +
      '<label class="f"><span>Password lama</span><div class="pw"><input type="password" name="old" required autocomplete="current-password"><button type="button">Lihat</button></div></label>' +
      '<label class="f"><span>Password baru (min. 6 karakter)</span><div class="pw"><input type="password" name="new" required minlength="6" autocomplete="new-password"><button type="button">Lihat</button></div></label>' +
      '<label class="f"><span>Ulangi password baru</span><div class="pw"><input type="password" name="new2" required autocomplete="new-password"><button type="button">Lihat</button></div></label>' +
      '<button class="btn" type="submit">Simpan Password</button></form></div></div>' +
      '<button class="btn red" id="lo">' + I.logout.replace('<svg', '<svg width="20" height="20"') + 'Keluar</button>' +
      (DEMO_MODE ? '<button class="btn ghost" id="rd" style="margin-top:10px">Hapus semua data demo</button>' : '') +
      '<p class="center muted" style="font-size:12px;margin-top:22px">' + esc(APP_NAME) + ' · Dibuat oleh Amajing Labs</p>');
    pwToggle(c);
    $('#pf', c).onsubmit = function (e) {
      e.preventDefault();
      var d = formData(e.target);
      if (d.new !== d.new2) { toast('Ulangi password baru tidak sama.', 'err'); return; }
      loading(true, 'Menyimpan…');
      run(api('change_password', d), 'Password berhasil diganti.').then(function (r) { S.token = r.token; saveSession(); e.target.reset(); }).catch(function () { });
    };
    $('#lo', c).onclick = function () { confirmBox('Keluar dari aplikasi?', 'Keluar').then(function (ok) { if (ok) logout(); }); };
    if ($('#rd', c)) $('#rd', c).onclick = function () {
      confirmBox('Hapus semua data demo (akun, absensi, laporan) di perangkat ini?', 'Hapus', true).then(function (ok) { if (ok) { DEMO.reset(); logout(); } });
    };
  };

  /* =====================================================================
     ADMIN
     ===================================================================== */
  ROUTES.admin = function () {
    var menu = [['admin-karyawan', 'karyawan', 'Karyawan'], ['admin-laporan', 'laporan', 'Laporan'], ['admin-approval', 'approval', 'Persetujuan'], ['admin-lokasi', 'lokasi', 'Lokasi Absen'],
      ['admin-shift', 'shift', 'Shift'], ['admin-pengumuman', 'pengumuman', 'Pengumuman'], ['admin-setelan', 'setelan', 'Pengaturan'], ['profil', 'izin', 'Password']];
    app.innerHTML = '<div class="home" style="padding-bottom:30px"><section class="hero"><div class="dots" style="right:10px;top:4px"></div>' +
      '<div class="prof"><button class="avatar" data-go="profil">AD</button><div class="grow"><b>Administrator</b><small id="aPer">' + esc(S.perusahaan || '') + '</small></div>' +
      '<button class="bell" id="aOut" aria-label="Keluar">' + I.logout + '</button></div>' +
      '<div class="brandmark">' + logoSvg() + '<div class="t"><b>' + esc(APP_NAME) + '</b><span>Panel Admin · ' + fmtLong(today()) + '</span></div></div></section>' +
      '<div class="stats"><div class="stat"><b id="sH">-</b><span>Hadir hari ini</span></div><div class="stat"><b id="sT" class="c-orange">-</b><span>Terlambat</span></div><div class="stat"><b id="sP" class="c-cyan">-</b><span>Menunggu persetujuan</span></div></div>' +
      '<div id="aWarn" style="margin:14px 16px 0"></div>' +
      '<h2 class="sec-title">Menu Admin</h2><div class="menu">' +
      menu.map(function (m) { return '<button class="tile" data-go="' + m[0] + '"><span class="ic">' + MI[m[1]] + '</span>' + m[2] + '</button>'; }).join('') + '</div>' +
      '<h2 class="sec-title">Absen hari ini</h2><div class="list-plain" id="aAbs"><div class="li muted">Memuat…</div></div>' +
      '<h2 class="sec-title">Belum absen hari ini</h2><div class="list-plain" id="aBelum"><div class="li muted">Memuat…</div></div></div>';
    bindNav();
    $('#aOut').onclick = function () { confirmBox('Keluar dari panel admin?', 'Keluar').then(function (ok) { if (ok) logout(); }); };
    api('admin_dashboard').then(function (d) {
      $('#sH').textContent = d.hadir + '/' + d.total; $('#sT').textContent = d.terlambat; $('#sP').textContent = d.pending;
      var w = '';
      if (!d.areas) w += '<div class="info-box warn">⚠️ Belum ada <b>Lokasi Absen</b>. Karyawan belum bisa absen masuk/pulang. <a href="#admin-lokasi">Tambah lokasi</a></div>';
      if (!d.total) w += '<div class="info-box">Belum ada karyawan terdaftar. <a href="#admin-karyawan">Daftarkan karyawan</a></div>';
      if (DEMO_MODE) w += '<div class="info-box warn">Mode demo: data hanya di perangkat ini. Sambungkan server Google Sheet lewat config.js (lihat PANDUAN.md).</div>';
      $('#aWarn').innerHTML = w;
      $('#aAbs').innerHTML = d.absen_hari_ini.length ? d.absen_hari_ini.map(function (r) {
        return '<div class="li"><div class="av-s">' + esc(initials(r.nama)) + '</div><div class="grow"><b>' + esc(r.nama) + '</b><span>Masuk ' + esc(r.jam_masuk) + ' · Pulang ' + esc(r.jam_pulang || '-') + ' · ' + esc(r.area_masuk) + '</span></div>' +
          '<span class="tag ' + (/Terlambat/.test(r.status) ? 'late' : 'ok') + '">' + esc(r.status.split(',')[0]) + '</span></div>';
      }).join('') : '<div class="li muted">Belum ada yang absen.</div>';
      $('#aBelum').innerHTML = d.belum_absen.length ? d.belum_absen.map(function (u) {
        return '<div class="li"><div class="av-s">' + esc(initials(u.nama)) + '</div><div class="grow"><b>' + esc(u.nama) + '</b><span>' + esc(u.jabatan) + '</span></div>' +
          (u.telepon ? '<a class="btn ghost sm" href="https://wa.me/' + esc(String(u.telepon).replace(/^0/, '62').replace(/^\+/, '')) + '" target="_blank" rel="noopener">WA</a>' : '') + '</div>';
      }).join('') : '<div class="li muted">Semua karyawan sudah absen / izin. 👍</div>';
    }).catch(function (e) { if (e.code !== 'AUTH') toast(e.message, 'err'); });
  };

  /* ---------- karyawan ---------- */
  ROUTES['admin-karyawan'] = function () {
    var data = null;
    var c = page('Karyawan', '<input class="search" id="q" placeholder="Cari nama, email, jabatan…"><div class="list-plain" style="margin:0" id="list"><div class="li muted">Memuat…</div></div>', { plus: function () { if (data) userForm(null); } });
    function load() {
      api('users_list').then(function (d) { data = d; draw(); }).catch(function (e) { $('#list', c).innerHTML = '<div class="li">' + esc(e.message) + '</div>'; });
    }
    function draw() {
      var q = $('#q', c).value.toLowerCase();
      var rows = data.users.filter(function (u) { return !q || (u.nama + ' ' + u.email + ' ' + u.jabatan + ' ' + u.telepon).toLowerCase().indexOf(q) >= 0; });
      $('#list', c).innerHTML = rows.length ? rows.map(function (u) {
        return '<div class="li" data-id="' + esc(u.id) + '" style="cursor:pointer"><div class="av-s">' + esc(initials(u.nama)) + '</div><div class="grow"><b>' + esc(u.nama) + '</b><span>' + esc(u.jabatan) + ' · ' + esc(u.email) + '<br>' + esc(u.telepon) + '</span></div><span class="muted">›</span></div>';
      }).join('') : '<div class="li muted">' + (data.users.length ? 'Tidak ditemukan.' : 'Belum ada karyawan. Ketuk + untuk mendaftarkan.') + '</div>';
      $$('[data-id]', c).forEach(function (el) {
        el.onclick = function () { userForm(data.users.filter(function (u) { return u.id === el.dataset.id; })[0]); };
      });
    }
    $('#q', c).oninput = function () { if (data) draw(); };
    function userForm(u) {
      var edit = !!u; u = u || { saldo_cuti: '12' };
      var ids = String(u.area_ids || '').split(',').filter(Boolean);
      var m = sheet(edit ? 'Edit Karyawan' : 'Daftarkan Karyawan', '<form>' +
        '<label class="f"><span>Nama lengkap</span><input name="nama" required value="' + esc(u.nama || '') + '"></label>' +
        '<label class="f"><span>Email (untuk login)</span><input name="email" type="email" required value="' + esc(u.email || '') + '"></label>' +
        '<label class="f"><span>Nomor telepon / WA</span><input name="telepon" type="tel" required value="' + esc(u.telepon || '') + '" placeholder="08xxxxxxxxxx"></label>' +
        '<label class="f"><span>Jabatan</span><select name="jabatan" required><option value="">— pilih —</option>' + JABATAN.map(function (j) { return '<option' + (u.jabatan === j ? ' selected' : '') + '>' + j + '</option>'; }).join('') + '</select></label>' +
        '<div class="row2"><label class="f"><span>Shift</span><select name="shift_id">' + data.shifts.map(function (s) { return '<option value="' + esc(s.id) + '"' + (u.shift_id === s.id ? ' selected' : '') + '>' + esc(s.nama + ' ' + s.masuk + '-' + s.pulang) + '</option>'; }).join('') + '</select></label>' +
        '<label class="f"><span>Jatah cuti / tahun</span><input name="saldo_cuti" type="number" min="0" value="' + esc(u.saldo_cuti) + '"></label></div>' +
        '<div class="f"><span>Lokasi absen yang diizinkan</span>' + (data.areas.length ? data.areas.map(function (a) {
          return '<label class="chk"><input type="checkbox" name="area_ids" value="' + esc(a.id) + '"' + (ids.indexOf(a.id) >= 0 ? ' checked' : '') + '>' + esc(a.nama) + '</label>';
        }).join('') + '<div class="hint">Tidak dicentang semua = boleh absen di semua lokasi.</div>' : '<div class="hint">Belum ada lokasi. Tambahkan di menu Lokasi Absen.</div>') + '</div>' +
        '<label class="f"><span>' + (edit ? 'Password baru (kosongkan jika tidak diganti)' : 'Password awal (min. 6 karakter)') + '</span><div class="pw"><input name="password" type="password" ' + (edit ? '' : 'required ') + 'minlength="6" autocomplete="new-password"><button type="button">Lihat</button></div>' +
        '<div class="hint">Berikan ke karyawan; mereka bisa menggantinya di menu Profil.</div></label>' +
        '<button class="btn" type="submit">' + (edit ? 'Simpan Perubahan' : 'Daftarkan') + '</button>' +
        (edit ? '<button class="btn red" type="button" id="del" style="margin-top:10px">Hapus Akun</button>' : '') + '</form>');
      pwToggle(m.el);
      $('form', m.el).onsubmit = function (e) {
        e.preventDefault();
        var d = formData(e.target);
        d.area_ids = d.area_ids || [];
        if (edit) d.id = u.id;
        loading(true, 'Menyimpan…');
        run(api(edit ? 'user_update' : 'user_add', d), edit ? 'Data karyawan disimpan.' : 'Karyawan berhasil didaftarkan.').then(function () { m.close(); load(); }).catch(function () { });
      };
      if (edit) $('#del', m.el).onclick = function () {
        confirmBox('Hapus akun ' + u.nama + '? Karyawan ini tidak bisa login lagi. Data laporan lamanya tetap tersimpan di Google Sheet.', 'Hapus', true).then(function (ok) {
          if (!ok) return;
          loading(true, 'Menghapus…');
          run(api('user_delete', { id: u.id }), 'Akun dihapus.').then(function () { m.close(); load(); }).catch(function () { });
        });
      };
    }
    load();
  };

  /* ---------- laporan ---------- */
  var repState = null;
  ROUTES['admin-laporan'] = function () {
    if (!repState) repState = { jenis: 'absensi', user_id: '', from: today().slice(0, 8) + '01', to: today() };
    var jenis = [['absensi', 'Absensi'], ['aktivitas', 'Aktivitas'], ['izin', 'Izin/Cuti'], ['lembur', 'Lembur'], ['reimburse', 'Reimburse'], ['tukarshift', 'Tukar Shift']];
    var c = page('Laporan Karyawan', '<div class="seg" id="seg">' + jenis.map(function (j) { return '<button data-j="' + j[0] + '" class="' + (repState.jenis === j[0] ? 'on' : '') + '">' + j[1] + '</button>'; }).join('') + '</div>' +
      '<div class="toolbar"><label class="f" style="flex-basis:100%"><span>Karyawan</span><select id="ru"><option value="">Semua karyawan</option></select></label>' +
      '<label class="f"><span>Dari</span><input type="date" id="rf" value="' + repState.from + '"></label><label class="f"><span>Sampai</span><input type="date" id="rt" value="' + repState.to + '"></label></div>' +
      '<div class="btns" style="margin-bottom:16px"><button class="btn" id="rgo">Tampilkan</button><button class="btn ghost" id="rcsv">Unduh CSV</button></div>' +
      '<div id="rsum" class="muted" style="margin:0 4px 10px;font-size:14px"></div><div id="list"></div>');
    var last = null;
    api('users_list').then(function (d) {
      $('#ru', c).innerHTML = '<option value="">Semua karyawan</option>' + d.users.map(function (u) { return '<option value="' + esc(u.id) + '"' + (repState.user_id === u.id ? ' selected' : '') + '>' + esc(u.nama) + '</option>'; }).join('');
    }).catch(function () { });
    $$('[data-j]', c).forEach(function (b) { b.onclick = function () { repState.jenis = b.dataset.j; ROUTES['admin-laporan'](); }; });
    function load() {
      repState.user_id = $('#ru', c).value; repState.from = $('#rf', c).value; repState.to = $('#rt', c).value;
      $('#list', c).innerHTML = emptyState('Memuat…');
      api('report', repState).then(function (d) {
        last = d;
        $('#rsum', c).textContent = d.rows.length + ' data · ' + fmtDMY(repState.from) + ' s/d ' + fmtDMY(repState.to);
        $('#list', c).innerHTML = d.rows.length ? d.rows.map(function (r) { return adminCard(repState.jenis, r); }).join('') : emptyState('Tidak ada data.');
        bindExpand(c);
      }).catch(function (e) { $('#list', c).innerHTML = emptyState(e.message); });
    }
    $('#rgo', c).onclick = load;
    $('#rcsv', c).onclick = function () {
      if (!last || !last.rows.length) { toast('Tampilkan data dulu.', 'err'); return; }
      var cols = last.columns;
      var csv = '﻿' + cols.join(';') + '\n' + last.rows.map(function (r) {
        return cols.map(function (k) { var v = String(r[k] == null ? '' : r[k]); if (v.indexOf('data:') === 0) v = '(foto demo)'; return '"' + v.replace(/"/g, '""') + '"'; }).join(';');
      }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'Laporan_' + repState.jenis + '_' + repState.from + '_' + repState.to + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    };
    load();
  };
  function adminCard(j, r) {
    if (j === 'absensi') return absenCard(r, true);
    if (j === 'aktivitas') return aktCard(r, true);
    if (j === 'izin') return reqCard(esc(r.nama) + ' · ' + esc(r.jenis), fmtDate(r.mulai) + ' – ' + fmtDate(r.selesai) + ' (' + esc(r.hari) + ' hari)', '<p>' + esc(r.alasan) + '</p>', r, [[r.foto, 'Lampiran']]);
    if (j === 'lembur') return reqCard(esc(r.nama) + ' · ' + fmtDate(r.tanggal), esc(r.jam_mulai) + ' – ' + esc(r.jam_selesai) + ' (' + esc(r.durasi) + ')', '<p>' + esc(r.keterangan) + '</p>', r, [[r.foto, 'Bukti']]);
    if (j === 'reimburse') return reqCard(esc(r.nama) + ' · ' + rupiah(r.nominal), esc(r.kategori) + ' · ' + fmtDate(r.tanggal), r.keterangan ? '<p>' + esc(r.keterangan) + '</p>' : '', r, [[r.foto, 'Struk']]);
    return reqCard(esc(r.nama) + ' · ' + fmtDate(r.tanggal), 'Ke shift ' + esc(r.shift), '<p>' + esc(r.alasan) + '</p>', r);
  }

  /* ---------- persetujuan ---------- */
  ROUTES['admin-approval'] = function () {
    var c = page('Persetujuan', '<div id="list">' + emptyState('Memuat…') + '</div>');
    var label = { Izin: 'izin', Lembur: 'lembur', Reimburse: 'reimburse', TukarShift: 'tukarshift' };
    function load() {
      api('approvals').then(function (rows) {
        $('#list', c).innerHTML = rows.length ? rows.map(function (r) {
          var card = adminCard(label[r._tipe], r);
          var tipe = r._tipe === 'TukarShift' ? 'Tukar Shift' : r._tipe;
          return card.replace('<div class="bd">', '<div class="bd"><span class="tag">' + tipe + '</span>')
            .replace(/<\/div><\/div>$/, '<div class="acts"><button class="btn green sm" data-a="Disetujui" data-t="' + r._tipe + '" data-id="' + esc(r.id) + '">Setujui</button>' +
              '<button class="btn red sm" data-a="Ditolak" data-t="' + r._tipe + '" data-id="' + esc(r.id) + '">Tolak</button></div></div></div>');
        }).join('') : emptyState('Tidak ada pengajuan yang menunggu. 👍');
        $$('[data-a]', c).forEach(function (b) {
          b.onclick = function () {
            promptBox((b.dataset.a === 'Disetujui' ? 'Setujui' : 'Tolak') + ' pengajuan ini? Catatan untuk karyawan (opsional):').then(function (cat) {
              if (cat === null) return;
              loading(true, 'Menyimpan…');
              run(api('approve', { tipe: b.dataset.t, id: b.dataset.id, status: b.dataset.a, catatan: cat }), 'Pengajuan ' + b.dataset.a.toLowerCase() + '.').then(load).catch(function () { });
            });
          };
        });
      }).catch(function (e) { $('#list', c).innerHTML = emptyState(e.message); });
    }
    load();
  };

  /* ---------- lokasi absen ---------- */
  ROUTES['admin-lokasi'] = function () {
    var areas = [];
    var c = page('Lokasi Absen', '<div class="info-box">Absen masuk & pulang hanya bisa dilakukan dalam radius titik lokasi di bawah (bawaan <b>10 meter</b>). Jika lebih jauh, karyawan diberi tahu jaraknya.</div>' +
      '<div class="minimap" id="ovmap" style="height:220px"></div><div class="list-plain" style="margin:0" id="list"><div class="li muted">Memuat…</div></div>', { plus: function () { areaForm(null); } });
    var ov = L.map('ovmap', { zoomControl: false }).setView(DEFAULT_CENTER, 12);
    tiles(ov);
    var lay = L.layerGroup().addTo(ov);
    cleanups.push(function () { ov.remove(); });
    function load() {
      api('areas_list').then(function (rows) {
        areas = rows; lay.clearLayers();
        rows.forEach(function (a) { L.circle([+a.lat, +a.lng], { radius: +a.radius, color: '#1565d8' }).addTo(lay); L.marker([+a.lat, +a.lng]).addTo(lay).bindTooltip(a.nama); });
        if (rows.length) ov.fitBounds(L.latLngBounds(rows.map(function (a) { return [+a.lat, +a.lng]; })).pad(0.3), { maxZoom: 17 });
        $('#list', c).innerHTML = rows.length ? rows.map(function (a) {
          return '<div class="li" data-id="' + esc(a.id) + '" style="cursor:pointer"><div class="av-s">📍</div><div class="grow"><b>' + esc(a.nama) + '</b><span>Radius ' + esc(a.radius) + ' m · ' + (+a.lat).toFixed(6) + ', ' + (+a.lng).toFixed(6) + (a.alamat ? '<br>' + esc(a.alamat) : '') + '</span></div><span class="muted">›</span></div>';
        }).join('') : '<div class="li muted">Belum ada lokasi. Ketuk + untuk menambah.</div>';
        $$('[data-id]', c).forEach(function (el) { el.onclick = function () { areaForm(areas.filter(function (a) { return a.id === el.dataset.id; })[0]); }; });
      }).catch(function (e) { toast(e.message, 'err'); });
    }
    function areaForm(a) {
      var edit = !!a; a = a || { radius: 10 };
      var m = sheet(edit ? 'Edit Lokasi' : 'Tambah Lokasi Absen', '<form>' +
        '<label class="f"><span>Nama lokasi</span><input name="nama" required value="' + esc(a.nama || '') + '" placeholder="Contoh: Alibaba Store Kawi"></label>' +
        '<div class="minimap" id="pmap"></div>' +
        '<div class="btns" style="margin-bottom:12px"><button type="button" class="btn ghost sm" id="myloc">📍 Pakai lokasi saya</button><button type="button" class="btn ghost sm" id="paste">Tempel link Maps</button></div>' +
        '<div class="row2"><label class="f"><span>Latitude</span><input name="lat" id="la" required inputmode="decimal" value="' + esc(a.lat || '') + '"></label>' +
        '<label class="f"><span>Longitude</span><input name="lng" id="lo2" required inputmode="decimal" value="' + esc(a.lng || '') + '"></label></div>' +
        '<label class="f"><span>Radius (meter)</span><input name="radius" id="rad" type="number" min="5" max="5000" value="' + esc(a.radius) + '"><div class="hint">Bawaan 10 meter sesuai ketentuan. Ketuk peta untuk memindah titik.</div></label>' +
        '<label class="f"><span>Alamat / catatan (opsional)</span><input name="alamat" value="' + esc(a.alamat || '') + '"></label>' +
        '<button class="btn" type="submit">Simpan Lokasi</button>' + (edit ? '<button class="btn red" type="button" id="del" style="margin-top:10px">Hapus Lokasi</button>' : '') + '</form>');
      var start = a.lat ? [+a.lat, +a.lng] : DEFAULT_CENTER;
      var pm = L.map($('#pmap', m.el)).setView(start, a.lat ? 18 : 13);
      tiles(pm);
      var mk = null, ci = null;
      function setPt(lat, lng, pan) {
        $('#la', m.el).value = (+lat).toFixed(7); $('#lo2', m.el).value = (+lng).toFixed(7);
        var r = +$('#rad', m.el).value || 10;
        if (!mk) { mk = L.marker([lat, lng], { draggable: true }).addTo(pm); ci = L.circle([lat, lng], { radius: r }).addTo(pm); mk.on('dragend', function () { var p = mk.getLatLng(); setPt(p.lat, p.lng); }); }
        mk.setLatLng([lat, lng]); ci.setLatLng([lat, lng]).setRadius(r);
        if (pan) pm.setView([lat, lng], 18);
      }
      if (a.lat) setPt(+a.lat, +a.lng);
      setTimeout(function () { pm.invalidateSize(); }, 250);
      pm.on('click', function (e) { setPt(e.latlng.lat, e.latlng.lng); });
      $('#rad', m.el).oninput = function () { if (ci) ci.setRadius(+this.value || 10); };
      ['#la', '#lo2'].forEach(function (s) { $(s, m.el).onchange = function () { var la = +$('#la', m.el).value, lo = +$('#lo2', m.el).value; if (isFinite(la) && isFinite(lo) && la && lo) setPt(la, lo, true); }; });
      $('#myloc', m.el).onclick = function () {
        loading(true, 'Mengambil lokasi GPS…');
        var best = null, done = false;
        var stopW = watchGps(function (p) {
          if (!best || p.acc < best.acc) best = p;
          if (best.acc <= 10 && !done) finish();
        }, function (e) { if (!done) { done = true; stopW(); loading(false); toast(e.message, 'err'); } });
        var tm = setTimeout(finish, 12000);
        function finish() {
          if (done) return; done = true; clearTimeout(tm); stopW(); loading(false);
          if (best) { setPt(best.lat, best.lng, true); toast('Titik diambil (akurasi ±' + Math.round(best.acc) + ' m).', 'ok'); }
          else toast('Lokasi belum didapat.', 'err');
        }
      };
      $('#paste', m.el).onclick = function () {
        promptBox('Tempel link Google Maps atau koordinat "lat, lng":', '-7.97, 112.63').then(function (t) {
          if (!t) return;
          var mm = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || t.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
          if (mm) setPt(+mm[1], +mm[2], true);
          else toast('Koordinat tidak ditemukan. Untuk link pendek (maps.app.goo.gl), buka dulu di browser lalu salin link panjangnya, atau ketuk titik di Google Maps dan salin angka koordinatnya.', 'err', 8000);
        });
      };
      $('form', m.el).onsubmit = function (e) {
        e.preventDefault();
        var d = formData(e.target); if (edit) d.id = a.id;
        loading(true, 'Menyimpan…');
        run(api('area_save', d), 'Lokasi disimpan.').then(function () { pm.remove(); m.close(); load(); }).catch(function () { });
      };
      if (edit) $('#del', m.el).onclick = function () {
        confirmBox('Hapus lokasi ' + a.nama + '?', 'Hapus', true).then(function (ok) {
          if (ok) { loading(true); run(api('area_delete', { id: a.id }), 'Lokasi dihapus.').then(function () { pm.remove(); m.close(); load(); }).catch(function () { }); }
        });
      };
    }
    setTimeout(function () { ov.invalidateSize(); }, 200);
    load();
  };

  /* ---------- shift master ---------- */
  ROUTES['admin-shift'] = function () {
    var c = page('Master Shift', '<div class="list-plain" style="margin:0" id="list"><div class="li muted">Memuat…</div></div>', { plus: function () { form(null); } });
    var rows = [];
    function load() {
      api('shifts_list').then(function (r) {
        rows = r;
        $('#list', c).innerHTML = r.map(function (s) { return '<div class="li" data-id="' + esc(s.id) + '" style="cursor:pointer"><div class="clock" style="width:40px;height:40px">' + I.clock + '</div><div class="grow"><b>' + esc(s.nama) + '</b><span>' + esc(s.masuk) + ' – ' + esc(s.pulang) + '</span></div><span class="muted">›</span></div>'; }).join('');
        $$('[data-id]', c).forEach(function (el) { el.onclick = function () { form(rows.filter(function (s) { return s.id === el.dataset.id; })[0]); }; });
      }).catch(function (e) { toast(e.message, 'err'); });
    }
    function form(s) {
      var edit = !!s; s = s || { masuk: '08:00', pulang: '17:00' };
      var m = sheet(edit ? 'Edit Shift' : 'Tambah Shift', '<form><label class="f"><span>Nama shift</span><input name="nama" required value="' + esc(s.nama || '') + '" placeholder="Pagi / Siang / Reguler"></label>' +
        '<div class="row2"><label class="f"><span>Jam masuk</span><input type="time" name="masuk" required value="' + esc(s.masuk) + '"></label><label class="f"><span>Jam pulang</span><input type="time" name="pulang" required value="' + esc(s.pulang) + '"></label></div>' +
        '<button class="btn" type="submit">Simpan</button>' + (edit ? '<button class="btn red" type="button" id="del" style="margin-top:10px">Hapus Shift</button>' : '') + '</form>');
      $('form', m.el).onsubmit = function (e) {
        e.preventDefault(); var d = formData(e.target); if (edit) d.id = s.id;
        loading(true); run(api('shift_save', d), 'Shift disimpan.').then(function () { m.close(); load(); }).catch(function () { });
      };
      if (edit) $('#del', m.el).onclick = function () {
        confirmBox('Hapus shift ' + s.nama + '? Karyawan dengan shift ini akan memakai shift pertama.', 'Hapus', true).then(function (ok) {
          if (ok) { loading(true); run(api('shift_delete', { id: s.id }), 'Shift dihapus.').then(function () { m.close(); load(); }).catch(function () { }); }
        });
      };
    }
    load();
  };

  /* ---------- pengumuman ---------- */
  ROUTES['admin-pengumuman'] = function () {
    var c = page('Pengumuman', '<div id="list">' + emptyState('Memuat…') + '</div>', { plus: function () { form(); } });
    function loadList() {
      api('pengumuman_all').then(draw).catch(function (e) { $('#list', c).innerHTML = emptyState(e.message); });
    }
    function draw(rows) {
      $('#list', c).innerHTML = rows.length ? rows.map(function (r) {
        return '<div class="item"><div class="hd"><div class="tm"><b>' + esc(r.judul) + '</b><span>' + fmtLong(r.tanggal) + ' · ' + esc(r.tanggal.slice(11, 16)) + '</span></div></div><div class="bd"><p style="font-weight:400;-webkit-line-clamp:unset">' + esc(r.isi) + '</p>' +
          '<div class="acts"><button class="btn red sm" data-del="' + esc(r.id) + '">Hapus</button></div></div></div>';
      }).join('') : emptyState('Belum ada pengumuman. Ketuk + untuk membuat.');
      $$('[data-del]', c).forEach(function (b) {
        b.onclick = function () {
          confirmBox('Hapus pengumuman ini?', 'Hapus', true).then(function (ok) {
            if (ok) { loading(true); run(api('pengumuman_delete', { id: b.dataset.del }), 'Dihapus.').then(loadList).catch(function () { }); }
          });
        };
      });
    }
    function form() {
      var m = sheet('Buat Pengumuman', '<form><label class="f"><span>Judul</span><input name="judul" required></label><label class="f"><span>Isi</span><textarea name="isi" rows="6" required></textarea></label><button class="btn" type="submit">Kirim ke Semua Karyawan</button></form>');
      $('form', m.el).onsubmit = function (e) {
        e.preventDefault(); loading(true);
        run(api('pengumuman_add', formData(e.target)), 'Pengumuman terkirim.').then(function () { m.close(); loadList(); }).catch(function () { });
      };
    }
    loadList();
  };

  /* ---------- pengaturan ---------- */
  ROUTES['admin-setelan'] = function () {
    var c = page('Pengaturan', emptyState('Memuat…'));
    api('settings_get').then(function (s) {
      var fi = s.folder_info;
      c.innerHTML = '<form id="sf" class="item" style="padding:18px">' +
        '<label class="f"><span>Nama perusahaan</span><input name="perusahaan" required value="' + esc(s.perusahaan) + '"></label>' +
        '<label class="f"><span>Toleransi terlambat (menit)</span><input name="toleransi" type="number" min="0" value="' + esc(s.toleransi) + '"></label>' +
        '<label class="f"><span>Folder Google Drive untuk foto</span><input name="folder" value="' + esc(s.folder_id ? 'https://drive.google.com/drive/folders/' + s.folder_id : '') + '" placeholder="https://drive.google.com/drive/folders/…"></label>' +
        (fi ? '<div class="info-box ' + (fi.ok && fi.publik ? '' : 'warn') + '">' + (fi.ok ? 'Folder aktif: <b>' + esc(fi.nama) + '</b>' + (fi.url ? ' · <a href="' + esc(fi.url) + '" target="_blank" rel="noopener">buka</a>' : '') + '<br>' +
          (fi.publik ? '✅ Akses: siapa saja yang memiliki link bisa melihat.' : '⚠️ Folder BELUM dibuka untuk "Siapa saja yang memiliki link". Foto bisa tidak tampil.') + (fi.peringatan ? '<br>' + esc(fi.peringatan) : '') : '⚠️ ' + esc(fi.error)) + '</div>' : '') +
        '<div class="info-box"><b>Cara menyiapkan folder foto:</b><ol><li>Buka Google Drive milik admin (akun yang men-deploy Apps Script) → buat folder, mis. "Foto Absensi".</li>' +
        '<li>Klik kanan folder → <b>Bagikan</b> → bagian <b>Akses umum</b> pilih <b>"Siapa saja yang memiliki link"</b> dengan peran <b>Pelihat</b>. Ini wajib supaya foto laporan selalu bisa dilihat.</li>' +
        '<li>Salin link folder lalu tempel di kolom di atas → Simpan. Aplikasi juga mencoba mengatur akses ini otomatis.</li></ol>Foto disimpan per bulan & kategori: <i>Folder / 2026-11 / Absensi, Aktivitas, Izin, …</i></div>' +
        '<button class="btn" type="submit">Simpan Pengaturan</button></form>' +
        (s.sheet_url ? '<a class="btn ghost" style="margin-bottom:12px;text-decoration:none" href="' + esc(s.sheet_url) + '" target="_blank" rel="noopener">Buka Google Sheet data</a>' : '') +
        '<button class="btn ghost" id="pw">Ganti password admin</button>';
      $('#sf', c).onsubmit = function (e) {
        e.preventDefault(); loading(true, 'Menyimpan & memeriksa folder…');
        run(api('settings_save', formData(e.target)), 'Pengaturan disimpan.').then(function (r) { S.perusahaan = r.perusahaan; saveSession(); lsSet('ba-perusahaan', r.perusahaan); ROUTES['admin-setelan'](); }).catch(function () { });
      };
      $('#pw', c).onclick = function () { go('profil'); };
    }).catch(function (e) { c.innerHTML = emptyState(e.message); });
  };

  /* ================= start ================= */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }
  render();
})();
