# Proyek 20 — GitScope: Git Repository Visualizer

GitScope adalah aplikasi browser read-only untuk mengeksplorasi repositori GitHub publik. Pengguna dapat memeriksa metadata repositori, menelusuri branch dan commit, melihat graph ancestry, membandingkan dua referensi, dan membaca diff dari GitHub REST API.

Semua pemrosesan dilakukan di browser. Tidak ada backend, database, analytics, telemetri, CDN, dependency eksternal, token, atau kredensial yang disimpan.

## Status implementasi

Fase 1–5 telah diimplementasikan dan menjalani QA akhir:

- Repository Explorer (metadata, branch, commit timeline, detail commit).
- Commit Graph berbasis parent SHA yang sudah dimuat.
- Branch Comparison dengan pagination commit dan daftar file.
- Diff Viewer dengan pembeda baris tambah/hapus/konteks dan batas tampilan.
- Penanganan loading, empty, error, rate limit, pembatalan, dan respons terlambat.
- Unit test dengan `node:test` dan mock, tanpa dependency testing tambahan.

## Teknologi

- HTML, CSS, dan JavaScript ES Modules tanpa framework.
- GitHub REST API `https://api.github.com` dengan akses GET read-only.
- `Intl` bawaan browser untuk format angka dan tanggal.
- Tidak ada build step dan tidak ada package manager.

## Menjalankan aplikasi

Dari root repositori:

```powershell
python -m http.server 8000
```

Buka:

```text
http://localhost:8000/proyek-20-gitscope-git-repository-visualizer/
```

Aplikasi memakai ES Modules sehingga harus dijalankan melalui HTTP, bukan `file://`.

## Repository Explorer

- URL harus berbentuk `https://github.com/owner/repo` (trailing slash dan suffix `.git` diterima).
- URL invalid ditolak sebelum request API dibuat.
- Metadata yang ditampilkan: owner, default branch, stars, forks, open issues, bahasa, waktu update, dan tautan ke GitHub.
- Daftar branch dimuat 100 per halaman dan dapat ditambah dengan tombol **Muat branch berikutnya**.
- Commit timeline dimuat 30 per halaman untuk branch aktif dan dapat dipaginasi.
- Memilih commit memuat detail commit, statistik, dan daftar file yang berubah.
- Request lama dibatalkan saat pengguna mengganti repositori atau branch. Respons yang datang terlambat tidak boleh menimpa state terbaru.
- Loading, empty, error, rate limit, dan pembatalan ditampilkan pada live region yang sesuai.

## Commit Graph

- Graph dibangun hanya dari relasi `parents[].sha` pada commit yang sudah dimuat.
- Rantai commit menghasilkan edge anak–parent; merge commit menampilkan seluruh parent yang tersedia.
- Parent yang belum dimuat ditandai `?` dan graph ditandai parsial.
- Graph tidak pernah diklaim lengkap. Ringkasan menunjukkan jumlah commit yang ditampilkan.
- Maksimum 100 node ditampilkan. Jika commit yang dimuat lebih banyak, graph dipotong dan indikator truncation ditampilkan.
- Pagination commit menambah node tanpa duplikasi.
- Node dapat dipilih dengan mouse, `Enter`, atau `Space`. Fokus keyboard terlihat dan dipertahankan setelah panel dirender ulang.
- Repositori atau branch baru selalu mengganti graph lama.
- Graph memakai scroll internal secara vertikal dan horizontal agar halaman tidak memanjang berlebihan.

## Branch Comparison

- Base dan head dipilih dari branch yang sudah dimuat dan commit yang tersedia pada timeline.
- Perbandingan hanya berjalan setelah tombol **Compare** ditekan.
- Status, ahead/behind, dan jumlah commit diambil dari respons GitHub Compare API; nilai tersebut tidak dihitung ulang dari data parsial.
- Commit comparison dimuat 30 per halaman dan digabung tanpa duplikasi.
- Daftar file hanya diambil dari halaman pertama respons compare, sesuai perilaku GitHub API. Jika mencapai 300 file, antarmuka menandai bahwa daftar mungkin terbatas.
- Mengubah base/head membatalkan request yang sedang berjalan dan menghapus hasil lama agar tidak tercampur.
- Mengganti repositori membersihkan seluruh state comparison.
- Perbandingan tidak mengubah branch aktif Repository Explorer.

## Diff Viewer

- File yang berubah dapat dipilih dari daftar; diff ditampilkan tanpa request API tambahan.
- Baris hunk, konteks, penambahan, penghapusan, dan metadata diberi kelas berbeda. Prefix `+`, `-`, `@`, dan spasi tetap ada sehingga warna bukan satu-satunya pembeda.
- Patch yang tidak tersedia ditampilkan sebagai keterbatasan respons API. GitScope tidak menyimpulkan file sebagai biner hanya karena patch tidak ada.
- Patch dipotong sebelum elemen DOM dibuat: maksimum 100.000 karakter dan 2.000 baris, dengan indikator truncation.
- Daftar file commit yang mencapai 300 file diberi catatan bahwa daftar mungkin dibatasi GitHub API.

## Keamanan

- Semua data dinamis dirender dengan `textContent`, `createElement`, `createDocumentFragment`, atau `replaceChildren`.
- Tidak ada `innerHTML`, `eval`, atau `new Function`.
- Tautan eksternal hanya diterima jika berupa HTTPS ke `github.com` tanpa kredensial.
- CSP membatasi script/style/gambar ke origin sendiri dan koneksi hanya ke `https://api.github.com`.
- API client hanya mengizinkan path repositori, branch, commit, dan compare yang dikenal.
- Tidak ada token pengguna, cookie autentikasi, atau penyimpanan kredensial.

## Rate limit dan cache

- Tanpa autentikasi, GitHub membatasi sekitar 60 request per jam per IP.
- GitScope tidak meminta token dan tidak melakukan retry agresif pada 403/429.
- Metadata `x-ratelimit-*` dan `retry-after` dibaca dari respons dan ditampilkan bila tersedia.
- Cache hanya in-memory, maksimum 100 entri, dengan key yang membedakan jenis data, owner/repo, referensi, dan halaman.
- Cache hilang saat halaman dimuat ulang. Tidak ada cache persisten atau penyimpanan cloud.
- Pagination tidak memuat seluruh riwayat secara otomatis.

## Pengujian

Jalankan seluruh unit test:

```powershell
node --test tests/*.test.mjs
```

Pemeriksaan sintaks semua modul:

```powershell
Get-ChildItem js -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Test memakai `node:test` dan `node:assert/strict`, dengan mock API untuk metadata, branch, commit, comparison, error, rate limit, pembatalan, dan respons terlambat. Tidak ada dependency testing tambahan.

## Struktur

```text
proyek-20-gitscope-git-repository-visualizer/
├── README.md
├── index.html
├── style.css
├── assets/
│   └── icon.svg
├── js/
│   ├── app.js
│   ├── app-controller.js
│   ├── branch-model.js
│   ├── commit-graph.js
│   ├── commit-graph-renderer.js
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

## Fitur yang belum tersedia

- Analitik kontributor.
- Analisis direktori yang sering berubah.
- Ekspor laporan atau JSON.
- Autentikasi GitHub/token dan akses repositori privat.
- Cache persisten atau sinkronisasi lintas sesi.
- Dukungan GitHub Enterprise atau host selain `github.com`.
- Pemuatan seluruh riwayat repositori sekaligus.
