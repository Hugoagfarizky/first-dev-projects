# Proyek 17 — TradeLab: Stock Trading Simulator

TradeLab adalah dashboard simulasi trading saham berbasis browser. Pada tahap ini, aplikasi menampilkan data harga sintetis, pencarian saham, filter sektor, detail saham, dan grafik harga 30 hari.

Semua pemrosesan dilakukan di browser. Tidak ada backend, database, analytics, telemetri, CDN, font eksternal, atau layanan eksternal.

## Tujuan Pembelajaran

- Memisahkan data pasar, rendering, dan orkestrasi UI ke modul ES yang dapat diuji.
- Membuat data harga sintetis yang deterministik dan transparan.
- Merancang dashboard keuangan yang responsif dan dapat diakses.
- Mempersiapkan fondasi sebelum logika trading, portofolio, dan autosave ditambahkan.

## Fitur Tahap 1

- Navigasi tiga tab: Pasar, Portofolio, dan Riwayat.
- Pencarian saham berdasarkan simbol atau nama.
- Filter sektor.
- Tabel saham dengan harga terakhir, perubahan, dan sektor.
- Detail saham terpilih.
- Grafik harga 30 hari.
- Data pasar sintetis deterministik dengan 12 saham.
- Status aplikasi dan live region.
- Layout responsif untuk desktop dan mobile.
- CSP dan rendering teks yang aman.

## Fitur yang Sudah Terhubung ke UI

- Beli dan jual saham dengan validasi saldo dan kepemilikan.
- Dashboard portofolio: saldo kas, nilai saham, total ekuitas, realized P/L, dan unrealized P/L.
- Daftar posisi dengan harga rata-rata, harga pasar, nilai pasar, dan laba/rugi.
- Riwayat transaksi terbaru.
- Watchlist tambah/hapus dengan persistensi terpisah (`tradelab.watchlist`).
- Reset portofolio dengan konfirmasi.
- Penyimpanan dan autosave dengan status `saving`, `saved`, `error`, dan sesi memori.

Fitur di atas akan ditambahkan pada tahap berikutnya. Tombol transaksi sengaja tidak disediakan agar tidak menyesatkan pengguna.

## Teknologi

- HTML5.
- CSS3.
- Vanilla JavaScript dengan ES Modules.
- SVG untuk grafik harga.
- `node --check` untuk pemeriksaan sintaks JavaScript.

Tidak ada framework, dependency npm, library eksternal, CDN, font eksternal, backend, analytics, atau telemetri.

## Modul

- `js/market-data.js`: katalog 12 saham sintetis dan generator histori harga deterministik.
- `js/trade-model.js`: validasi beli/jual, perhitungan total transaksi, dan batas input.
- `js/portfolio.js`: model portofolio, eksekusi beli/jual, ringkasan, dan reset.
- `js/storage.js`: load/save portofolio dengan envelope, validasi, dan hasil terstruktur.
- `js/autosave.js`: controller autosave debounce dengan snapshot dan status.
- `js/trading-controller.js`: orkestrasi trading, storage, autosave, dan ringkasan portofolio.
- `js/ui.js`: rendering tabel, detail saham, dan grafik harga.
- `js/app.js`: orkestrasi state UI dan data pasar.

## Prasyarat

- Browser modern yang mendukung ES Modules.
- Python 3 atau static HTTP server lain untuk menjalankan aplikasi.
- Tidak perlu `npm install`.

## Cara Menjalankan

Dari root repository:

```powershell
cd D:\Github\vibecoding-journey
python -m http.server 8000
```

Buka:

```text
http://localhost:8000/proyek-17-tradelab-stock-trading-simulator/
```

ES Modules tidak dijalankan melalui `file://`; gunakan static HTTP server lokal.

## Pengujian

Perintah unit test:

```powershell
cd D:\Github\vibecoding-journey\proyek-17-tradelab-stock-trading-simulator
node --test tests/*.test.mjs
```

Hasil aktual:

- Tests: 100
- Pass: 100
- Fail: 0
- Skipped: 0
- Cancelled: 0

Pengujian mencakup katalog 12 saham, harga dan histori integer positif, 30 titik histori, determinisme, simbol tidak dikenal, perlindungan katalog internal, alias API, sektor, validasi beli/jual, total transaksi, saldo tidak cukup, oversell, overflow, portofolio awal, weighted average cost, realized P/L, ringkasan portofolio, harga pasar yang hilang, reset, batas 500 transaksi, immutability, round-trip storage, envelope, schema, JSON rusak, storage tidak tersedia, read/write/quota error, isolasi data load, snapshot autosave, debounce, cancel, flush, dispose, kegagalan save, dan save lama yang tidak boleh menimpa state baru.

## Struktur Folder

```text
proyek-17-tradelab-stock-trading-simulator/
├── README.md
├── index.html
├── style.css
├── assets/
│   └── icon.svg
├── js/
    ├── app.js
    ├── autosave.js
    ├── market-data.js
    ├── portfolio.js
    ├── storage.js
    ├── trade-model.js
    └── ui.js
└── tests/
    ├── autosave.test.mjs
    ├── market-data.test.mjs
    ├── portfolio.test.mjs
    ├── storage.test.mjs
    └── trade-model.test.mjs
```

## Storage dan Autosave

Storage menggunakan key `tradelab.portfolio` dengan envelope:

```text
{
  app: "tradelab",
  schemaVersion: 1,
  savedAt: "ISO-8601-UTC",
  portfolio: { ... }
}
```

API storage:

- `loadPortfolio(storageAtauOpsi)`: mengembalikan status `empty`, `loaded`, `corrupt`, `unsupported-schema`, `unavailable`, atau `read-error`.
- `savePortfolio(portfolio, storageAtauOpsi)`: memvalidasi portofolio sebelum menulis; status `saved`, `invalid-portfolio`, `unavailable`, `write-error`, atau `quota-exceeded`.
- `clearPortfolio(storageAtauOpsi)`: menghapus hanya key portofolio.
- `createPortfolioStorage(storageAtauOpsi)`: mengikat storage yang diinjeksi ke metode `load()`, `save()`, dan `clear()`.
- Storage dapat diinjeksi sebagai objek Storage-like, `{ storage }`, atau dibiarkan kosong untuk memakai `globalThis.localStorage`.
- Data rusak tidak dihapus atau ditimpa otomatis saat load gagal.

Autosave:

- `createAutosaveController({ save, delay = 500, scheduler, now })`
- Metode: `schedule()`, `cancel()`, `flush()`, `waitForIdle()`, `dispose()`, `getStatus()`, `subscribe()`.
- Snapshot diambil saat `schedule()` dipanggil, bukan saat timer berjalan. Jika snapshot gagal, revision lama diinvalidasi dan save lama tidak boleh mengubah status menjadi `saved`.
- Debounce default 500 ms dan dapat diinjeksi melalui `scheduler` atau `setTimeout`/`clearTimeout`; method scheduler dipanggil dengan konteks objek aslinya.
- Status menyediakan `state`, `pending`, `inFlight`, `queued`, `revision`, `savedRevision`, `lastSavedAt`, `lastError`, `lastErrorDetails`, `cancelRequested`, `disposeRequested`, dan `staleSaveCompleted`.
- `cancel()` hanya membatalkan timer/pending dan meminta pembatalan kooperatif untuk save yang sudah berjalan; status menjadi `cancelling` jika masih ada save aktif, lalu `cancelled` setelah settle.
- `dispose()` menandai controller dibersihkan dan meminta pembatalan kooperatif; status menjadi `disposing` jika masih ada save aktif, lalu `disposed`.
- `flush()` menjalankan pending timer, menunggu seluruh save queued/aktif selesai, dan melaporkan `flushed`. Jika tidak ada timer tetapi ada save aktif, ia tetap menunggu.
- `waitForIdle()` menunggu seluruh save queued/aktif selesai tanpa memicu timer pending.
- Save lama yang sudah tidak berlaku tidak boleh mengubah status atau menimpa state yang lebih baru.

## Catatan Data

Seluruh data harga pada tahap ini adalah **data sintetis deterministik untuk simulasi**. Data tersebut bukan harga pasar aktual, bukan rekomendasi investasi, dan tidak boleh digunakan untuk keputusan keuangan nyata.

## Keamanan

- CSP membatasi skrip ke `'self'`, style ke `'self'` dan inline styles, gambar ke `'self'`, `blob:`, dan `data:`, serta koneksi jaringan melalui `connect-src 'none'`.
- Teks dinamis dirender dengan `textContent`, bukan `innerHTML`.
- Tidak ada `eval` atau `new Function`.
- Tidak ada API key, broker, atau layanan keuangan.

## Keterbatasan

- Logika domain trading, portofolio, storage, dan autosave sudah tersedia, tetapi belum terhubung ke UI.
- Grafik harga masih sederhana dan belum interaktif.
- Data sintetis tidak merepresentasikan volatilitas atau likuiditas pasar nyata.
- Belum diverifikasi dengan browser selain yang tersedia pada lingkungan pengembangan.