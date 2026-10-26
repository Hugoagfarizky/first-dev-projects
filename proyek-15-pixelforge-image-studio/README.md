# Proyek 15 — PixelForge: Local Image Studio

PixelForge adalah editor gambar lokal berbasis browser. Gambar dimuat dari perangkat, diedit dengan filter dan transformasi Canvas, dibandingkan dengan versi asli, serta diekspor sebagai PNG atau JPEG tanpa unggahan ke server.

## Tujuan Pembelajaran

- Memisahkan state editor, engine Canvas, kontrol DOM, dan ekspor ke modul ES yang dapat diuji.
- Menjaga bitmap sumber tetap immutable dan merender ulang dari sumber pada setiap preview/ekspor.
- Menerapkan transformasi rotasi/flip, undo/redo berbasis snapshot, dan Before/After non-destruktif.
- Memvalidasi berkas gambar berdasarkan ukuran, dekode aktual, dimensi, dan jumlah piksel.
- Menguji fungsi murni dengan `node:test` dan perilaku browser dengan Chrome CDP.

## Fitur yang Selesai

- Import PNG, JPEG, dan WebP melalui file picker atau drag-and-drop.
- Validasi berkas: maksimum 15 MiB, maksimum 24.000.000 piksel, sisi maksimum 12.000 px, dan dekode aktual.
- Preview Canvas dengan fit-to-workspace dan zoom tampilan yang tidak mengubah resolusi ekspor.
- Filter brightness, contrast, saturation, grayscale, sepia, dan blur dengan nilai netral dan reset filter.
- Rotasi kiri/kanan 90°, flip horizontal/vertikal, dan reset semua.
- Undo/redo dengan maksimum 50 snapshot dan penggabungan perubahan slider selama 260 ms.
- Before/After tanpa mengubah state edit atau riwayat.
- Ekspor PNG dengan transparansi dan JPEG dengan latar putih.
- Slider kualitas JPEG default 92% dan nama file ekspor yang disanitasi.
- Pesan status/error, live region, fokus, dukungan keyboard, dan `prefers-reduced-motion`.
- Layout responsif untuk desktop dan mobile.

## Teknologi

- HTML5, CSS3, Vanilla JavaScript ES Modules.
- HTML Canvas API, File API, `createImageBitmap`, Blob API, object URL.
- `node:test` untuk pengujian unit.

Tidak ada framework, dependency npm, library gambar eksternal, CDN, font eksternal, backend, analytics, atau telemetri.

## Cara Menjalankan

Jalankan dari root repository:

```powershell
cd D:\Github\vibecoding-journey
python -m http.server 8791
```

Buka:

```text
http://127.0.0.1:8791/proyek-15-pixelforge-image-studio/
```

## Batas Format dan Sumber

- Format: PNG, JPEG, dan WebP jika browser mendukung decoding.
- Batas ukuran berkas: 15 MiB.
- Batas jumlah piksel: 24.000.000 piksel.
- Batas sisi gambar: 12.000 px.
- Preview dirender pada sisi terpanjang maksimum 1600 px.
- Ekspor selalu menggunakan resolusi sumber hasil transformasi.

## Struktur Folder

```text
proyek-15-pixelforge-image-studio/
├── README.md
├── index.html
├── style.css
├── assets/
│   └── icon.svg
├── js/
│   ├── app.js
│   ├── editor-controls.js
│   ├── editor-state.js
│   ├── exporter.js
│   └── image-engine.js
└── tests/
    ├── editor-state.test.mjs
    ├── image-engine.test.mjs
    └── exporter.test.mjs
```

## Cara Memakai Filter dan Transformasi

- Setiap slider memiliki label, nilai saat ini, rentang, dan nilai default.
- Perubahan slider memperbarui preview langsung dari bitmap sumber.
- `Reset filter` mengembalikan seluruh filter ke nilai netral tanpa mengubah rotasi/flip.
- `Reset semua` mengembalikan filter, rotasi, dan flip ke kondisi awal.
- `Putar kiri/kanan` memutar 90° dan menukar lebar/tinggi pada 90°/270°.
- `Flip horizontal/vertikal` mencerminkan gambar tanpa mengubah ukuran.

## Undo/Redo dan Reset

- Undo/redo mencakup filter dan transformasi.
- Riwayat menyimpan maksimum 50 snapshot, termasuk kondisi awal.
- Perubahan slider cepat dikelompokkan dengan jeda commit 260 ms.
- Aksi baru setelah undo membuang cabang redo.
- Reset dapat di-undo dan di-redo.
- Mengganti gambar memulai sesi baru dan tidak mengizinkan undo ke gambar lama.

## Ekspor

- Format output: PNG atau JPEG.
- Kualitas JPEG default 92%, rentang 10%–100%.
- Dimensi hasil ditampilkan sebelum ekspor.
- PNG mempertahankan transparansi.
- JPEG tidak memiliki alpha channel; area transparan diekspor dengan latar putih `#ffffff`.
- Nama file output berbentuk `<basis-aman>-pixelforge-YYYY-MM-DD.(png|jpg)`.
- Blob divalidasi sebelum unduhan dan object URL dibersihkan.

## Pengujian

Perintah unit test:

```powershell
cd D:\Github\vibecoding-journey\proyek-15-pixelforge-image-studio
node --test tests/editor-state.test.mjs tests/image-engine.test.mjs tests/exporter.test.mjs
```

Hasil aktual:

- Unit test: 43 lulus, 0 gagal.
- Pengujian browser Chrome headless: 37 lulus, 0 gagal.
- Console error: 0.
- Uncaught exception: 0.
- Network failure: 0.
- Response HTTP 4xx/5xx: 0.
- Viewport diuji: desktop 1440×1100 dan mobile 390×844 DPR 2.

Hasil browser yang diverifikasi meliputi import PNG/JPEG/WebP, file invalid, penggantian gambar yang gagal, filter, rotasi, flip, undo/redo/reset, Before/After, ekspor PNG/JPEG, transparansi PNG, latar putih JPEG, drag-and-drop, keyboard slider, dan `prefers-reduced-motion`.

## Keterbatasan yang Diketahui

- File picker OS, screen reader, perangkat fisik, dan browser selain Chrome tidak diuji.
- Ekspor sangat besar bergantung pada memori browser dan batas Canvas browser.
- WebP hanya tersedia jika browser mendukung decoding/encoding.
- Tidak ada penyimpanan sesi; menutup tab menghapus riwayat edit.

## Privasi dan Lifecycle Resource

- Semua pemrosesan dilakukan di browser.
- Gambar tidak diunggah, tidak disimpan ke `localStorage`, IndexedDB, atau storage persisten lainnya.
- Bitmap lama ditutup saat gambar diganti atau sesi berakhir.
- Canvas sementara ekspor dibersihkan setelah Blob dibuat.
- Object URL unduhan dibersihkan dengan penundaan 1,5 detik dan saat `pagehide`.
- Jika gambar baru gagal didekode, gambar dan sesi lama tetap dipertahankan.