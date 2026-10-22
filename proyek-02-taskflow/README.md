# Proyek 02 — TaskFlow

TaskFlow adalah aplikasi pengelola tugas pribadi yang berjalan sepenuhnya di browser. Aplikasi ini membantu pengguna mencatat tugas, menentukan prioritas dan tenggat, lalu memantau progres tanpa akun atau backend.

Tidak ada framework, proses build, CDN, font eksternal, atau layanan pihak ketiga. Seluruh data tugas disimpan di `localStorage` pada browser yang digunakan.

## Tujuan

TaskFlow dibuat sebagai latihan membangun aplikasi CRUD yang rapi dan mudah diakses dengan HTML semantik, CSS modern, dan JavaScript vanilla. Fokusnya adalah alur kerja yang sederhana: tambah tugas, kerjakan, selesaikan, dan tinjau kembali.

## Fitur

- **Dashboard tugas** — jumlah seluruh tugas, tugas aktif, tugas selesai, dan tugas prioritas tinggi.
- **Membuat tugas** — judul wajib, deskripsi opsional, prioritas rendah/sedang/tinggi, dan tenggat opsional.
- **Mengubah dan menghapus** — memperbarui data tugas atau menghapusnya melalui dialog konfirmasi.
- **Menyelesaikan dan membuka kembali** — menandai tugas selesai atau mengembalikannya ke daftar aktif.
- **Filter** — melihat semua tugas, tugas aktif, tugas selesai, atau tugas prioritas tinggi dari sidebar maupun navigasi ringkas di layar kecil.
- **Pencarian judul** — menyaring tampilan berdasarkan judul, dengan tombol hapus pencarian dan keadaan khusus saat tidak ada hasil.
- **Penyimpanan lokal** — data disimpan setelah setiap perubahan dan dimuat kembali saat halaman dibuka lagi.
- **Empty state yang jelas** — panduan berbeda untuk daftar kosong, hasil filter kosong, dan pencarian tanpa hasil.
- **Umpan balik input** — validasi judul secara inline dan toast singkat untuk aksi tambah, ubah, selesai, dan hapus.
- **Tugas contoh** — empat tugas contoh hanya dibuat jika belum ada data tersimpan. Banner menyediakan aksi untuk menghapusnya setelah konfirmasi.
- **Penanganan kegagalan penyimpanan** — kesalahan baca/tulis ditangkap, aplikasi tetap dapat digunakan di memori, dan banner penjelasan ditampilkan.
- **Responsif dan aksesibel** — kontrol ramah keyboard, landmark semantik, fokus yang terlihat, skip link, dialog native, rendering DOM yang aman, dan dukungan `prefers-reduced-motion`.

## Teknologi

- HTML5
- CSS3 (custom properties, grid, flexbox, media query, reduced motion)
- JavaScript vanilla (ES2020+, tanpa dependency)
- Browser `localStorage`

## Struktur Direktori

```text
proyek-02-taskflow/
├── index.html   # Struktur halaman dan dialog
├── style.css    # Layout, tema, keadaan responsif, dan reduced motion
├── script.js    # State tugas, rendering, filter, dan penyimpanan
└── README.md
```

## Prasyarat

Browser modern yang mendukung JavaScript, `localStorage`, dan elemen `<dialog>`. Tidak ada instalasi, dependency, atau proses build.

## Cara Menjalankan

1. Buka `proyek-02-taskflow/index.html` langsung di browser modern, **atau**
2. Jalankan static server dari root repository, misalnya:

   ```bash
   python -m http.server 8000
   ```

   Lalu buka:

   ```text
   http://localhost:8000/proyek-02-taskflow/
   ```

JavaScript harus diizinkan agar aplikasi dapat berjalan. Setelah file tersedia secara lokal, aplikasi tidak memerlukan koneksi internet.

## Data dan Penyimpanan

- Data tugas disimpan dengan key **`taskflow.tasks.v1`**.
- Tugas contoh dibuat hanya jika key tersebut belum ada. Jika semua tugas dihapus, daftar kosong tetap dipertahankan dan contoh tidak dibuat ulang.
- Aksi **Hapus contoh** pada banner hanya menghapus tugas contoh; tugas buatan pengguna tetap ada.
- Data terikat pada browser dan profil saat ini. Data tidak disinkronkan antar-browser, antar-perangkat, atau dengan mode privat/incognito.
- Menghapus data situs, memakai profil lain, atau memblokir penyimpanan dapat menghilangkan akses ke data tersimpan.
- Jika `localStorage` tidak tersedia atau penuh, TaskFlow menampilkan peringatan dan tetap berjalan di tab saat ini, tetapi perubahan dapat hilang setelah reload.

## Pengujian

Repository ini tidak menyertakan suite pengujian otomatis. Pemeriksaan manual yang disarankan:

1. Tambah tugas dengan judul, prioritas, dan tenggat; pastikan tugas muncul dan ringkasan berubah.
2. Coba simpan judul kosong dan pastikan validasi tampil.
3. Ubah tugas, tandai selesai, lalu buka kembali.
4. Uji filter semua/aktif/selesai/prioritas tinggi dan pencarian judul.
5. Hapus tugas melalui dialog konfirmasi, lalu muat ulang halaman.
6. Uji seluruh alur pada lebar desktop dan ponsel.

Pembaruan dokumentasi ini tidak menjalankan pengujian browser.

## Batasan

- Aplikasi bersifat single-user dan offline-first; tidak ada backend, sinkronisasi, notifikasi, atau dukungan multi-perangkat.
- Data hanya tersimpan di browser dan dapat hilang jika data situs dibersihkan.
- Kapasitas penyimpanan mengikuti batas `localStorage` browser.
- Tampilan dan dialog memerlukan browser modern yang mendukung `<dialog>` dan fitur CSS yang digunakan.

## Catatan Implementasi

- Teks dari pengguna dirender dengan `textContent` dan DOM API, bukan sebagai HTML.
- Dialog memakai elemen native `<dialog>` untuk pengelolaan fokus dan penutupan dengan `Escape`.
- Tata letak dirancang agar tidak menimbulkan overflow horizontal, dari ponsel kecil hingga desktop lebar.
