# Proyek 10 — Pocket Notes PWA

Pocket Notes adalah aplikasi catatan pribadi yang berjalan sepenuhnya di browser. Catatan disimpan di IndexedDB, dan app shell disimpan oleh Service Worker sehingga aplikasi dapat dibuka kembali tanpa koneksi setelah cache berhasil disiapkan.

Proyek ini dibuat sebagai latihan membangun Progressive Web App tanpa framework, build tool, backend, atau dependency npm.

## Tujuan Pembelajaran

- Menggunakan IndexedDB native untuk operasi CRUD data terstruktur.
- Membuat Service Worker yang menyimpan app shell dan melayani permintaan saat offline.
- Menyediakan Web App Manifest dan menangani tawaran instalasi bila browser mendukung.
- Memisahkan tampilan, logika catatan, akses database, dan konfigurasi PWA ke modul terpisah.
- Menjaga UI tetap responsif, aksesibel, dan memberikan pesan kesalahan yang jelas.

## Fitur

### Manajemen catatan

- Membuat catatan baru dengan judul wajib dan isi opsional.
- Mengubah catatan yang sudah tersimpan.
- Menghapus catatan melalui dialog konfirmasi yang menampilkan judul catatan.
- Menyematkan dan melepas sematan catatan.
- Menampilkan waktu dibuat dan waktu diperbarui terakhir.
- Mengurutkan catatan berdasarkan `updatedAt` terbaru di posisi teratas. Perubahan sematan juga memperbarui `updatedAt`.
- Edit, pin, dan hapus dilakukan atomik dari record terbaru di IndexedDB. Edit atau hapus yang memakai `updatedAt` lama akan ditolak sebagai konflik, bukan menimpa perubahan tab lain.
- Perubahan dari tab lain disegarkan melalui `BroadcastChannel`; jika tidak tersedia, daftar disegarkan saat halaman kembali terlihat atau aktif.

### Pencarian dan tampilan

- Pencarian pada judul dan isi catatan (tidak peka huruf besar/kecil).
- Filter **Semua** dan **Disematkan**.
- Empty state berbeda untuk: belum ada catatan, filter sematan kosong, pencarian tanpa hasil, dan penyimpanan tidak tersedia.
- Indikator status penyimpanan (`Memuat catatan…`, `Menyimpan…`, `Penyimpanan siap`, `Tersimpan di perangkat`, `Gagal menyimpan`, atau `Penyimpanan bermasalah`). Status sukses hanya muncul setelah transaksi selesai.
- Indikator kesiapan offline (`Menyiapkan cache…`, `Siap offline`, `Cache belum siap`, `Cache offline gagal`, atau `Offline tidak didukung`).
- Tombol **Baca selengkapnya** hanya muncul bila line clamp benar-benar memotong teks; pengukuran diperbarui saat viewport berubah.
- Pengumuman status melalui region `aria-live` dan toast, termasuk status offline dan ketersediaan pembaruan, tanpa memindahkan fokus.
- Fokus keyboard dipulihkan ke kartu atau tombol aksi yang relevan setelah simpan, edit, pin, dan hapus.

### PWA dan offline

- `manifest.webmanifest` dengan nama, `start_url`, `scope`, mode `standalone`, warna tema, dan ikon SVG (`any` serta `maskable`).
- Service Worker menyimpan app shell: HTML, CSS, manifest, ikon, dan seluruh modul JavaScript.
- Nama cache diberi versi (`pocket-notes-shell-v2`); cache lama dengan prefix yang sama baru dihapus pada fase `activate` setelah instalasi baru berhasil.
- Permintaan navigasi dilayani dari cache lebih dahulu agar halaman terbuka saat offline.
- Tombol **Pasang aplikasi** hanya muncul bila browser mengirim event `beforeinstallprompt`. Pocket Notes tidak mengklaim prompt instalasi tersedia di semua browser.
- Banner **Muat ulang** muncul bila versi Service Worker baru menunggu, termasuk worker yang sudah menunggu saat halaman dimuat. Instalasi pertama tanpa controller tidak dianggap sebagai pembaruan.
- Status **Siap offline** hanya ditampilkan setelah Service Worker mengonfirmasi bahwa seluruh berkas app shell benar-benar ada di cache.
- Precache dilakukan per aset. Jika ada aset wajib yang gagal, instalasi worker baru ditolak, aset yang gagal dilaporkan, dan cache versi lama tetap dipakai.

## Teknologi

- HTML5 dan CSS3 (custom properties, grid, flexbox, `prefers-reduced-motion`)
- JavaScript vanilla dengan ES Modules
- IndexedDB native (tanpa library)
- Service Worker dan Cache Storage API
- Web App Manifest

Tidak ada framework, build step, dependency npm, CDN, font eksternal, backend, akun, atau sinkronisasi cloud.

## Struktur Direktori

```text
proyek-10-pocket-notes/
├── index.html              # Struktur halaman, dialog, dan status
├── style.css               # Tema, layout, responsivitas, reduced motion
├── manifest.webmanifest    # Metadata PWA dan ikon
├── sw.js                   # Cache app shell dan penanganan offline
├── README.md
├── js/
│   ├── app.js              # Orkestrasi aplikasi, event, IndexedDB, dan Service Worker
│   ├── db.js               # Koneksi IndexedDB dan operasi CRUD
│   ├── notes.js            # Normalisasi, validasi, pengurutan, dan filter catatan
│   └── ui.js               # Referensi DOM, render kartu, dialog, dan status
└── assets/
    ├── icon.svg            # Ikon aplikasi (purpose: any)
    └── icon-maskable.svg   # Ikon dengan safe zone (purpose: maskable)
```

## Prasyarat

- Browser modern yang mendukung ES Modules, IndexedDB, Service Worker, `<dialog>`, dan Cache Storage.
- Static HTTP server lokal. Service Worker hanya berjalan pada secure context (`https://` atau `localhost`).
- Python 3 bila memakai perintah contoh di bawah; static server lain juga dapat dipakai.

## Cara Menjalankan

Dari root repository:

```bash
python -m http.server 8000
```

Buka:

```text
http://localhost:8000/proyek-10-pocket-notes/
```

Jangan membuka `index.html` langsung melalui `file://`. ES Modules dan Service Worker memerlukan konteks HTTP yang sesuai.

Semua jalur aset bersifat relatif, sehingga aplikasi dapat dijalankan dari subdirektori repository, bukan hanya dari root domain.

### Memasang sebagai aplikasi

Jika browser menganggap aplikasi memenuhi syarat, tombol **Pasang aplikasi** muncul di header. Ketersediaan dan tampilan prompt berbeda antar-browser; tidak semua browser menampilkan tombol ini. Pocket Notes tidak memaksa instalasi.

## Cara Kerja IndexedDB

- Nama database: `pocketNotes`
- Versi: `1`
- Object store: `notes` dengan `keyPath: "id"`
- Index: `updatedAt`

Setiap record memiliki bentuk:

```js
{
  id: "uuid",
  title: "Judul catatan",
  body: "Isi catatan",
  pinned: false,
  createdAt: "2026-10-22T09:00:00.000Z",
  updatedAt: "2026-10-22T09:00:00.000Z"
}
```

Alur operasi di `js/db.js`:

- `openDatabase()` membuka database dan membuat object store serta index pada `onupgradeneeded`.
- `getAllNotes()` membaca seluruh catatan dalam transaksi `readonly`.
- `addNote(note)` memakai `add` dalam transaksi `readwrite` untuk catatan baru; ID yang bentrok tidak menimpa record lama.
- `updateNote(id, values, expectedUpdatedAt)` membaca record terbaru lalu menulis judul/isi dalam satu transaksi `readwrite`. Jika `updatedAt` sudah berubah, hasilnya `conflict`; jika record sudah tidak ada, hasilnya `missing`.
- `setNotePinned(id, pinned)` membaca record terbaru dan hanya mengubah `pinned` serta `updatedAt`, sehingga tidak menulis salinan judul/isi yang kedaluwarsa.
- `deleteNote(id, expectedUpdatedAt)` menghapus hanya jika `updatedAt` masih sama; perubahan yang lebih baru tidak dihapus diam-diam.
- Promise diselesaikan setelah transaksi `complete` agar perubahan dianggap tersimpan, bukan hanya setelah request selesai.
- Jika pembukaan database atau transaksi gagal, aplikasi menampilkan banner error dan tombol **Coba lagi**. Aplikasi **tidak** beralih diam-diam ke `localStorage`.

### Sinkronisasi antar-tab

Setelah mutasi berhasil, tab pengirim mengirim pesan `notes-changed` melalui `BroadcastChannel` bernama `pocket-notes-sync`. Tab lain membaca ulang daftar dari IndexedDB tanpa memindahkan fokus pengguna. Bila `BroadcastChannel` tidak tersedia atau pesan terlewat, tab menyegarkan daftar saat `visibilitychange` menjadi terlihat atau saat jendela kembali fokus. IndexedDB tetap menjadi sumber kebenaran; state lama tidak pernah ditulis kembali sebagai satu record utuh.

Catatan yang gagal dinormalisasi (misalnya `id`, judul, atau timestamp tidak valid) dilewati saat pembacaan. Pada pemuatan awal, catatan tersebut dapat dilaporkan lewat toast; pada penyegaran latar belakang atau antar-tab, toast dapat tidak ditampilkan untuk mencegah notifikasi berulang. Record tersebut tidak ditimpa.

## Cara Kerja Service Worker

- Registrasi: `navigator.serviceWorker.register("./sw.js", { scope: "./" })`.
- Fase `install`: membuka `pocket-notes-shell-v2` dan mengambil setiap aset `APP_SHELL` secara terpisah. Kegagalan dikumpulkan, aset yang gagal dilaporkan ke halaman melalui pesan `pocket-notes:install-failed`, lalu instalasi ditolak.
- Fase `activate`: menghapus cache lain dengan prefix `pocket-notes-`, lalu memanggil `clients.claim()`. Fase ini tidak berjalan bila instalasi gagal, sehingga cache versi lama tetap valid.
- Permintaan navigasi: cache `index.html` lebih dahulu, lalu jaringan, lalu halaman fallback 503 bila cache belum tersedia.
- Permintaan aset same-origin `GET`: cache lebih dahulu, lalu jaringan. Aset hanya disimpan saat instalasi, sehingga daftar cache tetap dapat diprediksi.
- Permintaan lintas origin dan metode selain `GET` tidak diintersepsi.
- Pesan `pocket-notes:status` dipakai halaman untuk memastikan seluruh berkas app shell ada di cache sebelum menampilkan **Siap offline**.
- Bila Service Worker baru sudah terpasang dan masih menunggu, termasuk saat halaman dimuat, banner pembaruan tampil. Tombol **Muat ulang** menunggu transaksi IndexedDB yang sedang berjalan selesai, mengirim `SKIP_WAITING`, lalu memuat ulang setelah `controllerchange`. Jika aktivasi gagal atau worker menjadi `redundant`, versi lama tetap dipakai dan pengguna mendapat pesan kegagalan.

### Saat mengubah app shell

Naikkan versi pada `CACHE_NAME` di `sw.js` (misalnya menjadi `pocket-notes-shell-v3`) setiap kali berkas app shell berubah. Tanpa kenaikan versi, browser dapat terus menyajikan berkas lama dari cache.

## Batasan

### Penyimpanan lokal

- Data hanya tersimpan di browser dan profil perangkat yang digunakan. Data tidak tersinkron antar-browser, antar-perangkat, atau dengan mode privat.
- Menghapus data situs, membersihkan penyimpanan browser, atau memakai mode incognito dapat menghilangkan seluruh catatan.
- Tidak ada akun, cadangan cloud, impor, atau ekspor.
- Kapasitas penyimpanan mengikuti kuota IndexedDB browser. Bila kuota penuh, penyimpanan gagal dan aplikasi menampilkan pesan error.
- Aplikasi tidak dapat menyimpan catatan bila IndexedDB diblokir oleh pengaturan browser atau mode privat tertentu.

### Offline

- Offline hanya berlaku untuk app shell dan aset yang sudah masuk cache. Aplikasi **tidak** menjamin dapat dibuka offline sebelum instalasi Service Worker dan pengisian cache berhasil.
- Instalasi Service Worker memerlukan `localhost` atau HTTPS.
- Versi baru aplikasi baru aktif setelah pengguna menekan **Muat ulang** pada banner pembaruan. Reload ditunda sampai transaksi tulis yang sedang berjalan selesai atau gagal.
- Jika precache versi baru gagal, versi lama tetap aktif; aplikasi tidak mengklaim pembaruan berhasil.
- Catatan tetap dapat dibaca dan diubah saat offline karena IndexedDB bersifat lokal, tetapi perubahan tidak tersinkron ke mana pun.
- Cache dapat dihapus oleh browser saat ruang penyimpanan menipis atau data situs dibersihkan.

### Instalasi dan kompatibilitas

- Prompt instalasi tidak tersedia di semua browser. Safari dan Firefox memiliki perilaku pemasangan yang berbeda dari Chrome/Edge.
- Ikon manifest berupa SVG. Sebagian browser atau platform mungkin meminta ikon PNG untuk tampilan tertentu.

### Keamanan

- Tidak ada autentikasi atau enkripsi khusus. Siapa pun yang dapat membuka profil browser tersebut dapat membaca catatan.
- Jangan menyimpan kata sandi, token, atau data sensitif lain di aplikasi ini.

## Pengujian

### Status pengujian yang sudah dijalankan

Pengujian dijalankan pada **22 Oktober 2026** dari root repository, dengan Node.js `24.21.0`, server statis uji, dan Google Chrome `155.0.8059.85` (headless, profil sementara). Harness pengujian dijalankan dari luar repository dan tidak disertakan dalam proyek.

1. **Pemeriksaan sintaks** — `node --check` pada `js/app.js`, `js/db.js`, `js/notes.js`, `js/ui.js`, dan `sw.js`: kelima berkas lulus.
2. **Validasi manifest** — `manifest.webmanifest` berhasil di-parse sebagai JSON; field `name`, `short_name`, `start_url`, `scope`, `display`, dan `icons` tersedia; kedua berkas ikon ada.
3. **Pemeriksaan referensi statis** — 9 entri `APP_SHELL` di `sw.js` ada di disk, 4 referensi lokal di `index.html` ada, dan seluruh 38 ID yang dicari `ui.js` tersedia di `index.html`. Tidak ada penggunaan `innerHTML`, `insertAdjacentHTML`, `eval`, atau `new Function`.
4. **Pengujian browser otomatis melalui Chrome DevTools Protocol** — 49 pemeriksaan lulus, 0 gagal:
   - status `saving` terlihat saat transaksi berjalan, lalu berubah menjadi `Tersimpan di perangkat` hanya setelah transaksi selesai;
   - kegagalan `QuotaExceededError` yang disimulasikan menampilkan status error dan pesan ruang penyimpanan, tanpa menutup dialog atau menampilkan sukses palsu;
   - fokus berpindah ke judul kartu setelah simpan/edit, tombol pin setelah semat/lepas semat, kartu berikutnya setelah hapus, dan empty state setelah catatan terakhir dihapus;
   - fokus tidak berpindah dari input pencarian saat menyaring atau saat daftar disegarkan dari tab lain;
   - nama aksesibel tombol pin/edit/hapus memuat judul catatan; label dan `aria-pressed` pin berubah sesuai kondisi;
   - toggle **Baca selengkapnya** muncul berdasarkan overflow visual pada catatan dengan banyak baris pendek, tidak muncul pada catatan pendek, dan pengukurannya diperbarui saat viewport berubah;
   - dua tab: edit dengan `updatedAt` lama ditolak sebagai konflik, catatan yang dihapus di tab lain tidak hidup kembali, pin atomik mempertahankan isi terbaru, dan dialog hapus stale dibatalkan saat record berubah;
   - worker versi baru dibuat menunggu, halaman dimuat ulang dengan `registration.waiting` yang sudah ada, dan banner pembaruan tampil;
   - tombol **Muat ulang** ditekan saat transaksi tulis berjalan; halaman baru reload setelah record tersimpan, cache v3 aktif, dan tidak terjadi reload berulang;
   - precache versi baru dengan aset yang hilang ditolak, aset yang gagal disebutkan, cache versi lama tetap ada, dan status **Siap offline** lama tidak berubah;
   - server dihentikan dan jaringan diemulasikan offline: app shell terbuka dari cache, catatan tetap terbaca, dan penghapusan offline memperbarui IndexedDB;
   - tidak ada error console tak terduga di halaman selama alur pengujian.
5. **Pemeriksaan responsif terukur** — pada 1440, 1024, 820, 390, dan 320 px dengan dua catatan, `document.documentElement.scrollWidth` dan `document.body.scrollWidth` sama dengan lebar viewport, sehingga tidak ada overflow horizontal.

### Yang belum diuji

- Pengujian pada perangkat fisik, iOS Safari, Firefox, atau Edge.
- Pembaca layar sungguhan dan audit aksesibilitas formal.
- Lighthouse atau audit PWA otomatis.
- Penyelesaian alur instalasi hingga aplikasi benar-benar terpasang. Tombol **Pasang aplikasi** hanya ditampilkan ketika browser menyediakan event `beforeinstallprompt`; ketersediaan prompt dan penyelesaian instalasi bergantung pada browser dan belum diverifikasi end-to-end.
- Kondisi kuota penuh nyata dan IndexedDB yang diblokir oleh pengaturan browser; kegagalan tulis diuji dengan `QuotaExceededError` simulasi.
- Fallback sinkronisasi saat `BroadcastChannel` tidak tersedia; jalur `visibilitychange`/`focus` ada di kode tetapi tidak diuji tanpa API tersebut.
- Timeout aktivasi `SKIP_WAITING` setelah worker berhasil terpasang.
- Pengujian unit otomatis untuk `notes.js` dan `db.js`.

Hasil di atas hanya berlaku untuk lingkungan yang disebutkan. Tidak ada klaim bahwa semua browser atau perangkat telah diuji.

## Checklist Pengujian Manual

- [ ] Buka aplikasi melalui `http://localhost:8000/proyek-10-pocket-notes/` dan pastikan tidak ada error di console.
- [ ] Buat catatan dengan judul saja, lalu dengan judul dan isi panjang.
- [ ] Coba simpan tanpa judul dan pastikan pesan validasi muncul tanpa menutup dialog.
- [ ] Ubah catatan, lalu pastikan urutannya berpindah ke atas dan waktu pembaruan berubah.
- [ ] Sematkan catatan, aktifkan filter **Disematkan**, lalu lepas sematan.
- [ ] Cari kata yang ada di judul, kata yang hanya ada di isi, dan kata yang tidak ada.
- [ ] Hapus catatan melalui dialog konfirmasi, lalu batalkan satu penghapusan.
- [ ] Muat ulang halaman dan pastikan seluruh catatan serta sematan tetap ada.
- [ ] Buka DevTools → Application → IndexedDB → `pocketNotes` → `notes` dan periksa field record.
- [ ] Buka DevTools → Application → Service Workers dan pastikan statusnya aktif.
- [ ] Buka DevTools → Application → Cache Storage dan pastikan `pocket-notes-shell-v2` berisi 9 aset.
- [ ] Matikan server, muat ulang halaman, dan pastikan app shell serta catatan masih terbuka.
- [ ] Nyalakan kembali server dan muat ulang untuk kembali online.
- [ ] Uji dengan keyboard: Tab ke pencarian, filter, kartu, dialog, dan tombol aksi. Setelah simpan/edit, periksa fokus berada di judul kartu; setelah pin, fokus kembali ke tombol pin; setelah hapus, fokus ke kartu berikutnya atau empty state.
- [ ] Buka dua tab, ubah catatan yang sama di keduanya, dan pastikan tab dengan data lama menerima pesan konflik.
- [ ] Uji lebar 1440, 1024, 820, 390, dan 320 px.
- [ ] Aktifkan `prefers-reduced-motion` dan pastikan animasi non-esensial berkurang.
- [ ] Periksa tombol **Pasang aplikasi** bila browser menawarkannya.
- [ ] Bersihkan data situs dan pastikan aplikasi kembali ke empty state tanpa error.
