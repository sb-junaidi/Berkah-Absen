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
