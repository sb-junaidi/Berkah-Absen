/*
 * demo-adapter.js — menjalankan CORE di browser (data di localStorage) untuk MODE DEMO.
 * Aktif otomatis bila API_URL di config.js masih kosong. Foto disimpan sebagai data URL kecil.
 */
var DEMO = (function () {
  'use strict';
  var P = 'berkahabsen-demo:';

  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), result = '', words = [], i, j;
    ascii = unescape(encodeURIComponent(ascii));
    var bitLen = ascii.length * 8;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], pl = k.length;
    var isC = {};
    for (var c = 2; pl < 64; c++) {
      if (!isC[c]) {
        for (i = 0; i < 313; i += c) isC[i] = c;
        hash[pl] = (Math.pow(c, .5) * maxWord) | 0;
        k[pl++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((bitLen / maxWord) | 0);
    words[words.length] = (bitLen);
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
    return result;
  }

  function load(t) { try { return JSON.parse(localStorage.getItem(P + t) || '[]'); } catch (e) { return []; } }
  function save(t, rows) {
    try { localStorage.setItem(P + t, JSON.stringify(rows)); }
    catch (e) { throw new Error('Penyimpanan demo penuh. Hapus data demo dari menu Profil.'); }
  }
  var db = {
    all: function (t) { return load(t); },
    insert: function (t, o) { var r = load(t); r.push(JSON.parse(JSON.stringify(o))); save(t, r); },
    update: function (t, id, patch) {
      var key = CORE.TABLES[t][0], r = load(t);
      r.forEach(function (o) { if (o[key] === String(id)) for (var k in patch) o[k] = String(patch[k]); });
      save(t, r);
    },
    remove: function (t, id) {
      var key = CORE.TABLES[t][0];
      save(t, load(t).filter(function (o) { return o[key] !== String(id); }));
    }
  };
  // simpan semua nilai sebagai string, seperti di Sheet
  var ins = db.insert;
  db.insert = function (t, o) { var c = {}; for (var k in o) c[k] = o[k] == null ? '' : String(o[k]); ins(t, c); };

  function secret() {
    var s = localStorage.getItem(P + 'secret');
    if (!s) { s = String(Math.random()) + Date.now(); localStorage.setItem(P + 'secret', s); }
    return s;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var ctx = {
    db: db,
    defaultAdminPassword: 'Berkah#Media*Technology@2026',
    hash: sha256,
    hmac: function (s) { return sha256(secret() + '|' + s); },
    uuid: function () { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(-16); },
    nowMs: function () { return Date.now(); },
    now: function () {
      // waktu WIB (UTC+7) apa pun zona waktu perangkat
      var d = new Date(Date.now() + 7 * 3600000);
      var date = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
      var time = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
      return { date: date, time: time, iso: date + ' ' + time };
    },
    saveFile: function (dataUrl) { return dataUrl; },
    folderInfo: function () { return { ok: true, nama: '(mode demo — foto disimpan di perangkat)', publik: true }; },
    sheetUrl: function () { return ''; },
    log: function (e) { console.error(e); }
  };

  return {
    call: function (body) { return CORE.handle(ctx, body); },
    reset: function () {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(P) === 0) localStorage.removeItem(k); });
    }
  };
})();
