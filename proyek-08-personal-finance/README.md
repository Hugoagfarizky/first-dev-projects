# Neraca — Personal Finance Dashboard

Neraca adalah dashboard keuangan pribadi yang berjalan sepenuhnya di browser. Aplikasi mencatat pemasukan dan pengeluaran, menampilkan ringkasan bulanan, membandingkan bulan berjalan dengan bulan sebelumnya, memvisualisasikan arus kas, serta membantu menyusun anggaran belanja per kategori.

Semua data disimpan di `localStorage` pada browser yang dipakai. Tidak ada akun, backend, koneksi rekening bank, API berbayar, atau API key. Aplikasi dimulai tanpa data contoh sehingga pengguna dapat langsung mencatat transaksi pertama.

## Fitur

- **Dashboard bulan terpilih** dengan total pemasukan, total pengeluaran, arus kas bersih, jumlah transaksi, dan perbandingan terhadap bulan sebelumnya.
- **Saldo kumulatif** dari seluruh riwayat transaksi, ditampilkan terpisah dari arus kas bulan terpilih.
- **Navigasi bulan dan tahun** melalui input bulan, tombol bulan sebelumnya/berikutnya, dan tombol **Bulan ini**. Dashboard dan halaman anggaran memakai periode yang sama; filter transaksi tetap independen.
- **Dua grafik CSS/SVG** tanpa library: arus kas enam bulan dan pengeluaran per kategori pada bulan terpilih. Setiap batang memiliki label, nominal, dan teks alternatif.
- **Transaksi terbaru** pada bulan terpilih serta ringkasan anggaran bulan tersebut di dashboard.
- **CRUD transaksi** dengan ID unik, jenis pemasukan/pengeluaran, nominal bilangan bulat rupiah, kategori tetap sesuai jenis, deskripsi opsional, tanggal lokal, serta timestamp dibuat dan diperbarui.
- **Validasi rupiah** yang menolak input kosong, nol, negatif, pecahan, format tidak valid, dan nominal melebihi batas. Perhitungan uang tidak memakai bilangan pecahan.
- **Pencarian dan filter transaksi** berdasarkan deskripsi, jenis, kategori, bulan, rentang tanggal, serta empat pilihan pengurutan.
- **Total hasil filter** berupa pemasukan, pengeluaran, arus kas bersih, dan jumlah transaksi. Empty state membedakan data kosong dari filter tanpa hasil.
- **Ekspor CSV** atas hasil filter aktif, lengkap dengan pengamanan formula spreadsheet dan penolakan ekspor kosong.
- **Anggaran bulanan per kategori pengeluaran** dengan batas, pemakaian, sisa, persentase, status aman/mendekati batas/melewati batas, dan pembaruan berdampingan.
- **Penyimpanan berversi** dengan validasi data, penanganan data rusak, data parsial, skema tidak dikenal, penyimpanan tidak tersedia, dan kuota penuh.
- **Antarmuka responsif dan aksesibel**: HTML semantik, native `<dialog>`, pengembalian fokus, navigasi keyboard, label ARIA, focus-visible, teks status langsung, dan dukungan `prefers-reduced-motion`.
- **Umpan balik yang jujur** melalui indikator status penyimpanan, banner, toast, dan pesan inline. Penulisan yang gagal tidak pernah dilaporkan sebagai berhasil.

## Teknologi

- HTML5 semantik
- CSS3 dengan custom properties, Grid, Flexbox, animasi ringan, dan grafik berbasis CSS
- Vanilla JavaScript dengan ES Modules
- `localStorage` untuk persistensi
- SVG inline untuk ikon dan favicon
- Node.js bawaan hanya untuk pemeriksaan sintaks dan pengujian logika di luar aplikasi

Tidak ada framework, build tool, backend, database eksternal, dependensi runtime, layanan berbayar, atau API key.

## Struktur Proyek

```text
proyek-08-personal-finance/
├── index.html          # Markup dashboard, tabel, form, dialog, dan sprite ikon
├── style.css           # Sistem visual, grafik, dialog, dan aturan responsif
├── README.md           # Dokumentasi proyek
└── js/
    ├── app.js          # Orkestrasi state, rute, event, CRUD, dan persistensi
    ├── analytics.js    # Ringkasan bulanan, perbandingan, tren, dan kategori
    ├── budgets.js      # Validasi, normalisasi, dan pemakaian anggaran
    ├── categories.js   # Daftar kategori tetap dan label jenis transaksi
    ├── csv.js          # Escape CSV, proteksi formula, dan nama berkas
    ├── dates.js        # Tanggal lokal, bulan, dan format Indonesia
    ├── money.js        # Parsing rupiah, format mata uang, dan penjumlahan
    ├── storage.js      # Pemuatan/penyimpanan berversi dan pemulihan
    ├── transactions.js # Model transaksi, validasi, filter, dan pengurutan
    └── ui.js           # Perenderan DOM, grafik, form, toast, dan banner
```

Logika bisnis dipisahkan dari DOM. Modul transaksi, anggaran, analitik, penyimpanan, dan CSV dapat diuji tanpa browser; `ui.js` dan `app.js` menangani interaksi serta tampilan.

## Menjalankan

Aplikasi memakai ES Modules sehingga perlu dijalankan melalui server HTTP lokal.

Dari folder proyek ini:

```bash
python -m http.server 8000
```

Lalu buka `http://localhost:8000/`.

Dari root repositori:

```bash
python -m http.server 8000
```

Lalu buka `http://localhost:8000/proyek-08-personal-finance/`.

Alternatifnya, gunakan **Live Server** di VS Code pada `index.html`. Membuka berkas melalui `file://` dapat diblokir browser karena modul JavaScript.

Tidak ada proses build, instalasi paket, API key, atau konfigurasi tambahan.

## Cara Menggunakan

1. Buka **Dashboard**, lalu pilih bulan dan tahun laporan. Gunakan **Bulan ini** untuk kembali ke periode berjalan.
2. Klik **Tambah transaksi**, pilih jenis, masukkan nominal, kategori, tanggal, dan deskripsi bila perlu.
3. Gunakan halaman **Transaksi** untuk mencari, memfilter, mengurutkan, mengubah, atau menghapus catatan. Penghapusan selalu meminta konfirmasi.
4. Klik **Ekspor CSV** untuk mengunduh hasil filter yang sedang tampil. Tombol dinonaktifkan secara logis saat tidak ada hasil.
5. Buka halaman **Anggaran**, pilih bulan, lalu tetapkan batas per kategori pengeluaran. Klik kartu anggaran untuk mengubah atau menghapusnya.
6. Tekan `Escape` untuk menutup dialog. Fokus dikembalikan ke tombol pemicu setelah dialog ditutup.

## Definisi dan Metode Perhitungan

- **Pemasukan bulan terpilih** adalah jumlah seluruh transaksi bertipe pemasukan pada bulan kalender tersebut.
- **Pengeluaran bulan terpilih** adalah jumlah seluruh transaksi bertipe pengeluaran pada bulan yang sama.
- **Arus kas bulan terpilih** dihitung sebagai pemasukan dikurangi pengeluaran. Nilainya boleh negatif.
- **Jumlah transaksi** menghitung transaksi pemasukan dan pengeluaran pada bulan terpilih.
- **Saldo kumulatif** adalah seluruh pemasukan dikurangi seluruh pengeluaran sepanjang riwayat, tanpa memandang filter atau bulan yang sedang dipilih.
- **Perbandingan bulan sebelumnya** memakai total bulan kalender penuh, bukan rata-rata harian atau proyeksi. Persentase hanya ditampilkan bila bulan sebelumnya memiliki data dan nilai pembanding lebih besar dari nol. Bila data pembanding tidak ada, aplikasi menampilkan keterangan, bukan persentase palsu. Untuk arus kas bersih, perbandingan ditampilkan sebagai selisih nominal.
- **Grafik enam bulan** menampilkan bulan terpilih dan lima bulan sebelumnya. Bulan tanpa transaksi tetap ditampilkan dengan nilai nol.
- **Grafik kategori** hanya menghitung pengeluaran pada bulan terpilih. Persentase setiap kategori dihitung terhadap total pengeluaran bulan tersebut; pemasukan tidak termasuk.
- **Filter** bersifat gabungan (AND). Pencarian hanya mencocokkan deskripsi, bulan dan rentang tanggal dapat dipakai bersama, dan pengurutan berlaku pada hasil filter. Total hasil filter serta CSV dihitung dari kumpulan yang sudah difilter dan diurutkan.
- Semua nominal ditampilkan sebagai rupiah tanpa desimal menggunakan `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })`.

## Perilaku Anggaran

- Anggaran dibuat untuk kombinasi **bulan + satu kategori pengeluaran**. Kombinasi yang sama tidak dapat dibuat dua kali; pengguna diarahkan untuk mengubah anggaran yang sudah ada.
- Batas anggaran wajib berupa bilangan bulat rupiah positif dengan batas maksimum yang sama seperti transaksi. Nilai nol atau negatif ditolak.
- **Pemakaian** adalah jumlah transaksi pengeluaran pada kategori dan bulan yang sama. Transaksi pemasukan tidak mengurangi pemakaian.
- **Sisa** dihitung sebagai batas dikurangi pemakaian dan dapat bernilai negatif bila batas terlampaui.
- **Status** ditentukan dari rasio pemakaian:
  - **Dalam batas** bila pemakaian di bawah 80% dari batas.
  - **Mendekati batas** bila pemakaian mencapai 80% hingga 100% dari batas.
  - **Melewati batas** bila pemakaian lebih besar dari batas.
- Anggaran adalah **batas perencanaan**, bukan saldo yang dipisahkan atau dipindahkan otomatis. Membuat anggaran tidak mengurangi saldo kumulatif, tidak mengunci uang, dan tidak mengubah transaksi. Pemakaian baru muncul setelah pengeluaran benar-benar dicatat.
- Menghapus anggaran tidak menghapus transaksi terkait. Anggaran tidak berpindah otomatis ke bulan berikutnya.

## Format Data `localStorage`

Data utama disimpan dengan kunci:

```text
neraca.finance.v1
```

Bentuknya:

```json
{
  "version": 1,
  "transactions": [
    {
      "id": "txn-...",
      "type": "expense",
      "amount": 45000,
      "categoryId": "food",
      "date": "2026-10-21",
      "description": "Makan siang",
      "createdAt": "2026-10-21T04:00:00.000Z",
      "updatedAt": "2026-10-21T04:00:00.000Z"
    }
  ],
  "budgets": [
    {
      "id": "bdg-...",
      "categoryId": "food",
      "month": "2026-10",
      "limit": 1500000,
      "createdAt": "2026-10-01T02:00:00.000Z",
      "updatedAt": "2026-10-01T02:00:00.000Z"
    }
  ]
}
```

- `version` saat ini adalah `1`.
- `type` bernilai `income` atau `expense`.
- `amount` dan `limit` adalah bilangan bulat positif dalam rupiah, maksimum `Rp999.999.999.999`.
- `date` adalah tanggal lokal `YYYY-MM-DD`; `month` adalah `YYYY-MM`.
- `createdAt` dan `updatedAt` adalah timestamp ISO 8601.
- ID transaksi dan anggaran harus unik. Deskripsi maksimum 160 karakter dan opsional.
- Kategori bersifat tetap. Kategori pemasukan: Gaji, Freelance, Investasi, Lainnya. Kategori pengeluaran: Makanan, Transportasi, Tagihan, Belanja, Pendidikan, Kesehatan, Hiburan, Lainnya.

Saat data rusak atau strukturnya tidak dikenali, salinan mentah disimpan di:

```text
neraca.finance.backup.v1
```

Nilai cadangan berisi `savedAt` dan string `raw` asli. Data mentah juga dapat diunduh dari banner pemulihan sebelum reset.

### Perilaku Penyimpanan

- **Belum ada data**: aplikasi mulai kosong dan menampilkan status siap menyimpan.
- **Data valid**: transaksi dan anggaran dimuat, lalu catatan yang tidak lolos validasi dilewati bila ada.
- **Data parsial**: catatan valid tetap tampil dengan peringatan dan jumlah catatan yang dilewati. Data mentah dapat diunduh. Penyimpanan berikutnya menulis ulang data valid yang tersisa.
- **Data rusak, skema tidak dikenal, atau struktur utama tidak valid**: aplikasi tidak menimpa data lama secara diam-diam. Penulisan dikunci sampai pengguna mengunduh data mentah (bila perlu) dan mengonfirmasi reset.
- **Reset** menghapus data utama dan memulai aplikasi kosong. Reset tidak menghidupkan kembali data contoh karena aplikasi memang tidak memakai data contoh.
- **Penyimpanan diblokir atau tidak tersedia**: aplikasi tetap dapat digunakan di memori selama tab terbuka, tetapi memberi tahu bahwa perubahan tidak persisten.
- **Kuota penuh**: perubahan di memori tetap terlihat, kegagalan penyimpanan dilaporkan, dan aplikasi tidak mengklaim penyimpanan berhasil.
- Setelah penyimpanan berhasil, salinan mentah pemulihan yang sudah tidak diperlukan dibersihkan.

## Perilaku CSV

- CSV selalu berisi **hasil filter aktif**, dalam urutan yang sedang tampil, bukan selalu seluruh data.
- Header yang diekspor: `Tanggal (YYYY-MM-DD)`, `Jenis`, `Kategori`, `Deskripsi`, `Nominal (Rp)`.
- Berkas memakai UTF-8 dengan BOM agar karakter Indonesia terbaca baik di Excel, serta akhir baris CRLF.
- Field yang mengandung koma, tanda kutip, atau baris baru diberi kutip dan tanda kutip ganda di-escape dengan benar.
- Teks yang diawali `=`, `+`, `-`, atau `@` (termasuk setelah spasi) diberi prefiks apostrof untuk mencegah formula injection saat dibuka di spreadsheet.
- Nama berkas memuat cakupan filter (bulan, rentang tanggal, atau `semua`) dan tanggal ekspor, misalnya `neraca-transaksi-2026-10-2026-10-21.csv`.
- Bila tidak ada transaksi pada hasil filter, aplikasi menampilkan pesan dan **tidak membuat berkas kosong**.
- CSV hanya untuk ekspor. Aplikasi belum menyediakan impor CSV.

## Batasan `localStorage`

- Data hanya tersimpan di browser dan profil pengguna saat ini. Data tidak tersinkron antar-tab, perangkat, browser, atau mode penyamaran.
- Menghapus data situs, membersihkan penyimpanan browser, atau memakai mode privat dapat menghilangkan data. Tidak ada cadangan cloud otomatis.
- Kapasitas `localStorage` umumnya sekitar 5 MB per origin dan berbeda antar-browser. Kuota penuh ditangani dengan pesan kegagalan, bukan dengan penyimpanan diam-diam.
- Data tidak dienkripsi. Siapa pun yang memiliki akses ke profil browser atau DevTools dapat membacanya.
- Dua tab yang terbuka bersamaan tidak saling menyinkronkan perubahan. Tab yang menyimpan terakhir dapat menimpa state tab lain.
- Raw backup JSON adalah sarana pemulihan saat data bermasalah, bukan fitur impor atau cadangan lengkap.
- Aplikasi tidak terhubung ke rekening bank, tidak mengimpor mutasi, tidak mendukung multi-mata uang, transaksi berulang, atau anggaran carry-over.
- Rentang tanggal yang didukung adalah 1900-01-01 sampai 2200-12-31. Nominal dibatasi `Rp999.999.999.999`.
- Belum ada pengelolaan kategori khusus; daftar kategori bersifat tetap.
- Tampilan memerlukan browser modern yang mendukung ES Modules, `<dialog>`, `Intl`, dan fitur CSS modern.

## Checklist Pengujian Manual

| No | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| 1 | Buka aplikasi pertama kali | Dashboard kosong tampil, saldo Rp0, tidak ada data contoh |
| 2 | Tambah pemasukan valid | Transaksi muncul, ringkasan bulan berubah, status tersimpan |
| 3 | Tambah pengeluaran valid | Pengeluaran dan arus kas dihitung benar |
| 4 | Simpan nominal kosong | Pesan validasi inline tampil dan dialog tetap terbuka |
| 5 | Simpan nominal `0` atau negatif | Input ditolak dengan pesan yang jelas |
| 6 | Simpan nominal pecahan seperti `10,5` | Input ditolak, tidak ada pembulatan diam-diam |
| 7 | Simpan nominal melebihi batas | Input ditolak dengan pesan batas maksimum |
| 8 | Simpan tanpa kategori atau tanggal | Field terkait ditandai dan fokus menuju kesalahan pertama |
| 9 | Ubah transaksi | ID dan `createdAt` tetap, `updatedAt` berubah, nilai baru tersimpan |
| 10 | Hapus transaksi lalu batalkan | Transaksi tetap ada dan fokus kembali ke pemicu |
| 11 | Hapus transaksi lalu konfirmasi | Transaksi hilang dari daftar dan ringkasan |
| 12 | Cari deskripsi | Hanya transaksi yang cocok yang tampil |
| 13 | Gabungkan jenis, kategori, bulan, dan rentang tanggal | Hasil mengikuti semua kondisi sekaligus |
| 14 | Urutkan nominal terbesar/terkecil | Urutan berubah dan tetap konsisten |
| 15 | Filter tanpa hasil | Empty state filter tampil, total 0, tombol ekspor tidak mengekspor |
| 16 | Hapus filter | Seluruh transaksi kembali tampil |
| 17 | Ganti bulan dashboard | Ringkasan, grafik kategori, transaksi terbaru, dan snapshot anggaran ikut berubah |
| 18 | Ganti bulan anggaran | Halaman anggaran memakai periode baru; filter transaksi tidak berubah |
| 19 | Bulan tanpa transaksi | Empty state dan grafik kosong tampil tanpa persentase palsu |
| 20 | Bulan sebelumnya tanpa data | Perbandingan menampilkan keterangan, bukan persentase |
| 21 | Bandingkan pengeluaran turun | Perubahan ditandai sebagai perbaikan secara wajar |
| 22 | Buka grafik dengan pembaca teks | Label, nominal, dan keterangan alternatif tersedia |
| 23 | Buat anggaran valid | Kartu anggaran, total, dan snapshot dashboard muncul |
| 24 | Buat anggaran duplikat | Ditolak dengan arahan untuk mengubah anggaran yang ada |
| 25 | Capai 80% pemakaian | Status berubah menjadi mendekati batas |
| 26 | Lewati batas anggaran | Sisa negatif dan status melewati batas tampil |
| 27 | Hapus anggaran | Hanya anggaran yang hilang; transaksi tetap utuh |
| 28 | Ekspor CSV dengan filter | Berkas berisi hanya hasil filter dan header yang benar |
| 29 | Buka CSV di spreadsheet | Karakter Indonesia benar; deskripsi berisi koma/kutip tetap utuh |
| 30 | Ekspor dengan deskripsi berawalan `=` | Sel diperlakukan sebagai teks, bukan formula |
| 31 | Ekspor saat filter kosong | Tidak ada berkas dibuat dan pesan ditampilkan |
| 32 | Reload setelah perubahan | Transaksi dan anggaran tetap sama |
| 33 | Rusak JSON di DevTools lalu reload | Data lama tidak ditimpa; banner pemulihan, unduh mentah, dan reset tersedia |
| 34 | Buat data parsial tidak valid | Data valid tetap tampil; jumlah catatan yang dilewati diumumkan |
| 35 | Simulasikan kuota penuh | Perubahan di memori tetap ada dan kegagalan disampaikan dengan jelas |
| 36 | Blokir `localStorage` | Aplikasi tetap tampil dan menjelaskan bahwa data tidak persisten |
| 37 | Navigasi keyboard pada dialog | Fokus masuk ke dialog, Tab tetap di dalam, Escape menutup, fokus kembali |
| 38 | Aktifkan `prefers-reduced-motion` | Animasi dan transisi non-esensial berkurang |
| 39 | Uji lebar 1440, 1024, 820, 390, dan 320 px | Tidak ada overflow horizontal; tabel dapat digulir di dalam panelnya |
| 40 | Periksa konsol browser | Tidak ada error JavaScript selama alur utama |

## Hasil Verifikasi Implementasi

- Semua modul JavaScript lulus `node --check`.
- Unit test logika: **18 test, 18 lulus, 0 gagal**. Mencakup validasi nominal, format rupiah, model transaksi, filter/pengurutan, ringkasan, perbandingan bulan, tren, anggaran, normalisasi data, penyimpanan berversi, dan CSV.
- Skenario browser otomatis di Chromium: **227 pemeriksaan lulus**. Mencakup CRUD, validasi, dialog, fokus, filter, pencarian, pengurutan, perpindahan bulan, grafik, anggaran, unduhan CSV, persistensi, data rusak, data parsial, kuota penuh, penyimpanan tidak tersedia, dan reduced motion.
- Viewport yang diuji: **1440×1000, 1024×900, 820×900, 390×844, dan 320×844**. Tidak ditemukan overflow horizontal tingkat halaman maupun error konsol.
- Harness pengujian dijalankan dari luar repositori. Tidak ada dependensi pengujian yang ditambahkan ke proyek.
- Checklist manual di atas tetap disediakan untuk verifikasi perilaku nyata di browser dan pembaca layar.

## Aksesibilitas

- Struktur halaman memakai landmark, heading berurutan, skip link, dan label form eksplisit.
- Dialog memakai elemen native `<dialog>` dengan `showModal()`, tombol tutup berlabel, penanganan `Escape`, dan pengembalian fokus ke pemicu.
- Semua tombol ikon memiliki nama aksesibel. Status penting diumumkan melalui `role="status"` atau `role="alert"`.
- Grafik menyediakan teks dan label ARIA, sehingga informasi tidak bergantung pada warna saja.
- Gaya `:focus-visible` dibuat jelas dan kontras.
- Animasi dinonaktifkan atau dikurangi saat `prefers-reduced-motion: reduce` aktif.

Pengujian aksesibilitas mencakup keyboard, fokus, label, dan kontras visual dasar, tetapi belum merupakan audit formal dengan pembaca layar sungguhan.
