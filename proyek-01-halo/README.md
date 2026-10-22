# Proyek 01 — Halo, Vibecoding!

Halaman web statis pertama dalam repository ini. Halaman menggunakan branding **Hugo.dev** dengan tagline “Exploring the web” dan dibuat sebagai latihan dasar HTML, CSS, serta JavaScript tanpa framework, build tool, atau dependensi eksternal.

## Tujuan

Proyek ini menjadi titik awal perjalanan belajar vibecoding: membuat halaman yang rapi, responsif, dan interaktif dengan HTML semantik, CSS, dan JavaScript vanilla.

## Fitur

- Landing page dengan bagian Home, Hello, dan Experiments.
- Navigasi anchor yang dapat digunakan dengan keyboard.
- Tombol **Say hello** yang menampilkan tiga pesan sapaan secara bergantian.
- Area sapaan memakai `role="status"` dan `aria-live="polite"` agar perubahan teks dapat diumumkan pembaca layar.
- Tahun pada footer diperbarui otomatis berdasarkan tahun perangkat.
- Skip link, gaya `:focus-visible`, serta dukungan `prefers-reduced-motion`.
- Layout responsif untuk layar desktop dan perangkat kecil.

## Teknologi

- HTML5
- CSS3
- JavaScript vanilla

Tidak ada framework, dependency, CDN, proses build, penyimpanan data, atau backend.

## Struktur Direktori

```text
proyek-01-halo/
├── index.html   # Struktur halaman dan konten
├── style.css    # Tema, layout, responsivitas, dan reduced motion
├── script.js    # Sapaan interaktif dan tahun footer
└── README.md
```

## Prasyarat

Browser modern. Tidak ada instalasi atau dependency yang perlu dipasang.

## Cara Menjalankan

1. Buka `proyek-01-halo/index.html` langsung di browser, atau
2. Gunakan Live Server dari editor.

Aplikasi tidak memerlukan HTTP server, build step, atau koneksi internet.

## Pengujian

Tidak ada suite pengujian otomatis di repository ini. Pemeriksaan manual yang disarankan:

1. Pastikan tautan Home, Hello, dan Experiments menuju bagian yang benar.
2. Klik tombol **Say hello** beberapa kali dan pastikan tiga pesan bergantian.
3. Periksa tahun pada footer sesuai tahun berjalan.
4. Navigasikan halaman dengan Tab dan pastikan skip link serta fokus terlihat.
5. Uji lebar desktop dan ponsel.
6. Aktifkan `prefers-reduced-motion` dan pastikan animasi non-esensial berkurang.

Pembaruan dokumentasi ini tidak menjalankan pengujian browser.

## Batasan

- Antarmuka menggunakan Bahasa Inggris.
- Halaman bersifat statis dan tidak menyimpan data pengguna.
- Tidak ada backend, autentikasi, formulir, atau integrasi API.
- Tidak ada pengujian otomatis atau proses deployment yang disertakan.
