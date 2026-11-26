/* Service worker: simpan kerangka aplikasi agar cepat dibuka. Data (API) selalu dari server. */
var CACHE_NAME = 'berkah-absen-v1';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.json', 'brand/ikon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var shell = url.origin === location.origin || url.hostname === 'unpkg.com' || url.hostname.indexOf('fonts.') === 0;
  if (!shell) return; // peta, foto Drive, API: langsung ke jaringan
  // network-first untuk file aplikasi (supaya update cepat sampai), fallback cache saat offline
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
});
