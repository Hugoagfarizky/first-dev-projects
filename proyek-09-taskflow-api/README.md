# Proyek 09 — TaskFlow API

TaskFlow API adalah aplikasi manajemen tugas dengan frontend vanilla JavaScript yang terhubung langsung ke REST API Express dan database SQLite. Semua tugas dibaca dan ditulis melalui API; frontend tidak memakai `localStorage` sebagai sumber data atau fallback.

Aplikasi dimulai tanpa data contoh. Pengguna dapat membuat tugas pertama, lalu mengelola, mencari, memfilter, mengurutkan, dan membagi tugas ke beberapa halaman. Setiap perubahan tetap tersimpan setelah server atau browser dimulai ulang selama database tersedia.

## Tujuan

Proyek ini menunjukkan alur aplikasi full-stack lokal yang nyata, bukan simulasi API di browser:

- Server Express menangani validasi, routing, error, dan penyajian frontend.
- SQLite menyimpan data secara persisten di folder lokal yang tidak dapat diakses melalui HTTP.
- Frontend memakai `fetch()` dan ES Modules untuk semua operasi CRUD.
- Pengujian memakai server dan database SQLite nyata.

## Fitur

### Manajemen tugas

- Membuat tugas dengan judul, deskripsi, status, prioritas, dan tenggat opsional.
- Melihat daftar tugas dengan ringkasan total dan jumlah per status.
- Mengedit seluruh field yang diizinkan melalui formulir.
- Mengubah status langsung dari kartu tugas.
- Menghapus tugas dengan dialog konfirmasi.
- Mencari berdasarkan judul.
- Memfilter berdasarkan status dan prioritas.
- Mengurutkan berdasarkan tanggal dibuat, prioritas, atau tenggat.
- Pagination server-side dengan navigasi halaman, sebelumnya, dan berikutnya.
- Tenggat ditampilkan sebagai tanggal kalender tanpa pergeseran zona waktu.

### Kualitas antarmuka

- Tema terang dengan aksen teal dan biru.
- Loading skeleton, error state, tombol coba lagi, empty state, dan toast.
- Empty state berbeda untuk database kosong dan hasil filter yang tidak ditemukan.
- Dialog aksesibel dengan fokus awal, penjebakan fokus native, tombol tutup, dan pengembalian fokus.
- Navigasi keyboard, label form, `aria-live`, serta `aria-busy` pada proses muat.
- Responsif pada desktop, tablet, dan layar 320 px tanpa horizontal overflow.
- Dukungan `prefers-reduced-motion`.
- Judul dan deskripsi pengguna dirender sebagai teks, bukan HTML.

## Teknologi dan versi

| Komponen | Versi |
| --- | --- |
| Node.js minimum | `>=22.13.0` |
| Node.js yang direkomendasikan | 24 LTS |
| npm | Versi bawaan Node.js |
| Express | `5.3.0` |
| better-sqlite3 | `13.0.3` |
| SQLite (melalui better-sqlite3) | `3.53.4` |
| Frontend | HTML5, CSS3, vanilla JavaScript ES Modules |
| Pengujian | Node.js built-in test runner |
| Browser target | Chrome, Edge, Firefox, dan Safari modern |

### Mengapa better-sqlite3

`better-sqlite3` dipilih karena menyediakan API SQLite sinkron yang sederhana, prepared statements, transaksi, dan dukungan WAL tanpa server database terpisah. Versi `13.0.3` mensyaratkan Node.js `>=22`, sesuai dengan Node LTS yang digunakan.

Ini adalah native addon. Instalasi normalnya memakai binary prebuilt untuk platform dan versi Node yang didukung. Jika binary tidak tersedia untuk lingkungan tertentu, npm mungkin membutuhkan compiler C++ dan Python. Jalankan `npm audit` secara berkala untuk memeriksa kerentanan dependency.

## Struktur Direktori

```text
proyek-09-taskflow-api/
├── package.json
├── package-lock.json
├── .gitignore
├── README.md
├── server/
│   ├── app.js
│   ├── server.js
│   ├── controllers/
│   │   └── tasksController.js
│   ├── db/
│   │   ├── database.js
│   │   └── migrations/
│   │       └── 001_create_tasks.sql
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── notFound.js
│   ├── routes/
│   │   └── tasks.js
│   ├── services/
│   │   └── tasksService.js
│   └── utils/
│       ├── ApiError.js
│       ├── asyncHandler.js
│       └── validation.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── js/
│       ├── api.js
│       ├── app.js
│       └── ui.js
└── tests/
    ├── tasks.test.js
    └── api.test.js
```

## Instalasi

Prasyarat:

- Node.js `22.13.0` atau lebih baru. Node.js 24 LTS direkomendasikan.
- npm.
- Build tools C++ hanya jika binary prebuilt `better-sqlite3` tidak tersedia untuk platform tersebut.

Dari root repository:

```bash
cd proyek-09-taskflow-api
npm ci
```

Gunakan `npm install` jika ingin memperbarui dependency sesuai rentang di `package.json`:

```bash
npm install
```

## Menjalankan server

Mode normal:

```bash
npm start
```

Mode pengembangan dengan restart otomatis saat file server berubah:

```bash
npm run dev
```

Alamat default:

- Frontend: `http://127.0.0.1:3000`
- Health check: `http://127.0.0.1:3000/api/health`
- REST API: `http://127.0.0.1:3000/api/v1/tasks`

> **Penting:** buka frontend melalui alamat server Express di atas. Jangan membuka `public/index.html` langsung (`file://`) atau memakai Live Server/server statis lain. Frontend memakai URL API relatif (`/api/health` dan `/api/v1/tasks`) dan API tidak membuka CORS. Jika halaman disajikan dari origin lain, request API akan menuju origin tersebut, gagal, dan indikator menampilkan **“API terputus”**.
>
> Jika indikator tersebut muncul, pastikan `npm start` masih berjalan, lalu buka `http://127.0.0.1:3000` (atau alamat sesuai `HOST`/`PORT` yang dipakai). Hentikan Live Server/server statis yang mungkin membuka proyek ini di port lain.

Konfigurasi melalui environment variable:

| Variable | Default | Keterangan |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Alamat bind server. Default hanya lokal. |
| `PORT` | `3000` | Port HTTP. |
| `DB_PATH` | `data/taskflow.sqlite` | Lokasi file SQLite. Path relatif dihitung dari direktori kerja saat perintah dijalankan. Gunakan path absolut untuk hasil yang pasti. |

Contoh PowerShell:

```powershell
$env:PORT = "4000"
$env:DB_PATH = "D:\data\taskflow-dev.sqlite"
npm start
```

Contoh Bash:

```bash
PORT=4000 DB_PATH=/home/user/taskflow-dev.sqlite npm start
```

Jangan mengubah `HOST` menjadi `0.0.0.0` pada jaringan yang tidak dipercaya. Aplikasi belum memiliki autentikasi.

## REST API

Semua endpoint data memakai prefix `/api/v1/tasks`. Respons sukses memakai bentuk `{ "data": ... }`. Respons error memakai bentuk `{ "error": { "code", "message", "details" } }`.

Request JSON harus memakai `Content-Type: application/json`. Batas ukuran body adalah **64 KB**.

### Daftar endpoint

| Method | Path | Fungsi | Status sukses |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Status server dan koneksi database | `200` |
| `GET` | `/api/v1/tasks` | Daftar tugas dengan filter dan pagination | `200` |
| `GET` | `/api/v1/tasks/:id` | Detail satu tugas | `200` |
| `POST` | `/api/v1/tasks` | Membuat tugas | `201` |
| `PATCH` | `/api/v1/tasks/:id` | Memperbarui field tertentu | `200` |
| `DELETE` | `/api/v1/tasks/:id` | Menghapus tugas | `204` tanpa body |

`DELETE` yang berhasil mengembalikan `204 No Content`. `POST` yang berhasil mengembalikan header `Location` menuju tugas baru.

### Query parameter daftar tugas

| Parameter | Default | Aturan |
| --- | --- | --- |
| `q` | tanpa pencarian | Pencarian judul, maksimal 100 karakter. `%` dan `_` diperlakukan sebagai teks biasa. |
| `status` | semua | `todo`, `in_progress`, atau `done`. |
| `priority` | semua | `low`, `medium`, atau `high`. |
| `sort` | `created_at` | `created_at`, `priority`, atau `due_date`. |
| `order` | `desc` | `asc` atau `desc`. |
| `page` | `1` | Bilangan bulat `1` sampai `1.000.000`. |
| `limit` | `10` | Bilangan bulat `1` sampai `50`. Frontend memakai `8`. |

Nama query yang tidak dikenal, nilai ganda, nilai kosong yang tidak valid, angka pecahan, dan nama kolom SQL arbitrer ditolak dengan `400 VALIDATION_ERROR`.

Detail pengurutan:

- `priority` memakai urutan logis `high` → `medium` → `low`, bukan urutan alfabetis.
- `due_date` menempatkan tugas tanpa tenggat di akhir, baik untuk `asc` maupun `desc`.
- `created_at` memakai timestamp ISO UTC.
- Hasil dengan nilai yang sama diurutkan dengan `created_at` dan `id` sebagai tie-breaker.

### Bentuk respons daftar

`pagination.total` adalah jumlah hasil setelah filter. `summary` adalah ringkasan global seluruh database dan tidak berubah saat filter aktif.

```json
{
  "data": [
    {
      "id": "1d7f3c2e-3c1d-4c8e-9a5b-0e5b8a1f2c44",
      "title": "Belajar REST API",
      "description": "Latihan endpoint dan database.",
      "status": "todo",
      "priority": "high",
      "due_date": "2026-11-01",
      "created_at": "2026-10-21T12:00:00.000Z",
      "updated_at": "2026-10-21T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 8,
    "total": 1,
    "total_pages": 1
  },
  "summary": {
    "total": 1,
    "todo": 1,
    "in_progress": 0,
    "done": 0
  }
}
```

Jika tidak ada hasil, `data` adalah array kosong dan `total_pages` bernilai `0`.

### Membuat tugas

```http
POST /api/v1/tasks
Content-Type: application/json
```

```json
{
  "title": "Belajar REST API",
  "description": "Latihan endpoint dan database.",
  "status": "todo",
  "priority": "high",
  "due_date": "2026-11-01"
}
```

Field wajib hanya `title`. Default `status` adalah `todo`, default `priority` adalah `medium`, `description` menjadi string kosong, dan `due_date` menjadi `null`. Respons sukses `201`:

```json
{
  "data": {
    "id": "1d7f3c2e-3c1d-4c8e-9a5b-0e5b8a1f2c44",
    "title": "Belajar REST API",
    "description": "Latihan endpoint dan database.",
    "status": "todo",
    "priority": "high",
    "due_date": "2026-11-01",
    "created_at": "2026-10-21T12:00:00.000Z",
    "updated_at": "2026-10-21T12:00:00.000Z"
  }
}
```

### Memperbarui sebagian field

`PATCH` hanya menerima `title`, `description`, `status`, `priority`, dan `due_date`. Payload kosong, field asing, atau nilai tidak valid ditolak. Field yang tidak dikirim tidak berubah. `updated_at` selalu diperbarui.

```http
PATCH /api/v1/tasks/1d7f3c2e-3c1d-4c8e-9a5b-0e5b8a1f2c44
Content-Type: application/json
```

```json
{
  "status": "done",
  "due_date": null
}
```

Respons sukses `200` berisi objek `data` terbaru. Mengirim `due_date: null` menghapus tenggat.

### Menghapus tugas

```http
DELETE /api/v1/tasks/1d7f3c2e-3c1d-4c8e-9a5b-0e5b8a1f2c44
```

Respons sukses `204` tanpa body. Menghapus ID yang sama lagi menghasilkan `404 NOT_FOUND`.

### Health check

```json
{
  "data": {
    "status": "ok",
    "database": "connected",
    "uptime_seconds": 42
  }
}
```

Jika koneksi database gagal, endpoint mengembalikan `503 DATABASE_UNAVAILABLE`. Path database dan pesan internal tidak dikirim ke klien.

### Contoh error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": [
      {
        "field": "title",
        "message": "Judul wajib diisi."
      }
    ]
  }
}
```

ID yang bukan UUID valid menghasilkan `400 INVALID_ID`. UUID valid yang tidak ada menghasilkan `404 NOT_FOUND`. Stack trace, nama tabel, dan pesan SQLite tidak pernah dikirim ke klien.

## Model data dan skema

Tabel `tasks`:

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `id` | `TEXT` | Primary key, UUID v4 yang dibuat server. |
| `title` | `TEXT` | Wajib, setelah trim 1–200 karakter. |
| `description` | `TEXT` | Wajib berupa string, maksimal 2.000 karakter, default `""`. |
| `status` | `TEXT` | `todo`, `in_progress`, atau `done`; default `todo`. |
| `priority` | `TEXT` | `low`, `medium`, atau `high`; default `medium`. |
| `due_date` | `TEXT` | `NULL` atau tanggal `YYYY-MM-DD`; tanggal kalender, bukan timestamp. |
| `created_at` | `TEXT` | Timestamp ISO 8601 UTC. |
| `updated_at` | `TEXT` | Timestamp ISO 8601 UTC, diperbarui pada setiap PATCH. |

Constraint database mencakup:

- `CHECK` panjang judul dan deskripsi.
- `CHECK` daftar status dan prioritas.
- `CHECK` pola `due_date`.
- Index untuk `created_at`, `status`, `priority`, dan `due_date`.

Validasi kalender penuh dilakukan di backend karena pola SQLite saja tidak dapat menolak tanggal seperti `2025-02-29`. Tahun yang diterima adalah `1900`–`2200`.

Field `id`, `created_at`, dan `updated_at` tidak dapat dikirim oleh klien. Field asing ditolak, sehingga input tidak dapat mengubah struktur database.

## Migrasi dan startup

Migrasi awal berada di `server/db/migrations/001_create_tasks.sql`. Saat server mulai:

1. Folder database dibuat jika belum ada.
2. Database dibuka dengan `foreign_keys`, `busy_timeout`, WAL, dan `synchronous = NORMAL`.
3. Tabel `schema_migrations` dipastikan ada.
4. Migrasi `.sql` yang belum tercatat dijalankan berurutan di dalam transaksi.
5. Versi migrasi dicatat dengan timestamp UTC.

Migrasi berjalan otomatis dan tidak menghapus data yang sudah ada. Jika database tidak dapat dibuka atau migrasi gagal, startup dihentikan dengan pesan error yang jelas dan proses keluar dengan kode non-zero. Server tidak mulai dalam keadaan setengah siap.

## Lokasi database, backup, dan reset

Lokasi default:

```text
proyek-09-taskflow-api/data/taskflow.sqlite
```

File `data/`, `*.sqlite`, `*.sqlite-wal`, dan `*.sqlite-shm` diabaikan Git. Folder `public/` adalah satu-satunya folder yang disajikan sebagai static files, sehingga database dan source server tidak dapat diunduh melalui HTTP.

### Backup

Hentikan server terlebih dahulu agar WAL selesai ditulis dengan aman, lalu salin seluruh folder `data/`.

PowerShell:

```powershell
# Hentikan server dengan Ctrl+C terlebih dahulu
Copy-Item -Recurse data data-backup-2026-10-21
```

Bash:

```bash
# Hentikan server dengan Ctrl+C terlebih dahulu
cp -R data data-backup-2026-10-21
```

Untuk database dengan `DB_PATH` khusus, salin file tersebut beserta file `-wal` dan `-shm` jika ada. Menyalin saat server berhenti adalah cara paling sederhana dan aman.

### Restore

```powershell
# Hentikan server terlebih dahulu
Remove-Item -Recurse -Force data
Copy-Item -Recurse data-backup-2026-10-21 data
npm start
```

Bash:

```bash
# Hentikan server terlebih dahulu
rm -rf data
cp -R data-backup-2026-10-21 data
npm start
```

### Reset data

Reset bersifat destruktif dan tidak dapat dibatalkan:

```powershell
# Hentikan server terlebih dahulu
Remove-Item -Recurse -Force data
npm start
```

Server akan membuat database baru dan menjalankan migrasi. Tidak ada tugas contoh yang dibuat otomatis.

## Pengujian

Perintah:

```bash
npm test
```

Perintah terpisah:

```bash
npm run test:unit
npm run test:api
```

Pengujian memakai Node.js built-in test runner dan database SQLite sementara di direktori temp OS. Database pengguna di `data/` tidak disentuh.

### Cakupan pengujian

Suite otomatis tersedia di `tests/tasks.test.js` dan `tests/api.test.js`. Berdasarkan deklarasi di file test, `tasks.test.js` berisi 12 test dan `api.test.js` berisi 22 test, dengan total 34 test. Jumlah ini dapat diverifikasi secara statis dari source test, tetapi status lulus tidak dapat diverifikasi tanpa log atau laporan eksekusi.

Cakupannya meliputi:

- Normalisasi judul, batas panjang, status, prioritas, tanggal kalender, query, ID, field asing, dan payload PATCH kosong.
- Health endpoint, CRUD lengkap, `201`, `204`, `400`, `404`, `413`, dan `500`.
- JSON rusak, body kosong, serta body melebihi 64 KB.
- Filter status/prioritas, pencarian judul, wildcard literal, semua opsi pengurutan, dan pagination.
- Persistensi setelah koneksi database dan aplikasi dibuat ulang.
- Database error yang dapat direproduksi tanpa membuat server crash.
- SQL injection pada pencarian, payload, dan nama kolom sort.
- Konsistensi envelope error dan tidak bocornya stack trace atau SQL.
- Penyajian hanya dari `public/`, bukan source server atau file database.

Pembaruan dokumentasi ini tidak menjalankan `npm test`; tidak ada log atau laporan hasil eksekusi yang disertakan, sehingga status lulus tidak diklaim. Harness pengujian browser juga tidak disertakan, dan hasil pengujian browser sebelumnya tidak dapat diverifikasi dari repository. Gunakan checklist manual di akhir dokumen untuk verifikasi di browser.

## Penanganan error

| Kode | HTTP | Penyebab |
| --- | --- | --- |
| `VALIDATION_ERROR` | `400` | Query atau payload tidak valid, field asing, PATCH kosong. |
| `INVALID_ID` | `400` | ID tugas bukan UUID yang valid. |
| `INVALID_JSON` | `400` | Body bukan JSON yang dapat diparse. |
| `NOT_FOUND` | `404` | Tugas atau endpoint tidak ditemukan. |
| `PAYLOAD_TOO_LARGE` | `413` | Body melebihi 64 KB. |
| `UNSUPPORTED_MEDIA_TYPE` | `415` | Encoding request tidak didukung. |
| `DATABASE_UNAVAILABLE` | `503` | Health check tidak dapat mengakses database. |
| `INTERNAL_ERROR` | `500` | Kesalahan server/database yang tidak terduga. |

Frontend juga memiliki error `NETWORK_ERROR` ketika `fetch()` tidak dapat menghubungi server. Error tersebut tidak disamarkan sebagai sukses dan tidak mengganti data dengan data lokal.

Error handler menangani route yang tidak ditemukan, error parser body, error validasi, error database, dan promise rejection dari controller. Detail internal hanya dicatat di console server, bukan dikirim ke klien.

## Keamanan dan batasan

Yang sudah diterapkan:

- Validasi dan normalisasi backend untuk semua payload dan query.
- Prepared statements dan parameter binding untuk seluruh nilai SQL.
- Whitelist kolom sort; tidak ada input pengguna yang disusun menjadi nama kolom.
- ID UUID yang divalidasi sebelum query.
- Batas body 64 KB.
- Static files hanya dari `public/`.
- Tidak ada CORS terbuka; frontend dan API memakai origin yang sama.
- Security header: CSP same-origin, `X-Content-Type-Options`, `X-Frame-Options`, dan `Referrer-Policy`.
- `x-powered-by` dinonaktifkan.
- Input pengguna dirender dengan `textContent`, bukan `innerHTML`.
- Tidak ada `eval`.
- Error HTTP tidak membocorkan stack trace, SQL, path database, atau struktur internal.
- Default bind `127.0.0.1`.

Batasan yang perlu diketahui:

- **Belum ada autentikasi, otorisasi, atau multi-user.** Siapa pun yang dapat mengakses server dapat membaca dan mengubah semua tugas. Jangan mengekspos aplikasi ini langsung ke internet.
- Belum ada rate limiting, CSRF token, audit log, enkripsi at-rest, atau HTTPS.
- SQLite berjalan dalam proses server. Aplikasi dirancang untuk satu instance lokal, bukan deployment multi-instance.
- Operasi database bersifat sinkron. Untuk dataset besar atau banyak pengguna bersamaan, pola ini perlu dievaluasi ulang.
- `due_date` sengaja berupa tanggal kalender tanpa jam atau zona waktu.
- Tidak ada soft delete, riwayat perubahan, lampiran, atau kolaborasi.
- Frontend tidak menyimpan draft atau data tugas di `localStorage`.
- Automated browser harness tidak disertakan; langkah manual di bawah dapat dipakai untuk verifikasi ulang.

## Checklist pengujian manual

- [ ] Jalankan `npm ci`, lalu `npm start`.
- [ ] Buka `http://127.0.0.1:3000`; pastikan indikator API berstatus terhubung.
- [ ] Pastikan database kosong menampilkan empty state tanpa tugas contoh.
- [ ] Tambah tugas dengan judul, deskripsi, status, prioritas, dan tenggat.
- [ ] Muat ulang browser; pastikan tugas masih ada.
- [ ] Edit judul, deskripsi, prioritas, status, dan tenggat.
- [ ] Ubah status langsung dari kartu dan periksa ringkasan status.
- [ ] Cari judul, lalu coba pencarian tanpa hasil dan tombol reset.
- [ ] Kombinasikan filter status dan prioritas.
- [ ] Coba semua opsi pengurutan, termasuk prioritas dan tenggat.
- [ ] Buat lebih dari delapan tugas, lalu uji halaman berikutnya/sebelumnya.
- [ ] Batalkan dialog hapus; pastikan tugas tetap ada.
- [ ] Konfirmasi hapus; pastikan tugas hilang dan total berkurang.
- [ ] Hentikan server, picu request, dan pastikan error state + tombol coba lagi muncul.
- [ ] Jalankan server kembali, klik coba lagi, dan pastikan data pulih.
- [ ] Buka dialog dengan keyboard, gunakan Tab dan Escape, lalu periksa fokus kembali.
- [ ] Uji lebar 1440, 1024, 820, 390, dan 320 px tanpa scroll horizontal.
- [ ] Aktifkan reduced motion di OS/browser dan pastikan animasi tidak mengganggu.
- [ ] Periksa console browser: tidak boleh ada error tak terduga.
- [ ] Hentikan server dengan Ctrl+C dan pastikan koneksi database ditutup dengan aman.
