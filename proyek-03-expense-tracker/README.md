# Expense Tracker

Expense Tracker adalah aplikasi pencatatan pemasukan dan pengeluaran pribadi yang berjalan sepenuhnya di browser. Tujuannya adalah memberi gambaran arus kas yang sederhana dan mudah dipahami: berapa uang masuk, ke mana uang keluar, dan bagaimana saldo bersih saat ini.

Aplikasi ini dibuat sebagai proyek latihan vibecoding dengan HTML, CSS, dan JavaScript tanpa framework, tanpa proses build, dan tanpa backend. Seluruh data transaksi disimpan di `localStorage` pada browser yang digunakan.

## Fitur

- **Dashboard keuangan** — total pemasukan, total pengeluaran, saldo bersih, dan status surplus/defisit yang dihitung dari data transaksi.
- **Tambah transaksi** — jenis pemasukan atau pengeluaran, nominal Rupiah, kategori sesuai jenis, tanggal, dan deskripsi opsional.
- **Ubah transaksi** — memperbarui transaksi yang sudah ada tanpa membuat duplikat.
- **Hapus transaksi** — penghapusan satu transaksi atau seluruh transaksi melalui dialog konfirmasi.
- **Validasi input** — nominal kosong, nol, negatif, bukan angka, atau terlalu besar ditolak dengan pesan Bahasa Indonesia. Jenis, kategori, dan tanggal juga divalidasi.
- **Riwayat transaksi** — daftar responsif berisi tanggal, deskripsi, kategori, jenis, nominal, serta aksi ubah dan hapus.
- **Pencarian dan filter** — pencarian deskripsi, filter jenis, filter kategori, rentang tanggal, dan pengurutan tanggal terbaru/terlama. Semua filter dapat dikombinasikan dan dihapus.
- **Visualisasi kategori** — grafik donat SVG pengeluaran per kategori, lengkap dengan nama kategori, nominal, persentase, dan ringkasan tekstual.
- **Transaksi terbaru** — lima transaksi terbaru ditampilkan di dashboard.
- **Penyimpanan lokal** — data disimpan setelah setiap perubahan dan dimuat kembali saat halaman dibuka.
- **Data contoh** — delapan transaksi contoh hanya dibuat ketika penyimpanan belum pernah diinisialisasi. Data contoh dapat dihapus tanpa menghapus transaksi buatan pengguna.
- **Penanganan kegagalan penyimpanan** — kegagalan baca/tulis dan data rusak ditangani tanpa menghentikan aplikasi. Data mentah yang bermasalah dicadangkan bila penyimpanan mengizinkan.
- **Aksesibilitas dan responsivitas** — struktur semantik, label form, fokus keyboard yang terlihat, dialog native, dukungan `prefers-reduced-motion`, serta layout untuk ponsel hingga desktop.

## Teknologi

- HTML5
- CSS3 (custom properties, grid, flexbox, media queries, reduced motion)
- Vanilla JavaScript (ES2020+, tanpa library)
- Browser `localStorage`
- Format mata uang `id-ID` / `IDR`
- SVG untuk grafik kategori

## Struktur File

```text
proyek-03-expense-tracker/
├── index.html   # Struktur halaman, dashboard, filter, dan dialog
├── style.css    # Tema, layout responsif, komponen, reduced motion
├── script.js    # Data, validasi, perhitungan, filter, grafik, penyimpanan
└── README.md
```

## Cara Menjalankan

Tidak ada instalasi, dependency, atau proses build.

1. Buka `proyek-03-expense-tracker/index.html` langsung di browser modern (klik dua kali), atau
2. Dari VS Code, klik kanan `index.html` lalu pilih **Open with Live Server** / **Show Preview** jika tersedia.

JavaScript harus diizinkan agar aplikasi dapat mencatat dan menyimpan transaksi. Setelah file tersedia secara lokal, aplikasi tidak memerlukan koneksi jaringan dan tidak memerlukan server backend.

## Cara Kerja localStorage

- Transaksi disimpan sebagai array JSON pada key **`expenseTracker.transactions.v1`**.
- Jika key belum pernah ada, aplikasi membuat delapan transaksi contoh dan menyimpannya.
- Jika key sudah ada tetapi berisi array kosong, aplikasi tetap menampilkan daftar kosong dan tidak membuat ulang data contoh.
- Setiap tambah, ubah, hapus, atau hapus semua transaksi langsung disimpan ke `localStorage`.
- Jika data tidak dapat dibaca atau formatnya tidak sesuai, aplikasi tidak langsung menimpa data lama. Data mentah dicadangkan ke **`expenseTracker.transactions.backup.v1`** bila penyimpanan mengizinkan, lalu aplikasi mulai dengan daftar kosong. Perubahan berikutnya dari pengguna akan menulis data baru.
- Jika `localStorage` tidak dapat dibaca sama sekali, aplikasi tetap berjalan di memori tetapi sengaja tidak menulis data baru pada sesi tersebut agar data lama tidak tertimpa. Muat ulang halaman untuk mencoba membaca kembali.
- Jika `localStorage` tidak tersedia atau penuh, aplikasi tetap dapat digunakan di tab saat ini, tetapi perubahan bisa hilang saat halaman dimuat ulang.
- Tombol **Hapus Data Contoh** hanya menghapus transaksi yang masih ditandai sebagai contoh. Transaksi contoh yang sudah Anda ubah dianggap transaksi pengguna.

## Batasan

- Data hanya tersimpan pada browser dan perangkat yang sama. Data tidak otomatis tersinkronisasi antar-browser, antar-perangkat, atau dengan mode incognito.
- Tidak ada autentikasi, backend, cloud sync, integrasi bank, atau layanan finansial sungguhan.
- Menghapus data situs di browser dapat menghapus seluruh transaksi.
- Aplikasi menggunakan `localStorage`, sehingga kapasitas penyimpanan mengikuti batas browser.
- Tampilan date-picker native dapat mengikuti locale browser; tanggal yang ditampilkan aplikasi menggunakan format Indonesia.
