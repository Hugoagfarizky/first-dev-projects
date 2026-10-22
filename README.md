# vibecoding-journey

Kumpulan proyek belajar vibecoding, dari halaman web statis, aplikasi browser, dan game arcade Canvas, hingga PWA offline-first serta aplikasi full-stack dengan Express dan SQLite.

## Tentang Repository

Repository ini mendokumentasikan perjalanan belajar vibecoding melalui sebelas proyek kecil. Setiap proyek disimpan di foldernya sendiri dan dikembangkan secara bertahap, mulai dari HTML, CSS, dan JavaScript dasar sampai integrasi API, penyimpanan lokal, REST API, database SQLite, PWA offline-first, serta game arcade 2D dengan HTML5 Canvas.

README ini berfungsi sebagai pengantar dan indeks. Instruksi teknis yang lengkap tersedia di README Proyek 01–11.

## Prasyarat

| Kebutuhan | Digunakan untuk |
| --- | --- |
| Browser modern | Semua proyek, termasuk Proyek 10 dan 11 |
| Python 3 atau static server lain | Proyek 04–08, 10, dan 11; wajib untuk 05–08, 10, dan 11, disarankan untuk 04 |
| Koneksi internet | Proyek 04 dan 05; instalasi awal Proyek 09 |
| TMDB API key | Proyek 05 |
| Node.js `>=22.13.0` dan npm | Proyek 09 |

Jika tidak menggunakan Python, static server lain seperti Live Server juga dapat dipakai untuk proyek yang memerlukannya. Proyek 10 tidak memerlukan instalasi dependency, API key, atau backend; cukup browser modern dan static HTTP server lokal. Proyek 11 tidak memerlukan dependency npm, API key, atau backend; gunakan browser modern dan static HTTP server lokal karena implementasinya memakai ES Modules.

## Daftar Proyek

| No. | Proyek | Folder | Fokus | Dokumentasi |
| --- | --- | --- | --- | --- |
| 01 | [Halo, Vibecoding!](proyek-01-halo/) | `proyek-01-halo/` | Halaman web sederhana dengan HTML, CSS, dan JavaScript | [README](proyek-01-halo/README.md) |
| 02 | [TaskFlow](proyek-02-taskflow/) | `proyek-02-taskflow/` | Aplikasi pengelolaan tugas | [README](proyek-02-taskflow/README.md) |
| 03 | [Expense Tracker](proyek-03-expense-tracker/) | `proyek-03-expense-tracker/` | Pelacakan pengeluaran | [README](proyek-03-expense-tracker/README.md) |
| 04 | [Weather Dashboard (Cuaca Kita)](proyek-04-weather-dashboard/) | `proyek-04-weather-dashboard/` | Dashboard cuaca menggunakan Open-Meteo | [README](proyek-04-weather-dashboard/README.md) |
| 05 | [Movie Explorer](proyek-05-movie-explorer/) | `proyek-05-movie-explorer/` | Eksplorasi film menggunakan TMDB | [README](proyek-05-movie-explorer/README.md) |
| 06 | [Kanban Board](proyek-06-kanban-board/) | `proyek-06-kanban-board/` | Papan tugas Kanban | [README](proyek-06-kanban-board/README.md) |
| 07 | [Ritme — Habit Tracker](proyek-07-habit-tracker/) | `proyek-07-habit-tracker/` | Pelacakan kebiasaan | [README](proyek-07-habit-tracker/README.md) |
| 08 | [Neraca — Personal Finance Dashboard](proyek-08-personal-finance/) | `proyek-08-personal-finance/` | Dashboard keuangan pribadi | [README](proyek-08-personal-finance/README.md) |
| 09 | [TaskFlow API](proyek-09-taskflow-api/) | `proyek-09-taskflow-api/` | REST API menggunakan Node.js, Express, dan SQLite | [README](proyek-09-taskflow-api/README.md) |
| 10 | [Pocket Notes — PWA Catatan Pribadi](proyek-10-pocket-notes/) | `proyek-10-pocket-notes/` | Aplikasi catatan offline-first menggunakan IndexedDB, Service Worker, dan Web App Manifest | [README](proyek-10-pocket-notes/README.md) |
| 11 | [Astro Dodge](proyek-11-astro-dodge/) | `proyek-11-astro-dodge/` | Game arcade 2D dengan HTML5 Canvas, game loop, kontrol keyboard dan sentuh, collision detection, serta sistem skor | [README](proyek-11-astro-dodge/README.md) |

Proyek 01 merupakan titik awal berupa halaman statis; fitur dan cara menjalankannya dijelaskan di [README Proyek 01](proyek-01-halo/README.md).

## Cara Menjalankan

### Proyek 01–03: tanpa build

Proyek 01–03 tidak memerlukan instalasi, dependency, atau proses build. Buka file `index.html` langsung di browser, atau gunakan Live Server.

- `proyek-01-halo/index.html`
- `proyek-02-taskflow/index.html`
- `proyek-03-expense-tracker/index.html`

Proyek 02 dan 03 menyimpan data di `localStorage` browser.

### Proyek 04–08 dan 10: server HTTP lokal

Proyek 04 tetap dapat dibuka langsung, tetapi fitur geolokasi biasanya memerlukan `localhost` atau HTTPS. Proyek 05–08 memakai JavaScript ES Modules, sehingga harus dijalankan melalui server HTTP dan tidak disarankan dibuka lewat `file://`. Proyek 10 juga memakai ES Modules dan Service Worker, sehingga harus dijalankan melalui server HTTP pada `localhost` atau HTTPS dan tidak boleh dibuka lewat `file://`.

Dari root repository:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/proyek-04-weather-dashboard/
http://localhost:8000/proyek-05-movie-explorer/
http://localhost:8000/proyek-06-kanban-board/
http://localhost:8000/proyek-07-habit-tracker/
http://localhost:8000/proyek-08-personal-finance/
http://localhost:8000/proyek-10-pocket-notes/
```

Status **Siap offline** hanya berlaku setelah app shell berhasil disimpan di cache Service Worker. Catatan disimpan secara lokal melalui IndexedDB, tanpa sinkronisasi cloud atau antarperangkat.

Khusus Proyek 05, salin `proyek-05-movie-explorer/config.example.js` menjadi `config.js`, lalu isi API key TMDB. File `config.js` diabaikan Git dan tidak boleh di-commit.

### Proyek 09: full-stack

Proyek 09 memerlukan Node.js `>=22.13.0` dan npm.

```bash
cd proyek-09-taskflow-api
npm ci
npm start
```

Buka `http://127.0.0.1:3000`.

Jangan membuka `public/index.html` langsung atau memakai Live Server untuk proyek ini. Frontend memakai URL API relatif dan API tidak membuka CORS. Instruksi konfigurasi `HOST`, `PORT`, dan `DB_PATH` tersedia di README Proyek 09.

### Proyek 11: game arcade 2D

Proyek 11 dapat dibuka melalui browser modern. Petunjuk lengkap tersedia di [README Proyek 11](proyek-11-astro-dodge/README.md). Implementasi memakai ES Modules, jadi jalankan melalui static HTTP server lokal; tidak ada dependency npm, API key, atau backend yang perlu dipasang.

Dari root repository:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/proyek-11-astro-dodge/
```

## Struktur Repository

```text
vibecoding-journey/
├── README.md
├── .gitignore
├── proyek-01-halo/
│   ├── README.md
│   ├── index.html
│   ├── script.js
│   └── style.css
├── proyek-02-taskflow/
│   ├── README.md
│   ├── index.html
│   ├── script.js
│   └── style.css
├── proyek-03-expense-tracker/
│   ├── README.md
│   ├── index.html
│   ├── script.js
│   └── style.css
├── proyek-04-weather-dashboard/
│   ├── README.md
│   ├── index.html
│   ├── script.js
│   └── style.css
├── proyek-05-movie-explorer/
│   ├── README.md
│   ├── .gitignore
│   ├── config.example.js
│   ├── index.html
│   ├── style.css
│   ├── assets/
│   └── js/
├── proyek-06-kanban-board/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   └── js/
├── proyek-07-habit-tracker/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   └── js/
├── proyek-08-personal-finance/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   └── js/
├── proyek-09-taskflow-api/
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── .gitignore
│   ├── public/
│   ├── server/
│   └── tests/
├── proyek-10-pocket-notes/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── assets/
│   │   ├── icon.svg
│   │   └── icon-maskable.svg
│   └── js/
│       ├── app.js
│       ├── db.js
│       ├── notes.js
│       └── ui.js
└── proyek-11-astro-dodge/
    ├── README.md
    ├── index.html
    ├── style.css
    └── js/
        ├── app.js
        ├── game.js
        ├── player.js
        ├── asteroid.js
        └── collision.js
```

File lokal seperti `config.js`, `data/`, `node_modules/`, dan database SQLite tidak ditampilkan karena diabaikan Git.

## Pengujian dan Verifikasi

- **Otomatis:** Proyek 09 memiliki pengujian di `tests/` dan dapat dijalankan dengan `npm test` dari folder proyek. Hasil pengujian tidak dijalankan ulang dalam pembaruan README ini.
- **Terdokumentasi di README proyek, harness tidak disertakan:** Proyek 10 memiliki hasil pemeriksaan browser terdahulu yang didokumentasikan di README proyek. Harness pengujian tidak disertakan dalam repository dan tidak dijalankan ulang dalam tahap dokumentasi ini.
- **Terdokumentasi di README proyek, harness tidak disertakan:** Proyek 11 memiliki hasil pengujian browser terdahulu yang didokumentasikan di README proyek, termasuk 41 pemeriksaan pada implementasi sebelumnya. Harness tidak disertakan dalam repository dan tidak dijalankan ulang dalam tahap dokumentasi ini.
- **Tidak dapat diverifikasi dari repository:** Proyek 05, 06, dan 08 tidak memiliki artifact pengujian terdahulu yang dapat diverifikasi hanya dari repository.
- **Manual:** Proyek 01–04 dan 07 tidak menyediakan perintah pengujian otomatis dalam repository. Gunakan checklist atau pengujian manual di README proyek jika tersedia.
- Jangan menganggap semua proyek memiliki pengujian otomatis.

## Keamanan dan Keterbatasan

- Jangan meng-commit `.env`, `.env.*`, API key, `config.js`, database lokal, atau file konfigurasi lain yang berisi kredensial. `.env`, `.env.*`, `config.js`, dan database lokal sudah diabaikan Git, tetapi tetap periksa sebelum melakukan commit.
- **Movie Explorer (05):** API key TMDB disimpan di `config.js` lokal. Karena aplikasi berjalan di frontend, key dapat terlihat di browser; ini bukan mekanisme pengamanan produksi. Untuk produksi, gunakan backend atau proxy yang menyimpan kredensial.
- **TaskFlow API (09):** belum memiliki autentikasi, otorisasi, rate limiting, CSRF, atau HTTPS. Server secara default hanya mengikat `127.0.0.1`; gunakan secara lokal dan jangan mengeksposnya ke internet.
- **Aplikasi dengan `localStorage` (02, 03, 05–08, 11):** data tersimpan per browser dan profil, tidak tersinkron antarperangkat, serta dapat hilang jika data situs dibersihkan. Proyek 11 hanya menyimpan rekor tertinggi di `localStorage`.
- **Weather Dashboard (04):** geolokasi memerlukan izin browser dan biasanya hanya tersedia pada `https://` atau `localhost`.
- **Pocket Notes (10):** catatan disimpan di IndexedDB browser pada perangkat pengguna dan tidak tersinkronisasi otomatis ke cloud atau perangkat lain; menghapus data situs/browser dapat menghilangkan catatan. Dukungan offline bergantung pada keberhasilan cache Service Worker. Alur instalasi PWA end-to-end belum diverifikasi, jadi jangan menganggap aplikasi sudah terpasang.

## Atribusi

- **Open-Meteo** — sumber data cuaca untuk Proyek 04: <https://open-meteo.com/>
- **TMDB** — Movie Explorer menggunakan TMDB API dan gambar dari TMDB: <https://www.themoviedb.org/>

> This product uses the TMDB API but is not endorsed or certified by TMDB.

Informasi sumber data tersedia di README Proyek 04 dan 05.

## Catatan Pembelajaran

Repository ini disusun secara bertahap: dimulai dari halaman statis, dilanjutkan dengan aplikasi browser dan penyimpanan lokal, lalu integrasi API dan aplikasi full-stack dengan REST API serta database. Proyek 10 memperkenalkan PWA offline-first, IndexedDB, dan Service Worker. Proyek 11 menambahkan HTML5 Canvas, game loop `requestAnimationFrame`, pengelolaan waktu dan simulasi, collision detection, kontrol keyboard dan sentuh, serta state permainan, pause, dan restart. README utama ini sengaja dibuat sebagai indeks agar detail teknis tetap terpusat di dokumentasi masing-masing proyek.
