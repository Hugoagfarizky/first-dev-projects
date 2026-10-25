# Proyek 14 — Flowboard: Kanban Task Manager

Flowboard adalah aplikasi web Kanban untuk mengelola tugas pada empat kolom status: **To Do**, **In Progress**, **Review**, dan **Done**. Pengguna dapat membuat, mengedit, menghapus, memindahkan, mengurutkan, mencari, memfilter, serta mengekspor dan mengimpor papan.

Seluruh data disimpan di `localStorage` browser. Tidak ada backend, database, analytics, unggahan data, CDN, font eksternal, atau layanan eksternal.

## Tujuan Pembelajaran

- Memisahkan model domain, validasi, riwayat, persistensi, impor/ekspor, rendering, dan orkestrasi UI ke modul ES yang dapat diuji.
- Menerapkan HTML Drag and Drop beserta alternatif status yang dapat dioperasikan dengan keyboard dan layar sentuh.
- Mengelola state papan secara immutable agar undo/redo, filter, dan penyimpanan tetap konsisten.
- Memvalidasi data lokal dan data impor sebelum dipakai atau mengganti papan aktif.
- Menampilkan konten tidak tepercaya sebagai teks, tanpa mengeksekusi HTML atau JSON sebagai kode.
- Menguji logika domain secara deterministik dengan `node:test` tanpa dependency npm.

## Fitur

### Papan Kanban

- Empat kolom tetap dengan urutan To Do, In Progress, Review, dan Done.
- Jumlah tugas per kolom dan empty state yang berbeda untuk papan kosong serta hasil filter kosong.
- Kartu menampilkan judul, ringkasan deskripsi, prioritas, tenggat, tag, dan penanda **Terlambat**.
- Detail tugas dibuka dalam dialog sehingga konteks papan tetap terlihat di belakangnya.

### Pengelolaan Tugas

- Membuat tugas dari tombol utama atau tombol `+` pada kolom tertentu.
- Mengedit judul, deskripsi, tag, prioritas, status, dan tenggat.
- Menghapus tugas melalui dialog konfirmasi yang menyebut judul tugas.
- Prioritas **Low**, **Medium**, dan **High**.
- Tag dipisahkan dengan koma, dinormalkan, dan dideduplikasi tanpa membedakan huruf besar/kecil.
- ID menggunakan `crypto.randomUUID()` bila tersedia, dengan fallback acak dari Web Crypto. Judul tidak pernah dipakai sebagai ID.
- Tenggat memakai format `YYYY-MM-DD`. Tugas dianggap terlambat bila tanggal tenggat sudah lewat dan statusnya bukan Done.

### Drag and Drop

- Memindahkan kartu antarkolom.
- Mengurutkan ulang kartu di dalam kolom.
- Marker garis dan highlight kolom saat dragover.
- Satu operasi drop menghasilkan satu perubahan state, satu entri riwayat, dan satu penyimpanan.
- Listener dipasang sekali pada kontainer papan melalui event delegation, bukan dipasang ulang setiap render.
- Drag dinonaktifkan saat filter aktif untuk menghindari urutan hasil filter yang ambigu.
- Saat filter aktif, kartu memakai `draggable="false"`, cursor normal (bukan `grab`), dan drag handle tidak lagi menonjol. Setelah filter direset, kartu kembali `draggable` dengan cursor `grab`.
- Alternatif drag: kontrol `<select>` status native pada setiap kartu, yang dapat dipakai dengan keyboard dan layar sentuh.
- Tugas baru dan perpindahan status menempatkan kartu di bagian atas kolom tujuan.

### Pencarian dan Filter

- Pencarian pada judul, deskripsi, dan tag.
- Filter prioritas Low/Medium/High.
- Filter tenggat: semua, terlambat, atau tanpa tenggat.
- Tombol reset filter.
- Jumlah hasil aktif, jumlah per kolom, total tugas, dan total terlambat.
- Catatan bahwa papan sedang menampilkan hasil filter dan drag dinonaktifkan.
- Filter hanya membentuk tampilan turunan; data sumber tidak diubah atau dihapus.
- Tugas yang diedit saat filter aktif tetap diedit pada data sumber dan dapat hilang dari hasil bila sudah tidak cocok dengan filter.

### Undo dan Redo

Tersedia untuk pembuatan, pengeditan, penghapusan, perpindahan status, pengurutan, dan penggantian papan melalui impor.

- Menyimpan snapshot state papan, bukan sekadar membalik satu field.
- Batas riwayat: **50 aksi**.
- Tombol dinonaktifkan saat tidak ada aksi yang dapat dibatalkan atau diulang.
- Undo/redo tidak menambahkan entri riwayat baru.
- Aksi baru setelah undo menghapus cabang redo.
- Perubahan hasil undo/redo disimpan ke storage bila storage masih dapat ditulis.
- Bila penyimpanan gagal, UI tidak mengklaim data tersimpan.
- Shortcut: `Ctrl+Z` untuk undo dan `Ctrl+Shift+Z` atau `Ctrl+Y` untuk redo saat fokus tidak berada pada kontrol formulir.
- Riwayat hanya berada di memori tab aktif dan **tidak ditulis ke `localStorage`**. Riwayat hilang saat halaman dimuat ulang atau tab ditutup. Data tugas yang berhasil disimpan tetap dimuat kembali, tetapi riwayat operasi sebelumnya tidak ikut dipulihkan.

### Persistensi Lokal

- Kunci `localStorage`: `flowboard.board`.
- Skema data berversi dengan `schemaVersion: 1`.
- Data divalidasi ketika dibaca, bukan hanya ketika ditulis.
- Nilai masuk dinormalisasi menjadi bentuk kanonik sebelum dipakai: ID dan teks di-trim, prioritas/status menjadi enum huruf kecil, tanggal di-trim, serta tag di-trim dan dideduplikasi tanpa membedakan huruf besar/kecil.
- Schema 1 mewajibkan seluruh field tugas: `id`, `title`, `description`, `tags`, `priority`, `status`, `dueDate`, `createdAt`, dan `updatedAt`. Field wajib yang hilang tidak diisi diam-diam dari default normalizer.
- Root payload schema 1 memakai allowlist `app`, `schemaVersion`, `savedAt`, dan `board`. Field asing pada root maupun tugas ditolak dengan pesan yang menyebut field tersebut.
- ID dicek unik setelah trim. Dua ID yang bertabrakan setelah normalisasi menyebabkan seluruh payload ditolak, bukan menimpa salah satu tugas.
- JSON rusak, papan tidak valid, field asing, dan versi skema tidak dikenal dilaporkan tanpa menghapus data lama.
- Bila data lama tidak dapat dibaca atau dimigrasikan dengan aman, aplikasi tetap dapat dipakai di memori, tetapi penulisan storage diblokir agar sumber lama tidak tertimpa.
- Kegagalan akses, penulisan, atau verifikasi tulis ditampilkan sebagai status error.
- Status "Tersimpan" hanya muncul setelah `setItem` berhasil dan isi yang dibaca kembali sama dengan payload yang ditulis.
- Aksi yang gagal disimpan boleh tetap berlaku di memori, tetapi UI menampilkan satu pesan yang menyatakan perubahan **belum tersimpan** dan mempertahankan peringatan itu di live region.

### Ekspor dan Impor JSON

- Ekspor seluruh papan, bukan hanya hasil filter, melalui unduhan file JSON.
- Nama file: `flowboard-YYYY-MM-DD.json`.
- Impor melalui file picker dengan batas **1 MiB (1.048.576 byte)**.
- Root impor memakai allowlist `app`, `schemaVersion`, `exportedAt`, dan `board`. Field asing pada root maupun pada setiap tugas ditolak dengan error yang menyebut nama field.
- Setiap tugas schema 1 wajib memiliki seluruh field model. Nilai yang masuk dinormalisasi ke bentuk kanonik sebelum divalidasi ulang terhadap tipe, panjang, status, prioritas, tanggal, dan timestamp.
- ID dicek unik setelah trim; tabrakan ID menolak seluruh payload.
- Validasi sebelum penggantian papan: JSON, aplikasi, versi skema, empat kolom, field wajib, field asing, tipe field, batas panjang, status, prioritas, tanggal, ID unik, kecocokan status dengan kolom, dan maksimum 500 tugas.
- Impor bersifat transaksional: payload divalidasi seluruhnya lebih dahulu, lalu konfirmasi penggantian papan ditampilkan.
- File invalid tidak mengubah papan aktif dan tidak menulis storage.
- Impor yang berhasil menjadi satu aksi riwayat yang dapat di-undo.
- Jika papan berhasil diterapkan di memori tetapi penulisan storage gagal, impor tidak dilaporkan sebagai sukses penuh. Satu pesan menampilkan “Papan diimpor ke memori, tetapi belum tersimpan.” beserta alasan persistensi.
- Ekspor → impor → ekspor mempertahankan seluruh field sah yang menjadi bagian schema; metadata asing tidak pernah dipertahankan atau diekspor kembali.
- JSON hanya diproses dengan `JSON.parse`; tidak dieksekusi sebagai kode.

### Pengalaman Pengguna dan Aksesibilitas

- Layout responsif: empat kolom pada desktop, dua kolom pada lebar menengah, dan satu kolom pada mobile.
- Hierarki heading `h1` → `h2` kolom → `h3` kartu.
- Label form eksplisit, pesan error form, penanda `aria-invalid`, dan fokus otomatis ke field yang gagal divalidasi.
- Fokus keyboard dipulihkan berdasarkan identitas tugas dan jenis kontrol setelah render ulang: kontrol status setelah perpindahan status, tombol Edit setelah simpan, kartu berikutnya/sebelumnya atau Undo setelah hapus, serta tombol Tambah tugas bila papan menjadi kosong.
- Fokus tidak dikembalikan ke elemen yang sudah dihapus dan tidak diambil alih saat dialog masih terbuka. Jika target hasil edit tidak lagi terlihat karena filter, fokus berpindah ke tombol Reset filter, bukan ke kartu tersembunyi.
- Dialog memakai elemen `<dialog>` native dengan `aria-labelledby`.
- Judul dialog, nama file impor, deskripsi, dan tag panjang dibungkus dengan `overflow-wrap: anywhere`; dialog tetap dapat digulir vertikal dan tidak memiliki overflow horizontal internal pada viewport 390×844.
- Live region untuk status dan alert untuk error. Hanya satu toast yang terlihat pada satu waktu agar pesan sukses dan peringatan persistensi tidak saling menimpa.
- Status penyimpanan dan status riwayat selalu terlihat.
- Fokus keyboard terlihat dengan `:focus-visible`. Placeholder dan teks “Tanpa tenggat” memakai warna dengan rasio kontras 4,98:1 terhadap putih; focus ring `#0a5c57` memiliki rasio 7,83:1 terhadap putih.
- Dukungan `prefers-reduced-motion`.
- Tidak memakai hover sebagai satu-satunya cara mengakses tindakan.
- Tidak ada overflow horizontal pada viewport yang diuji.

## Teknologi dan Batasan

- HTML5.
- CSS3.
- Vanilla JavaScript dengan ES Modules.
- Web Storage API.
- HTML Drag and Drop API.
- `node:test` untuk pengujian domain.
- File API, Blob API, dan `URL.createObjectURL` untuk impor/ekspor.
- Tidak ada framework, library, dependency npm, backend, database, CDN, font eksternal, analytics, atau request jaringan dari aplikasi.

Aplikasi membutuhkan browser modern yang mendukung ES Modules, `<dialog>`, dan `crypto.randomUUID` (dengan fallback Web Crypto). Pengujian browser dilakukan pada Chrome 155.

## Persyaratan

- Browser modern.
- Python 3 atau static HTTP server lain untuk menjalankan aplikasi.
- Node.js 24 untuk menjalankan pengujian unit. Pengujian aktual memakai Node.js `v24.21.0`.
- Tidak perlu `npm install`.

## Menjalankan Aplikasi

Dari root repository:

```powershell
python -m http.server 8000
```

Buka:

```text
http://localhost:8000/proyek-14-flowboard-kanban/
```

ES Modules tidak dijalankan melalui `file://`; gunakan static HTTP server lokal.

## Panduan Penggunaan

1. Klik **Tambah tugas** atau tombol `+` pada kolom untuk membuat tugas.
2. Isi judul wajib, lalu tambahkan deskripsi, tag, prioritas, status, dan tenggat bila diperlukan.
3. Gunakan **Detail** untuk melihat seluruh isi tugas tanpa meninggalkan papan.
4. Gunakan **Edit** atau **Hapus** pada kartu. Penghapusan selalu meminta konfirmasi.
5. Pindahkan kartu dengan drag, atau gunakan menu status pada kartu untuk keyboard dan layar sentuh.
6. Urutkan kartu dengan menariknya ke posisi baru di dalam kolom.
7. Gunakan pencarian, filter prioritas, dan filter tenggat. Tekan **Reset filter** untuk kembali ke seluruh papan.
8. Gunakan **Undo** dan **Redo** bila perlu. Riwayat dibatasi 50 aksi.
9. Gunakan **Ekspor JSON** untuk membuat cadangan seluruh papan.
10. Gunakan **Impor JSON** untuk mengganti papan setelah file divalidasi dan penggantian dikonfirmasi.

## Batas Data

| Data | Batas |
| --- | --- |
| Jumlah tugas | 500 |
| Judul | 120 karakter, wajib, tidak boleh hanya whitespace |
| Deskripsi | 2.000 karakter |
| Tag per tugas | 8 |
| Panjang satu tag | 32 karakter |
| ID tugas | 1–64 karakter `A-Z`, `a-z`, `0-9`, `_`, `-`; diawali huruf atau angka |
| Tenggat | `YYYY-MM-DD`, tanggal kalender valid, tahun 1900–9999 |
| Riwayat | 50 aksi |
| Ukuran file impor | 1 MiB (1.048.576 byte) |

Judul dan deskripsi di-trim. Tag kosong diabaikan dan duplikat tag tanpa membedakan huruf besar/kecil dibuang.

## Struktur Folder

```text
proyek-14-flowboard-kanban/
├── README.md
├── index.html
├── style.css
├── assets/
│   └── icon.svg
├── js/
│   ├── app.js
│   ├── board.js
│   ├── history.js
│   ├── import-export.js
│   ├── storage.js
│   ├── task-model.js
│   └── ui.js
└── tests/
    ├── board.test.mjs
    ├── history.test.mjs
    ├── import-export.test.mjs
    ├── storage.test.mjs
    └── task-model.test.mjs
```

### Tanggung Jawab Modul

| Modul | Tanggung jawab |
| --- | --- |
| `js/task-model.js` | Batas data, validasi, normalisasi, pembuatan/pengeditan tugas, status overdue |
| `js/board.js` | Empat kolom, CRUD, pemindahan, pengurutan, filter, validasi papan |
| `js/history.js` | Snapshot undo/redo dengan batas ukuran |
| `js/storage.js` | Serialisasi berversi, migrasi, pembacaan aman, penulisan dan verifikasi tulis |
| `js/import-export.js` | Format ekspor, validasi impor transaksional, batas ukuran |
| `js/ui.js` | Rendering kartu/papan dengan DOM API aman, dialog, format tanggal, status UI |
| `js/app.js` | Orkestrasi state, event delegation, drag/drop, filter, persistensi, impor/ekspor, shortcut |

`ui.js` dan `tests/history.test.mjs` ditambahkan karena rendering DOM dan riwayat memiliki tanggung jawab yang cukup berbeda untuk dipisahkan.

## Model Data

Sebuah tugas disimpan dengan bentuk:

```json
{
  "id": "6f1c2f7e-3b0d-4b0f-a4e0-1a7f2f4ae1f0",
  "title": "Riset pengguna",
  "description": "Wawancara dan sintesis temuan.",
  "tags": ["riset", "UX"],
  "priority": "high",
  "status": "todo",
  "dueDate": "2026-10-30",
  "createdAt": "2026-10-23T10:00:00.000Z",
  "updatedAt": "2026-10-23T10:00:00.000Z"
}
```

- `priority`: `low`, `medium`, atau `high`.
- `status`: `todo`, `in-progress`, `review`, atau `done`.
- `dueDate`: `YYYY-MM-DD` atau `null`.
- `createdAt` dan `updatedAt`: timestamp ISO 8601.
- Urutan kartu ditentukan oleh posisi di larik kolom, bukan oleh judul.
- Pada schema 1, seluruh sembilan field di atas wajib ada. `description`, `tags`, dan `dueDate` boleh bernilai kosong/`null`, tetapi field-nya tidak boleh hilang dari payload.
- Nilai masuk dibaca sebagai data kanonik: `priority` dan `status` dinormalisasi ke enum huruf kecil, teks di-trim, tanggal di-trim, serta tag di-trim dan dideduplikasi tanpa membedakan kapitalisasi.

## Skema Penyimpanan dan Migrasi

Payload yang ditulis ke `localStorage`:

```json
{
  "app": "flowboard",
  "schemaVersion": 1,
  "savedAt": "2026-10-23T10:00:00.000Z",
  "board": {
    "columns": {
      "todo": [],
      "in-progress": [],
      "review": [],
      "done": []
    }
  }
}
```

Kebijakan versi:

- **Versi 1** adalah skema aktif dan divalidasi penuh saat dibaca. Root memakai allowlist `app`, `schemaVersion`, `savedAt`, dan `board`; field asing ditolak. Seluruh field tugas wajib ada dan nilai mentah dikembalikan sebagai data kanonik.
- **Versi 0** dikenali sebagai skema lama dengan larik `tasks`. Root hanya menerima `schemaVersion` dan `tasks`.
- Migrasi versi 0 memetakan field legacy secara eksplisit ke bentuk kanonik: `id`, `title`, `description`, `tags`, `priority`, `status`, `dueDate`, `createdAt`, dan `updatedAt`. Field opsional yang tidak ada memakai default yang didokumentasikan (`priority: medium`, `status: todo`, deskripsi kosong, tag kosong, tenggat `null`, serta timestamp waktu migrasi). Field asing pada root atau tugas lama ditolak; metadata asing tidak dipertahankan.
- ID hasil migrasi dicek unik setelah trim. Tabrakan ID menggagalkan seluruh migrasi.
- **Versi lain, JSON rusak, field asing, atau data yang gagal dimigrasikan** menghasilkan status error. Aplikasi memakai papan kosong di memori, memblokir penulisan storage, dan **tidak menghapus atau menimpa** data lama.
- Migrasi versi 0 yang berhasil akan disimpan kembali sebagai versi 1 bila storage dapat ditulis.
- Tidak ada penghapusan otomatis data lama.

## Undo dan Redo

Riwayat menyimpan snapshot papan pada setiap aksi yang mengubah state. Implementasi:

- Kapasitas maksimum 50 aksi; snapshot paling lama dibuang saat batas terlampaui.
- Snapshot awal bukan aksi, sehingga tombol undo/redo mulai nonaktif.
- Undo memindahkan indeks ke snapshot sebelumnya; redo memindahkan indeks ke snapshot berikutnya.
- Undo/redo tidak memanggil `record`, sehingga tidak membuat entri baru.
- Aksi baru setelah undo memotong snapshot redo.
- Setiap undo/redo dirender ulang dan dicoba disimpan. Kegagalan simpan tidak dilaporkan sebagai sukses.
- Impor papan yang berhasil dicatat sebagai satu aksi.
- Riwayat hanya berada di memori tab aktif. Riwayat **tidak disimpan ke `localStorage`**, sehingga hilang saat halaman dimuat ulang atau tab ditutup. Data tugas yang berhasil disimpan tetap dimuat kembali, tetapi riwayat operasi sebelumnya tidak dipulihkan.

## Perilaku Filter dan Drag

- Filter diterapkan pada salinan tampilan; papan sumber tetap utuh.
- Saat filter aktif, kartu dibuat tidak `draggable` dan catatan filter tampil.
- Menu status tetap aktif saat filter aktif agar pengguna tetap dapat memindahkan tugas.
- Setelah filter direset, urutan asli kolom kembali tampil.
- Drag hanya diizinkan pada tampilan tanpa filter, sehingga indeks drop selalu dapat dipetakan ke urutan sumber secara tidak ambigu.

## Format Ekspor dan Impor

File ekspor:

```json
{
  "app": "flowboard",
  "schemaVersion": 1,
  "exportedAt": "2026-10-23T10:00:00.000Z",
  "board": {
    "columns": {
      "todo": [],
      "in-progress": [],
      "review": [],
      "done": []
    }
  }
}
```

Aturan impor:

1. File harus berupa teks JSON dan tidak melebihi 1 MiB.
2. Root harus berupa objek dengan allowlist `app`, `schemaVersion`, `exportedAt`, dan `board`. Field asing pada root ditolak.
3. `schemaVersion` harus `1`.
4. `app` boleh tidak ada, tetapi bila ada harus `flowboard`.
5. `board.columns` harus memiliki tepat empat kolom yang dikenal.
6. Setiap tugas hanya boleh memiliki field `id`, `title`, `description`, `tags`, `priority`, `status`, `dueDate`, `createdAt`, dan `updatedAt`. Field asing pada tugas ditolak.
7. Seluruh field tugas wajib ada. Field yang hilang tidak diisi diam-diam oleh default normalizer.
8. Nilai masuk dinormalisasi lebih dahulu: ID/teks/tanggal di-trim, prioritas dan status menjadi enum huruf kecil, serta tag di-trim dan dideduplikasi tanpa membedakan kapitalisasi.
9. Setelah normalisasi, nilai harus lolos validasi tipe, panjang, prioritas, status, tanggal, timestamp, dan pola ID.
10. ID harus unik di seluruh papan setelah trim. Tabrakan ID menolak seluruh payload.
11. `task.status` harus sama dengan nama kolom tempat tugas berada.
12. Total tugas maksimal 500.
13. Setelah valid, pengguna melihat konfirmasi yang menjelaskan bahwa seluruh papan akan diganti.
14. Papan aktif baru diganti setelah konfirmasi. File invalid tidak menyentuh papan aktif atau storage.
15. Impor yang valid menghasilkan data kanonik. Ekspor ulang mempertahankan seluruh field sah dan tidak menambahkan metadata asing.

## Keamanan

- Tidak ada `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write`, atau request jaringan di kode aplikasi.
- Judul, deskripsi, tag, nama file, dan isi JSON dirender melalui `textContent` dan pembuatan elemen DOM.
- ID tugas divalidasi dengan pola aman sebelum dipakai pada atribut `id` dan `data-*`.
- CSP di `index.html` membatasi script, style, dan gambar ke origin sendiri serta memblokir koneksi keluar, objek, dan form action.
- Impor tidak pernah menjalankan JSON sebagai kode.
- Validasi impor dilakukan menyeluruh sebelum papan diganti.
- Storage yang rusak atau tidak didukung tidak ditimpa.
- Kesalahan penyimpanan tidak ditampilkan sebagai keberhasilan.

## Privasi

- Data hanya disimpan di `localStorage` browser pada origin tempat aplikasi dijalankan.
- Tidak ada data yang dikirim ke server atau layanan pihak ketiga.
- Tidak ada analytics, cookie pihak ketiga, atau font/gambar eksternal.
- Menghapus data situs pada browser juga menghapus papan.
- File ekspor dibuat di browser dan diunduh langsung; file tidak diunggah ke mana pun.

## Pengujian

### Pengujian Unit

Perintah dari folder proyek:

```powershell
node --test tests/task-model.test.mjs tests/board.test.mjs tests/history.test.mjs tests/storage.test.mjs tests/import-export.test.mjs
```

Hasil aktual pada Node.js `v24.21.0`:

```text
tests 79
pass 79
fail 0
```

Cakupan pengujian unit:

- Pembuatan, pengeditan, penghapusan, pemindahan, dan pengurutan tugas.
- Validasi judul, deskripsi, tag, tanggal, ID, status, prioritas, timestamp, dan tipe data.
- Tugas dengan judul sama tetapi ID berbeda.
- Konsistensi setelah beberapa operasi berurutan.
- Filter pencarian, prioritas, dan tenggat tanpa mengubah data sumber.
- Undo/redo untuk pembuatan, pengeditan, penghapusan, perpindahan status, dan pengurutan ulang, termasuk batas riwayat, percabangan redo, dan state tanpa perubahan.
- Persistensi, pemulihan, migrasi versi 0, JSON rusak, schema tidak dikenal, get/set storage gagal, dan verifikasi tulis.
- Ekspor mentah, round-trip impor, ID duplikat, jumlah tugas berlebih, field invalid, batas ukuran, dan teks HTML sebagai teks biasa.
- Papan dengan status yang tidak cocok dengan kolom, kolom ekstra, dan jumlah tugas di atas batas.
- Kanonikalisasi schema 1 dan impor: ID bertabrakan setelah trim, prioritas `HIGH`, tenggat ` 2026-10-30 `, tag berpadding/duplikat, serta tanggal `2026-10-30` tidak dianggap terlambat pada `2026-10-26`.
- Setiap field tugas wajib yang hilang satu per satu, baik pada schema 1 storage maupun impor.
- Pelanggaran panjang setelah trim untuk judul, deskripsi, dan tag.
- Penolakan field asing pada root papan, root storage, root impor, task papan, task storage, task impor, dan task legacy.
- Migrasi schema 0 yang sah, ID bertabrakan setelah trim, judul terlalu panjang setelah trim, field asing, dan data yang tidak dapat dimigrasikan tanpa menimpa payload lama.
- Ekspor → impor → ekspor mempertahankan seluruh field sah dan tidak menambahkan metadata asing.

### Pengujian Browser

Lingkungan aktual:

- Google Chrome `155.0.8059.85`, mode headless.
- Static server lokal Python pada `127.0.0.1`.
- Windows, viewport desktop **1440×1100** DPR 1 dan mobile **390×844** DPR 2.
- Otomasi melalui Chrome DevTools Protocol dengan harness sementara di luar repository.

Hasil aktual:

Harness browser dasar:

```text
total  63
passed 63
failed 0
console errors 0
uncaught exceptions 0
log errors 0
failed network resources 0
HTTP 4xx/5xx 0
```

Harness regresi terarah untuk temuan audit:

```text
total  59
passed 59
failed 0
console errors 0
uncaught exceptions 0
```

Skenario browser dasar yang dijalankan:

- Memuat aplikasi, empat kolom, empty state, heading, label form, live region, dan accessibility tree.
- Membuat tugas lewat UI, termasuk prioritas, tag, tenggat, overdue, dan penyimpanan.
- Menolak judul whitespace dengan dialog tetap terbuka.
- Membuat dua tugas berjudul sama dan memastikan keduanya memiliki ID berbeda.
- Mengedit tugas, undo, dan redo.
- Menghapus dengan konfirmasi, undo penghapusan, dan redo penghapusan.
- Memindahkan status dengan keyboard (`ArrowDown` pada `<select>` native yang difokuskan).
- Drag antarkolom dengan marker/highlight, undo satu langkah, dan redo.
- Drag untuk mengubah urutan di dalam kolom.
- Pencarian, filter prioritas, filter terlambat, reset filter, dan pengeditan saat filter aktif.
- Reload halaman dan memastikan isi serta urutan kartu tetap sama.
- Ekspor JSON melalui unduhan browser dan verifikasi isi file.
- Impor JSON invalid tanpa mengubah papan aktif.
- Impor JSON valid dengan konfirmasi dan penggantian papan, lalu undo impor.
- Judul berisi `<img src=x onerror=...>` tampil sebagai teks dan tidak dieksekusi.
- Storage berisi JSON rusak: papan kosong di memori, status error, dan data lama tidak ditimpa.
- Penulisan storage yang dilempar sebagai error: tugas tetap di memori, status error, tidak ada klaim tersimpan.
- Viewport desktop dan mobile tanpa overflow horizontal; kolom bertumpuk pada mobile; dialog muat di viewport.
- Tidak ada console error, uncaught exception, resource gagal, atau respons HTTP 4xx/5xx.

Skenario regresi terarah yang dijalankan:

- **M1 fokus:** fokus kembali ke `<select>` status tugas yang sama setelah perpindahan status; tombol Edit kartu yang sama setelah simpan; tombol Edit kartu berikutnya setelah hapus; tombol Undo setelah menghapus kartu terakhir di kolom; tombol Tambah tugas setelah papan menjadi kosong; dan kartu yang dipulihkan setelah Undo.
- **M1 filter dan dialog:** target edit yang hilang karena filter tidak menerima fokus dan fokus berpindah ke Reset filter; Escape pada dialog tidak memindahkan fokus ke elemen yang sudah dihapus.
- **M1 riwayat:** redo penghapusan saat papan kosong tidak meninggalkan fokus di `body`, tetapi berpindah ke tombol Tambah tugas.
- **M2 persistensi:** dengan `Storage.prototype.setItem` yang melempar `QuotaExceededError`, impor tetap berlaku di memori, payload lama tidak berubah, hanya satu toast yang terlihat, tidak ada klaim “berhasil diimpor”, dan live region mempertahankan “belum tersimpan”.
- **M2 undo dan aksi lain:** Undo serta perubahan status saat storage diblokir melaporkan bahwa hasilnya belum tersimpan, tetap berlaku di memori, dan tidak menimpa storage lama.
- **H1/L5 kanonikalisasi:** impor dengan ID/teks berpadding, prioritas `HIGH`, tenggat ` 2026-10-30 `, dan tag duplikat disimpan sebagai data kanonik; filter prioritas High, dialog detail, dan form edit menerima nilai kanonik yang sama; tenggat 30 Oktober 2026 tidak ditandai terlambat pada 26 Oktober 2026.
- **L5 field asing:** field asing pada task dan root ditolak sebelum dialog konfirmasi, dengan satu error yang menyebut nama field, tanpa mengubah papan aktif atau storage.
- **L3 drag cursor:** kartu tanpa filter memiliki cursor `grab` dan `draggable=true`; saat filter aktif cursor menjadi `default`, drag handle juga `default`, `draggable=false`, dan `dragstart` dicegah; reset filter mengembalikan cursor `grab`.
- **L2 kontras terukur:** placeholder dan “Tanpa tenggat” `#5f7379` pada putih = **4,98:1**; focus ring `#0a5c57` pada putih = **7,83:1**, outline solid 3 px.
- **L1 dialog mobile:** pada `390×844` DPR 2, dialog impor dengan nama file 185 karakter, dialog detail dengan judul 120 karakter/deskripsi 2000 karakter/8 tag panjang, dan dialog hapus semuanya memiliki `scrollWidth <= clientWidth + 1`; isi tetap terbungkus, dialog tetap `overflow-y: auto`, dan tidak ada overflow halaman.

Catatan metodologi:

- Drag diuji dengan `DragEvent` dan `DataTransfer` sintetis di Chrome, bukan gerakan mouse atau sentuhan fisik.
- Perpindahan status keyboard diuji dengan event tombol `ArrowDown` melalui CDP pada kontrol native.
- Fokus setelah aksi diuji dengan event keyboard CDP dan pemanggilan `.focus()`/`.click()` sintetis, bukan pointer fisik. Harness memeriksa `document.activeElement`, `data-task-id`, dan `data-action`, sehingga fokus ke node yang sudah dihapus atau kartu tersembunyi akan terdeteksi.
- Pesan persistensi diuji dengan mengganti `Storage.prototype.setItem` agar melempar `QuotaExceededError`, lalu memeriksa toast yang terlihat, teks live region, isi papan di memori, dan payload `localStorage` lama.
- L1 diukur dengan `scrollWidth`/`clientWidth` setiap dialog pada `390×844` DPR 2, bukan inspeksi visual manual.
- L2 dihitung dari `getComputedStyle` di Chrome dengan rumus luminans relatif WCAG terhadap latar putih.
- L3 diperiksa dari properti `draggable`, hasil `dispatchEvent(new DragEvent('dragstart'))`, dan `getComputedStyle(...).cursor`, bukan dari gerakan drag fisik.
- Impor diuji dengan menyuntikkan objek `File` ke input file, bukan melalui dialog file picker sistem operasi.
- Ekspor diuji melalui unduhan Chrome yang sebenarnya.
- Kedua harness browser bersifat sementara dan tidak disertakan ke dalam repository.

### Yang Belum Diuji

- Pengujian dengan screen reader nyata seperti NVDA, JAWS, atau VoiceOver.
- Perangkat fisik, layar sentuh nyata, dan gestur drag pada perangkat mobile.
- Browser selain Chrome, termasuk Firefox dan Safari.
- Drag dengan mouse fisik dan pengujian visual manual menyeluruh pada semua skala zoom.
- File picker sistem operasi secara nyata.
- Kondisi kuota `localStorage` yang benar-benar penuh; kegagalan tulis disimulasikan dengan melempar error.
- Sinkronisasi atau penggabungan perubahan antar beberapa tab.
- Migrasi data versi 0 melalui UI browser; migrasi diuji pada unit test.
- Pengujian fokus dengan pointer fisik, pembaca layar, atau urutan Tab lengkap pada semua kombinasi browser dan zoom.
- Audit kontras menyeluruh untuk seluruh pasangan warna tema; yang diukur hanya placeholder, “Tanpa tenggat”, dan focus ring terhadap putih.

## Keterbatasan

- Data terikat pada origin, browser, dan profil browser. Mengganti origin atau menghapus data situs akan menghilangkan papan.
- Aplikasi tidak menyinkronkan perubahan antar tab. Membuka beberapa tab pada papan yang sama dapat menyebabkan tab terakhir menimpa data tab lain.
- Bila storage diblokir karena data lama tidak valid, aplikasi tidak mencoba menimpa data tersebut. Pengguna dapat mengekspor papan di memori, tetapi perubahan tidak persisten sampai data lama ditangani secara manual.
- Undo/redo hanya berada di memori tab aktif dan tidak disimpan ke `localStorage`. Riwayat hilang setelah reload atau tab ditutup; tugas yang tersimpan tetap dimuat kembali.
- Riwayat menyimpan hingga 50 snapshot papan; perubahan di luar batas tersebut tidak dapat di-undo.
- Pengurutan ulang kartu hanya tersedia melalui drag. Alternatif keyboard/touch disediakan untuk perubahan status, bukan untuk pengurutan.
- Filter tidak dapat dipakai bersamaan dengan drag karena urutan hasil filter tidak dipetakan kembali ke urutan sumber.
- Tenggat diperlakukan sebagai tanggal kalender lokal untuk penanda terlambat, sementara tanggal ditampilkan dengan format Indonesia dan zona UTC agar tidak bergeser satu hari.
- Kebijakan field asing bersifat ketat: file atau payload dengan metadata tambahan ditolak, bukan dibersihkan atau dipertahankan. File seperti itu perlu diedit agar hanya memuat field schema yang didokumentasikan.
- Hanya satu toast yang terlihat pada satu waktu. Pesan baru menggantikan pesan sebelumnya agar sukses dan error tidak saling menimpa; live region tetap menyampaikan status terakhir.
- Aplikasi membutuhkan browser modern dengan dukungan `<dialog>` dan ES Modules.
