# Movie Explorer

Movie Explorer adalah aplikasi web untuk mencari, menjelajahi, dan menyimpan film favorit. Antarmuka dibuat dengan nuansa sinematik gelap, dengan poster film sebagai elemen visual utama. Seluruh data film berasal dari TMDB API; aplikasi tidak menyimpan daftar film palsu sebagai data bawaan.

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## Fitur

- **Beranda** dengan film pilihan (hero), Trending, Popular, Top Rated, dan Upcoming.
- **Pencarian film** berdasarkan judul melalui TMDB, dengan debounce 450 ms dan tombol pencarian.
- **Load More** untuk hasil pencarian dan katalog, dengan deduplikasi film berdasarkan ID.
- **Filter genre** dan **pengurutan** berdasarkan popularitas atau rating.
- **Indikator filter aktif** berupa chip yang dapat dihapus, serta tombol reset filter.
- **Detail film** dalam dialog aksesibel: poster/backdrop, judul, sinopsis, rating, tanggal rilis, genre, durasi, bahasa asli, dan status.
- **Favorit** menggunakan `localStorage`, dengan sinkronisasi tombol favorit di kartu, hero, dan dialog detail.
- **My Favorites** dengan empty state dan jumlah favorit pada navigasi.
- **Loading, error, dan empty state** yang terpisah untuk beranda, pencarian, dan favorit.
- **Poster placeholder** jika `poster_path` tidak tersedia atau gambar gagal dimuat.
- **Responsive** untuk desktop, tablet, dan smartphone, termasuk menu mobile dan navigasi keyboard.
- **Atribusi TMDB** di footer dan README.

## Teknologi

- HTML5
- CSS3 (tanpa framework CSS)
- JavaScript vanilla dengan ES Modules
- TMDB API v3
- `localStorage` untuk favorit
- Tanpa dependency runtime atau build step

## Struktur Folder

```text
proyek-05-movie-explorer/
├── index.html
├── style.css
├── README.md
├── .gitignore
├── config.example.js
├── config.js              # lokal, diabaikan Git, tidak disertakan dalam commit
├── assets/
│   └── tmdb-logo.svg      # logo resmi TMDB untuk atribusi
└── js/
    ├── app.js             # routing, state, event, orkestrasi UI
    ├── api.js             # konfigurasi, request, endpoint, dan normalisasi TMDB
    ├── ui.js              # rendering kartu, hero, state, dialog, toast
    ├── favorites.js       # penyimpanan favorit dan sinkronisasi
    └── utils.js           # helper format, gambar, filter, sorting, debounce
```

## Mendapatkan Akses TMDB API

1. Buat akun TMDB di <https://www.themoviedb.org/signup>.
2. Buka halaman pengaturan akun, lalu pilih menu **API**.
3. Daftarkan aplikasi untuk mendapatkan **API Key (v3 auth)**.
4. Baca dokumentasi resmi di <https://developer.themoviedb.org/docs>.

Aplikasi ini menggunakan API key v3 melalui parameter `api_key` pada request ke `https://api.themoviedb.org/3`.

## Konfigurasi Lokal

1. Salin file contoh:

   ```powershell
   Copy-Item config.example.js config.js
   ```

   Atau di macOS/Linux:

   ```bash
   cp config.example.js config.js
   ```

2. Buka `config.js`, lalu isi nilai berikut dengan API key Anda:

   ```js
   window.MOVIE_EXPLORER_CONFIG = {
     tmdbApiKey: "ISI_API_KEY_TMDB_ANDA_DI_SINI",
   };
   ```

3. `config.js` sudah masuk ke `.gitignore` proyek dan **tidak boleh di-commit**.
4. Jika `config.js` masih kosong, aplikasi tetap dapat dibuka, tetapi akan menampilkan petunjuk konfigurasi dan tidak mengirim request ke TMDB.

Jangan menaruh API key asli di `config.example.js`, `index.html`, atau file source lain.

## Menjalankan Aplikasi

Karena aplikasi memakai ES Modules, jalankan melalui server HTTP sederhana, bukan dengan membuka `index.html` langsung melalui `file://`.

Dari root repository:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/proyek-05-movie-explorer/
```

Alternatif jika Python tidak tersedia: gunakan static server lokal lain, misalnya ekstensi Live Server di editor. Tidak ada build step yang diperlukan.

## Cara Kerja Data

Endpoint TMDB yang digunakan:

- `GET /trending/movie/week`
- `GET /movie/popular`
- `GET /movie/top_rated`
- `GET /movie/upcoming`
- `GET /search/movie`
- `GET /discover/movie`
- `GET /movie/{movie_id}`
- `GET /genre/movie/list`

Semua request melewati `js/api.js`. Modul tersebut menangani:

- penyisipan API key,
- timeout 12 detik,
- HTTP error, error jaringan, dan respons JSON yang tidak valid,
- normalisasi data agar properti yang tidak tersedia tidak merusak UI,
- pemisahan hasil halaman, total halaman, dan total hasil.

Untuk pencarian, filter genre dan pengurutan diterapkan pada hasil yang sudah dimuat di browser karena endpoint pencarian TMDB tidak menerima parameter `with_genres`/`sort_by` seperti endpoint discover. Pada tampilan katalog tanpa kata kunci, filter dan pengurutan dikirim ke endpoint `/discover/movie`. Saat mengurutkan berdasarkan rating, aplikasi memakai `vote_count.gte=100` agar hasil tidak didominasi film dengan sedikit suara.

## Penyimpanan Favorit

Favorit disimpan di `localStorage` browser dengan key:

```text
movieExplorer.favorites.v1
```

Data yang disimpan adalah ringkasan film (ID, judul, poster, tahun, rating, genre, dan metadata ringan lain) agar kartu favorit dapat ditampilkan kembali setelah reload. Detail lengkap tetap diambil dari TMDB saat dialog detail dibuka.

Favorit bersifat lokal untuk browser dan perangkat tersebut. Menghapus data situs di browser juga akan menghapus daftar favorit. Perubahan favorit dari tab lain disinkronkan melalui event `storage`.

## Batasan Keamanan API Key

Ini adalah aplikasi frontend tanpa backend. API key yang dipakai di browser **selalu dapat dilihat** oleh pengguna melalui source code, DevTools, atau request network. Menaruhnya di `config.js` dan menambahkan file itu ke `.gitignore` hanya mencegah key ikut ter-commit; cara ini **bukan** mekanisme pengamanan produksi.

Untuk penggunaan produksi, opsi yang lebih aman adalah menambahkan backend/proxy server yang menyimpan kredensial dan meneruskan request ke TMDB. Backend seperti itu tidak disertakan dalam versi belajar ini.

## Pengujian

Pengujian pengembangan yang dilakukan:

- Pemeriksaan sintaks semua modul JavaScript.
- Pemeriksaan struktur file, endpoint, konfigurasi, atribusi, dan tidak adanya kredensial.
- Pengujian parser/normalisasi respons dengan data mock.
- Pengujian browser menggunakan respons API mock untuk beranda, pencarian, filter, detail, favorit, poster kosong, Load More, dan error state.
- Pemeriksaan tampilan desktop dan mobile serta console error browser.

Pengujian integrasi TMDB live hanya dapat dilakukan setelah `config.js` diisi dengan API key yang valid. Tanpa key, aplikasi tidak mengirim request pencarian ke TMDB dan status integrasi live tidak diklaim berhasil.

Untuk pengujian manual setelah key tersedia:

1. Buka beranda dan pastikan empat bagian film tampil.
2. Cari judul film, lalu ubah genre dan urutan.
3. Buka detail film dan tutup dialog dengan tombol, `Esc`, atau klik backdrop.
4. Tambahkan beberapa favorit, reload halaman, lalu buka **Favorit**.
5. Hapus favorit dan pastikan jumlah pada navigasi ikut berubah.
6. Periksa layout pada lebar desktop, tablet, dan ponsel.

## Atribusi dan Pemberitahuan TMDB

Aplikasi ini menggunakan TMDB API dan gambar dari TMDB. Logo TMDB yang disertakan berasal dari halaman resmi [TMDB Logos & Attribution](https://www.themoviedb.org/about/logos-attribution) dan digunakan hanya untuk atribusi. Movie Explorer bukan produk resmi dan tidak didukung atau disertifikasi oleh TMDB.

Pemberitahuan yang ditampilkan di footer:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

Data film dan gambar tetap milik TMDB serta pemegang hak masing-masing.
