# Berkah Absen — Panduan Pemasangan

Aplikasi absensi & laporan aktivitas khusus **Berkah Media Technology**.
Data laporan → **Google Sheet**, foto → **Google Drive** milik admin.

## Isi folder

| File | Fungsi |
|---|---|
| `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, `brand/` | Aplikasi (PWA) yang dibuka karyawan & admin di HP |
| `config.js` | Tempat menempel URL server (`API_URL`) |
| `core.js` | Aturan server (dipakai Apps Script & mode demo) |
| `apps-script/dist/Code.gs` | **File yang ditempel ke Google Apps Script** (hasil `build.ps1`) |

## 1. Siapkan server (Google Sheet + Apps Script) — dilakukan admin sekali

1. Login ke Google dengan **akun admin** (foto akan tersimpan di Drive akun ini).
2. Buat **Google Sheet** baru, beri nama misalnya `Data Absensi Berkah`.
3. Menu **Ekstensi → Apps Script**.
4. Hapus isi `Code.gs`, lalu tempel seluruh isi `apps-script/dist/Code.gs`.
5. (Opsional) Setelan proyek → centang *Tampilkan file manifes "appsscript.json"* → tempel isi `apps-script/dist/appsscript.json`.
6. Pilih fungsi **`setup`** di toolbar → **Jalankan** → izinkan akses (Sheet & Drive).
   Ini membuat semua tab (Users, Absensi, Aktivitas, Izin, Lembur, Reimburse, TukarShift, Shift, Area, Pengumuman, Settings),
   akun admin default, dan folder **"Foto Absensi - …"** di Drive (sudah dibuka untuk siapa saja yang punya link).
7. **Terapkan → Deployment baru → jenis: Aplikasi web**
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
8. Salin **URL aplikasi web** (berakhiran `/exec`), tempel ke `config.js`:
   ```js
   API_URL: 'https://script.google.com/macros/s/XXXX/exec',
   ```

> Setiap kali `Code.gs` diubah: **Terapkan → Kelola deployment → Edit → Versi: Baru**, supaya URL tetap sama.

## 2. Publikasikan aplikasi

Unggah isi folder ini (kecuali `apps-script/`) ke hosting HTTPS, misalnya **GitHub Pages**.
HTTPS wajib, karena GPS & kamera hanya jalan di HTTPS.
Karyawan membuka link → menu browser → **Tambahkan ke layar utama** (jadi seperti aplikasi).

## 3. Login & pengaturan awal admin

- Username: **`admin`**
- Password default: **`Berkah#Media*Technology@2026`** → segera ganti di menu **Password**.
- **Pengaturan**: nama perusahaan, toleransi terlambat, dan **folder Google Drive** untuk foto.
  Jika memakai folder sendiri: klik kanan folder → **Bagikan** → *Akses umum* →
  **"Siapa saja yang memiliki link" – Pelihat**, lalu tempel link folder dan **Simpan**.
  (Ini wajib supaya foto laporan selalu bisa dilihat dari aplikasi.)
- **Lokasi Absen**: tambah titik toko/kantor (ketuk peta, "Pakai lokasi saya", atau tempel link Google Maps). Radius bawaan **10 meter**.
- **Shift**: atur jam kerja (default Reguler 08:00–18:00).
- **Karyawan**: daftarkan nama, email, telepon, jabatan (Product Manager, Retail Manager, Operasional Manager, Head Store (HS), PIC IT, Kasir), password awal, shift, dan lokasi absen yang diizinkan.

Lupa password admin? Buka Apps Script → jalankan fungsi **`resetAdminPassword`** → kembali ke password default.

## Aturan yang dijalankan server

- Karyawan **hanya bisa melihat datanya sendiri**; semua permintaan dicek token di server.
- Menu admin hanya bisa diakses token admin.
- Absen masuk/pulang ditolak bila jarak > radius lokasi (10 m); pesan menyebut jaraknya, mis. *"Anda masih berjarak 33 meter dari titik absen …"*.
- Setiap absen & aktivitas menyimpan koordinat GPS, akurasi, dan foto (dengan cap waktu/lokasi) ke Drive: `Folder / 2026-11 / Absensi | Aktivitas | Izin | Lembur | Reimburse`.
- Password disimpan sebagai hash (bukan teks asli). Ganti password membuat sesi lama otomatis keluar.

## Catatan

- Akurasi GPS HP biasanya 3–15 m. Di dalam gedung bisa lebih buruk; sarankan karyawan absen dekat pintu/jendela dan tunggu sampai jarak di layar ≤ 10 m.
- Aplikasi web tidak bisa 100% mencegah aplikasi *fake GPS*; foto bercap + koordinat di laporan membantu admin memeriksa.
- **Mode demo**: jika `API_URL` kosong, aplikasi berjalan dengan data di perangkat itu saja (untuk mencoba tampilan).
