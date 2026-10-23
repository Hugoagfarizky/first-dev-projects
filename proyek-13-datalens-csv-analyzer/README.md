# Proyek 13 — DataLens: CSV Data Explorer

DataLens adalah aplikasi web untuk mengimpor, mengeksplorasi, menganalisis, memvisualisasikan, dan mengekspor data CSV langsung di browser. Tidak ada backend, unggahan file, analytics, atau penyimpanan dataset otomatis: seluruh proses berjalan di tab browser pengguna.

Aplikasi dibuat dengan HTML5, CSS3, JavaScript vanilla (ES Modules), SVG, File API, dan Blob API. Tidak ada framework, library grafik, dependency npm, CDN, font eksternal, atau aset jaringan.

## Tujuan Pembelajaran

- Membaca file lokal dengan File API tanpa mengirimkannya ke server.
- Menulis parser CSV dengan state yang membedakan field berpetik, posisi tepat setelah kutip penutup, dan field biasa.
- Menangani BOM, beberapa delimiter, field berpetik, escaped quote, serta line break di dalam field.
- Memvalidasi struktur data dan memberikan pesan error yang menyebut baris dan kolom bila relevan.
- Menghitung statistik yang tetap finite untuk nilai sangat besar, termasuk rata-rata, median, dan histogram.
- Membuat tabel besar tetap responsif dengan pencarian, pengurutan total-order, dan pagination.
- Menggambar visualisasi SVG dengan label yang dapat dibedakan dan ringkasan aksesibel yang konsisten.
- Mengekspor CSV dengan escaping yang benar serta mitigasi formula injection yang bersifat best-effort.
- Membangun antarmuka responsif yang dapat digunakan dengan keyboard dan tetap aman terhadap konten CSV tidak tepercaya.

## Fitur

### Impor CSV

- File picker dan area drag-and-drop.
- Tombol **Muat data contoh** untuk memakai `data/sample-data.csv` tanpa memilih file.
- Menampilkan nama file, ukuran, jumlah baris data, jumlah kolom, sumber, dan delimiter yang dipakai.
- Mendukung BOM UTF-8, CRLF/LF, dan delimiter koma, titik koma, atau tab.
- Parser mendukung field berpetik, delimiter di dalam field, escaped quote (`""`), dan line break di dalam field berpetik.
- Setelah kutip penutup, parser hanya menerima delimiter aktif, akhir baris, akhir file, atau spasi/tab horizontal. Spasi dan tab setelah kutip penutup dianggap sintaks dan diabaikan; karakter non-whitespace lain ditolak dengan nomor baris dan kolom.
- Record yang seluruh field-nya kosong setelah `trim` dilewati, termasuk record berisi delimiter saja seperti `,,` dan field kosong berpetik seperti `"",""`. Kebijakan ini berlaku sebelum pemilihan header dan di seluruh body data.
- Header kosong diberi nama `Kolom N`. Seluruh nama hasil normalisasi dilacak dengan `Set`; jika bentrok, suffix `(2)`, `(3)`, dan seterusnya dinaikkan sampai benar-benar unik. Urutan kolom dan nilai data tidak diubah.
- Deteksi delimiter memprioritaskan konsistensi jumlah field di beberapa record, bukan hanya jumlah kolom terbanyak. Jika beberapa delimiter menghasilkan struktur yang sama-sama konsisten, autodeteksi ditandai ambigu dan pengguna diberi warning.
- Pemilih delimiter manual menyediakan **Deteksi otomatis**, **Koma (,)**, **Titik koma (;)**, dan **Tab**. Pilihan berlaku untuk impor berikutnya. Mengubah pilihan tidak langsung mengubah dataset aktif; tombol **Terapkan ulang** memproses ulang file aktif atau data contoh dengan pilihan tersebut.
- Baris dengan jumlah kolom tidak konsisten ditolak dengan pesan yang menyebutkan nomor baris dan jumlah kolom yang diharapkan. Data tidak dipotong atau ditambahkan secara diam-diam.
- Menolak file kosong, file biner/non-teks, file yang bukan UTF-8 valid, file dengan satu kolom, file header saja, file dengan kutip tidak ditutup, dan file yang melebihi 10 MiB.
- Validasi tidak hanya memakai ekstensi file: tipe MIME diperiksa, lalu isi file diperiksa sebagai teks UTF-8.
- Jika impor file baru gagal, dataset lama tetap aktif. Error file baru ditampilkan tanpa menghapus warning milik dataset lama. Dataset dan warning baru diterapkan bersama hanya setelah impor baru berhasil.

### Ringkasan dan statistik

- Total baris data, total kolom, jumlah sel kosong, dan jumlah kolom numerik.
- Persentase sel kosong terhadap seluruh sel data.
- Pemilih kolom numerik dengan statistik minimum, maksimum, rata-rata, dan median.
- Sel kosong dan nilai non-numerik tidak dihitung dalam statistik numerik. Jumlah keduanya ditampilkan di bawah statistik.
- Kolom dianggap numerik jika minimal 60% nilai non-kosongnya dapat dibaca sebagai angka. Angka desimal memakai titik dan mendukung notasi eksponen.
- Rata-rata dan jumlah dihitung dengan skala relatif agar tidak overflow. Median dua nilai tengah dihitung dengan membagi masing-masing nilai sebelum dijumlahkan. Rentang yang tidak dapat direpresentasikan sebagai `max - min` ditangani dengan pemetaan setengah nilai.
- Nilai besar yang sama, nilai konstan, seluruh nilai nol, serta campuran nilai negatif dan positif besar tetap menghasilkan statistik yang finite bila hasil matematisnya masih dapat direpresentasikan.

### Tabel data

- Pencarian teks global yang tidak membedakan huruf besar/kecil.
- Pengurutan naik dan turun pada setiap kolom dengan aturan total order yang konsisten:
  - angka diklasifikasikan secara tegas dan dibandingkan secara numerik;
  - teks seperti `2a` tidak diubah menjadi angka dan dibandingkan memakai `Intl.Collator` Bahasa Indonesia;
  - pada urutan naik, kelompok angka berada sebelum kelompok teks;
  - urutan turun membalik urutan nonkosong secara konsisten;
  - sel kosong selalu berada di akhir pada kedua arah.
- Pengurutan hanya mengubah tampilan tabel, bukan urutan dataset sumber yang dipakai statistik, grafik, dan fitur lain.
- Debounce pencarian membersihkan timer setelah dijalankan atau dibatalkan. Ekspor hanya memaksa penerapan query jika masih ada timer yang tertunda, sehingga ekspor tidak mereset halaman aktif tanpa alasan.
- Pagination dengan pilihan 10, 25, 50, atau 100 baris per halaman.
- Jumlah hasil setelah pencarian ditampilkan, begitu juga rentang baris dan halaman aktif.
- Hanya satu halaman tabel yang dirender ke DOM, bukan seluruh dataset.
- Keadaan awal, hasil pencarian kosong, file invalid, dan pesan error memiliki tampilan yang berbeda dan jelas.

### Visualisasi

- Pemilih kolom untuk grafik yang mencakup semua kolom.
- Kolom numerik ditampilkan sebagai histogram delapan kelompok yang dihitung dari nilai aktual.
- Kolom teks ditampilkan sebagai grafik delapan kategori terbanyak, beserta jumlah kategori lain yang tidak ditampilkan.
- Grafik berubah saat kolom atau dataset diganti.
- Label batas histogram memakai presisi adaptif berdasarkan lebar bin dan besaran nilai. Notasi ilmiah dipakai untuk nilai ekstrem atau sangat kecil; label dijamin unik dan tidak menampilkan rentang nol palsu akibat pembulatan.
- Batas bin yang sebenarnya tetap tersedia pada model histogram, sedangkan label hanyalah representasi tampilan yang dibulatkan.
- Grafik dan ringkasan aksesibel memakai objek label yang sama.
- Setiap grafik memiliki judul, label sumbu, nilai batang, ringkasan aksesibel, dan tooltip per batang.
- Empty state ditampilkan jika kolom tidak memiliki nilai yang dapat divisualisasikan.

### Ekspor CSV

- Mengekspor **hasil pencarian aktif** dalam **urutan tabel yang sedang aktif**.
- Jika pencarian kosong, ekspor mencakup seluruh dataset.
- Cakupan ekspor selalu ditampilkan di dekat tombol agar pengguna tidak salah mengira sedang mengekspor seluruh data.
- Nama file menyertakan nama sumber, cakupan (`semua` atau `filter`), jumlah baris, dan tanggal.
- CSV hasil ekspor memakai koma sebagai delimiter, BOM UTF-8, dan CRLF.
- Escape diterapkan pada tanda kutip, delimiter, dan line break.
- Nilai teks dan header yang berpotensi menjadi formula diberi awalan apostrof. Pemeriksaan mengabaikan whitespace, karakter kontrol C0/C1, BOM, serta karakter format/zero-width di awal nilai. Prefiks asli tidak dinormalisasi atau dihapus; apostrof ditambahkan sebelum prefiks tersebut.
- Angka negatif yang valid seperti `-5`, `-1.2`, dan `-1e3` tetap diekspor sebagai angka. Ekspresi seperti `-2+3`, `-SUM(A1:A2)`, `=1+1`, `+SUM(A1:A2)`, dan `@cmd` dilindungi.
- Mitigasi formula injection bersifat **best-effort**. Perilaku aplikasi spreadsheet berbeda-beda dan tidak ada jaminan absolut.
- Unduhan dibuat sebagai Blob di browser; tidak ada file yang dikirim ke server.

### Aksesibilitas dan pengalaman pengguna

- Skip link, navigasi bagian, label form, dan fokus keyboard yang terlihat.
- Live region untuk status impor, error, dan ekspor.
- `aria-sort` pada header tabel, nama aksesibel pada tombol pengurutan, caption tabel, serta ringkasan teks untuk grafik.
- Kontras teks diuji untuk pasangan warna utama.
- Layout responsif untuk desktop dan layar kecil.
- Dukungan `prefers-reduced-motion`.
- Konten CSV dirender dengan `textContent` dan DOM API yang aman, tidak melalui `innerHTML` sebagai markup.

## Teknologi

| Teknologi | Penggunaan |
| --- | --- |
| HTML5 | Struktur halaman, form impor, tabel, SVG |
| CSS3 | Desain responsif, fokus, reduced motion, kontras |
| JavaScript vanilla + ES Modules | Parser, analisis, tabel, grafik, ekspor |
| SVG | Histogram dan grafik kategori |
| File API | Membaca file lokal |
| Blob API dan object URL | Membuat unduhan CSV lokal |
| `TextDecoder` | Dekode UTF-8 dengan validasi |
| `Intl` | Format angka dan collation Bahasa Indonesia |
| Content Security Policy | Membatasi sumber script, style, dan koneksi |
| `node:test` | Pengujian unit tanpa dependency |

Tidak ada framework, library grafik, backend, database, CDN, font eksternal, atau aset gambar jaringan.

## Persyaratan

- Browser modern dengan dukungan ES Modules, File API, Blob API, SVG, `TextDecoder`, dan `ResizeObserver`.
- Python 3 atau static HTTP server lain untuk menjalankan aplikasi.
- Node.js 24 atau versi yang mendukung `node:test` dan ES Modules untuk menjalankan pengujian unit.
- Tidak memerlukan koneksi internet.
- Tidak ada instalasi dependency npm.

Pengujian browser dilakukan di Google Chrome 155.0.8059.85 pada Windows. Browser lain belum diuji secara langsung.

## Menjalankan Aplikasi

Dari root repository:

```powershell
cd D:\Github\vibecoding-journey
python -m http.server 8000
```

Buka:

```text
http://localhost:8000/proyek-13-datalens-csv-analyzer/
```

Alternatif, jalankan server dari dalam folder proyek:

```powershell
cd D:\Github\vibecoding-journey\proyek-13-datalens-csv-analyzer
python -m http.server 8000
```

Lalu buka `http://localhost:8000/`.

Jangan membuka `index.html` langsung melalui `file://`. ES Modules dan pemuatan data contoh memerlukan static HTTP server lokal.

## Cara Menggunakan

1. Pilih file CSV/TSV/TXT melalui tombol **Pilih file CSV**, letakkan file ke area impor, atau klik **Muat data contoh**.
2. Periksa kartu **Dataset aktif** untuk nama file, ukuran, jumlah baris, jumlah kolom, dan delimiter.
3. Jika autodeteksi delimiter memberi warning ambigu atau hasil kolom terlihat salah, pilih delimiter manual lalu klik **Terapkan ulang**. Pilihan juga dipakai untuk impor berikutnya.
4. Lihat **Ringkasan** untuk total baris, kolom, sel kosong, dan kolom numerik.
5. Pilih kolom numerik untuk melihat minimum, maksimum, rata-rata, dan median.
6. Pilih kolom pada bagian **Visualisasi** untuk mengganti grafik.
7. Gunakan pencarian, tombol header untuk mengurutkan, dan kontrol halaman pada bagian **Tabel data**.
8. Klik **Ekspor CSV** untuk mengunduh data. Baca teks cakupan di bawah tombol: hasil filter atau seluruh dataset.
9. Untuk mengganti dataset, impor file baru. Dataset lama dan warning-nya tetap ada jika file baru ditolak.

## Struktur Folder

```text
proyek-13-datalens-csv-analyzer/
├── README.md
├── index.html
├── style.css
├── assets/
│   └── icon.svg
├── data/
│   └── sample-data.csv
├── js/
│   ├── app.js
│   ├── csv-parser.js
│   ├── data-analyzer.js
│   ├── data-table.js
│   ├── chart.js
│   └── csv-exporter.js
└── tests/
    ├── csv-parser.test.mjs
    ├── data-analyzer.test.mjs
    ├── data-table.test.mjs
    └── csv-exporter.test.mjs
```

| File | Peran |
| --- | --- |
| `index.html` | Struktur halaman, label, live region, kontrol impor, tabel, dan wadah grafik |
| `style.css` | Sistem visual, layout responsif, fokus, kontras, reduced motion |
| `assets/icon.svg` | Favicon lokal |
| `data/sample-data.csv` | Dataset contoh 24 baris dan 10 kolom |
| `js/app.js` | Orkestrasi impor, validasi file, delimiter manual, statistik, grafik, tabel, dan ekspor |
| `js/csv-parser.js` | Deteksi delimiter, state parser, normalisasi header, dan validasi record |
| `js/data-analyzer.js` | Profil kolom, statistik numerik, histogram, kategori, dan format label |
| `js/data-table.js` | Comparator total-order, pencarian, debounce, pagination, dan render sel |
| `js/chart.js` | Renderer SVG untuk histogram dan grafik kategori |
| `js/csv-exporter.js` | Escaping CSV, mitigasi formula, dan nama file ekspor |
| `tests/csv-parser.test.mjs` | Regresi H-1, M-2, M-3, dan L-3 |
| `tests/data-analyzer.test.mjs` | Regresi M-4 dan L-2 |
| `tests/data-table.test.mjs` | Regresi M-1 dan properti total-order |
| `tests/csv-exporter.test.mjs` | Regresi L-1 dan pemeriksaan CSV mentah |

## Catatan Implementasi

- **State parser:** `inQuotes`, `afterClosingQuote`, dan kondisi field biasa dipisahkan. Kutip penutup tidak lagi menyerap karakter berikutnya secara diam-diam.
- **Whitespace setelah kutip:** hanya spasi dan tab horizontal yang diizinkan dan diabaikan sebagai sintaks. Newline mengakhiri record. Karakter lain menghasilkan `INVALID_CHARACTER_AFTER_QUOTE` dengan baris dan kolom.
- **Record kosong:** record dengan seluruh field kosong setelah `trim` dibuang sebelum header dipilih dan sebelum validasi jumlah kolom. File yang hanya berisi record kosong ditolak; file dengan header dan record kosong saja juga ditolak.
- **Header:** pencocokan memakai nama hasil normalisasi, bukan nama mentah. Contoh `a,a,a (2)` menjadi tiga nama unik; data tidak diubah.
- **Delimiter:** konsistensi jumlah field dihitung dari sampel hingga 30 record atau 128 KiB. Kandidat dengan konsistensi dalam toleransi 0,02 dari kandidat terbaik dianggap berdekatan dan memicu warning ambigu. Autodeteksi tetap memilih satu delimiter, tetapi pengguna dapat memilih manual.
- **Angka:** nilai seperti `10`, `-3.5`, `.5`, dan `1e3` dikenali. Format desimal koma seperti `1,5` tidak dikenali sebagai angka.
- **Median:** untuk jumlah nilai genap, median adalah rata-rata dua nilai tengah yang dihitung tanpa penjumlahan langsung yang berpotensi overflow.
- **Histogram:** nilai kosong dan non-numerik dikeluarkan. Total nilai yang dipakai ditampilkan. Data konstan menghasilkan satu batang. Delapan bin tetap; tidak ada pengaturan bin manual.
- **Label histogram:** presisi awal dihitung dari rasio nilai absolut maksimum terhadap jarak batas minimum, lalu dinaikkan sampai semua label unik. Nilai dengan absolut minimal `1e15` atau kurang dari `1e-6` memakai notasi ilmiah.
- **Grafik kategori:** nilai kosong dikeluarkan; maksimal delapan kategori teratas ditampilkan.
- **Ekspor:** selalu memakai koma sebagai delimiter, termasuk ketika file sumber memakai titik koma atau tab.
- **Formula injection:** apostrof ditambahkan pada nilai teks berisiko. Ini mengubah isi sel teks tersebut dan merupakan trade-off keamanan yang disengaja, bukan jaminan penuh.

## Pengujian

### Lingkungan pengujian

| Alat | Versi/keterangan |
| --- | --- |
| Google Chrome | 155.0.8059.85, headless, Chrome DevTools Protocol |
| Node.js | 24.21.0 |
| Python | 3.14.8, static HTTP server |
| Viewport browser | 1440 × 1100 dan 390 × 844 (DPR 2) |
| Waktu run terbaru | 2026-10-23 |

Pengujian unit berada di folder `tests/` dan tidak memerlukan dependency npm. Harness browser berada di folder sementara di luar repository karena memerlukan Chrome DevTools Protocol, static HTTP server, dan fixture; harness tersebut bukan dependency aplikasi.

### Perintah pengujian unit

Dari folder proyek:

```powershell
cd D:\Github\vibecoding-journey\proyek-13-datalens-csv-analyzer
node --test tests/csv-parser.test.mjs tests/data-analyzer.test.mjs tests/data-table.test.mjs tests/csv-exporter.test.mjs
```

### Hasil run terbaru

Angka berikut adalah hasil eksekusi ulang terbaru, bukan hanya angka historis:

| Suite | Jumlah | Hasil terbaru |
| --- | ---: | --- |
| Unit test `node:test` | 41 | **41/41 lolos, 0 gagal** |
| Harness browser lama | 132 | **132/132 lolos, 0 gagal** |
| Regresi browser pasca-audit | 34 | **34/34 lolos, 0 gagal** |

Rincian unit test:

| File | Jumlah | Hasil |
| --- | ---: | --- |
| `tests/csv-parser.test.mjs` | 19 | 19/19 lolos |
| `tests/data-analyzer.test.mjs` | 12 | 12/12 lolos |
| `tests/data-table.test.mjs` | 5 | 5/5 lolos |
| `tests/csv-exporter.test.mjs` | 5 | 5/5 lolos |

Harness lama tetap mencakup pemeriksaan modul parser/analisis/ekspor serta UI dan integrasi browser. Hasil 132/132 tersebut adalah run ulang pada 2026-10-23 setelah perbaikan, bukan hasil historis sebelum perbaikan.

Rincian regresi browser baru (34 pemeriksaan):

| Kelompok | Jumlah | Hasil |
| --- | ---: | --- |
| Kondisi awal dan L-3 | 6 | Lolos |
| H-1 dan L-4 | 7 | Lolos |
| M-1 dan M-2 | 3 | Lolos |
| M-4 dan L-2 | 5 | Lolos |
| L-5 | 5 | Lolos |
| Impor mendekati 10 MiB | 3 | Lolos |
| Console dan network | 5 | Lolos |

### Perintah harness browser sementara

Harness browser tidak disertakan ke repository. Pada mesin pengujian, aplikasi disajikan melalui `127.0.0.1:8765` dan Chrome headless membuka port CDP `9223`. Setelah kedua layanan aktif:

```powershell
node C:\Users\Acer\AppData\Local\Temp\datalens-test\run-tests.mjs
node C:\Users\Acer\AppData\Local\Temp\datalens-test\regression-pasca-audit.mjs
```

Jalur di atas adalah jalur aktual pada mesin pengujian dan tidak portabel. Perintah unit di dalam repository dapat dijalankan ulang tanpa harness tersebut.

### Skenario regresi utama

- **H-1:** `"x"y`, `"a"b"c"`, dan header dengan karakter setelah kutip ditolak; error menyebut baris/kolom. Field berpetik valid dengan delimiter, escaped quote, line break, spasi, dan tab tetap diterima.
- **M-1:** nilai `10`, `2a`, `1e2`, dan sel kosong menghasilkan urutan naik `10, 1e2, 2a, kosong` serta turun `2a, 1e2, 10, kosong`. Properti antisimetri dan transitivity diuji pada campuran angka, teks, dan kosong.
- **M-2:** record `,,` sebelum header, di tengah, dan di akhir dilewati; field kosong berpetik dilewati; field sebagian kosong dipertahankan; file tanpa data valid ditolak.
- **M-3:** `a,a`, `a,a,a (2)`, `a,a (2),a,a (3)`, header kosong, dan spasi/duplikat menghasilkan nama akhir yang semuanya unik beserta warning.
- **M-4:** data `0, 0.01, 0.02, 0.03, 0.04, 0.05` menghasilkan delapan label unik dari `0–0,00625` sampai `0,04375–0,05`, delapan batas yang benar, dan total observasi 6. Ringkasan aksesibel memuat label yang sama.
- **L-1:** prefiks U+0000, U+0001, U+001F, U+200B, BOM, whitespace, dan C1 sebelum karakter formula diberi apostrof pada CSV mentah. `-5`, `-1.2`, dan `-1e3` tidak berubah.
- **L-2:** `[-1e308, 1e308]`, `[1e308, 1e308]`, campuran nilai besar, data konstan, dan seluruh nilai nol menghasilkan statistik/histogram finite, jumlah observasi tetap, serta label tanpa `NaN`, `Infinity`, atau `—`.
- **L-3:** input `name,id;note,ok` / `A,1;B,2` / `C,3;D,4` memicu warning ambigu pada mode otomatis. Dengan pilihan titik koma dan **Terapkan ulang**, hasilnya tepat dua kolom: `name,id | note,ok` dan baris `A,1 | B,2`.
- **L-4:** warning header duplikat tetap terlihat saat impor file invalid berikutnya gagal; dataset lama tetap aktif. Impor file valid berikutnya menghapus warning lama.
- **L-5:** setelah pencarian dan debounce selesai, pindah ke halaman kedua lalu ekspor: halaman tetap di halaman kedua dan `applyQuery` tidak dipanggil ulang. Saat debounce masih tertunda, ekspor memakai query terbaru, `applyQuery` dipanggil tepat satu kali, dan cakupan ekspor berubah menjadi 12 dari 25 baris.

### Hasil impor mendekati 10 MiB

Impor browser terakhir memakai file yang dibuat di memori dan diimpor melalui file input:

| Metrik | Hasil aktual |
| --- | --- |
| Ukuran file | **10.171.147 byte (9,70 MiB)**, di bawah batas 10 MiB |
| Jumlah baris data | **136.308** |
| Jumlah kolom | 5 |
| Kolom numerik | 2 |
| Baris tabel pada halaman pertama | 10 |
| Batang grafik | 8 |
| Warning/error | Tidak ada |
| Waktu terukur | **sekitar 479 ms** termasuk polling dan jeda pengukuran 100 ms |
| Viewport | Desktop Chrome headless 1440 × 1100 |

Waktu tersebut adalah pengukuran satu kali di browser headless desktop, bukan benchmark statistik. Performa di ponsel, tablet, atau browser lain belum divalidasi.

### Console dan network

Pada run browser baru: **0 console error**, **0 uncaught exception**, **0 log error browser**, **0 resource gagal**, dan **0 respons HTTP 4xx/5xx**. Run harness lama yang juga lulus 132/132 mencakup pemeriksaan console dan resource dengan hasil bersih.

### Contoh file hasil unduhan yang diperiksa

```text
sample-data-filter-6baris-2026-10-23.csv
formula-semua-6baris-2026-10-23.csv
search-page-filter-12baris-2026-10-23.csv
search-page-filter-25baris-2026-10-23.csv
```

### Pengujian yang belum dilakukan

- Pengujian dengan screen reader sungguhan seperti NVDA, JAWS, VoiceOver, atau TalkBack. Pemeriksaan aksesibilitas dilakukan melalui DOM, accessibility tree Chrome, dan keyboard.
- Pengujian di perangkat fisik. Tampilan mobile diuji melalui emulasi viewport Chrome, bukan ponsel/tablet nyata.
- Pengujian impor mendekati 10 MiB di perangkat mobile atau browser selain Chrome.
- Pengujian lintas browser di Firefox, Safari, dan Edge.
- Drag-and-drop dari file manager sistem operasi. Drag-and-drop diuji dengan event sintetis di browser.
- Membuka file hasil ekspor di Microsoft Excel, LibreOffice Calc, atau Google Sheets. Isi CSV diperiksa sebagai string mentah dan dengan parser, bukan dengan aplikasi spreadsheet.
- Audit aksesibilitas otomatis dengan alat seperti axe atau Lighthouse.
- Pengujian encoding selain UTF-8. File non-UTF-8 sengaja ditolak.
- Pengujian beban berulang atau benchmark performa multi-run.

## Batasan yang Diketahui

- Ukuran file maksimum 10 MiB (10.485.760 byte). Seluruh dataset disimpan di memori tab dan hilang saat halaman dimuat ulang.
- Hanya file teks UTF-8. Encoding lama seperti Windows-1252 tidak dideteksi otomatis.
- Hanya delimiter koma, titik koma, dan tab yang didukung.
- Deteksi delimiter otomatis bersifat heuristik. File ambigu dapat memerlukan pemilihan manual dan **Terapkan ulang**.
- Spasi/tab setelah kutip penutup diabaikan. Karakter non-whitespace setelah kutip penutup membuat impor gagal; parser tidak mencoba memperbaiki input rusak.
- Record dengan seluruh field kosong selalu dilewati. Baris seperti itu tidak dapat dipertahankan sebagai data.
- Baris dengan jumlah kolom tidak konsisten ditolak, bukan diperbaiki otomatis.
- Header kosong dan duplikat dinormalisasi; nama header asli dapat berubah.
- Deteksi kolom numerik memakai ambang 60%, sehingga kolom dengan banyak teks tetap dapat dianggap numerik jika nilai angkanya dominan.
- Angka dengan pemisah desimal koma tidak dikenali sebagai angka.
- Histogram memakai delapan kelompok tetap; tidak ada pengaturan bin manual.
- Label histogram dibulatkan untuk tampilan. Batas internal tetap dipakai untuk perhitungan, tetapi label yang tampak tidak selalu identik dengan nilai floating-point mentah.
- Jumlah internal dapat menjadi `null` jika hasil penjumlahan benar-benar di luar rentang `Number`, meskipun rata-rata dan median masih finite. Jumlah tidak ditampilkan di antarmuka.
- Grafik kategori hanya menampilkan delapan kategori teratas.
- Pencarian bersifat substring global, bukan filter per kolom atau query kompleks.
- Ekspor selalu memakai delimiter koma dan mengikuti pencarian serta urutan tabel aktif; tidak ada pilihan delimiter ekspor.
- Mitigasi formula bersifat best-effort. Aplikasi spreadsheet dapat memperlakukan prefiks, karakter kontrol, atau zero-width secara berbeda.
- Tidak ada penyimpanan preferensi, riwayat impor, atau dataset otomatis.
- Tabel membatasi tinggi area scroll agar halaman tetap nyaman; data lengkap tetap dapat diakses melalui pagination dan ekspor.

## Privasi dan Pengolahan Data Lokal

- File CSV dibaca dengan File API dan diproses sepenuhnya di browser.
- Tidak ada unggahan file, backend, database, API eksternal, analytics, atau telemetri.
- Tidak ada CDN, font eksternal, atau aset jaringan. Favicon dan data contoh disajikan dari origin yang sama.
- Dataset tidak disimpan ke `localStorage`, `sessionStorage`, atau IndexedDB. Data hanya berada di memori tab dan hilang saat halaman ditutup atau dimuat ulang.
- File contoh diambil dari `data/sample-data.csv` pada server lokal yang sama.
- Isi CSV tidak pernah dieksekusi sebagai kode. Nilai sel dirender sebagai teks.
- Ekspor dibuat di browser dengan Blob dan object URL, lalu object URL dibersihkan setelah unduhan dimulai.
- Content Security Policy membatasi script dan style ke origin sendiri serta memblokir koneksi eksternal.
- Validasi ukuran, tipe MIME, dan isi teks dilakukan sebelum parsing. Ekstensi file saja tidak dijadikan dasar kepercayaan.
- Pesan error tidak menampilkan markup dari isi file dan tidak menjalankan konten pengguna.

## Keamanan Ekspor dan Formula Injection

Spreadsheet dapat menafsirkan sel yang diawali `=`, `+`, `-`, atau `@` sebagai formula. Untuk mengurangi risiko tersebut, eksportir memeriksa prefiks setelah mengabaikan whitespace, karakter kontrol, BOM, dan karakter format/zero-width. Nilai teks berisiko diberi apostrof, termasuk header. Contoh:

```csv
'=1+1
'+SUM(A1:A2)
'-2+3
'@cmd
```

Karakter tak terlihat tidak dihapus atau dinormalisasi; apostrof ditambahkan sebelum prefiks asli. Angka negatif yang valid seperti `-5`, `-1.2`, dan `-1e3` tidak diberi apostrof agar tetap dapat diperlakukan sebagai angka.

Konsekuensinya, nilai teks berisiko akan terlihat dengan apostrof di awal saat dibuka di aplikasi lain. Ini adalah trade-off keamanan yang didokumentasikan. Mitigasi ini **best-effort**, bukan jaminan bahwa semua aplikasi spreadsheet akan memperlakukan sel dengan cara yang sama. Jangan membuka CSV tidak tepercaya tanpa pertimbangan keamanan.

## Catatan Git

Folder ini berisi kode sumber, aset, dokumentasi, dan pengujian untuk Proyek 13 dalam repository vibecoding-journey. Perubahan proyek dikelola melalui riwayat Git repository. Untuk gambaran keseluruhan proyek dan panduan repository, lihat README root.
