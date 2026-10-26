# Proyek 16 — DiagramForge: Visual Diagram Builder

DiagramForge adalah editor diagram berbasis browser untuk membuat flowchart dan diagram proses. Pengguna dapat menambahkan node, menghubungkannya dengan konektor berpanah, memindahkan dan mengedit node, melakukan undo/redo, menyimpan diagram otomatis di browser, serta mengekspor dan mengimpor diagram.

Semua pemrosesan dilakukan di browser. Tidak ada backend, database, analytics, telemetri, CDN, font eksternal, atau layanan eksternal.

## Tujuan Pembelajaran

- Memanipulasi SVG secara langsung dengan JavaScript vanilla.
- Mengelola state diagram yang immutable dan dapat diuji.
- Menerapkan interaksi pointer: pilih, drag, zoom, pan, fit-to-view, dan konektor.
- Menerapkan undo/redo berbasis snapshot.
- Menerapkan persistensi lokal yang aman dan validasi impor.
- Mengekspor SVG, PNG, dan JSON tanpa backend.
- Menjaga keamanan XSS dan aksesibilitas keyboard.

## Fitur yang Selesai

### Editor diagram

- Kanvas SVG dengan grid dan workspace 1600×900 unit.
- Node bertipe `startEnd`, `process`, `decision`, dan `inputOutput`.
- Tambah node dari toolbar.
- Pilih node atau edge.
- Pindahkan node dengan drag.
- Edit teks node dengan batas 120 karakter.
- Ubah warna isi, garis, dan teks node.
- Hapus node atau edge terpilih.
- Konektor berpanah yang tetap mengikuti posisi node.
- Mode konektor dengan pilihan node sumber dan tujuan.
- Penolakan self-edge.
- Penghapusan node juga menghapus edge yang terhubung.

### Navigasi dan viewport

- Zoom in, zoom out, fit-to-view, dan reset zoom.
- Zoom dengan roda mouse yang mempertahankan titik di bawah pointer.
- Pan dengan Space + drag, middle mouse, atau mode pan.
- Zoom dibatasi antara 0,25x dan 4x.
- Indikator persentase zoom pada status.
- Fit-to-view memperhitungkan bounding box seluruh node dengan padding.
- Diagram kosong ditangani tanpa error.

### Riwayat dan penyimpanan

- Undo/redo dengan maksimum 50 snapshot, termasuk kondisi awal.
- Aksi baru setelah undo membuang cabang redo.
- Autosave didebounce 500 ms setelah perubahan selesai.
- Status penyimpanan: menyimpan, tersimpan, belum tersimpan, gagal menyimpan, penyimpanan rusak, atau penyimpanan tidak tersedia.
- Storage rusak tidak ditimpa diam-diam oleh autosave.
- Kegagalan baca sementara tidak otomatis memblokir semua percobaan save berikutnya.
- Diagram tetap dapat digunakan di memori jika storage gagal.

### Impor dan ekspor

- Impor JSON melalui file picker.
- Validasi penuh sebelum diagram aktif diganti.
- Konfirmasi penggantian jika diagram memiliki konten.
- Batas ukuran file impor: 1 MiB.
- Ekspor JSON dengan indentasi 2 spasi.
- Ekspor SVG mandiri dengan namespace, marker panah, bentuk, warna, dan teks.
- Ekspor PNG dengan latar putih, rasio aspek diagram dipertahankan, dan batas dimensi/piksel.
- Nama file ekspor: `diagramforge-YYYY-MM-DD.(json|svg|png)`.
- Object URL dan resource sementara dibersihkan pada jalur sukses maupun gagal.

### Interaksi dan aksesibilitas

- Node SVG dapat difokus dengan keyboard.
- Tombol memiliki label yang jelas dan fokus terlihat.
- Shortcut keyboard untuk undo, redo, zoom, fit-to-view, hapus, dan navigasi.
- Live region untuk status dan pesan error.
- Dukungan `prefers-reduced-motion`.
- Layout responsif untuk desktop dan mobile.

## Teknologi

- HTML5.
- CSS3.
- Vanilla JavaScript dengan ES Modules.
- SVG.
- Web Storage API.
- File API, Blob API, dan `URL.createObjectURL`.
- HTML Canvas API untuk ekspor PNG.
- `node:test` untuk pengujian domain.

Tidak ada framework, library, dependency npm, backend, database, CDN, font eksternal, analytics, atau telemetri.

## Prasyarat

- Browser modern yang mendukung ES Modules, SVG, Canvas, dan Web Crypto.
- Python 3 atau static HTTP server lain untuk menjalankan aplikasi.
- Node.js 24 untuk menjalankan pengujian unit. Pengujian aktual memakai Node.js `v24.21.0`.
- Tidak perlu `npm install`.

## Cara Menjalankan

Dari root repository:

```powershell
cd D:\Github\vibecoding-journey
python -m http.server 8000
```

Buka:

```text
http://localhost:8000/proyek-16-diagramforge-visual-diagram-builder/
```

ES Modules tidak dijalankan melalui `file://`; gunakan static HTTP server lokal.

## Kontrol

### Mouse

- Klik node untuk memilih.
- Drag node untuk memindahkan.
- Klik edge untuk memilih.
- Klik area kosong untuk membatalkan seleksi.
- Roda mouse untuk zoom.
- Space + drag atau middle mouse untuk pan.
- Tombol `Pan` untuk mengaktifkan mode pan.

### Keyboard

- `Tab`: pindah fokus.
- `ArrowUp/Down/Left/Right`: memindahkan node terpilih 10 unit.
- `Delete` atau `Backspace`: hapus node/edge terpilih, kecuali fokus berada pada input/editor.
- `Escape`: batalkan mode konektor dan seleksi.
- `Ctrl+Z`: undo.
- `Ctrl+Shift+Z` atau `Ctrl+Y`: redo.
- `+` atau `=`: zoom in.
- `-`: zoom out.
- `0`: fit-to-view.
- `Space`: aktifkan pan jika fokus berada pada area kanvas atau elemen non-interaktif.

### Toolbar

- `Tambah Start/End`, `Tambah Process`, `Tambah Decision`, `Tambah Input/Output`: menambah node.
- `Mode konektor`: membuat konektor antara dua node.
- `Hapus`: menghapus node atau edge terpilih.
- `Undo` dan `Redo`: riwayat editor.
- `Zoom +`, `Zoom -`, `Fit`, `Reset Zoom`: navigasi viewport.
- `Pan`: mode pan.
- `Diagram baru`: membuat diagram baru.
- `Impor JSON`: membuka file picker JSON.
- `Ekspor JSON`, `Ekspor SVG`, `Ekspor PNG`: mengekspor diagram.

## Autosave, Diagram Baru, Impor, dan Ekspor

### Autosave

- Kunci `localStorage`: `diagramforge.diagram`.
- Payload berversi dengan allowlist `app`, `schemaVersion`, `savedAt`, dan `diagram`.
- Autosave didebounce 500 ms setelah perubahan selesai.
- Status penyimpanan selalu ditampilkan pada header.
- Jika storage rusak, autosave dinonaktifkan sampai pengguna membuat diagram baru atau mengimpor diagram valid.
- Jika storage tidak tersedia, aplikasi tetap berjalan di memori.
- Kegagalan baca sementara tidak otomatis memblokir semua percobaan save berikutnya.

### Diagram baru

- Jika diagram memiliki konten, pengguna harus mengonfirmasi.
- Diagram baru mereset history, selection, dan mode konektor.
- Jika storage tersedia, diagram baru disimpan segera.

### Impor JSON

- Batas ukuran file: 1 MiB.
- Payload divalidasi seluruhnya sebelum diagram aktif diganti.
- Field asing, schema tidak didukung, ID duplikat, node invalid, dan edge yatim ditolak.
- Jika impor invalid, diagram aktif tidak berubah.
- Jika diagram memiliki konten, pengguna harus mengonfirmasi penggantian.
- Setelah impor valid, history direset dan diagram disimpan jika storage tersedia.

### Ekspor JSON

- Menghasilkan file `diagramforge-YYYY-MM-DD.json`.
- Payload dapat diimpor kembali.
- Blob divalidasi sebelum unduhan.

### Ekspor SVG

- Menghasilkan file `diagramforge-YYYY-MM-DD.svg`.
- Ekspor seluruh diagram berdasarkan bounding box node, bukan viewport yang terlihat.
- Termasuk padding 48 px.
- Termasuk namespace SVG, marker panah, bentuk, warna, dan teks.
- Tidak menyertakan grid, seleksi, focus ring, atau dekorasi interaksi.
- Teks pengguna dirender sebagai teks biasa, bukan HTML.

### Ekspor PNG

- Menghasilkan file `diagramforge-YYYY-MM-DD.png`.
- Latar putih.
- Rasio aspek diagram dipertahankan.
- Seluruh diagram masuk ke gambar tanpa terpotong.
- Batas dimensi maksimum: 4096 px.
- Batas jumlah piksel maksimum: 16.777.216 piksel.
- Jika batas dilampaui, dimensi diperkecil dengan rasio aspek dipertahankan.
- Kegagalan decoding SVG, Canvas, atau `toBlob` dilaporkan sebagai error.

## Perintah Test

Dari folder Proyek 16:

```powershell
cd D:\Github\vibecoding-journey\proyek-16-diagramforge-visual-diagram-builder
node --test tests/*.test.mjs
```

Hasil aktual:

- Test files: 9
- Tests: 100
- Pass: 100
- Fail: 0
- Skipped: 0
- Cancelled: 0

Pengujian domain, history, storage, impor/ekspor, renderer geometry, controller, viewport, integrasi aplikasi, dan ekspor visual dijalankan dengan `node:test` tanpa dependency npm.

## Struktur Folder

```text
proyek-16-diagramforge-visual-diagram-builder/
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
```

### Tanggung Jawab Modul

| Modul | Tanggung Jawab |
| --- | --- |
| `js/diagram-model.js` | Model diagram, node, edge, validasi, normalisasi, batas data, geometri validasi |
| `js/history.js` | Snapshot undo/redo dengan batas 50 |
| `js/storage.js` | Serialisasi berversi, pembacaan aman, autosave, quota, verifikasi tulis |
| `js/import-export.js` | Format ekspor JSON, validasi impor transaksional, batas ukuran |
| `js/svg-renderer.js` | Rendering SVG, grid, node, edge, marker, fokus, dan geometri endpoint |
| `js/canvas-controller.js` | State editor, seleksi, drag, keyboard, undo/redo, viewport, inspector |
| `js/visual-export.js` | Ekspor SVG dan PNG, bounding box, validasi dimensi, download |
| `js/app.js` | Orkestrasi startup, autosave, impor, ekspor, dan status |

## Model Data

Diagram:

```json
{
  "app": "diagramforge",
  "schemaVersion": 1,
  "id": "uuid",
  "name": "Diagram tanpa judul",
  "createdAt": "2026-10-26T00:00:00.000Z",
  "updatedAt": "2026-10-26T00:00:00.000Z",
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "nodes": [],
  "edges": []
}
```

Node:

```json
{
  "id": "uuid",
  "type": "process",
  "x": 240,
  "y": 160,
  "width": 160,
  "height": 80,
  "text": "Proses",
  "fill": "#e8f1ff",
  "stroke": "#1f4b99",
  "textColor": "#10203a"
}
```

Edge:

```json
{
  "id": "uuid",
  "from": "node-id-sumber",
  "to": "node-id-tujuan",
  "label": ""
}
```

Tipe node:

- `startEnd`: kapsul, 140×70.
- `process`: persegi panjang, 160×80.
- `decision`: belah ketupat, 140×140.
- `inputOutput`: jajaran genjang, 160×80.

Aturan penting:

- Posisi `x` dan `y` adalah pusat node.
- Ukuran node ditentukan oleh tipe, bukan input bebas.
- ID node dan edge unik.
- Edge tidak boleh self-edge.
- Edge hanya boleh merujuk node yang ada.
- Menghapus node juga menghapus edge yang terhubung.
- Teks node maksimum 120 karakter.
- Label edge maksimum 80 karakter.
- Warna hanya `#rrggbb`.
- Koordinat harus finite dan berada dalam batas ±100.000.
- Maksimum 200 node dan 400 edge.
- Field asing ditolak ketika validasi diagram.

## Catatan Keamanan dan Privasi

- Semua pemrosesan dilakukan di browser.
- Gambar atau diagram tidak diunggah ke server.
- Diagram disimpan hanya di `localStorage` browser dengan kunci `diagramforge.diagram`.
- Teks pengguna dirender dengan `textContent` atau SVG text node, bukan `innerHTML`.
- Warna, ID, dimensi, dan payload divalidasi.
- Impor JSON dibatasi 1 MiB dan divalidasi sebelum diagram aktif diganti.
- CSP membatasi koneksi jaringan melalui `connect-src 'none'`; gambar mengizinkan `'self'`, `blob:`, dan `data:`; skrip dibatasi ke `'self'`; style mengizinkan `'self'` dan inline styles.
- CSP diterapkan melalui meta tag. `frame-ancestors` tidak dapat diterapkan melalui meta CSP dan memerlukan HTTP response header.
- Tidak ada `eval` atau `new Function`.
- Tidak ada analytics atau telemetri.

## Keterbatasan yang Diketahui

- Ekspor SVG dan PNG bergantung pada kemampuan browser mendekode SVG dan membuat Canvas.
- Diagram sangat besar dapat memerlukan memori besar meskipun output dibatasi.
- Node berukuran tetap; tidak ada resize manual.
- Konektor berupa garis lurus; tidak ada routing melengkung atau orthogonal.
- Tidak ada multi-select, grouping, copy/paste, atau auto-layout.
- Tidak ada penyimpanan cloud atau sinkronisasi antar-tab.
- Tidak ada PWA atau dukungan offline.
- Riwayat undo/redo hanya berada di memori tab aktif dan hilang saat reload.
- Browser selain yang diuji, screen reader nyata, dan perangkat fisik belum diverifikasi.
- Interaksi penuh browser belum diautomasi; browser headless berhasil memuat aplikasi dan merender kanvas kosong, tetapi drag, edit, impor, ekspor, dan konfirmasi belum diverifikasi melalui harness otomatis.

## Status Verifikasi

- Unit test: 100 lulus, 0 gagal, 0 skipped, 0 cancelled.
- Pemeriksaan whitespace: `git diff --check` exit code 0.
- Browser runtime: Edge headless berhasil memuat halaman, CSS, seluruh modul ES, SVG canvas, dan empty state. Tidak ada console error aplikasi. Interaksi penuh belum diautomasi.><|start|>assistant to=write<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="content">
# Proyek 16 — DiagramForge: Visual Diagram Builder

DiagramForge adalah editor diagram berbasis browser untuk membuat flowchart dan diagram proses. Pengguna dapat menambahkan node, menghubungkannya dengan konektor berpanah, memindahkan dan mengedit node, melakukan undo/redo, menyimpan diagram otomatis di browser, serta mengekspor dan mengimpor diagram.

Semua pemrosesan dilakukan di browser. Tidak ada backend, database, analytics, telemetri, CDN, font eksternal, atau layanan eksternal.

## Tujuan Pembelajaran

- Memanipulasi SVG secara langsung dengan JavaScript vanilla.
- Mengelola state diagram yang immutable dan dapat diuji.
- Menerapkan interaksi pointer: pilih, drag, zoom, pan, fit-to-view, dan konektor.
- Menerapkan undo/redo berbasis snapshot.
- Menerapkan persistensi lokal yang aman dan validasi impor.
- Mengekspor SVG, PNG, dan JSON tanpa backend.
- Menjaga keamanan XSS dan aksesibilitas keyboard.

## Fitur yang Selesai

### Editor diagram

- Kanvas SVG dengan grid dan workspace 1600×900 unit.
- Node bertipe `startEnd`, `process`, `decision`, dan `inputOutput`.
- Tambah node dari toolbar.
- Pilih node atau edge.
- Pindahkan node dengan drag.
- Edit teks node dengan batas 120 karakter.
- Ubah warna isi, garis, dan teks node.
- Hapus node atau edge terpilih.
- Konektor berpanah yang tetap mengikuti posisi node.
- Mode konektor dengan pilihan node sumber dan tujuan.
- Penolakan self-edge.
- Penghapusan node juga menghapus edge yang terhubung.

### Navigasi dan viewport

- Zoom in, zoom out, fit-to-view, dan reset zoom.
- Zoom dengan roda mouse yang mempertahankan titik di bawah pointer.
- Pan dengan Space + drag, middle mouse, atau mode pan.
- Zoom dibatasi antara 0,25x dan 4x.
- Indikator persentase zoom pada status.
- Fit-to-view memperhitungkan bounding box seluruh node dengan padding.
- Diagram kosong ditangani tanpa error.

### Riwayat dan penyimpanan

- Undo/redo dengan maksimum 50 snapshot, termasuk kondisi awal.
- Aksi baru setelah undo membuang cabang redo.
- Autosave didebounce 500 ms setelah perubahan selesai.
- Status penyimpanan: menyimpan, tersimpan, belum tersimpan, gagal menyimpan, penyimpanan rusak, atau penyimpanan tidak tersedia.
- Storage rusak tidak ditimpa diam-diam oleh autosave.
- Kegagalan baca sementara tidak otomatis memblokir semua percobaan save berikutnya.
- Diagram tetap dapat digunakan di memori jika storage gagal.

### Impor dan ekspor

- Impor JSON melalui file picker.
- Validasi penuh sebelum diagram aktif diganti.
- Konfirmasi penggantian jika diagram memiliki konten.
- Batas ukuran file impor: 1 MiB.
- Ekspor JSON dengan indentasi 2 spasi.
- Ekspor SVG mandiri dengan namespace, marker panah, bentuk, warna, dan teks.
- Ekspor PNG dengan latar putih, rasio aspek diagram dipertahankan, dan batas dimensi/piksel.
- Nama file ekspor: `diagramforge-YYYY-MM-DD.(json|svg|png)`.
- Object URL dan resource sementara dibersihkan pada jalur sukses maupun gagal.

### Interaksi dan aksesibilitas

- Node SVG dapat difokus dengan keyboard.
- Tombol memiliki label yang jelas dan fokus terlihat.
- Shortcut keyboard untuk undo, redo, zoom, fit-to-view, hapus, dan navigasi.
- Live region untuk status dan pesan error.
- Dukungan `prefers-reduced-motion`.
- Layout responsif untuk desktop dan mobile.

## Teknologi

- HTML5.
- CSS3.
- Vanilla JavaScript dengan ES Modules.
- SVG.
- Web Storage API.
- File API, Blob API, dan `URL.createObjectURL`.
- HTML Canvas API untuk ekspor PNG.
- `node:test` untuk pengujian domain.

Tidak ada framework, library, dependency npm, backend, database, CDN, font eksternal, analytics, atau telemetri.

## Prasyarat

- Browser modern yang mendukung ES Modules, SVG, Canvas, dan Web Crypto.
- Python 3 atau static HTTP server lain untuk menjalankan aplikasi.
- Node.js 24 untuk menjalankan pengujian unit. Pengujian aktual memakai Node.js `v24.21.0`.
- Tidak perlu `npm install`.

## Cara Menjalankan

Dari root repository:

```powershell
cd D:\Github\vibecoding-journey
python -m http.server 8000
```

Buka:

```text
http://localhost:8000/proyek-16-diagramforge-visual-diagram-builder/
```

ES Modules tidak dijalankan melalui `file://`; gunakan static HTTP server lokal.

## Kontrol

### Mouse

- Klik node untuk memilih.
- Drag node untuk memindahkan.
- Klik edge untuk memilih.
- Klik area kosong untuk membatalkan seleksi.
- Roda mouse untuk zoom.
- Space + drag atau middle mouse untuk pan.
- Tombol `Pan` untuk mengaktifkan mode pan.

### Keyboard

- `Tab`: pindah fokus.
- `ArrowUp/Down/Left/Right`: memindahkan node terpilih 10 unit.
- `Delete` atau `Backspace`: hapus node/edge terpilih, kecuali fokus berada pada input/editor.
- `Escape`: batalkan mode konektor dan seleksi.
- `Ctrl+Z`: undo.
- `Ctrl+Shift+Z` atau `Ctrl+Y`: redo.
- `+` atau `=`: zoom in.
- `-`: zoom out.
- `0`: fit-to-view.
- `Space`: aktifkan pan jika fokus berada pada area kanvas atau elemen non-interaktif.

### Toolbar

- `Tambah Start/End`, `Tambah Process`, `Tambah Decision`, `Tambah Input/Output`: menambah node.
- `Mode konektor`: membuat konektor antara dua node.
- `Hapus`: menghapus node atau edge terpilih.
- `Undo` dan `Redo`: riwayat editor.
- `Zoom +`, `Zoom -`, `Fit`, `Reset Zoom`: navigasi viewport.
- `Pan`: mode pan.
- `Diagram baru`: membuat diagram baru.
- `Impor JSON`: membuka file picker JSON.
- `Ekspor JSON`, `Ekspor SVG`, `Ekspor PNG`: mengekspor diagram.

## Autosave, Diagram Baru, Impor, dan Ekspor

### Autosave

- Kunci `localStorage`: `diagramforge.diagram`.
- Payload berversi dengan allowlist `app`, `schemaVersion`, `savedAt`, dan `diagram`.
- Autosave didebounce 500 ms setelah perubahan selesai.
- Status penyimpanan selalu ditampilkan pada header.
- Jika storage rusak, autosave dinonaktifkan sampai pengguna membuat diagram baru atau mengimpor diagram valid.
- Jika storage tidak tersedia, aplikasi tetap berjalan di memori.
- Kegagalan baca sementara tidak otomatis memblokir semua percobaan save berikutnya.

### Diagram baru

- Jika diagram memiliki konten, pengguna harus mengonfirmasi.
- Diagram baru mereset history, selection, dan mode konektor.
- Jika storage tersedia, diagram baru disimpan segera.

### Impor JSON

- Batas ukuran file: 1 MiB.
- Payload divalidasi seluruhnya sebelum diagram aktif diganti.
- Field asing, schema tidak didukung, ID duplikat, node invalid, dan edge yatim ditolak.
- Jika impor invalid, diagram aktif tidak berubah.
- Jika diagram memiliki konten, pengguna harus mengonfirmasi penggantian.
- Setelah impor valid, history direset dan diagram disimpan jika storage tersedia.

### Ekspor JSON

- Menghasilkan file `diagramforge-YYYY-MM-DD.json`.
- Payload dapat diimpor kembali.
- Blob divalidasi sebelum unduhan.

### Ekspor SVG

- Menghasilkan file `diagramforge-YYYY-MM-DD.svg`.
- Ekspor seluruh diagram berdasarkan bounding box node, bukan viewport yang terlihat.
- Termasuk padding 48 px.
- Termasuk namespace SVG, marker panah, bentuk, warna, dan teks.
- Tidak menyertakan grid, seleksi, focus ring, atau dekorasi interaksi.
- Teks pengguna dirender sebagai teks biasa, bukan HTML.

### Ekspor PNG

- Menghasilkan file `diagramforge-YYYY-MM-DD.png`.
- Latar putih.
- Rasio aspek diagram dipertahankan.
- Seluruh diagram masuk ke gambar tanpa terpotong.
- Batas dimensi maksimum: 4096 px.
- Batas jumlah piksel maksimum: 16.777.216 piksel.
- Jika batas dilampaui, dimensi diperkecil dengan rasio aspek dipertahankan.
- Kegagalan decoding SVG, Canvas, atau `toBlob` dilaporkan sebagai error.

## Perintah Test

Dari folder Proyek 16:

```powershell
cd D:\Github\vibecoding-journey\proyek-16-diagramforge-visual-diagram-builder
node --test tests/*.test.mjs
```

Hasil aktual:

- Test files: 9
- Tests: 100
- Pass: 100
- Fail: 0
- Skipped: 0
- Cancelled: 0

Pengujian domain, history, storage, impor/ekspor, renderer geometry, controller, viewport, integrasi aplikasi, dan ekspor visual dijalankan dengan `node:test` tanpa dependency npm.

## Struktur Folder

```text
proyek-16-diagramforge-visual-diagram-builder/
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
```

### Tanggung Jawab Modul

| Modul | Tanggung Jawab |
| --- | --- |
| `js/diagram-model.js` | Model diagram, node, edge, validasi, normalisasi, batas data, geometri validasi |
| `js/history.js` | Snapshot undo/redo dengan batas 50 |
| `js/storage.js` | Serialisasi berversi, pembacaan aman, autosave, quota, verifikasi tulis |
| `js/import-export.js` | Format ekspor JSON, validasi impor transaksional, batas ukuran |
| `js/svg-renderer.js` | Rendering SVG, grid, node, edge, marker, fokus, dan geometri endpoint |
| `js/canvas-controller.js` | State editor, seleksi, drag, keyboard, undo/redo, viewport, inspector |
| `js/visual-export.js` | Ekspor SVG dan PNG, bounding box, validasi dimensi, download |
| `js/app.js` | Orkestrasi startup, autosave, impor, ekspor, dan status |

## Model Data

Diagram:

```json
{
  "app": "diagramforge",
  "schemaVersion": 1,
  "id": "uuid",
  "name": "Diagram tanpa judul",
  "createdAt": "2026-10-26T00:00:00.000Z",
  "updatedAt": "2026-10-26T00:00:00.000Z",
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "nodes": [],
  "edges": []
}
```

Node:

```json
{
  "id": "uuid",
  "type": "process",
  "x": 240,
  "y": 160,
  "width": 160,
  "height": 80,
  "text": "Proses",
  "fill": "#e8f1ff",
  "stroke": "#1f4b99",
  "textColor": "#10203a"
}
```

Edge:

```json
{
  "id": "uuid",
  "from": "node-id-sumber",
  "to": "node-id-tujuan",
  "label": ""
}
```

Tipe node:

- `startEnd`: kapsul, 140×70.
- `process`: persegi panjang, 160×80.
- `decision`: belah ketupat, 140×140.
- `inputOutput`: jajaran genjang, 160×80.

Aturan penting:

- Posisi `x` dan `y` adalah pusat node.
- Ukuran node ditentukan oleh tipe, bukan input bebas.
- ID node dan edge unik.
- Edge tidak boleh self-edge.
- Edge hanya boleh merujuk node yang ada.
- Menghapus node juga menghapus edge yang terhubung.
- Teks node maksimum 120 karakter.
- Label edge maksimum 80 karakter.
- Warna hanya `#rrggbb`.
- Koordinat harus finite dan berada dalam batas ±100.000.
- Maksimum 200 node dan 400 edge.
- Field asing ditolak ketika validasi diagram.

## Catatan Keamanan dan Privasi

- Semua pemrosesan dilakukan di browser.
- Diagram tidak diunggah ke server.
- Diagram disimpan hanya di `localStorage` browser dengan kunci `diagramforge.diagram`.
- Teks pengguna dirender dengan `textContent` atau SVG text node, bukan `innerHTML`.
- Warna, ID, dimensi, dan payload divalidasi.
- Impor JSON dibatasi 1 MiB dan divalidasi sebelum diagram aktif diganti.
- CSP membatasi koneksi jaringan melalui `connect-src 'none'`; gambar mengizinkan `'self'`, `blob:`, dan `data:`; skrip dibatasi ke `'self'`; style mengizinkan `'self'` dan inline styles.
- CSP diterapkan melalui meta tag. `frame-ancestors` tidak dapat diterapkan melalui meta CSP dan memerlukan HTTP response header.
- Tidak ada `eval` atau `new Function`.
- Tidak ada analytics atau telemetri.

## Keterbatasan yang Diketahui

- Ekspor SVG dan PNG bergantung pada kemampuan browser mendekode SVG dan membuat Canvas.
- Diagram sangat besar dapat memerlukan memori besar meskipun output dibatasi.
- Node berukuran tetap; tidak ada resize manual.
- Konektor berupa garis lurus; tidak ada routing melengkung atau orthogonal.
- Tidak ada multi-select, grouping, copy/paste, atau auto-layout.
- Tidak ada penyimpanan cloud atau sinkronisasi antar-tab.
- Tidak ada PWA atau dukungan offline.
- Riwayat undo/redo hanya berada di memori tab aktif dan hilang saat reload.
- Browser selain yang diuji, screen reader nyata, dan perangkat fisik belum diverifikasi.
- Interaksi penuh browser belum diautomasi; browser headless berhasil memuat aplikasi dan merender kanvas kosong, tetapi drag, edit, impor, ekspor, dan konfirmasi belum diverifikasi melalui harness otomatis.

## Status Verifikasi

- Unit test: 100 lulus, 0 gagal, 0 skipped, 0 cancelled.
- Pemeriksaan whitespace: `git diff --check` exit code 0.
- Browser runtime: Edge headless berhasil memuat halaman, CSS, seluruh modul ES, SVG canvas, dan empty state. Tidak ada console error aplikasi. Interaksi penuh belum diautomasi.