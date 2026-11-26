// ==== Berkah Absen - Code.gs (hasil build, jangan diedit langsung) ====
/*
 * core.js — logika server Berkah Absen.
 * Dipakai di 2 tempat:
 *   1. Google Apps Script (digabung dengan apps-script/gas-adapter.js oleh build.ps1 → dist/Code.gs)
 *   2. Mode DEMO di browser (dengan demo-adapter.js, data di localStorage)
 * Semua akses data lewat ctx (adapter), jadi aturan keamanan hanya ditulis sekali di sini.
 */
var CORE = (function () {
  'use strict';

  var TABLES = {
    Users: ['id', 'nama', 'email', 'telepon', 'jabatan', 'area_ids', 'shift_id', 'saldo_cuti', 'pass_hash', 'salt', 'pv', 'dibuat'],
    Absensi: ['id', 'user_id', 'nama', 'tanggal', 'shift', 'jam_masuk', 'lat_masuk', 'lng_masuk', 'akurasi_masuk', 'area_masuk', 'jarak_masuk', 'foto_masuk', 'ket_masuk',
      'jam_pulang', 'lat_pulang', 'lng_pulang', 'akurasi_pulang', 'area_pulang', 'jarak_pulang', 'foto_pulang', 'ket_pulang', 'status'],
    Aktivitas: ['id', 'user_id', 'nama', 'tanggal', 'jam', 'lat', 'lng', 'akurasi', 'lokasi', 'keterangan', 'foto'],
    Izin: ['id', 'user_id', 'nama', 'jenis', 'mulai', 'selesai', 'hari', 'alasan', 'foto', 'status', 'catatan', 'diproses', 'dibuat'],
    Lembur: ['id', 'user_id', 'nama', 'tanggal', 'jam_mulai', 'jam_selesai', 'durasi', 'keterangan', 'foto', 'status', 'catatan', 'diproses', 'dibuat'],
    Reimburse: ['id', 'user_id', 'nama', 'tanggal', 'kategori', 'nominal', 'keterangan', 'foto', 'status', 'catatan', 'diproses', 'dibuat'],
    TukarShift: ['id', 'user_id', 'nama', 'tanggal', 'shift_id', 'shift', 'alasan', 'status', 'catatan', 'diproses', 'dibuat'],
    Shift: ['id', 'nama', 'masuk', 'pulang'],
    Area: ['id', 'nama', 'lat', 'lng', 'radius', 'alamat'],
    Pengumuman: ['id', 'judul', 'isi', 'tanggal', 'oleh'],
    Settings: ['key', 'value']
  };

  var JABATAN = ['Product Manager', 'Retail Manager', 'Operasional Manager', 'Head Store (HS)', 'PIC IT', 'Kasir'];
  var JENIS_IZIN = ['Izin', 'Sakit', 'Cuti'];
  var KATEGORI_REIMB = ['Transport', 'Bensin', 'Tol', 'Parkir', 'Makan', 'Akomodasi', 'Lainnya'];
  var APPROVAL_TABLES = ['Izin', 'Lembur', 'Reimburse', 'TukarShift'];
  var REPORT_TABLES = { absensi: 'Absensi', aktivitas: 'Aktivitas', izin: 'Izin', lembur: 'Lembur', reimburse: 'Reimburse', tukarshift: 'TukarShift' };
  var DEFAULT_RADIUS = 10; // meter
  var TOKEN_DAYS = 30;

  function UserError(msg, code) { var e = new Error(msg); e.userError = true; e.code = code || ''; return e; }
  function fail(msg, code) { throw UserError(msg, code); }

  /* ---------- util ---------- */
  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { r[k] = o[k]; }); return r; }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function isTime(s) { return /^\d{2}:\d{2}$/.test(s); }
  function minutes(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function dayDiff(a, b) { // inklusif
    var da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
    var db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
    return Math.round((db - da) / 86400000) + 1;
  }
  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (lat2 - lat1) * toR, dLng = (lng2 - lng1) * toR;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ',') + ' km' : Math.round(m) + ' meter'; }
  function byDesc(f) { return function (a, b) { return a[f] < b[f] ? 1 : a[f] > b[f] ? -1 : 0; }; }
  function inRange(d, from, to) { return (!from || d >= from) && (!to || d <= to); }
  function safeName(s) { return str(s).replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 40) || 'user'; }

  function settings(ctx) {
    var o = {};
    ctx.db.all('Settings').forEach(function (r) { o[r.key] = r.value; });
    return o;
  }
  function setSetting(ctx, key, value) {
    var exists = ctx.db.all('Settings').some(function (r) { return r.key === key; });
    if (exists) ctx.db.update('Settings', key, { value: String(value) });
    else ctx.db.insert('Settings', { key: key, value: String(value) });
  }

  function hashPass(ctx, pw, salt) {
    var h = salt + ':' + pw;
    for (var i = 0; i < 64; i++) h = ctx.hash(h + ':' + salt);
    return h;
  }
  function checkNewPassword(pw) {
    if (str(pw).length < 6) fail('Password minimal 6 karakter.');
  }

  function ensureInit(ctx) {
    var s = settings(ctx);
    if (!s.admin_hash) {
      var salt = ctx.uuid();
      setSetting(ctx, 'admin_salt', salt);
      setSetting(ctx, 'admin_hash', hashPass(ctx, ctx.defaultAdminPassword, salt));
      setSetting(ctx, 'admin_pv', ctx.uuid());
      if (!s.perusahaan) setSetting(ctx, 'perusahaan', 'Berkah Media Technology');
      if (!s.toleransi) setSetting(ctx, 'toleransi', '0');
    }
    if (!ctx.db.all('Shift').length) ctx.db.insert('Shift', { id: ctx.uuid(), nama: 'Reguler', masuk: '08:00', pulang: '18:00' });
  }

  /* ---------- token ---------- */
  function makeToken(ctx, uid, role, pv) {
    var exp = ctx.nowMs() + TOKEN_DAYS * 86400000;
    var body = [uid, role, pv, exp].join('.');
    return body + '.' + ctx.hmac(body);
  }
  function auth(ctx, token) {
    var p = str(token).split('.');
    if (p.length !== 5) fail('Sesi berakhir, silakan login lagi.', 'AUTH');
    var body = p.slice(0, 4).join('.');
    if (ctx.hmac(body) !== p[4]) fail('Sesi tidak valid, silakan login lagi.', 'AUTH');
    if (+p[3] < ctx.nowMs()) fail('Sesi berakhir, silakan login lagi.', 'AUTH');
    if (p[1] === 'admin') {
      if (settings(ctx).admin_pv !== p[2]) fail('Password admin telah diganti, silakan login lagi.', 'AUTH');
      return { id: 'admin', role: 'admin', nama: 'Admin' };
    }
    var u = findUser(ctx, p[0]);
    if (!u || u.pv !== p[2]) fail('Akun tidak ditemukan atau password telah diubah. Silakan login lagi.', 'AUTH');
    u.role = 'user';
    return u;
  }
  function findUser(ctx, id) {
    return ctx.db.all('Users').filter(function (u) { return u.id === id; })[0] || null;
  }
  function publicUser(u) {
    var o = pick(u, ['id', 'nama', 'email', 'telepon', 'jabatan', 'area_ids', 'shift_id', 'saldo_cuti', 'dibuat']);
    o.telepon = str(o.telepon).replace(/^'/, '');
    return o;
  }

  /* ---------- shift & area ---------- */
  function shiftById(ctx, id) {
    var all = ctx.db.all('Shift');
    return all.filter(function (s) { return s.id === id; })[0] || all[0] || { id: '', nama: 'Reguler', masuk: '08:00', pulang: '18:00' };
  }
  function shiftFor(ctx, u, date) {
    var swap = ctx.db.all('TukarShift').filter(function (r) {
      return r.user_id === u.id && r.tanggal === date && r.status === 'Disetujui';
    })[0];
    return shiftById(ctx, swap ? swap.shift_id : u.shift_id);
  }
  function allowedAreas(ctx, u) {
    var all = ctx.db.all('Area');
    var ids = str(u.area_ids).split(',').map(str).filter(Boolean);
    return ids.length ? all.filter(function (a) { return ids.indexOf(a.id) >= 0; }) : all;
  }
  function nearest(areas, lat, lng) {
    var best = null;
    areas.forEach(function (a) {
      var d = haversine(lat, lng, num(a.lat), num(a.lng));
      if (!best || d < best.dist) best = { area: a, dist: d, radius: num(a.radius) > 0 ? num(a.radius) : DEFAULT_RADIUS };
    });
    return best;
  }

  /* ---------- foto ---------- */
  function savePhoto(ctx, dataUrl, u, kategori, label) {
    if (!dataUrl) return '';
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) fail('Format foto tidak dikenali.');
    if (dataUrl.length > 8 * 1024 * 1024) fail('Ukuran foto terlalu besar.');
    var n = ctx.now();
    var name = n.date + '_' + n.time.replace(/:/g, '').slice(0, 4) + '_' + safeName(u.nama) + '_' + label + '.jpg';
    return ctx.saveFile(dataUrl, name, [n.date.slice(0, 7), kategori]);
  }

  /* ---------- rekap ---------- */
  function rekap(ctx, u, now) {
    var month = now.date.slice(0, 7), year = now.date.slice(0, 4);
    var hadir = ctx.db.all('Absensi').filter(function (r) {
      return r.user_id === u.id && r.tanggal.slice(0, 7) === month && r.jam_masuk;
    }).length;
    var izinRows = ctx.db.all('Izin').filter(function (r) { return r.user_id === u.id && r.status === 'Disetujui'; });
    var izin = 0, cuti = 0;
    izinRows.forEach(function (r) {
      if (r.jenis === 'Cuti') { if (r.mulai.slice(0, 4) === year) cuti += +r.hari || 0; }
      else if (r.mulai.slice(0, 7) === month) izin += +r.hari || 0;
    });
    var saldo = (str(u.saldo_cuti) === '' ? 12 : +u.saldo_cuti) - cuti;
    return { hadir: hadir, izin: izin, saldo_cuti: saldo };
  }

  /* ================= HANDLERS ================= */
  var H = {};

  /* --- publik --- */
  H.login = function (ctx, b) {
    var id = str(b.email).toLowerCase(), pw = str(b.password);
    if (!id || !pw) fail('Isi email dan password.');
    var s = settings(ctx);
    if (id === 'admin') {
      if (hashPass(ctx, pw, s.admin_salt) !== s.admin_hash) fail('Username atau password salah.');
      return { token: makeToken(ctx, 'admin', 'admin', s.admin_pv), role: 'admin', user: { id: 'admin', nama: 'Admin', jabatan: 'Administrator' }, perusahaan: s.perusahaan };
    }
    var u = ctx.db.all('Users').filter(function (x) { return str(x.email).toLowerCase() === id; })[0];
    if (!u || hashPass(ctx, pw, u.salt) !== u.pass_hash) fail('Email atau password salah.');
    return { token: makeToken(ctx, u.id, 'user', u.pv), role: 'user', user: publicUser(u), perusahaan: s.perusahaan };
  };

  H.info = function (ctx) {
    return { perusahaan: settings(ctx).perusahaan, jabatan: JABATAN };
  };

  /* --- user --- */
  H.me = function (ctx, b, u) {
    var now = ctx.now();
    var shift = shiftFor(ctx, u, now.date);
    var today = ctx.db.all('Absensi').filter(function (r) { return r.user_id === u.id && r.tanggal === now.date; })[0] || null;
    var peng = ctx.db.all('Pengumuman').sort(byDesc('tanggal'))[0];
    return {
      user: publicUser(u), perusahaan: settings(ctx).perusahaan, now: now, shift: shift,
      today: today, rekap: rekap(ctx, u, now), areas: allowedAreas(ctx, u),
      pengumuman_terakhir: peng ? peng.tanggal + '|' + peng.id : ''
    };
  };

  H.absen = function (ctx, b, u) {
    var type = b.type === 'pulang' ? 'pulang' : 'masuk';
    var lat = num(b.lat), lng = num(b.lng), acc = num(b.acc);
    if (!isFinite(lat) || !isFinite(lng)) fail('Lokasi GPS belum didapat. Aktifkan GPS lalu coba lagi.');
    var areas = allowedAreas(ctx, u);
    if (!areas.length) fail('Admin belum menentukan lokasi absen. Hubungi admin.');
    var best = nearest(areas, lat, lng);
    if (best.dist > best.radius) {
      fail('Anda masih berjarak ' + fmtDist(best.dist) + ' dari titik absen "' + best.area.nama + '". Absen hanya bisa dalam radius ' + best.radius + ' meter. Silakan mendekat ke titik lokasi.', 'RANGE');
    }
    if (!b.photo) fail('Foto wajib diambil untuk absen.');
    var now = ctx.now();
    var row = ctx.db.all('Absensi').filter(function (r) { return r.user_id === u.id && r.tanggal === now.date; })[0];
    var jam = now.time.slice(0, 5);
    var shift = shiftFor(ctx, u, now.date);
    var tol = +settings(ctx).toleransi || 0;

    if (type === 'masuk') {
      if (row && row.jam_masuk) fail('Anda sudah absen masuk hari ini pukul ' + row.jam_masuk + '.');
      var late = minutes(jam) - minutes(shift.masuk);
      var status = late > tol ? 'Terlambat ' + (late >= 60 ? Math.floor(late / 60) + ' jam ' : '') + (late % 60) + ' menit' : 'Tepat Waktu';
      var foto = savePhoto(ctx, b.photo, u, 'Absensi', 'masuk');
      var rec = {
        id: ctx.uuid(), user_id: u.id, nama: u.nama, tanggal: now.date, shift: shift.nama + ' ' + shift.masuk + '-' + shift.pulang,
        jam_masuk: jam, lat_masuk: lat, lng_masuk: lng, akurasi_masuk: isFinite(acc) ? Math.round(acc) : '', area_masuk: best.area.nama,
        jarak_masuk: Math.round(best.dist), foto_masuk: foto, ket_masuk: str(b.keterangan).slice(0, 500), status: status
      };
      ctx.db.insert('Absensi', rec);
      return { record: rec, message: 'Absen masuk berhasil pukul ' + jam + ' WIB (' + status + ').' };
    }
    if (!row || !row.jam_masuk) fail('Anda belum absen masuk hari ini.');
    if (row.jam_pulang) fail('Anda sudah absen pulang hari ini pukul ' + row.jam_pulang + '.');
    var st = row.status;
    if (minutes(jam) < minutes(shift.pulang) && minutes(shift.pulang) > minutes(shift.masuk)) st += ', Pulang Cepat';
    var foto2 = savePhoto(ctx, b.photo, u, 'Absensi', 'pulang');
    var patch = {
      jam_pulang: jam, lat_pulang: lat, lng_pulang: lng, akurasi_pulang: isFinite(acc) ? Math.round(acc) : '', area_pulang: best.area.nama,
      jarak_pulang: Math.round(best.dist), foto_pulang: foto2, ket_pulang: str(b.keterangan).slice(0, 500), status: st
    };
    ctx.db.update('Absensi', row.id, patch);
    for (var k in patch) row[k] = patch[k];
    return { record: row, message: 'Absen pulang berhasil pukul ' + jam + ' WIB.' };
  };

  H.aktivitas_add = function (ctx, b, u) {
    var lat = num(b.lat), lng = num(b.lng);
    if (!isFinite(lat) || !isFinite(lng)) fail('Lokasi GPS belum didapat.');
    if (!b.photo) fail('Foto wajib diambil.');
    var ket = str(b.keterangan);
    if (!ket) fail('Keterangan wajib diisi.');
    var now = ctx.now();
    var rec = {
      id: ctx.uuid(), user_id: u.id, nama: u.nama, tanggal: now.date, jam: now.time.slice(0, 5), lat: lat, lng: lng,
      akurasi: isFinite(num(b.acc)) ? Math.round(num(b.acc)) : '', lokasi: str(b.lokasi).slice(0, 200) || (lat.toFixed(6) + ', ' + lng.toFixed(6)),
      keterangan: ket.slice(0, 2000), foto: savePhoto(ctx, b.photo, u, 'Aktivitas', 'aktivitas')
    };
    ctx.db.insert('Aktivitas', rec);
    return { record: rec };
  };

  function myList(table, dateField) {
    return function (ctx, b, u) {
      var from = str(b.from), to = str(b.to);
      return ctx.db.all(table).filter(function (r) {
        return r.user_id === u.id && inRange(r[dateField], from, to);
      }).sort(function (a, c) {
        var x = a[dateField] + (a.jam || a.jam_masuk || a.dibuat || ''), y = c[dateField] + (c.jam || c.jam_masuk || c.dibuat || '');
        return x < y ? 1 : x > y ? -1 : 0;
      });
    };
  }
  H.aktivitas_list = myList('Aktivitas', 'tanggal');
  H.absensi_list = myList('Absensi', 'tanggal');
  H.izin_list = myList('Izin', 'mulai');
  H.lembur_list = myList('Lembur', 'tanggal');
  H.reimburse_list = myList('Reimburse', 'tanggal');
  H.tukarshift_list = myList('TukarShift', 'tanggal');

  H.izin_add = function (ctx, b, u) {
    var jenis = str(b.jenis), mulai = str(b.mulai), selesai = str(b.selesai) || str(b.mulai);
    if (JENIS_IZIN.indexOf(jenis) < 0) fail('Pilih jenis izin.');
    if (!isDate(mulai) || !isDate(selesai)) fail('Tanggal tidak valid.');
    var hari = dayDiff(mulai, selesai);
    if (hari < 1) fail('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    if (!str(b.alasan)) fail('Alasan wajib diisi.');
    if (jenis === 'Cuti') {
      var sisa = rekap(ctx, u, ctx.now()).saldo_cuti;
      if (hari > sisa) fail('Saldo cuti tidak cukup (sisa ' + sisa + ' hari).');
    }
    var rec = {
      id: ctx.uuid(), user_id: u.id, nama: u.nama, jenis: jenis, mulai: mulai, selesai: selesai, hari: hari,
      alasan: str(b.alasan).slice(0, 1000), foto: savePhoto(ctx, b.photo, u, 'Izin', jenis.toLowerCase()),
      status: 'Menunggu', catatan: '', diproses: '', dibuat: ctx.now().iso
    };
    ctx.db.insert('Izin', rec);
    return { record: rec };
  };

  H.lembur_add = function (ctx, b, u) {
    var tgl = str(b.tanggal), m = str(b.jam_mulai), s = str(b.jam_selesai);
    if (!isDate(tgl) || !isTime(m) || !isTime(s)) fail('Tanggal/jam tidak valid.');
    var dur = minutes(s) - minutes(m); if (dur <= 0) dur += 1440;
    if (!str(b.keterangan)) fail('Keterangan wajib diisi.');
    var rec = {
      id: ctx.uuid(), user_id: u.id, nama: u.nama, tanggal: tgl, jam_mulai: m, jam_selesai: s,
      durasi: Math.floor(dur / 60) + ' jam ' + (dur % 60) + ' menit', keterangan: str(b.keterangan).slice(0, 1000),
      foto: savePhoto(ctx, b.photo, u, 'Lembur', 'lembur'), status: 'Menunggu', catatan: '', diproses: '', dibuat: ctx.now().iso
    };
    ctx.db.insert('Lembur', rec);
    return { record: rec };
  };

  H.reimburse_add = function (ctx, b, u) {
    var tgl = str(b.tanggal), kat = str(b.kategori), nominal = Math.round(num(String(b.nominal).replace(/[^\d]/g, '')));
    if (!isDate(tgl)) fail('Tanggal tidak valid.');
    if (KATEGORI_REIMB.indexOf(kat) < 0) fail('Pilih kategori.');
    if (!(nominal > 0)) fail('Nominal tidak valid.');
    if (!b.photo) fail('Foto bukti/struk wajib dilampirkan.');
    var rec = {
      id: ctx.uuid(), user_id: u.id, nama: u.nama, tanggal: tgl, kategori: kat, nominal: nominal,
      keterangan: str(b.keterangan).slice(0, 1000), foto: savePhoto(ctx, b.photo, u, 'Reimburse', kat.toLowerCase()),
      status: 'Menunggu', catatan: '', diproses: '', dibuat: ctx.now().iso
    };
    ctx.db.insert('Reimburse', rec);
    return { record: rec };
  };

  H.shift_info = function (ctx, b, u) {
    var now = ctx.now();
    return { saya: shiftById(ctx, u.shift_id), hari_ini: shiftFor(ctx, u, now.date), semua: ctx.db.all('Shift') };
  };

  H.tukarshift_add = function (ctx, b, u) {
    var tgl = str(b.tanggal), sh = ctx.db.all('Shift').filter(function (s) { return s.id === str(b.shift_id); })[0];
    if (!isDate(tgl)) fail('Tanggal tidak valid.');
    if (!sh) fail('Pilih shift.');
    if (!str(b.alasan)) fail('Alasan wajib diisi.');
    var rec = {
      id: ctx.uuid(), user_id: u.id, nama: u.nama, tanggal: tgl, shift_id: sh.id, shift: sh.nama + ' ' + sh.masuk + '-' + sh.pulang,
      alasan: str(b.alasan).slice(0, 1000), status: 'Menunggu', catatan: '', diproses: '', dibuat: ctx.now().iso
    };
    ctx.db.insert('TukarShift', rec);
    return { record: rec };
  };

  H.pengumuman_list = function (ctx) {
    return ctx.db.all('Pengumuman').sort(byDesc('tanggal'));
  };

  H.change_password = function (ctx, b, u) {
    var old = str(b.old), nw = str(b.new);
    checkNewPassword(nw);
    if (u.role === 'admin') {
      var s = settings(ctx);
      if (hashPass(ctx, old, s.admin_salt) !== s.admin_hash) fail('Password lama salah.');
      var salt = ctx.uuid(), pv = ctx.uuid();
      setSetting(ctx, 'admin_salt', salt);
      setSetting(ctx, 'admin_hash', hashPass(ctx, nw, salt));
      setSetting(ctx, 'admin_pv', pv);
      return { token: makeToken(ctx, 'admin', 'admin', pv) };
    }
    if (hashPass(ctx, old, u.salt) !== u.pass_hash) fail('Password lama salah.');
    var salt2 = ctx.uuid(), pv2 = ctx.uuid();
    ctx.db.update('Users', u.id, { salt: salt2, pass_hash: hashPass(ctx, nw, salt2), pv: pv2 });
    return { token: makeToken(ctx, u.id, 'user', pv2) };
  };

  /* --- admin --- */
  var A = {};

  A.admin_dashboard = function (ctx) {
    var now = ctx.now();
    var users = ctx.db.all('Users');
    var abs = ctx.db.all('Absensi').filter(function (r) { return r.tanggal === now.date; });
    var hadirIds = abs.map(function (r) { return r.user_id; });
    var izinToday = ctx.db.all('Izin').filter(function (r) { return r.status === 'Disetujui' && r.mulai <= now.date && r.selesai >= now.date; });
    var izinIds = izinToday.map(function (r) { return r.user_id; });
    var pending = 0;
    APPROVAL_TABLES.forEach(function (t) { pending += ctx.db.all(t).filter(function (r) { return r.status === 'Menunggu'; }).length; });
    return {
      now: now, perusahaan: settings(ctx).perusahaan,
      total: users.length, hadir: abs.length,
      terlambat: abs.filter(function (r) { return /Terlambat/.test(r.status); }).length,
      izin: izinToday.length, pending: pending,
      aktivitas: ctx.db.all('Aktivitas').filter(function (r) { return r.tanggal === now.date; }).length,
      absen_hari_ini: abs.sort(byDesc('jam_masuk')),
      belum_absen: users.filter(function (u) { return hadirIds.indexOf(u.id) < 0 && izinIds.indexOf(u.id) < 0; }).map(publicUser),
      areas: ctx.db.all('Area').length
    };
  };

  A.users_list = function (ctx) {
    return { users: ctx.db.all('Users').map(publicUser).sort(function (a, b) { return a.nama.localeCompare(b.nama); }), jabatan: JABATAN, shifts: ctx.db.all('Shift'), areas: ctx.db.all('Area') };
  };

  function cleanUserInput(ctx, b, existingId) {
    var o = {
      nama: str(b.nama), email: str(b.email).toLowerCase(), telepon: str(b.telepon).replace(/[^\d+]/g, ''),
      jabatan: str(b.jabatan), shift_id: str(b.shift_id), area_ids: (Array.isArray(b.area_ids) ? b.area_ids : str(b.area_ids).split(',')).map(str).filter(Boolean).join(','),
      saldo_cuti: str(b.saldo_cuti) === '' ? '12' : String(Math.max(0, Math.round(num(b.saldo_cuti) || 0)))
    };
    if (!o.nama) fail('Nama wajib diisi.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email)) fail('Email tidak valid.');
    if (o.email === 'admin') fail('Email tidak valid.');
    if (o.telepon.length < 8) fail('Nomor telepon tidak valid.');
    if (JABATAN.indexOf(o.jabatan) < 0) fail('Pilih jabatan.');
    var dup = ctx.db.all('Users').filter(function (u) { return u.email.toLowerCase() === o.email && u.id !== existingId; })[0];
    if (dup) fail('Email sudah terdaftar atas nama ' + dup.nama + '.');
    return o; // kolom Sheet diformat teks oleh adapter, jadi angka 0 di depan nomor tidak hilang
  }

  A.user_add = function (ctx, b) {
    var o = cleanUserInput(ctx, b, null);
    checkNewPassword(b.password);
    o.id = ctx.uuid(); o.salt = ctx.uuid(); o.pass_hash = hashPass(ctx, str(b.password), o.salt); o.pv = ctx.uuid(); o.dibuat = ctx.now().iso;
    ctx.db.insert('Users', o);
    return publicUser(o);
  };

  A.user_update = function (ctx, b) {
    var u = findUser(ctx, str(b.id)); if (!u) fail('Karyawan tidak ditemukan.');
    var o = cleanUserInput(ctx, b, u.id);
    if (str(b.password)) {
      checkNewPassword(b.password);
      o.salt = ctx.uuid(); o.pass_hash = hashPass(ctx, str(b.password), o.salt); o.pv = ctx.uuid();
    }
    ctx.db.update('Users', u.id, o);
    if (o.nama !== u.nama) {
      // nama di laporan lama tetap seperti saat diinput
    }
    return publicUser(findUser(ctx, u.id));
  };

  A.user_delete = function (ctx, b) {
    var u = findUser(ctx, str(b.id)); if (!u) fail('Karyawan tidak ditemukan.');
    ctx.db.remove('Users', u.id);
    return { deleted: u.id };
  };

  A.areas_list = function (ctx) { return ctx.db.all('Area'); };
  A.area_save = function (ctx, b) {
    var o = { nama: str(b.nama), lat: num(b.lat), lng: num(b.lng), radius: Math.round(num(b.radius)) || DEFAULT_RADIUS, alamat: str(b.alamat).slice(0, 300) };
    if (!o.nama) fail('Nama lokasi wajib diisi.');
    if (!isFinite(o.lat) || !isFinite(o.lng) || Math.abs(o.lat) > 90 || Math.abs(o.lng) > 180) fail('Titik koordinat tidak valid.');
    if (o.radius < 5 || o.radius > 5000) fail('Radius harus 5 – 5000 meter.');
    o.lat = o.lat.toFixed(7); o.lng = o.lng.toFixed(7);
    if (str(b.id)) { ctx.db.update('Area', str(b.id), o); o.id = str(b.id); }
    else { o.id = ctx.uuid(); ctx.db.insert('Area', o); }
    return o;
  };
  A.area_delete = function (ctx, b) { ctx.db.remove('Area', str(b.id)); return { deleted: b.id }; };

  A.shifts_list = function (ctx) { return ctx.db.all('Shift'); };
  A.shift_save = function (ctx, b) {
    var o = { nama: str(b.nama), masuk: str(b.masuk), pulang: str(b.pulang) };
    if (!o.nama || !isTime(o.masuk) || !isTime(o.pulang)) fail('Isi nama shift, jam masuk dan jam pulang.');
    if (str(b.id)) { ctx.db.update('Shift', str(b.id), o); o.id = str(b.id); }
    else { o.id = ctx.uuid(); ctx.db.insert('Shift', o); }
    return o;
  };
  A.shift_delete = function (ctx, b) {
    if (ctx.db.all('Shift').length <= 1) fail('Minimal harus ada 1 shift.');
    ctx.db.remove('Shift', str(b.id)); return { deleted: b.id };
  };

  A.pengumuman_add = function (ctx, b) {
    var o = { id: ctx.uuid(), judul: str(b.judul).slice(0, 200), isi: str(b.isi).slice(0, 5000), tanggal: ctx.now().iso, oleh: 'Admin' };
    if (!o.judul || !o.isi) fail('Judul dan isi wajib diisi.');
    ctx.db.insert('Pengumuman', o); return o;
  };
  A.pengumuman_all = function (ctx) { return ctx.db.all('Pengumuman').sort(byDesc('tanggal')); };
  A.pengumuman_delete =function (ctx, b) { ctx.db.remove('Pengumuman', str(b.id)); return { deleted: b.id }; };

  A.report = function (ctx, b) {
    var t = REPORT_TABLES[str(b.jenis)]; if (!t) fail('Jenis laporan tidak dikenal.');
    var df = t === 'Izin' ? 'mulai' : 'tanggal';
    var from = str(b.from), to = str(b.to), uid = str(b.user_id), st = str(b.status);
    var rows = ctx.db.all(t).filter(function (r) {
      return inRange(r[df], from, to) && (!uid || r.user_id === uid) && (!st || r.status === st);
    });
    rows.sort(function (a, c) {
      var x = a[df] + (a.jam || a.jam_masuk || a.dibuat || ''), y = c[df] + (c.jam || c.jam_masuk || c.dibuat || '');
      return x < y ? 1 : x > y ? -1 : 0;
    });
    return { rows: rows, columns: TABLES[t] };
  };

  A.approvals = function (ctx) {
    var out = [];
    APPROVAL_TABLES.forEach(function (t) {
      ctx.db.all(t).forEach(function (r) { if (r.status === 'Menunggu') { r._tipe = t; out.push(r); } });
    });
    return out.sort(byDesc('dibuat'));
  };

  A.approve = function (ctx, b) {
    var t = str(b.tipe), st = str(b.status);
    if (APPROVAL_TABLES.indexOf(t) < 0) fail('Tipe tidak valid.');
    if (st !== 'Disetujui' && st !== 'Ditolak') fail('Status tidak valid.');
    var r = ctx.db.all(t).filter(function (x) { return x.id === str(b.id); })[0];
    if (!r) fail('Data tidak ditemukan.');
    ctx.db.update(t, r.id, { status: st, catatan: str(b.catatan).slice(0, 500), diproses: ctx.now().iso });
    return { id: r.id, status: st };
  };

  A.settings_get = function (ctx) {
    var s = settings(ctx);
    return {
      perusahaan: s.perusahaan || '', folder_id: s.folder_id || '', toleransi: s.toleransi || '0',
      folder_info: s.folder_id && ctx.folderInfo ? ctx.folderInfo(s.folder_id) : null,
      sheet_url: ctx.sheetUrl ? ctx.sheetUrl() : ''
    };
  };
  A.settings_save = function (ctx, b) {
    var per = str(b.perusahaan); if (!per) fail('Nama perusahaan wajib diisi.');
    setSetting(ctx, 'perusahaan', per);
    setSetting(ctx, 'toleransi', String(Math.max(0, Math.round(num(b.toleransi) || 0))));
    var f = str(b.folder);
    var m = f.match(/folders\/([\w-]{10,})/) || f.match(/[?&]id=([\w-]{10,})/) || f.match(/^([\w-]{10,})$/);
    var info = null;
    if (f) {
      if (!m) fail('Link folder Google Drive tidak valid.');
      info = ctx.folderInfo ? ctx.folderInfo(m[1], true) : { ok: true, nama: '(demo)', publik: true };
      if (!info.ok) fail('Folder tidak bisa dibuka oleh akun admin: ' + info.error);
      setSetting(ctx, 'folder_id', m[1]);
    }
    return A.settings_get(ctx);
  };

  /* ---------- dispatcher ---------- */
  var WRITE = ['absen', 'aktivitas_add', 'izin_add', 'lembur_add', 'reimburse_add', 'tukarshift_add', 'change_password',
    'user_add', 'user_update', 'user_delete', 'area_save', 'area_delete', 'shift_save', 'shift_delete', 'pengumuman_add',
    'pengumuman_delete', 'approve', 'settings_save'];

  function handle(ctx, body) {
    try {
      var action = str(body && body.action);
      var run = function () {
        ensureInit(ctx);
        if (action === 'login') return H.login(ctx, body);
        if (action === 'info') return H.info(ctx, body);
        var who = auth(ctx, body.token);
        if (A[action]) {
          if (who.role !== 'admin') fail('Hanya admin yang boleh mengakses menu ini.');
          return A[action](ctx, body);
        }
        if (action === 'change_password') return H.change_password(ctx, body, who);
        if (!H[action]) fail('Aksi tidak dikenal: ' + action);
        if (who.role === 'admin') fail('Akun admin tidak dipakai untuk absen. Login dengan akun karyawan.');
        return H[action](ctx, body, who);
      };
      var data = WRITE.indexOf(action) >= 0 && ctx.lock ? ctx.lock(run) : run();
      return { ok: true, data: data };
    } catch (e) {
      if (e && e.userError) return { ok: false, error: e.message, code: e.code };
      if (ctx.log) ctx.log(e);
      return { ok: false, error: 'Terjadi kesalahan server: ' + (e && e.message ? e.message : e) };
    }
  }

  return { handle: handle, TABLES: TABLES, JABATAN: JABATAN, haversine: haversine, fmtDist: fmtDist, DEFAULT_RADIUS: DEFAULT_RADIUS };
})();

/*
 * gas-adapter.js — sambungan CORE ke Google Sheets + Google Drive.
 * Jangan edit dist/Code.gs langsung; jalankan build.ps1 untuk menggabungkan core.js + file ini.
 *
 * Cara pasang (ringkas, lengkapnya di PANDUAN.md):
 *   1. Buat Google Sheet baru → Ekstensi → Apps Script → tempel isi dist/Code.gs.
 *   2. Jalankan fungsi setup() sekali (izinkan akses).
 *   3. Terapkan → Deployment baru → Aplikasi web: Jalankan sebagai "Saya", Akses "Siapa saja".
 *   4. Salin URL /exec ke config.js di aplikasi.
 */
var DEFAULT_ADMIN_PASSWORD = 'Berkah#Media*Technology@2026';
var TZ = 'Asia/Jakarta';

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: 'API Berkah Absen aktif' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e && e.postData && e.postData.contents || '{}');
    out = CORE.handle(gasCtx_(), body);
  } catch (err) {
    out = { ok: false, error: 'Permintaan tidak valid: ' + err };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Jalankan SEKALI dari editor Apps Script: membuat semua tab Sheet, akun admin default dan folder foto. */
function setup() {
  var ctx = gasCtx_();
  Object.keys(CORE.TABLES).forEach(function (t) { sheet_(t); });
  CORE.handle(ctx, { action: 'info' }); // memicu ensureInit (admin default + shift Reguler)
  var folder = rootFolder_(ctx);
  var del = SpreadsheetApp.getActive().getSheetByName('Sheet1') || SpreadsheetApp.getActive().getSheetByName('Lembar1');
  if (del && SpreadsheetApp.getActive().getSheets().length > 1) SpreadsheetApp.getActive().deleteSheet(del);
  Logger.log('Setup selesai. Folder foto: ' + folder.getUrl());
  Logger.log('Login admin: username "admin", password default (ganti setelah login).');
}

/** Darurat: kembalikan password admin ke default jika lupa. Jalankan manual dari editor. */
function resetAdminPassword() {
  var ctx = gasCtx_();
  ['admin_hash', 'admin_salt', 'admin_pv'].forEach(function (k) { ctx.db.remove('Settings', k); });
  CORE.handle(ctx, { action: 'info' });
  Logger.log('Password admin dikembalikan ke default.');
}

/* ---------------- adapter ---------------- */
var memo_ = {};

function sheet_(t) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(t);
  var cols = CORE.TABLES[t];
  if (!sh) {
    sh = ss.insertSheet(t);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#dbe8fb');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
  } else {
    // tambah kolom baru bila versi skrip menambah kolom
    var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    if (head.length < cols.length || head.join() !== cols.slice(0, head.length).join()) {
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#dbe8fb');
    }
  }
  return sh;
}

function cell_(v) {
  if (v instanceof Date) {
    if (v.getFullYear() < 1901) return Utilities.formatDate(v, TZ, 'HH:mm');
    var s = Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
    return / 00:00:00$/.test(s) ? s.slice(0, 10) : s;
  }
  return v == null ? '' : String(v);
}

function all_(t) {
  if (memo_[t]) return memo_[t].map(function (o) { return Object.assign({}, o); });
  var sh = sheet_(t), cols = CORE.TABLES[t];
  var last = sh.getLastRow();
  var rows = [];
  if (last > 1) {
    var vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
    vals.forEach(function (r, i) {
      if (r.join('') === '') return;
      var o = {};
      cols.forEach(function (c, j) { o[c] = cell_(r[j]); });
      o._row = i + 2;
      rows.push(o);
    });
  }
  memo_[t] = rows;
  return rows.map(function (o) { return Object.assign({}, o); });
}

function rowOf_(t, obj) {
  return CORE.TABLES[t].map(function (c) { return obj[c] == null ? '' : String(obj[c]); });
}

function strip_(o) { var r = Object.assign({}, o); delete r._row; return r; }

var gasDb_ = {
  all: function (t) { return all_(t).map(function (o) { var r = strip_(o); return r; }); },
  insert: function (t, obj) {
    var sh = sheet_(t), cols = CORE.TABLES[t];
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, cols.length).setNumberFormat('@').setValues([rowOf_(t, obj)]);
    delete memo_[t];
  },
  update: function (t, id, patch) {
    var key = CORE.TABLES[t][0];
    var cur = all_(t).filter(function (o) { return o[key] === String(id); })[0];
    if (!cur) throw new Error('Data ' + t + ' ' + id + ' tidak ditemukan');
    Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
    var sh = sheet_(t);
    sh.getRange(cur._row, 1, 1, CORE.TABLES[t].length).setNumberFormat('@').setValues([rowOf_(t, cur)]);
    delete memo_[t];
  },
  remove: function (t, id) {
    var key = CORE.TABLES[t][0];
    var cur = all_(t).filter(function (o) { return o[key] === String(id); })[0];
    if (cur) sheet_(t).deleteRow(cur._row);
    delete memo_[t];
  }
};

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function secret_() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('TOKEN_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('TOKEN_SECRET', s); }
  return s;
}

function rootFolder_(ctx) {
  var id = '';
  gasDb_.all('Settings').forEach(function (r) { if (r.key === 'folder_id') id = r.value; });
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* folder hilang → buat baru */ }
  }
  var nama = 'Foto Absensi';
  gasDb_.all('Settings').forEach(function (r) { if (r.key === 'perusahaan' && r.value) nama += ' - ' + r.value; });
  var f = DriveApp.createFolder(nama);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
  var exists = gasDb_.all('Settings').some(function (r) { return r.key === 'folder_id'; });
  if (exists) gasDb_.update('Settings', 'folder_id', { value: f.getId() });
  else gasDb_.insert('Settings', { key: 'folder_id', value: f.getId() });
  return f;
}

function subFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function gasCtx_() {
  memo_ = {};
  return {
    db: gasDb_,
    defaultAdminPassword: DEFAULT_ADMIN_PASSWORD,
    hash: function (s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); },
    hmac: function (s) { return hex_(Utilities.computeHmacSha256Signature(s, secret_())); },
    uuid: function () { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); },
    nowMs: function () { return Date.now(); },
    now: function () {
      var d = new Date();
      return {
        date: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'),
        time: Utilities.formatDate(d, TZ, 'HH:mm:ss'),
        iso: Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss')
      };
    },
    lock: function (fn) {
      var l = LockService.getScriptLock();
      l.waitLock(30000);
      try { return fn(); } finally { l.releaseLock(); }
    },
    saveFile: function (dataUrl, name, path) {
      var m = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
      var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
      var folder = rootFolder_(this);
      path.forEach(function (p) { folder = subFolder_(folder, p); });
      var f = folder.createFile(blob);
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* kebijakan domain melarang; folder harus dibagikan manual */ }
      return 'https://drive.google.com/file/d/' + f.getId() + '/view';
    },
    folderInfo: function (id, makePublic) {
      try {
        var f = DriveApp.getFolderById(id);
        var err = '';
        if (makePublic) {
          try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { err = String(e.message || e); }
        }
        var acc = f.getSharingAccess();
        return { ok: true, nama: f.getName(), url: f.getUrl(), publik: acc === DriveApp.Access.ANYONE_WITH_LINK || acc === DriveApp.Access.ANYONE, peringatan: err };
      } catch (e) {
        return { ok: false, error: String(e.message || e) };
      }
    },
    sheetUrl: function () { return SpreadsheetApp.getActive().getUrl(); },
    log: function (e) { console.error(e && e.stack || e); }
  };
}
