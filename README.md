# vibecoding-journey

Dokumentasi belajar vibecoding dan proyek AI

Hari pertama belajar vibecoding dan GitHub

## Daftar Proyek

| Proyek | Deskripsi | Teknologi |
| --- | --- | --- |
| [Proyek 01 — Halo, Vibecoding!](proyek-01-halo/) | Halaman web statis pertama dengan tombol interaktif | HTML, CSS, JavaScript |
| [Proyek 02 — TaskFlow](proyek-02-taskflow/) | Aplikasi pengelola tugas pribadi dengan penyimpanan lokal | HTML, CSS, JavaScript, localStorage |
| [Proyek 03 — Expense Tracker](proyek-03-expense-tracker/) | Aplikasi pencatatan pemasukan dan pengeluaran pribadi | HTML, CSS, JavaScript, localStorage |
| [Proyek 04 — Weather Dashboard](proyek-04-weather-dashboard/) | Dashboard cuaca aktual dan prakiraan tujuh hari dengan Open-Meteo | HTML, CSS, JavaScript, Open-Meteo API |
| [Proyek 05 — Movie Explorer](proyek-05-movie-explorer/) | Aplikasi penemuan film dengan pencarian, filter, detail, dan favorit dari TMDB | HTML, CSS, JavaScript, TMDB API, localStorage |
| [Proyek 06 — Kanban Board](proyek-06-kanban-board/) | Papan tugas tiga kolom dengan CRUD, drag-and-drop, filter, statistik, dan penyimpanan lokal | HTML, CSS, JavaScript, localStorage |
| [Proyek 07 — Ritme Habit Tracker](proyek-07-habit-tracker/) | Pelacak kebiasaan harian dan mingguan dengan dashboard, kalender, streak, dan statistik | HTML, CSS, JavaScript, localStorage |
| [Proyek 08 — Neraca](proyek-08-personal-finance/) | Dashboard keuangan pribadi dengan transaksi, anggaran bulanan, grafik arus kas, dan ekspor CSV | HTML, CSS, JavaScript, localStorage, SVG |

## Proyek 02 — TaskFlow

TaskFlow adalah aplikasi pengelola tugas pribadi yang berjalan sepenuhnya di browser. Pengguna dapat menambah, mengubah, menyelesaikan, dan menghapus tugas, lalu menyaringnya berdasarkan status atau prioritas.

**Fitur utama:**

- Ringkasan jumlah tugas total, aktif, selesai, dan prioritas tinggi.
- Tambah, ubah, hapus, serta tandai tugas selesai atau aktif kembali.
- Filter Semua Tugas, Aktif, Selesai, dan Prioritas Tinggi.
- Pencarian berdasarkan judul dan tampilan kosong yang jelas.
- Penyimpanan otomatis di `localStorage`, termasuk penanganan kegagalan penyimpanan.
- Tugas contoh yang hanya muncul saat belum ada data dan dapat dihapus.
- Antarmuka responsif, navigasi keyboard, dialog aksesibel, dan dukungan `prefers-reduced-motion`.

**Teknologi:** HTML5, CSS3, vanilla JavaScript, dan `localStorage`.

Dokumentasi lengkap: [proyek-02-taskflow/README.md](proyek-02-taskflow/README.md)

## Proyek 03 — Expense Tracker

Expense Tracker adalah aplikasi pencatatan pemasukan dan pengeluaran pribadi yang berjalan sepenuhnya di browser. Aplikasi menampilkan ringkasan saldo, riwayat transaksi yang dapat difilter, dan visualisasi pengeluaran per kategori.

**Fitur utama:**

- Ringkasan total pemasukan, total pengeluaran, dan saldo bersih dalam Rupiah.
- Tambah, ubah, dan hapus transaksi dengan konfirmasi.
- Kategori pemasukan dan pengeluaran yang sesuai dengan jenis transaksi.
- Pencarian deskripsi, filter jenis, kategori, rentang tanggal, dan pengurutan tanggal.
- Grafik donat pengeluaran per kategori beserta ringkasan tekstual.
- Penyimpanan otomatis di `localStorage`, penanganan data rusak, dan transaksi contoh.
- Antarmuka Indonesia yang responsif, aksesibel, dan mendukung `prefers-reduced-motion`.

**Teknologi:** HTML5, CSS3, vanilla JavaScript, `localStorage`, dan SVG.

Dokumentasi lengkap: [proyek-03-expense-tracker/README.md](proyek-03-expense-tracker/README.md)

## Cara Menjalankan

1. Buka folder [`proyek-01-halo`](proyek-01-halo/).
2. Buka `index.html` di browser (klik dua kali), atau
3. Di VS Code, klik kanan `index.html` lalu pilih **Open with Live Server** / **Show Preview**.

Tidak perlu instalasi atau server khusus.

Untuk TaskFlow, buka [`proyek-02-taskflow/index.html`](proyek-02-taskflow/index.html) di browser dengan cara yang sama. Aplikasi ini juga tidak memerlukan instalasi atau server khusus.

Untuk Expense Tracker, buka [`proyek-03-expense-tracker/index.html`](proyek-03-expense-tracker/index.html) di browser dengan cara yang sama. Aplikasi ini juga tidak memerlukan instalasi atau server khusus.

## Catatan Belajar

- Repository ini berisi dokumentasi dan proyek kecil selama belajar vibecoding.
- Setiap proyek disimpan di foldernya sendiri (`proyek-01-...`, `proyek-02-...`, dst.).
- Commit dibuat kecil dan sering, dengan pesan yang menjelaskan perubahannya.
