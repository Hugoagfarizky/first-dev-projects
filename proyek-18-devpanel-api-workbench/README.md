# Proyek 18 — DevPanel API Workbench

DevPanel API Workbench adalah alat developer berbasis browser untuk membangun dan memvalidasi request HTTP. Pada Phase 1, fondasi model request, request builder, dan JSON formatter sudah tersedia sebagai modul murni yang dapat diuji tanpa DOM atau jaringan.

Semua pemrosesan dilakukan di browser pada tahap implementasi. Tidak ada backend, database, analytics, telemetri, CDN, dependency eksternal, atau layanan eksternal.

## Fitur Phase 1

- Validasi method HTTP: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
- Validasi URL absolut `http:`/`https:` dengan penolakan skema lain, URL relatif, malformed, dan kredensial.
- Validasi timeout integer positif dengan batas maksimum.
- Builder query parameters dengan encoding, parameter kosong, disabled, duplikat, dan karakter khusus.
- Validasi header, deteksi duplikat case-insensitive, newline, dan metadata header sensitif.
- Validasi dan pembangunan JSON body, termasuk penolakan body pada `GET`.
- JSON formatter: parse, pretty print, compact, dan penanganan input invalid/kosong/non-string.
- Fungsi murni yang tidak memutasi input.

## Fitur Phase 2

- HTTP client berbasis Fetch API dengan dependency yang dapat diinjeksi.
- Integrasi dengan request hasil Phase 1.
- Timeout, pembatalan pengguna, network/CORS error, dan kegagalan baca body.
- Respons HTTP non-2xx tetap dibaca sebagai respons HTTP.
- Ekstraksi status, status text, headers, body, waktu, dan ukuran respons.
- Batas ukuran respons dengan deteksi `Content-Length` dan pembacaan stream terbatas.
- Response inspector murni untuk status, headers, body mentah/JSON, metadata, dan error aman.

## Fitur Phase 3

- Generic JSON storage dengan envelope berversi dan validasi.
- Request history dengan sanitasi header sensitif dan query sensitif.
- Collections dengan validasi, import/export, batas, dan sanitasi kredensial.
- Penanganan storage unavailable, corrupt, unsupported, read/write/quota.

## Fitur Phase 4

- UI request builder dengan method, URL, query, headers, body, dan timeout.
- Tombol Send dan Cancel.
- Response inspector dengan status, waktu, ukuran, headers, body, dan JSON formatting.
- History dan collections terintegrasi dengan storage aktual.
- Import/export collections.
- Sanitasi kredensial pada history dan collections.
- Layout responsif dan aksesibilitas dasar.

## Fitur yang Belum Tersedia

- Pengujian browser interaktif.

## Struktur File

```text
proyek-18-devpanel-api-workbench/
├── README.md
├── js/
│   ├── app.js
│   ├── ui.js
│   ├── workbench-controller.js
│   ├── request-model.js
│   ├── request-builder.js
│   ├── json-formatter.js
│   ├── http-client.js
│   ├── response-inspector.js
│   ├── storage.js
│   ├── history-storage.js
│   └── collection-storage.js
└── tests/
    ├── request-model.test.mjs
    ├── request-builder.test.mjs
    ├── json-formatter.test.mjs
    ├── http-client.test.mjs
    ├── response-inspector.test.mjs
    ├── storage.test.mjs
    ├── history-storage.test.mjs
    ├── collection-storage.test.mjs
    └── app-integration.test.mjs
```

## Pengujian

Jalankan dari direktori proyek:

```powershell
cd D:\Github\vibecoding-journey\proyek-18-devpanel-api-workbench
node --test tests/*.test.mjs
```

Pemeriksaan sintaks:

```powershell
node --check js/request-model.js
node --check js/request-builder.js
node --check js/json-formatter.js
node --check js/http-client.js
node --check js/response-inspector.js
node --check js/storage.js
node --check js/history-storage.js
node --check js/collection-storage.js
node --check js/workbench-controller.js
node --check js/ui.js
node --check js/app.js
```

## Keamanan

- Tidak ada `eval` atau `new Function`.
- URL divalidasi dengan allowlist protokol.
- Header sensitif ditandai tanpa menyalin nilainya ke pesan error.
- Input tidak dimutasi.
- Tidak ada request jaringan pada Phase 1.