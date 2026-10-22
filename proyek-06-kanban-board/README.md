# Proyek 06 — Kanban Board

Kanban Board adalah papan kerja tiga kolom untuk mengelola tugas pribadi sepenuhnya di browser. Pengguna dapat membuat, mengubah, menghapus, memindahkan, dan mengurutkan kartu tugas, lalu menyaring papan berdasarkan pencarian, prioritas, dan label. Seluruh perubahan disimpan otomatis ke `localStorage` tanpa akun, backend, API, atau dependensi eksternal.

## Fitur

- Tiga kolom tetap: **To Do**, **In Progress**, dan **Done**, masing-masing dengan jumlah kartu dan empty state.
- Tambah, lihat detail, edit, dan hapus tugas dengan konfirmasi sebelum penghapusan.
- Field tugas: judul wajib, deskripsi opsional, status, prioritas **Rendah/Sedang/Tinggi**, label opsional, tenggat opsional, serta timestamp dibuat dan diperbarui.
- ID tugas yang stabil dan unik, bukan indeks array.
- Drag-and-drop di desktop untuk memindahkan kartu antar kolom atau mengubah urutan di dalam kolom.
- Feedback target drop, indikator posisi, pencegahan duplikasi, dan pemulihan yang aman ketika drag dibatalkan.
- Alternatif keyboard dan sentuh melalui menu kartu dan pilihan status di dialog detail.
- Pencarian judul dan deskripsi, filter prioritas, filter label, kombinasi ketiganya, serta kontrol hapus filter.
- Statistik total, jumlah per status, persentase penyelesaian, dan progress bar; aman saat papan kosong.
- Penyimpanan otomatis setelah create, edit, hapus, pindah status, dan reorder.
- Penanganan data rusak, data parsial, kegagalan akses penyimpanan, dan kuota penyimpanan.
- Dialog aksesibel, focus management, focus-visible, dukungan Escape, dan toast yang tidak berlebihan.
- Tata letak responsif untuk desktop, tablet, dan mobile tanpa overflow horizontal tingkat halaman.
- Dukungan `prefers-reduced-motion`.

## Teknologi

- HTML5 semantik
- CSS3 (custom properties, grid, flexbox, animasi ringan)
- Vanilla JavaScript dengan ES Modules
- `localStorage`
- SVG inline untuk ikon dan favicon

Tidak ada framework, build tool, backend, API, layanan berbayar, dependensi baru, atau API key.

## Struktur Direktori

```text
proyek-06-kanban-board/
├── index.html          # Markup aplikasi, dialog, dan sprite ikon
├── style.css           # Desain visual dan aturan responsif
├── README.md           # Dokumentasi proyek
└── js/
    ├── app.js          # Orkestrasi state, event, dialog, filter, dan drag-and-drop
    ├── storage.js      # Baca/tulis localStorage dan penanganan kegagalan
    ├── tasks.js        # Model tugas, validasi, urutan, filter, dan statistik
    └── ui.js           # Render kartu, kolom, statistik, dialog, dan toast
```

## Prasyarat

- Browser modern yang mendukung ES Modules, `<dialog>`, dan fitur CSS yang digunakan.
- Server HTTP lokal; tidak ada instalasi paket, build step, API key, atau konfigurasi tambahan.

## Menjalankan

Aplikasi menggunakan ES Modules, jadi jalankan melalui server HTTP lokal. Dari root repositori:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/proyek-06-kanban-board/
```

Alternatif: gunakan ekstensi **Live Server** di VS Code pada `proyek-06-kanban-board/index.html`.

Membuka `index.html` langsung melalui `file://` tidak disarankan karena browser dapat memblokir pemuatan modul JavaScript.

## Cara Menggunakan

1. Klik **Tugas baru** atau tombol `+` pada header kolom untuk membuat kartu.
2. Klik judul kartu untuk melihat detail dan mengeditnya.
3. Gunakan menu `⋯` pada kartu untuk memindahkan, mengedit, atau menghapus tugas.
4. Di desktop, tarik kartu ke kolom lain atau ke posisi lain di kolom yang sama.
5. Gunakan kolom pencarian, filter prioritas, dan filter label. Tombol **Hapus filter** mengembalikan seluruh papan.
6. Status juga dapat diubah langsung dari pilihan **Status** di dialog detail. Ini adalah alternatif untuk keyboard dan perangkat sentuh.
7. Tekan `Escape` untuk menutup dialog atau menu. Fokus dikembalikan ke pemicu setelah dialog ditutup.

## Data dan Penyimpanan

Data disimpan dengan key:

```text
kanbanBoard.tasks.v1
```

Bentuk data:

```json
{
  "version": 1,
  "tasks": []
}
```

Perilaku penting:

- Setiap perubahan yang berhasil disimpan akan memperbarui indikator penyimpanan di header.
- **Tugas contoh hanya dibuat saat key belum ada.** Setelah itu, data contoh tidak dimasukkan ulang pada setiap reload.
- Menghapus semua tugas menyimpan array kosong yang valid. Papan tetap kosong setelah reload dan tidak memunculkan contoh kembali.
- Jika JSON rusak atau schema tidak dikenali, aplikasi menampilkan peringatan, mengunci perubahan tulis, dan **tidak menimpa data lama** sampai pengguna memilih **Reset data** dan mengonfirmasinya.
- Reset menulis envelope kosong yang valid. Data contoh tidak kembali setelah reset atau reload. Untuk memunculkan contoh lagi, hapus key melalui DevTools lalu reload.
- Jika sebagian data tidak valid, entri yang valid tetap ditampilkan dengan peringatan. Entri tidak valid dilewati; penyimpanan berikutnya menulis ulang data yang sudah bersih.
- Jika akses `localStorage` ditolak atau kuota penuh, perubahan tetap terlihat selama tab terbuka, tetapi aplikasi menampilkan banner, toast, dan status penyimpanan yang jelas.
- Data bersifat lokal per browser dan profil. Tidak ada sinkronisasi antar-tab, perangkat, atau browser.

Untuk mengosongkan papan secara permanen, hapus semua kartu melalui UI. Untuk mengembalikan data contoh, jalankan di konsol browser:

```js
localStorage.removeItem("kanbanBoard.tasks.v1");
location.reload();
```

## Pengujian

Repository ini tidak menyertakan test runner, skrip unit test, harness pengujian browser, log, atau laporan hasil. Klaim unit test dan pengujian browser pada versi sebelumnya tidak dapat diverifikasi dari repository; karena itu angka hasil tidak dicantumkan. Checklist berikut dapat digunakan untuk verifikasi manual.

### Checklist skenario

| No | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| 1 | Buka aplikasi pertama kali | Enam tugas contoh muncul, dua per kolom, statistik 6 dan 33% |
| 2 | Tambah tugas valid | Kartu muncul di kolom yang dipilih, statistik dan penyimpanan berubah |
| 3 | Simpan judul kosong | Validasi tampil, dialog tetap terbuka, fokus kembali ke judul |
| 4 | Edit tugas | ID dan `createdAt` tetap, `updatedAt` berubah, perubahan tersimpan |
| 5 | Buka detail lalu batalkan | Tidak ada perubahan data dan fokus kembali ke pemicu |
| 6 | Tekan Tab dan Escape di dialog | Fokus tetap di dalam dialog; Escape menutup dan mengembalikan fokus |
| 7 | Cari berdasarkan judul | Hanya kartu yang cocok yang tampil |
| 8 | Cari berdasarkan deskripsi | Kartu dengan kata kunci di deskripsi ikut ditemukan |
| 9 | Filter prioritas | Hanya kartu dengan prioritas terpilih yang tampil |
| 10 | Filter label | Hanya kartu dengan label terpilih yang tampil |
| 11 | Gabungkan pencarian, prioritas, dan label | Hasil mengikuti semua kondisi sekaligus |
| 12 | Hapus filter dan cari tanpa hasil | Kontrol kembali ke semua, empty state filter tampil dengan benar |
| 13 | Filter tidak mengubah data | Isi `localStorage` identik sebelum dan sesudah filter |
| 14 | Statistik setelah tambah/edit/pindah/hapus | Total, jumlah status, dan persentase selalu sesuai data |
| 15 | Papan kosong | Statistik 0, persentase 0%, empty state global dan per kolom tampil |
| 16 | Reorder di kolom yang sama | Urutan kartu berubah dan tersimpan |
| 17 | Pindah kartu antar kolom | Status berubah, tidak ada duplikasi, statistik diperbarui |
| 18 | Batalkan drag | Tidak ada perubahan data atau urutan |
| 19 | Drag saat filter aktif | Reorder dinonaktifkan; menu kartu dan dialog tetap menjadi alternatif |
| 20 | Reload setelah perubahan | Data, status, dan urutan tetap sama; contoh tidak diduplikasi |
| 21 | Hapus semua tugas lalu reload | Papan tetap kosong; contoh tidak muncul kembali |
| 22 | Hapus dengan konfirmasi | Pembatalan mempertahankan tugas; konfirmasi menghapusnya |
| 23 | Data JSON rusak | Data lama tidak ditimpa; reset hanya setelah konfirmasi |
| 24 | Data schema parsial | Data valid tetap tampil, data tidak valid dilewati dengan peringatan |
| 25 | Akses `localStorage` gagal | Aplikasi tetap tampil dan memberi pesan yang jelas |
| 26 | Kuota penyimpanan penuh | Perubahan di memori dipertahankan, kegagalan diberitahukan, lalu dapat pulih |
| 27 | Viewport 1440, 1024, 820, dan 390 px | Tidak ada overflow horizontal halaman; dialog mobile berada di viewport |
| 28 | Konsol browser | Tidak ada error atau exception JavaScript |

### Catatan pengujian

Pengujian tidak dijalankan ulang pada pembaruan dokumentasi ini; tidak ada hasil pengujian yang diklaim. Gunakan checklist di atas untuk memverifikasi perilaku aplikasi secara langsung di browser.

## Batasan

- Penyimpanan hanya lokal di browser dan dapat hilang jika data situs dibersihkan atau penyimpanan browser tidak tersedia.
- Tidak ada sinkronisasi antar-tab, akun, kolaborasi, cloud backup, atau impor/ekspor.
- Tidak ada undo setelah penghapusan; penghapusan hanya dilindungi dialog konfirmasi.
- Drag-and-drop mengandalkan HTML5 Drag and Drop, sehingga tidak diandalkan pada perangkat sentuh. Gunakan menu kartu atau ubah **Status** di dialog detail.
- Urutan kartu tidak dapat diubah dengan drag saat filter aktif. Perubahan status tetap tersedia melalui menu dan dialog.
- Board selalu menampilkan ketiga status; belum ada filter status terpisah.
- Label berupa teks bebas; belum ada pengelolaan daftar label terpusat.
- Tenggat tanggal tidak menghasilkan pengingat atau notifikasi, dan dihitung sebagai tanggal lokal.
- Tampilan dan dialog mengandalkan browser modern yang mendukung `<dialog>`, ES Modules, dan fitur CSS modern. Chrome, Edge, Firefox, dan Safari versi terbaru direkomendasikan.
- Aksesibilitas mencakup keyboard, fokus, label ARIA, dan kontras visual dasar, tetapi belum merupakan audit formal dengan pembaca layar.
