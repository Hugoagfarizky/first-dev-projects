# Proyek 19 — LogLens: Local Log File Analyzer

LogLens adalah alat developer lokal untuk membaca dan menganalisis file log di browser. Seluruh pemrosesan dirancang berjalan di perangkat pengguna: tidak ada upload, telemetri, backend, atau koneksi jaringan.

**Status saat ini: Phase 4 — Hardening & Final Polish.** Parser, file reader streaming, query engine, statistik, dan exporter sudah terhubung ke antarmuka browser. Hardening mencakup batas baris Unicode, sanitasi nama ekspor, offset timezone ±14:00, pesan rentang waktu invalid yang aksesibel, serta perbaikan kecil lifecycle download dan drag-and-drop. File dapat dimuat lewat file picker atau drag-and-drop, difilter, dilihat per halaman, dan diekspor sebagai `.log` tanpa koneksi jaringan.

## Tujuan

- Membaca file log lokal tanpa mengirimkannya ke server.
- Menampilkan baris log dengan nomor baris yang mengikuti posisi fisik di file.
- Mengenali format log yang berbeda tanpa menganggap semua file memiliki struktur yang sama.
- Menyediakan pencarian, filter level/waktu, statistik, pagination, dan ekspor yang dapat diuji.
- Menjaga seluruh isi log tetap berada di browser dan hanya ada di memori selama halaman terbuka.

## Fitur Phase 1

- Model record log yang konsisten untuk plain text, structured text, dan JSON Lines.
- Parser timestamp terpisah dengan validasi komponen tanggal dan waktu.
- Dukungan ISO 8601 dengan `Z`, offset timezone, timestamp lokal, dan milidetik.
- Penanganan BOM di awal input, LF/CRLF/CR, baris kosong, dan nomor baris.
- Normalisasi level `WARNING` → `WARN` dan `CRITICAL` → `FATAL`.
- UI scaffold responsif dengan badge `Local only`, empty state, layout statistik, toolbar filter, dan tabel log.
- CSP dengan `connect-src 'none'`; tidak ada koneksi jaringan.

## Fitur Phase 2

- File reader streaming berbasis `File.stream()` dan `TextDecoder`; file tidak dibaca sekaligus dengan `file.text()`.
- Batas MVP: 20 MiB, 200.000 baris, dan 64 KiB byte UTF-8 per baris.
- Progress berbasis byte, dukungan `AbortSignal`, dan error terstruktur untuk pembatalan, file invalid, batas ukuran/baris, serta kegagalan stream.
- Query literal case-insensitive pada `raw` dan `message`, dengan filter level dan rentang waktu inklusif.
- Batas hasil query 10.000 hit, jumlah kecocokan penuh, penanda truncation, dan indeks hasil untuk navigasi.
- Statistik level, baris kosong, record tanpa timestamp, serta timestamp valid paling awal dan paling akhir.
- Exporter teks LF dengan nama file `.log` yang disanitasi.

## Fitur Phase 4

- File picker dan drag-and-drop memakai `readLogFile()` berbasis `File.stream()`; isi file tidak dibaca sekaligus dengan `file.text()`.
- Progress pembacaan, nama file, ukuran, jumlah baris, dan tombol Cancel saat pemuatan berlangsung.
- Error terstruktur untuk file invalid, melebihi 20 MiB, melebihi 200.000 baris, pembatalan, dan kegagalan baca.
- Dataset lama tetap aktif ketika pemuatan baru gagal atau dibatalkan; pemuatan yang lebih baru selalu mengalahkan hasil asinkron yang terlambat.
- Pencarian literal case-insensitive pada `raw` dan `message`, filter level multi-select termasuk `UNKNOWN`, filter waktu inklusif, dan reset filter.
- Pagination 100 record per halaman dengan nomor baris fisik dan indeks sumber asli tetap terjaga.
- Navigasi match sebelumnya/berikutnya; navigasi dibatasi 10.000 hit pertama dan menampilkan peringatan ketika batas tersebut tercapai.
- Statistik dataset penuh dan statistik semua record yang cocok dengan filter, bukan hanya halaman atau 10.000 hasil pertama. Statistik dataset penuh tidak berubah saat filter diubah.
- Ekspor seluruh hasil filter melalui `buildExport()`. `Blob` dan download hanya dibuat setelah tombol ekspor ditekan; object URL dicabut kembali setelah digunakan.
- Rendering data log memakai `textContent`, `createElement`, dan `DocumentFragment`. Payload HTML/JavaScript di dalam log ditampilkan sebagai teks, bukan dieksekusi.
- Layout responsif, tabel dengan scroll internal, label kontrol, fokus keyboard yang terlihat, live region untuk status, dan dukungan `prefers-reduced-motion`.
- CSP tetap memakai `connect-src 'none'`. Tidak ada jaringan, `localStorage`, `sessionStorage`, IndexedDB, atau penyimpanan log persisten.

## Batasan Phase 4

- Navigasi match dibatasi 10.000 hit pertama. Statistik dan ekspor tetap mencakup semua hasil filter.
- Stack trace multi-line belum dikelompokkan; setiap baris fisik tetap menjadi record terpisah.
- Parsing logfmt atau format log khusus vendor belum didukung.
- Tidak ada persistensi sesi. Dataset hilang saat halaman ditutup atau di-refresh.
- File yang sangat besar tetap dibatasi 20 MiB dan 200.000 baris sesuai batas MVP.

## Menjalankan

Tidak ada dependency eksternal atau proses build. Karena memakai ES Modules, gunakan static HTTP server lokal.

```powershell
cd proyek-19-loglens-log-file-analyzer
python -m http.server 8000
```

Buka `http://localhost:8000/`, lalu pilih file log atau tarik file ke area dropzone.

### Menggunakan Aplikasi

1. Pilih file lewat tombol **Pilih file log** atau drag-and-drop. Batas: 20 MiB, 200.000 baris, dan 64 KiB byte UTF-8 per baris.
2. Tunggu progress pembacaan. Tombol **Batalkan** tersedia selama proses berlangsung.
3. Gunakan pencarian literal, checkbox level, dan rentang waktu untuk memfilter. Tombol **Reset filter** mengembalikan seluruh dataset.
4. Gunakan pagination atau tombol match sebelumnya/berikutnya untuk berpindah hasil.
5. Tekan **Ekspor semua hasil** untuk mengunduh hasil filter sebagai file `.log`. Statistik dan ekspor mencakup semua kecocokan, termasuk yang melewati batas navigasi 10.000 hit.
6. Tekan **Hapus dataset** untuk membuang file dan filter dari state dan UI.

File tidak di-upload dan tidak disimpan. Jangan memuat log yang tidak boleh dibaca di perangkat ini.

## API

### `parseTimestamp(value)`

Mengembalikan hasil parsing untuk satu string timestamp lengkap. Parser tidak mencari timestamp di tengah teks.

```js
import { parseTimestamp } from './js/timestamp-parser.js';

parseTimestamp('2026-10-27T10:20:30.123Z');
// {
//   ok: true,
//   timestampMs: 1793096430123,
//   timestampIso: '2026-10-27T10:20:30.123Z',
//   timestampSource: 'iso',
//   error: null
// }
```

Bentuk hasil:

| Field | Nilai |
| --- | --- |
| `ok` | `true` jika valid |
| `timestampMs` | epoch milliseconds atau `null` |
| `timestampIso` | representasi ISO UTC atau `null` |
| `timestampSource` | `iso`, `local`, atau `none` |
| `error` | pesan error atau `null` |

Aturan:

- Timestamp dengan `Z` atau offset dinormalisasi ke epoch yang benar.
- Timestamp tanpa timezone diperlakukan sebagai waktu lokal browser dan ditandai `local`.
- `timestampIso` selalu representasi UTC dari epoch.
- Komponen tanggal, jam, menit, detik, dan offset divalidasi secara eksplisit.
- Offset timezone dibatasi pada rentang sipil ±14:00; offset seperti +14:01, -14:01, +15:00, atau +23:59 ditolak.
- Tanggal mustahil, input kosong, format asing, dan input non-string mengembalikan `ok: false` tanpa exception.

Catatan waktu lokal dan DST:

- Timestamp tanpa timezone diperlakukan sebagai waktu lokal browser.
- Pada transisi daylight saving time (DST), beberapa waktu lokal dapat ambigu (terjadi dua kali) atau tidak ada sama sekali.
- Parser menggunakan perilaku `Date` browser dan tidak dapat menentukan maksud penulis log secara pasti jika informasi timezone tidak tercantum. Karena itu, timestamp lokal tidak selalu dapat dipetakan secara unik ke satu instant.
- Untuk dataset lintas zona waktu, utamakan timestamp dengan `Z` atau offset eksplisit.

### `parseLogLine(line, lineNumber = 1, options = {})`

Mengembalikan satu record log. `line` tidak boleh menyertakan newline.

Opsi:
- `maxLineLength`: batas panjang baris dalam byte UTF-8. Default `65536` byte. Pemotongan dilakukan pada batas code point tanpa memecah surrogate pair.

### `parseLogText(text, options = {})`

Mengembalikan hasil parsing seluruh teks:

```js
import { parseLogText } from './js/log-parser.js';

const result = parseLogText('2026-10-27T10:20:30Z INFO server started\nhello raw line');
// {
//   ok: true,
//   records: [ ... ],
//   totalLines: 2,
//   truncatedLines: 0,
//   error: null
// }
```

Jika `text` bukan string, hasilnya:

```js
{
  ok: false,
  records: [],
  totalLines: 0,
  truncatedLines: 0,
  error: 'Input log harus berupa string.'
}
```

### Bentuk Record

```js
{
  lineNumber: 1,
  raw: '2026-10-27T10:20:30Z INFO server started',
  timestampMs: 1793096430000,
  timestampIso: '2026-10-27T10:20:30.000Z',
  timestampSource: 'iso',
  level: 'INFO',
  message: 'server started',
  format: 'structured-text',
  blank: false,
  lineTruncated: false
}
```

Nilai `format`: `plain`, `jsonl`, atau `structured-text`.
Nilai `level`: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`, atau `UNKNOWN`.

### Utilitas Model

- `LOG_LEVELS`, `LOG_FORMATS`, `TIMESTAMP_SOURCES`, `DEFAULT_MAX_LINE_LENGTH`.
- `normalizeLevel(value)`.
- `utf8ByteLength(value)`.
- `truncateLine(raw, maxLineLength)` — `maxLineLength` dalam byte UTF-8.
- `createLogRecord(input)`.

### `readLogFile(file, options = {})`

Membaca file-like object lokal memakai `file.stream()` dan `TextDecoder` streaming. Modul ini tidak mengakses DOM atau jaringan.

```js
import { readLogFile } from './js/file-reader.js';

const controller = new AbortController();
const result = await readLogFile(file, {
  signal: controller.signal,
  onProgress: ({ bytesRead, fileSize, lines, progress }) => {
    // progress: 0..1, atau null jika ukuran file tidak tersedia
  },
});
```

Opsi:
- `signal`: `AbortSignal` opsional.
- `onProgress`: callback opsional yang menerima `{ bytesRead, fileSize, lines, progress }`.
- `maxBytes`: default `20 * 1024 * 1024` (20 MiB).
- `maxLines`: default `200000`.
- `maxLineLength`: default `65536` byte UTF-8.

Hasil sukses:

```js
{
  ok: true,
  records: [ /* canonical log records */ ],
  totalLines: 1200,
  truncatedLines: 0,
  bytesRead: 84521,
  fileSize: 84521,
  error: null
}
```

Hasil gagal selalu memakai `ok: false`, `records: []`, dan error terstruktur:

```js
{
  ok: false,
  records: [],
  totalLines: 0,
  truncatedLines: 0,
  bytesRead: 0,
  fileSize: 22000000,
  error: {
    code: 'file-too-large',
    message: 'File melebihi batas ukuran.',
    maxBytes: 20971520,
    fileSize: 22000000,
    bytesRead: 0
  }
}
```

Kode error: `invalid-file`, `file-too-large`, `too-many-lines`, `aborted`, `read-error`.

Konstanta `MAX_FILE_BYTES`, `MAX_LINES`, dan `READ_ERROR_CODES` juga diekspor untuk dipakai oleh UI.

Perilaku:
- BOM di awal file dihapus; BOM di tengah baris tetap dipertahankan.
- LF, CRLF, dan CR didukung, termasuk pemisah yang terbelah antar-chunk.
- UTF-8 multibyte yang terbelah antar-chunk ditangani oleh decoder streaming.
- Trailing newline tidak menghasilkan baris hantu.
- Baris kosong tetap menjadi record dengan `blank: true`.
- `maxLineLength` dihitung dalam byte UTF-8. Baris yang melebihi batas dipotong pada batas karakter Unicode tanpa memecah surrogate pair dan ditandai `lineTruncated: true`.
- Buffer baris dibatasi di sekitar `maxLineLength` byte, sehingga satu baris sangat panjang tidak disimpan tanpa batas walaupun melintasi banyak chunk.
- Jika file melebihi batas ukuran atau jumlah baris, seluruh hasil dibuang dan pembacaan dianggap gagal; tidak ada hasil parsial yang dilaporkan sebagai sukses.
- Jika `size` tidak tersedia, pembacaan tetap berjalan dan batas byte ditegakkan sambil menghitung byte yang dibaca; `fileSize` bernilai `null`.
- Pembatalan menghentikan stream, membuang hasil parsial, dan mengembalikan `error.code === 'aborted'`.
- Reader dilepas kembali pada akhir pembacaan, kegagalan, atau pembatalan.

### `queryLogs(records, options = {})`

Fungsi murni untuk mencari dan memfilter record tanpa mengubah input.

```js
import { queryLogs, nextMatchPosition } from './js/query-engine.js';

const result = queryLogs(records, {
  query: 'timeout',
  levels: ['WARN', 'ERROR'],
  fromMs: 1793096400000,
  toMs: 1793096500000,
});
```

Opsi:
- `query`: pencarian literal case-insensitive pada `raw` dan `message`. Karakter seperti `.*` tidak ditafsirkan sebagai regex. String kosong berarti tanpa pencarian.
- `levels`: array level, termasuk `UNKNOWN`. Array kosong berarti tanpa filter level.
- `fromMs`, `toMs`: batas waktu inklusif dalam epoch milliseconds. Salah satu boleh digunakan sendiri.
- `limit`: jumlah hasil maksimum; default dan batas keras `10000`.

Hasil:

```js
{
  ok: true,
  results: [ /* maksimal 10.000 record */ ],
  resultIndices: [ /* indeks hasil yang dikembalikan */ ],
  matchedIndices: [ /* indeks semua kecocokan, termasuk di luar batas */ ],
  totalMatches: 12450,
  returnedCount: 10000,
  truncated: true,
  excludedWithoutTimestamp: 3,
  limit: 10000,
  error: null
}
```

Ketika filter waktu aktif, record tanpa timestamp valid dikecualikan dan dihitung pada `excludedWithoutTimestamp`. `totalMatches` menghitung seluruh kecocokan, sedangkan `truncated` menandai bahwa hasil yang dikembalikan mencapai batas. `matchedIndices` tersedia agar statistik dan ekspor dapat memakai seluruh hasil filter meskipun `results` dibatasi 10.000.

`nextMatchPosition(currentPosition, matchCount, direction = 1)` mengembalikan posisi berikutnya atau sebelumnya dengan wraparound; gunakan `-1` sebagai posisi awal. Input records yang bukan array menghasilkan `ok: false` tanpa exception.

### `computeStatistics(records)` dan `compareStatistics(allRecords, filteredRecords)`

Statistik dihitung dari record, bukan dari teks pesan atau line break di dalam message.

```js
import { computeStatistics, compareStatistics } from './js/statistics.js';

const stats = computeStatistics(records);
const comparison = compareStatistics(allRecords, filteredRecords);
```

`computeStatistics` mengembalikan `totalLines`, `blankLines`, `levelCounts` untuk semua level, `withoutTimestamp`, `timestampedLines`, `firstTimestampMs`, `lastTimestampMs`, `firstTimestampIso`, dan `lastTimestampIso`.

`compareStatistics` mengembalikan `{ ok, all, filtered, filteredCount, error }` agar statistik dataset penuh dan hasil filter tidak tertukar. Untuk statistik filter yang lengkap, kirim seluruh koleksi hasil filter, bukan potongan halaman.

### `buildExport(records, options = {})` dan `sanitizeExportFilename(value)`

Fungsi murni untuk menyiapkan konten ekspor. Modul ini tidak membuat `Blob`, tidak memicu download, dan tidak mengirim data ke jaringan.

```js
import { buildExport, sanitizeExportFilename } from './js/exporter.js';

const exported = buildExport(filteredRecords, {
  filename: 'loglens-filtered.log',
});
```

Hasil sukses berisi `content`, `filename`, `lineCount`, `byteLength`, `mimeType`, `lineEnding: '\n'`, dan `error: null`.

Perilaku:
- Satu baris output untuk setiap record, memakai `raw` agar log asli tetap dipertahankan.
- Baris kosong tetap menjadi baris kosong.
- Output memakai LF dan diakhiri LF jika ada record.
- Nama file selalu berekstensi `.log`; path separator, karakter Windows terlarang, karakter kontrol, dan kontrol bidi Unicode disanitasi. Nama device Windows yang direservasi, termasuk varian berekstensi atau bertitik banyak, diberi prefix `log-`; titik dan spasi di akhir komponen dibuang.
- Nama akhir dibatasi maksimal 255 byte UTF-8 dan 255 UTF-16 code units termasuk `.log`. Pemotongan dilakukan pada batas code point tanpa memecah surrogate pair; input kosong atau seluruhnya invalid memakai fallback deterministik `loglens-filtered.log`.
- Record asli tidak dimutasi.

`sanitizeExportFilename(value)` dapat dipakai terpisah untuk mendapatkan nama file yang aman.

### `createAppController(options = {})`

Controller state yang tidak mengakses DOM dan dapat diuji di Node. UI `app.js` menggunakannya untuk memuat file, filter, pagination, navigasi match, statistik, dan ekspor.

```js
import { createAppController, PAGE_SIZE } from './js/app-controller.js';

const controller = createAppController({
  readFile: readLogFile, // opsional; dapat diganti fake reader pada test
  pageSize: PAGE_SIZE,
  onChange: (state) => {
    // render state ke UI
  },
});
```

Method utama:

- `loadFile(file)`: memuat file. Dataset lama tetap aktif sampai pemuatan baru berhasil. Pemuatan baru membatalkan pembacaan lama.
- `cancelLoad()`: membatalkan pemuatan yang sedang berjalan tanpa menghapus dataset lama.
- `clearDataset()`: membuang dataset, filter, statistik, dan state ekspor.
- `updateFilters({ query, levels, fromMs, toMs })`: menerapkan sebagian atau semua filter, lalu menghitung ulang hasil.
- `resetFilters()`: mengembalikan filter default.
- `setPage(index)`, `nextMatch(direction)`: pagination dan navigasi match.
- `exportFilteredResults({ filename })`: mengembalikan hasil `buildExport()` untuk seluruh record yang cocok. Download tetap merupakan tanggung jawab UI.
- `getState()`: snapshot state untuk rendering.

State memuat `dataset`, `load`, `filters`, `query`, `stats`, `page`, `activeMatch`, `canExport`, dan `status`. `matchedIndices` dari `queryLogs()` tidak diekspos sebagai array besar; controller memakainya secara internal untuk statistik dan ekspor lengkap.

`onChange` dipanggil saat state berubah, termasuk progress pembacaan. Listener tidak boleh mengubah state controller secara langsung.

## Format yang Didukung

### JSON Lines

Baris yang merupakan JSON object valid diperlakukan sebagai JSON Lines.

Timestamp dibaca dari:
- `timestamp`
- `time`
- `ts`
- `@timestamp`
- `date`
- `log.timestamp`

Level dibaca dari:
- `level`
- `severity`
- `lvl`
- `log.level`

Message dibaca dari:
- `message`
- `msg`
- `event`

Jika message tidak tersedia, baris JSON yang sudah di-trim digunakan sebagai representasi pesan yang aman. JSON invalid, array, atau nilai primitif diperlakukan sebagai raw log.

Nilai timestamp numerik tidak ditebak satuannya dan tidak dianggap timestamp valid pada fase ini.

### Structured Text

Baris dengan timestamp di awal, misalnya:

```text
2026-10-27T10:20:30.123Z INFO server started
2026-10-27 10:20:30 [WARNING] disk space low
[2026-10-27 10:20:30] CRITICAL fatal error
```

Timestamp boleh berada di dalam tanda kurung siku. Level token opsional; jika tidak ada, record tetap `structured-text` dengan level `UNKNOWN`.

### Plain / Raw

Baris yang tidak dikenali tetap disimpan dengan `format: 'plain'`, level `UNKNOWN`, dan `message` berisi baris asli. Baris tidak dibuang.

## Penanganan Baris

- Nomor baris 1-based mengikuti posisi fisik.
- BOM hanya dihapus dari awal input.
- LF, CRLF, dan CR didukung.
- Baris kosong tetap dipertahankan dengan `blank: true`.
- Stack trace multi-line tidak dikelompokkan pada fase ini; setiap baris adalah record terpisah.
- Baris yang melebihi `maxLineLength` byte UTF-8 dipotong pada batas karakter Unicode dan ditandai `lineTruncated: true`.

## Keamanan dan Privasi

- CSP membatasi koneksi dengan `connect-src 'none'`; tidak ada request jaringan dari aplikasi.
- Tidak ada fetch, upload, telemetri, analytics, atau storage isi log.
- Tidak ada `localStorage`, `sessionStorage`, atau IndexedDB. Dataset hanya berada di memori selama halaman terbuka.
- Tidak ada dependency eksternal, CDN, atau font eksternal.
- Rendering UI menggunakan `textContent`, `createElement`, dan `DocumentFragment`; tidak ada `innerHTML`, `eval`, atau `new Function`.
- Parser dan UI tidak mencetak isi log ke console.
- File ekspor dibuat lokal melalui `Blob` hanya setelah aksi eksplisit pengguna, dan object URL dicabut setelah download dimulai.
- UI menampilkan peringatan bahwa file ekspor dapat mengandung data sensitif.

## Test

Dari direktori proyek:

```powershell
node --test tests/*.test.mjs
```

Test tidak memerlukan dependency eksternal dan menggunakan `node:test` bawaan Node.js. Suite mencakup parser timestamp, parser log, file reader streaming, query engine, statistik, exporter, dan controller UI. Controller diuji tanpa DOM menggunakan fake reader untuk memverifikasi loading, pembatalan, stale request, filter, pagination, statistik lengkap di atas 10.000 hit, clear, dan ekspor.

Validasi sintaks semua file JavaScript:

```powershell
Get-ChildItem js -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem tests -Filter *.mjs | ForEach-Object { node --check $_.FullName }
```

## Struktur

```text
proyek-19-loglens-log-file-analyzer/
├── index.html
├── style.css
├── README.md
├── assets/
│   └── icon.svg
├── js/
│   ├── app.js
│   ├── app-controller.js
│   ├── ui.js
│   ├── log-model.js
│   ├── timestamp-parser.js
│   ├── log-parser.js
│   ├── file-reader.js
│   ├── query-engine.js
│   ├── statistics.js
│   └── exporter.js
└── tests/
    ├── timestamp-parser.test.mjs
    ├── log-parser.test.mjs
    ├── file-reader.test.mjs
    ├── query-engine.test.mjs
    ├── statistics.test.mjs
    ├── exporter.test.mjs
    └── app-controller.test.mjs
```

## Cakupan Phase 4

Phase 4 mencakup integrasi UI, pemuatan file streaming, pencarian dan filter, pagination, statistik penuh/filter, ekspor, keamanan rendering, hardening Unicode/ekspor/timestamp/UX, serta browser smoke test. Browser E2E dijalankan melalui harness eksternal; repository tidak menyertakan harness E2E permanen.
