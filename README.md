# first-dev-projects

Kumpulan proyek belajar vibecoding, dari halaman web statis, aplikasi browser, aplikasi manajemen tugas Kanban, eksplorasi dan analisis CSV di browser, game arcade Canvas, dan visualisasi audio real-time, hingga PWA offline-first serta aplikasi full-stack dengan Express dan SQLite.

## Tentang Repository

Repository ini mendokumentasikan perjalanan belajar vibecoding melalui dua puluh proyek kecil. Setiap proyek disimpan di foldernya sendiri dan dikembangkan secara bertahap, mulai dari HTML, CSS, dan JavaScript dasar sampai integrasi API, penyimpanan lokal, REST API, database SQLite, PWA offline-first, game arcade 2D dengan HTML5 Canvas, pemutar audio lokal dengan visualisasi real-time menggunakan Web Audio API dan Canvas, eksplorasi dan analisis CSV di browser, serta aplikasi Kanban dengan drag-and-drop, undo/redo, penyimpanan lokal berversi, dan impor/ekspor JSON.

README ini berfungsi sebagai pengantar dan indeks. Instruksi teknis yang lengkap tersedia di README Proyek 01–20.

## Prasyarat

| Kebutuhan | Digunakan untuk |
| --- | --- |
| Browser modern | Semua proyek, termasuk Proyek 10–20 |
| Python 3 atau static server lain | Proyek 04–08 dan 10–20; wajib untuk 05–08 dan 10–20, disarankan untuk 04 |
| Koneksi internet | Proyek 04, 05, dan 20; instalasi awal Proyek 09 |
| TMDB API key | Proyek 05 |
| Node.js `>=22.13.0` dan npm | Proyek 09 |
| Node.js 24 atau versi yang mendukung `node:test` dan ES Modules | Unit test Proyek 13–20; tidak memerlukan npm |

Jika tidak menggunakan Python, static server lain seperti Live Server juga dapat dipakai untuk proyek yang memerlukannya. Proyek 10 tidak memerlukan instalasi dependency, API key, atau backend; cukup browser modern dan static HTTP server lokal. Proyek 11 tidak memerlukan dependency npm, API key, atau backend; gunakan browser modern dan static HTTP server lokal karena implementasinya memakai ES Modules. Proyek 12 juga tidak memerlukan dependency npm, backend, API key, atau koneksi internet untuk memuat aset aplikasi; gunakan browser modern dan static HTTP server lokal karena implementasinya memakai ES Modules dan Web Audio API. Format audio yang dapat diputar mengikuti dukungan browser. Proyek 13 tidak memerlukan dependency npm, API key, atau backend; gunakan browser modern dan static HTTP server lokal karena implementasinya memakai ES Modules dan memuat data contoh melalui `fetch`. Unit test Proyek 13 memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules. Proyek 14 juga tidak memerlukan dependency npm, API key, atau backend; gunakan browser modern dan static HTTP server lokal karena implementasinya memakai ES Modules. Unit test Proyek 14 memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm. Proyek 15 juga tidak memerlukan dependency npm, API key, atau backend; gunakan browser modern dan static HTTP server lokal karena implementasinya memakai ES Modules dan Canvas API. Gambar diproses di browser dan tidak diunggah. Unit test Proyek 15 memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm. Proyek 16 juga tidak memerlukan dependency npm, API key, atau backend; gunakan browser modern dan static HTTP server lokal karena implementasinya memakai ES Modules, SVG, dan Canvas API. Diagram disimpan di `localStorage` browser dan tidak diunggah. Unit test Proyek 16 memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm. Proyek 20 tidak memerlukan dependency npm, API key, atau backend; gunakan browser modern dan static HTTP server lokal karena implementasinya memakai ES Modules dan GitHub REST API publik. Aplikasi hanya melakukan request GET read-only ke `https://api.github.com`, dan tanpa autentikasi GitHub membatasi sekitar 60 request per jam per IP. Unit test Proyek 20 memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm.

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
| 12 | [Soundwave Studio — Real-Time Audio Visualizer](proyek-12-soundwave-studio/) | `proyek-12-soundwave-studio/` | Pemutar audio lokal dan visualisasi real-time menggunakan Web Audio API, AnalyserNode, dan Canvas | [README](proyek-12-soundwave-studio/README.md) |
| 13 | [DataLens: CSV Data Explorer](proyek-13-datalens-csv-analyzer/) | `proyek-13-datalens-csv-analyzer/` | Impor dan analisis CSV lokal dengan vanilla JavaScript/HTML/CSS: statistik, tabel, grafik SVG, ekspor hasil pencarian, validasi, aksesibilitas, dan mitigasi formula best-effort | [README](proyek-13-datalens-csv-analyzer/README.md) |
| 14 | [Flowboard: Kanban Task Manager](proyek-14-flowboard-kanban/) | `proyek-14-flowboard-kanban/` | Aplikasi Kanban empat kolom dengan CRUD tugas, prioritas, tag, tenggat, drag-and-drop dan pengurutan kartu, pencarian/filter, undo/redo dengan batas 50 aksi, penyimpanan lokal berversi, serta impor/ekspor JSON | [README](proyek-14-flowboard-kanban/README.md) |
| 15 | [PixelForge: Local Image Studio](proyek-15-pixelforge-image-studio/) | `proyek-15-pixelforge-image-studio/` | Editor gambar lokal dengan Canvas: import PNG/JPEG/WebP, filter, rotasi/flip, undo/redo, Before/After, validasi file/dimensi/piksel, dan ekspor PNG/JPEG | [README](proyek-15-pixelforge-image-studio/README.md) |
| 16 | [DiagramForge: Visual Diagram Builder](proyek-16-diagramforge-visual-diagram-builder/) | `proyek-16-diagramforge-visual-diagram-builder/` | Editor diagram flowchart berbasis SVG: node, konektor, drag, undo/redo, zoom/pan, autosave, dan ekspor SVG/PNG/JSON | [README](proyek-16-diagramforge-visual-diagram-builder/README.md) |
| 17 | [TradeLab: Stock Trading Simulator](proyek-17-tradelab-stock-trading-simulator/) | `proyek-17-tradelab-stock-trading-simulator/` | Dashboard simulasi trading saham berbasis browser: data harga sintetis deterministik, pencarian dan filter sektor, detail saham, grafik 30 hari, beli/jual, portofolio, riwayat transaksi, watchlist, dan autosave | [README](proyek-17-tradelab-stock-trading-simulator/README.md) |
| 18 | [DevPanel API Workbench](proyek-18-devpanel-api-workbench/) | `proyek-18-devpanel-api-workbench/` | Alat developer browser untuk membangun dan memvalidasi request HTTP: validasi method/URL/timeout/query/header/body, HTTP client Fetch, history, collections, import/export JSON, dan UI dark workspace | [README](proyek-18-devpanel-api-workbench/README.md) |
| 19 | [LogLens: Local Log File Analyzer](proyek-19-loglens-log-file-analyzer/) | `proyek-19-loglens-log-file-analyzer/` | Pembaca dan analyzer log lokal: streaming, pencarian, filter level/waktu, statistik, pagination, ekspor `.log`, serta hardening Unicode, ekspor, timestamp, dan UX | [README](proyek-19-loglens-log-file-analyzer/README.md) |
| 20 | [GitScope: Git Repository Visualizer](proyek-20-gitscope-git-repository-visualizer/) | `proyek-20-gitscope-git-repository-visualizer/` | Aplikasi visualisasi repositori GitHub publik berbasis HTML, CSS, JavaScript ES Modules, dan GitHub REST API: metadata, branch, commit history, commit graph, branch comparison, dan diff | [README](proyek-20-gitscope-git-repository-visualizer/README.md) |

Proyek 01 merupakan titik awal berupa halaman statis; fitur dan cara menjalankannya dijelaskan di [README Proyek 01](proyek-01-halo/README.md).

## Cara Menjalankan

### Proyek 01–03: tanpa build

Proyek 01–03 tidak memerlukan instalasi, dependency, atau proses build. Buka file `index.html` langsung di browser, atau gunakan Live Server.

- `proyek-01-halo/index.html`
- `proyek-02-taskflow/index.html`
- `proyek-03-expense-tracker/index.html`

Proyek 02 dan 03 menyimpan data di `localStorage` browser.

### Proyek 04–08, 10, 12, 13, 14, 15, dan 16: server HTTP lokal

Proyek 04 tetap dapat dibuka langsung, tetapi fitur geolokasi biasanya memerlukan `localhost` atau HTTPS. Proyek 05–08 memakai JavaScript ES Modules, sehingga harus dijalankan melalui server HTTP dan tidak disarankan dibuka lewat `file://`. Proyek 10 juga memakai ES Modules dan Service Worker, sehingga harus dijalankan melalui server HTTP pada `localhost` atau HTTPS dan tidak boleh dibuka lewat `file://`.

Proyek 12 memakai ES Modules dan Web Audio API, sehingga juga harus dijalankan melalui server HTTP. Pilih file audio dari perangkat melalui file picker; audio diproses di browser dan tidak diunggah ke server. Format audio yang dapat diputar mengikuti dukungan browser.

Proyek 13 memakai ES Modules dan memuat data contoh melalui `fetch`, sehingga harus dijalankan melalui server HTTP lokal dan tidak boleh dibuka lewat `file://`; CSV diproses di browser tanpa backend.

Proyek 14 memakai ES Modules, sehingga harus dijalankan melalui server HTTP lokal dan tidak didukung lewat `file://`. Data disimpan secara lokal di `localStorage` browser.

Proyek 15 memakai ES Modules dan Canvas API, sehingga harus dijalankan melalui server HTTP lokal dan tidak didukung lewat `file://`. Gambar diproses di browser, tidak diunggah, dan tidak disimpan otomatis ke storage persisten.

Proyek 16 memakai ES Modules dan SVG, sehingga harus dijalankan melalui server HTTP lokal dan tidak didukung lewat `file://`. Diagram disimpan di `localStorage` browser; impor/ekspor JSON, SVG, dan PNG diproses di browser.

Dari root repository:

```powershell
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
http://localhost:8000/proyek-12-soundwave-studio/
http://localhost:8000/proyek-13-datalens-csv-analyzer/
http://localhost:8000/proyek-14-flowboard-kanban/
http://localhost:8000/proyek-15-pixelforge-image-studio/
http://localhost:8000/proyek-16-diagramforge-visual-diagram-builder/
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

```powershell
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/proyek-11-astro-dodge/
```

### Proyek 17–20

Proyek 17–20 memakai ES Modules dan harus dijalankan melalui static HTTP server lokal.

Dari root repository:

```powershell
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/proyek-17-tradelab-stock-trading-simulator/
http://localhost:8000/proyek-18-devpanel-api-workbench/
http://localhost:8000/proyek-19-loglens-log-file-analyzer/
http://localhost:8000/proyek-20-gitscope-git-repository-visualizer/
```

Proyek 17–20 tidak memerlukan dependency npm, API key, atau backend. Unit test Proyek 17–20 memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm. Proyek 20 memerlukan koneksi internet ke `https://api.github.com`; tanpa autentikasi, GitHub membatasi sekitar 60 request per jam per IP.

## Struktur Repository

```text
first-dev-projects/
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
├── proyek-11-astro-dodge/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   └── js/
│       ├── app.js
│       ├── game.js
│       ├── player.js
│       ├── asteroid.js
│       └── collision.js
├── proyek-12-soundwave-studio/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   ├── assets/
│   │   └── icon.svg
│   └── js/
│       ├── app.js
│       ├── audio-engine.js
│       ├── player-ui.js
│       └── visualizer.js
├── proyek-13-datalens-csv-analyzer/
    ├── README.md
    ├── index.html
    ├── style.css
    ├── assets/
    │   └── icon.svg
    ├── data/
    │   └── sample-data.csv
    ├── js/
    │   ├── app.js
    │   ├── chart.js
    │   ├── csv-exporter.js
    │   ├── csv-parser.js
    │   ├── data-analyzer.js
    │   └── data-table.js
    └── tests/
        ├── csv-parser.test.mjs
        ├── data-analyzer.test.mjs
        ├── data-table.test.mjs
        └── csv-exporter.test.mjs
├── proyek-14-flowboard-kanban/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   ├── assets/
│   │   └── icon.svg
│   ├── js/
│   │   ├── app.js
│   │   ├── board.js
│   │   ├── history.js
│   │   ├── import-export.js
│   │   ├── storage.js
│   │   ├── task-model.js
│   │   └── ui.js
│   └── tests/
│       ├── board.test.mjs
│       ├── history.test.mjs
│       ├── import-export.test.mjs
│       ├── storage.test.mjs
│       └── task-model.test.mjs
├── proyek-15-pixelforge-image-studio/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   ├── assets/
│   │   └── icon.svg
│   ├── js/
│   │   ├── app.js
│   │   ├── editor-controls.js
│   │   ├── editor-state.js
│   │   ├── exporter.js
│   │   └── image-engine.js
│   └── tests/
│       ├── app-session.test.mjs
│       ├── editor-state.test.mjs
│       ├── image-engine.test.mjs
│       └── exporter.test.mjs
└── proyek-16-diagramforge-visual-diagram-builder/
    ├── README.md
    ├── index.html
    ├── style.css
    ├── assets/
    │   └── icon.svg
    ├── js/
    │   ├── app.js
    │   ├── canvas-controller.js
    │   ├── diagram-model.js
    │   ├── history.js
    │   ├── import-export.js
    │   ├── storage.js
    │   ├── svg-renderer.js
    │   └── visual-export.js
    └── tests/
        ├── app-integration.test.mjs
        ├── canvas-controller.test.mjs
        ├── diagram-model.test.mjs
        ├── history.test.mjs
        ├── import-export.test.mjs
        ├── storage.test.mjs
        ├── svg-renderer.test.mjs
        ├── viewport.test.mjs
        └── visual-export.test.mjs
├── proyek-17-tradelab-stock-trading-simulator/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   ├── assets/
│   │   └── icon.svg
│   ├── js/
│   │   ├── app.js
│   │   ├── autosave.js
│   │   ├── market-data.js
│   │   ├── portfolio.js
│   │   ├── storage.js
│   │   ├── trade-model.js
│   │   ├── trading-controller.js
│   │   ├── ui.js
│   │   └── watchlist-storage.js
│   └── tests/
│       ├── autosave.test.mjs
│       ├── market-data.test.mjs
│       ├── portfolio.test.mjs
│       ├── storage.test.mjs
│       ├── trade-model.test.mjs
│       ├── trading-controller.test.mjs
│       └── watchlist-storage.test.mjs
├── proyek-18-devpanel-api-workbench/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   ├── assets/
│   │   └── icon.svg
│   ├── js/
│   │   ├── app.js
│   │   ├── collection-storage.js
│   │   ├── history-storage.js
│   │   ├── http-client.js
│   │   ├── json-formatter.js
│   │   ├── request-builder.js
│   │   ├── request-model.js
│   │   ├── response-inspector.js
│   │   ├── storage.js
│   │   ├── ui.js
│   │   └── workbench-controller.js
│   └── tests/
│       ├── app-integration.test.mjs
│       ├── collection-storage.test.mjs
│       ├── history-storage.test.mjs
│       ├── http-client.test.mjs
│       ├── json-formatter.test.mjs
│       ├── request-builder.test.mjs
│       ├── request-model.test.mjs
│       ├── response-inspector.test.mjs
│       └── storage.test.mjs
├── proyek-19-loglens-log-file-analyzer/
│   ├── README.md
│   ├── index.html
│   ├── style.css
│   ├── assets/
│   │   └── icon.svg
│   ├── js/
│   │   ├── app-controller.js
│   │   ├── app.js
│   │   ├── exporter.js
│   │   ├── file-reader.js
│   │   ├── log-model.js
│   │   ├── log-parser.js
│   │   ├── query-engine.js
│   │   ├── statistics.js
│   │   ├── timestamp-parser.js
│   │   └── ui.js
│   └── tests/
│       ├── app-controller.test.mjs
│       ├── exporter.test.mjs
│       ├── file-reader.test.mjs
│       ├── log-parser.test.mjs
│       ├── query-engine.test.mjs
│       ├── statistics.test.mjs
│       ├── timestamp-parser.test.mjs
│       └── ui-contract.test.mjs
└── proyek-20-gitscope-git-repository-visualizer/
    ├── README.md
    ├── index.html
    ├── style.css
    ├── assets/
    │   └── icon.svg
    ├── js/
    │   ├── app-controller.js
    │   ├── app.js
    │   ├── branch-model.js
    │   ├── commit-graph-renderer.js
    │   ├── commit-graph.js
    │   ├── commit-normalizer.js
    │   ├── compare-model.js
    │   ├── formatters.js
    │   ├── github-api-client.js
    │   ├── patch-viewer.js
    │   ├── repo-model.js
    │   ├── ui.js
    │   └── url-validator.js
    └── tests/
        ├── app-controller.test.mjs
        ├── branch-model.test.mjs
        ├── commit-graph.test.mjs
        ├── commit-normalizer.test.mjs
        ├── compare-model.test.mjs
        ├── comparison.test.mjs
        ├── formatters.test.mjs
        ├── github-api-client.test.mjs
        ├── patch-viewer.test.mjs
        ├── qa-regression.test.mjs
        ├── repo-model.test.mjs
        ├── repository-explorer.test.mjs
        └── url-validator.test.mjs
```


File lokal seperti `config.js`, `node_modules/`, dan database SQLite tidak ditampilkan karena diabaikan Git.

## Pengujian dan Verifikasi

- **Otomatis:** Proyek 09 memiliki pengujian di `tests/` dan dapat dijalankan dengan `npm test` dari folder proyek. Hasil pengujian tidak dijalankan ulang dalam pembaruan README ini.
- **Otomatis:** Proyek 13 memiliki 41 unit test di `tests/` dan dapat dijalankan dengan `node --test tests/csv-parser.test.mjs tests/data-analyzer.test.mjs tests/data-table.test.mjs tests/csv-exporter.test.mjs` dari folder proyek. Hasil terbaru: 41/41 lulus. Unit test memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm.
- **Otomatis:** Proyek 14 memiliki 79 unit test di `tests/` dan dapat dijalankan ulang dari folder proyek. Hasil terbaru: 79/79 lulus pada Node.js `v24.21.0`. Unit test memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm; perintah lengkap tersedia di bawah daftar ini.
- **Otomatis:** Proyek 15 memiliki 43 unit test di `tests/` dan dapat dijalankan ulang dari folder proyek. Hasil terbaru: 43/43 lulus pada Node.js `v24.21.0`. Browser harness Chrome headless yang dilaporkan pada README Proyek 15 mencatat 37/37 pemeriksaan lulus, 0 console error, 0 uncaught exception, 0 network failure, dan 0 respons HTTP 4xx/5xx. Harness browser tidak disertakan dalam repository. Unit test memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm.
- **Otomatis:** Proyek 16 memiliki 100 unit test di `tests/` dan dapat dijalankan ulang dari folder proyek. Hasil terbaru: 100/100 lulus pada Node.js `v24.21.0`. Edge headless berhasil memuat aplikasi, merender kanvas kosong, dan memverifikasi autosave/reload serta pan; interaksi penuh belum diautomasi. Harness browser tidak disertakan dalam repository. Unit test memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm.
- **Otomatis:** Proyek 17 memiliki 100 unit test di `tests/` dan dapat dijalankan ulang dari folder proyek dengan `node --test tests/*.test.mjs`. Unit test memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm.
- **Otomatis:** Proyek 18 memiliki 73 unit test di `tests/` dan dapat dijalankan ulang dari folder proyek dengan `node --test tests/*.test.mjs`. Unit test memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm.
- **Otomatis:** Proyek 19 memiliki 139 unit test di `tests/` dan dapat dijalankan ulang dari folder proyek dengan `node --test tests/*.test.mjs`. Unit test memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm.
- **Otomatis:** Proyek 20 memiliki 95 unit test di `tests/` dan dapat dijalankan ulang dari folder proyek dengan `node --test tests/*.test.mjs`. Hasil terbaru: 95/95 lulus. Unit test memerlukan Node.js 24 atau versi yang mendukung `node:test` dan ES Modules, tanpa npm.
- **Browser sementara, harness tidak disertakan:** Proyek 20 diuji dengan Chrome headless untuk skenario mock, real GitHub API, keyboard/focus, responsif, dan aksesibilitas. Hasil terbaru lulus tanpa console error atau uncaught exception. Harness berada di luar repository dan tidak dapat dijalankan setelah clone; hasil ini bukan jaminan bebas bug.
- **Browser sementara, harness tidak disertakan:** Proyek 14 mencatat 63/63 pemeriksaan pada harness browser dasar dan 59/59 pada regresi khusus audit. Harness browser dasar mencatat 0 console error, uncaught exception, failed resource, dan respons HTTP 4xx/5xx; harness regresi audit mencatat 0 console error dan uncaught exception. Kedua harness berada di luar repository dan tidak dapat dijalankan setelah clone. Hasil ini merupakan hasil pengujian yang dilaporkan pada run terbaru, bukan jaminan bebas bug.
- **Keterbatasan pengujian Proyek 14:** belum ada pengujian screen reader nyata; Firefox dan Safari belum diuji; drag memakai event sintetis sehingga mouse fisik dan sentuhan nyata belum diuji; kegagalan storage disimulasikan dan kuota yang benar-benar penuh belum diuji; sinkronisasi antar-tab belum didukung; riwayat undo/redo hanya berada di memori dan hilang setelah reload atau tab ditutup.
- **Browser sementara, harness tidak disertakan:** Proyek 13 mencatat 132/132 pemeriksaan pada harness browser lama dan 34/34 pada regresi pasca-audit. Impor browser desktop Chrome headless mencapai 10.171.147 byte (9,70 MiB), 136.308 baris data, dan sekitar 479 ms pada satu pengukuran; console error dan kegagalan resource tercatat 0. Harness berada di folder sementara, tidak disertakan dalam repository, dan tidak dapat dijalankan setelah clone. Hasil ini bukan jaminan bebas bug atau benchmark universal; browser selain Chrome, screen reader nyata, perangkat fisik, dan kompatibilitas spreadsheet belum diuji.
- **Terdokumentasi di README proyek, harness tidak disertakan:** Proyek 10 memiliki hasil pemeriksaan browser terdahulu yang didokumentasikan di README proyek. Harness pengujian tidak disertakan dalam repository dan tidak dijalankan ulang dalam tahap dokumentasi ini.
- **Terdokumentasi di README proyek, harness tidak disertakan:** Proyek 11 memiliki hasil pengujian browser terdahulu yang didokumentasikan di README proyek, termasuk 41 pemeriksaan pada implementasi sebelumnya. Harness tidak disertakan dalam repository dan tidak dijalankan ulang dalam tahap dokumentasi ini.
- **Terdokumentasi di README proyek, harness tidak disertakan:** Proyek 12 memiliki hasil 85 pemeriksaan browser terdahulu yang didokumentasikan di README proyek. Harness pengujian tidak disertakan dalam repository dan tidak dijalankan ulang dalam tahap dokumentasi ini.
- **Tidak dapat diverifikasi dari repository:** Proyek 05, 06, dan 08 tidak memiliki artifact pengujian terdahulu yang dapat diverifikasi hanya dari repository.
- **Manual:** Proyek 01–04 dan 07 tidak menyediakan perintah pengujian otomatis dalam repository. Gunakan checklist atau pengujian manual di README proyek jika tersedia.
- Jangan menganggap semua proyek memiliki pengujian otomatis.

Perintah unit test Proyek 14 dari root repository:

```powershell
cd proyek-14-flowboard-kanban
node --test tests/task-model.test.mjs tests/board.test.mjs tests/history.test.mjs tests/storage.test.mjs tests/import-export.test.mjs
```

Perintah unit test Proyek 15 dari root repository:

```powershell
cd proyek-15-pixelforge-image-studio
node --test tests/editor-state.test.mjs tests/image-engine.test.mjs tests/exporter.test.mjs tests/app-session.test.mjs
```

Perintah unit test Proyek 16 dari root repository:

```powershell
cd proyek-16-diagramforge-visual-diagram-builder
node --test tests/*.test.mjs
```

## Keamanan dan Keterbatasan

- Jangan meng-commit `.env`, `.env.*`, API key, `config.js`, database lokal, atau file konfigurasi lain yang berisi kredensial. `.env`, `.env.*`, `config.js`, dan database lokal sudah diabaikan Git, tetapi tetap periksa sebelum melakukan commit.
- **Movie Explorer (05):** API key TMDB disimpan di `config.js` lokal. Karena aplikasi berjalan di frontend, key dapat terlihat di browser; ini bukan mekanisme pengamanan produksi. Untuk produksi, gunakan backend atau proxy yang menyimpan kredensial.
- **TaskFlow API (09):** belum memiliki autentikasi, otorisasi, rate limiting, CSRF, atau HTTPS. Server secara default hanya mengikat `127.0.0.1`; gunakan secara lokal dan jangan mengeksposnya ke internet.
- **Aplikasi dengan `localStorage` (02, 03, 05–08, 11, 12, 14):** data tersimpan per browser dan profil, tidak tersinkron antarperangkat, serta dapat hilang jika data situs dibersihkan. Proyek 11 hanya menyimpan rekor tertinggi di `localStorage`; Proyek 12 hanya menyimpan preferensi mode visualisasi dan volume, bukan file audio.
- **Weather Dashboard (04):** geolokasi memerlukan izin browser dan biasanya hanya tersedia pada `https://` atau `localhost`.
- **Pocket Notes (10):** catatan disimpan di IndexedDB browser pada perangkat pengguna dan tidak tersinkronisasi otomatis ke cloud atau perangkat lain; menghapus data situs/browser dapat menghilangkan catatan. Dukungan offline bergantung pada keberhasilan cache Service Worker. Alur instalasi PWA end-to-end belum diverifikasi, jadi jangan menganggap aplikasi sudah terpasang.
- **Soundwave Studio (12):** audio diputar di browser menggunakan file lokal yang dipilih pengguna dan tidak diunggah atau disimpan ke backend. `localStorage` hanya menyimpan preferensi mode visualisasi dan volume. Dukungan format serta fitur audio bergantung pada browser dan codec yang tersedia. Pengujian audio melalui speaker/headphone, browser selain Chrome, dan perangkat fisik belum dilakukan; belum ada audit privasi atau kompatibilitas formal.
- **DataLens (13):** file CSV diproses secara lokal di browser tanpa backend atau unggahan. Dataset hanya berada di memori tab dan tidak disimpan otomatis ke browser. Mitigasi formula injection bersifat best-effort dan bukan jaminan absolut. Autodeteksi delimiter dapat ambigu, sehingga tersedia pemilihan manual dan **Terapkan ulang**.
- **Flowboard (14):** tugas disimpan secara lokal di `localStorage` browser dan tidak dikirim ke backend atau layanan eksternal. Impor JSON divalidasi menyeluruh sebelum papan aktif diganti; field asing ditolak, dan konten tugas/JSON ditampilkan sebagai teks aman, bukan dieksekusi sebagai HTML. Riwayat undo/redo hanya berada di memori dan tidak persisten. Drag dinonaktifkan ketika filter aktif, tetapi perubahan status tetap memiliki alternatif melalui kontrol `<select>` native. Data tidak tersinkronisasi antar-tab.
- **PixelForge (15):** gambar diproses sepenuhnya di browser, tidak diunggah, dan tidak disimpan otomatis ke `localStorage`, IndexedDB, atau storage persisten lainnya. Import divalidasi berdasarkan ukuran berkas, decoding aktual, dimensi, dan jumlah piksel; batasnya 15 MiB, 24.000.000 piksel, dan sisi maksimum 12.000 px. CSP memblokir koneksi jaringan melalui `connect-src 'none'`; gambar mengizinkan `'self'`, `blob:`, dan `data:`, sementara skrip dibatasi ke `'self'` dan style mengizinkan `'self'` serta inline styles. Harness browser tidak disertakan dalam repository.
- **DiagramForge (16):** diagram diproses sepenuhnya di browser dan disimpan di `localStorage` dengan kunci `diagramforge.diagram`; tidak ada backend atau unggahan. Impor JSON divalidasi sebelum diagram aktif diganti; ekspor SVG/PNG/JSON diproses di browser. CSP memblokir koneksi jaringan melalui `connect-src 'none'`; gambar mengizinkan `'self'`, `blob:`, dan `data:`. Harness browser tidak disertakan dalam repository.
- **TradeLab (17):** data pasar sintetis diproses di browser; tidak ada backend, database, analytics, telemetri, CDN, atau font eksternal. Portofolio, riwayat, dan watchlist disimpan di `localStorage` browser; autosave menggunakan debounce dan status sesi memori.
- **DevPanel (18):** request HTTP dikirim langsung dari browser ke endpoint yang dimasukkan pengguna; tidak ada backend, database, analytics, telemetri, CDN, dependency eksternal, atau penyimpanan cloud. Kredensial disanitasi pada history dan collections. CSP membatasi `connect-src 'self' http: https:` karena aplikasi perlu mengirim request ke endpoint HTTP/HTTPS yang dipilih pengguna; Kebijakan ini sesuai kebutuhan fungsi aplikasi, tetapi pengguna tetap harus memastikan endpoint dan kredensial yang dikirim dapat dipercaya. Harness browser tidak disertakan dalam repository.
- **LogLens (19):** file log diproses sepenuhnya di browser; tidak ada upload, telemetri, backend, `localStorage`, `sessionStorage`, IndexedDB, atau penyimpanan log persisten. CSP memakai `connect-src 'none'`. Nama file ekspor disanitasi dan dibatasi 255 byte UTF-8/255 UTF-16 code units.
- **GitScope (20):** aplikasi read-only yang hanya mengirim GET ke `https://api.github.com`; tidak ada token, backend, database, analytics, telemetri, CDN, atau penyimpanan kredensial. CSP membatasi `connect-src` ke `https://api.github.com`, data dinamis dirender sebagai teks aman, dan tautan eksternal disanitasi ke HTTPS `github.com`. Tanpa autentikasi, GitHub membatasi sekitar 60 request per jam per IP.

## Atribusi

- **Open-Meteo** — sumber data cuaca untuk Proyek 04: <https://open-meteo.com/>
- **TMDB** — Movie Explorer menggunakan TMDB API dan gambar dari TMDB: <https://www.themoviedb.org/>

> This product uses the TMDB API but is not endorsed or certified by TMDB.

Informasi sumber data tersedia di README Proyek 04 dan 05.

## Catatan Pembelajaran

Repository ini disusun secara bertahap: dimulai dari halaman statis, dilanjutkan dengan aplikasi browser dan penyimpanan lokal, lalu integrasi API dan aplikasi full-stack dengan REST API serta database. Proyek 10 memperkenalkan PWA offline-first, IndexedDB, dan Service Worker. Proyek 11 menambahkan HTML5 Canvas, game loop `requestAnimationFrame`, pengelolaan waktu dan simulasi, collision detection, kontrol keyboard dan sentuh, serta state permainan, pause, dan restart. Proyek 12 menambahkan Web Audio API dan `AudioContext`, `AnalyserNode` untuk data frekuensi dan waveform, visualisasi real-time dengan Canvas, lifecycle audio, pengelolaan object URL, serta kontrol playback, seek, volume, dan mute. Proyek 13 menambahkan File API untuk impor CSV lokal, parser stateful, analisis statistik, tabel dengan pencarian/pengurutan/pagination, grafik SVG, serta ekspor Blob dengan mitigasi formula best-effort. Proyek 14 menambahkan papan Kanban empat kolom, drag-and-drop dengan alternatif kontrol status native, snapshot undo/redo 50 aksi di memori, penyimpanan `localStorage` berversi, serta impor/ekspor JSON transaksional dengan kanonikalisasi dan allowlist. Proyek 15 menambahkan editor gambar lokal dengan Canvas, filter, rotasi/flip, undo/redo dengan batas 50 snapshot, Before/After non-destruktif, validasi import berbasis file/dimensi/piksel, preflight metadata format, dan ekspor PNG/JPEG. Proyek 16 menambahkan editor diagram visual berbasis SVG dengan node, konektor, drag, undo/redo, zoom/pan, fit-to-view, autosave, validasi storage/impor, dan ekspor JSON/SVG/PNG. Proyek 17 menambahkan dashboard simulasi trading saham dengan data pasar sintetis deterministik, pencarian/filter, detail saham, grafik harga, beli/jual, portofolio, riwayat transaksi, watchlist, dan autosave. Proyek 18 menambahkan alat developer untuk membangun dan memvalidasi request HTTP dengan model request, HTTP client Fetch, history, collections, import/export JSON, dan UI dark workspace. Proyek 19 menambahkan pembaca dan analyzer log lokal dengan streaming, pencarian, filter level/waktu, statistik, pagination, ekspor `.log`, serta hardening Unicode, ekspor, timestamp, dan UX. Proyek 20 menambahkan visualisasi repositori GitHub publik dengan GitHub REST API read-only, repository explorer, branch dan commit timeline, detail commit, commit ancestry graph berbasis parent SHA, branch comparison, serta diff viewer. README utama ini sengaja dibuat sebagai indeks agar detail teknis tetap terpusat di dokumentasi masing-masing proyek.
