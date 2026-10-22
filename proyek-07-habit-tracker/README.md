# Proyek 07 — Ritme Habit Tracker

Ritme adalah pelacak kebiasaan yang berjalan sepenuhnya di browser. Semua data disimpan secara lokal; tidak ada akun, backend, API key, atau data contoh yang dikirim ke server.

## Fitur

- **Dashboard** dengan ringkasan kebiasaan aktif, progres hari ini, streak terbaik, konsistensi tujuh hari, dan daftar fokus hari ini.
- **Kebiasaan harian atau mingguan** dengan kategori, warna aksen, dan deskripsi opsional.
- **Tambah, edit, arsipkan, aktifkan kembali, dan hapus** kebiasaan. Penghapusan meminta konfirmasi dan menghapus riwayat terkait.
- **Check-in** dari dashboard atau kalender. Check-in pada tanggal yang belum terjadi, tanggal sebelum kebiasaan dibuat, atau hari yang tidak dijadwalkan tidak tersedia.
- **Kalender bulanan** dengan navigasi bulan, ringkasan aktivitas per hari, riwayat arsip, dan navigasi keyboard.
- **Pencarian dan filter** berdasarkan nama, kategori, serta status aktif/arsip/semua.
- **Statistik** berupa total check-in, penyelesaian tujuh dan tiga puluh hari, streak berjalan, streak terpanjang, serta konsistensi per kebiasaan.
- **Penyimpanan lokal** dengan penanganan data rusak, data parsial, akses penyimpanan yang diblokir, dan kuota penuh.
- **Antarmuka Indonesia yang responsif dan aksesibel**: navigasi keyboard, dialog dengan pengembalian fokus, label ARIA, serta dukungan `prefers-reduced-motion`.

Aplikasi dimulai tanpa data contoh. Kebiasaan pertama dibuat melalui tombol **Kebiasaan baru**.

## Prasyarat

- Browser modern yang mendukung ES Modules, `<dialog>`, dan `localStorage`.
- Server HTTP lokal; tidak ada instalasi paket, build step, API key, atau konfigurasi tambahan.

## Cara Menjalankan

Jalankan folder proyek melalui server lokal karena aplikasi menggunakan ES Modules. Dari folder ini:

```bash
python -m http.server 8000
```

Lalu buka `http://localhost:8000`. Alternatifnya, gunakan **Live Server** di editor. Membuka `index.html` langsung melalui `file://` dapat diblokir browser untuk modul JavaScript.

Tidak ada proses build, instalasi paket, API key, atau konfigurasi tambahan.

## Aturan Statistik dan Streak

- Statistik dan streak hanya menghitung **kebiasaan aktif**. Kebiasaan yang diarsipkan tidak lagi menambah target atau persentase.
- Total check-in tetap mencakup riwayat kebiasaan yang diarsipkan. Riwayat arsip juga tetap terlihat di kalender.
- Streak hanya menghitung hari yang benar-benar dijadwalkan:
  - kebiasaan harian dijadwalkan setiap hari;
  - kebiasaan mingguan hanya pada hari yang dipilih.
- Hari tanpa jadwal dilewati dan tidak memutus streak.
- Hari ini yang belum selesai tidak memutus streak berjalan; streak berjalan baru berhenti ketika ada hari terjadwal di masa lalu yang terlewat.
- Tanggal masa depan diabaikan.
- **Streak berjalan** dan **streak terpanjang** dihitung terpisah.
- Konsistensi 30 hari per kebiasaan hanya menghitung hari yang dijadwalkan sejak kebiasaan dibuat.

## Arsip dan Penghapusan

Mengarsipkan kebiasaan menghentikan jadwal dan check-in baru, tetapi mempertahankan seluruh riwayat. Kebiasaan arsip dapat diaktifkan kembali. Menghapus kebiasaan bersifat permanen dan ikut menghapus check-in milik kebiasaan tersebut.

## Data dan Penyimpanan

Data disimpan di `localStorage` dengan kunci `habitTracker.data.v1` dan format:

```json
{
  "version": 1,
  "habits": [
    {
      "id": "habit-...",
      "name": "Baca buku",
      "description": "Sepuluh halaman setiap hari",
      "category": "learning",
      "color": "teal",
      "frequency": { "type": "daily", "days": [] },
      "createdOn": "2026-10-21",
      "updatedAt": "2026-10-21T08:00:00.000Z",
      "archivedAt": null
    }
  ],
  "checkins": {
    "habit-...": ["2026-10-21"]
  }
}
```

- `frequency.type` bernilai `daily` atau `weekly`.
- `frequency.days` berisi angka hari dengan urutan JavaScript: `0` Minggu sampai `6` Sabtu. Array ini kosong untuk kebiasaan harian.
- `createdOn`, `archivedAt`, dan tanggal check-in memakai tanggal lokal `YYYY-MM-DD`.
- Semua data tetap berada di browser dan tidak dikirim ke mana pun.

### Pemulihan Data

- **Data rusak**: aplikasi tidak menimpa data lama secara diam-diam. Perubahan dikunci sampai pengguna mengunduh data mentah dan mengonfirmasi reset.
- **Data parsial**: rekaman valid tetap ditampilkan dengan peringatan; rekaman tidak valid dilewati. Perubahan berikutnya menyimpan data valid yang terlihat.
- **Penyimpanan tidak tersedia atau kuota penuh**: perubahan tetap berada di memori selama tab terbuka, dan aplikasi memberi tahu bahwa data belum tersimpan.

## Struktur Direktori

```text
proyek-07-habit-tracker/
├── index.html
├── style.css
├── README.md
└── js/
    ├── app.js        # orkestrasi aplikasi, dialog, persistensi
    ├── calendar.js   # detail hari dan grid bulanan
    ├── checkins.js   # normalisasi dan operasi check-in
    ├── dates.js      # tanggal lokal, format, dan utilitas kalender
    ├── habits.js     # model, validasi, jadwal, arsip
    ├── stats.js      # streak, progres, dan ringkasan
    ├── storage.js    # pemuatan/penyimpanan berversi
    └── ui.js         # perenderan dan dialog
```

## Teknologi

HTML5, CSS3, dan vanilla JavaScript (ES Modules) dengan `localStorage`. Tanpa framework, backend, API key, atau dependensi baru.

## Pengujian

Repository ini tidak menyertakan suite pengujian otomatis. Pemeriksaan manual yang disarankan:

1. Buat kebiasaan harian dan mingguan, lalu periksa jadwal serta kategori.
2. Lakukan check-in dari dashboard dan kalender; pastikan tanggal yang tidak dijadwalkan tidak dapat dicentang.
3. Periksa streak, konsistensi tujuh dan tiga puluh hari, serta ringkasan progres.
4. Arsipkan kebiasaan, aktifkan kembali, lalu hapus dengan konfirmasi.
5. Cari dan filter berdasarkan nama, kategori, serta status.
6. Muat ulang halaman dan pastikan data tetap tersimpan.
7. Uji navigasi keyboard, dialog, dan `prefers-reduced-motion`.

Pembaruan dokumentasi ini tidak menjalankan pengujian browser.

## Batasan

- Data hanya tersimpan di browser dan perangkat yang sama; tidak ada sinkronisasi, akun, atau cadangan cloud.
- Menghapus data situs atau memakai mode privat dapat menghilangkan data.
- Tidak ada pengingat, notifikasi, impor, atau ekspor data.
- Aplikasi dimulai tanpa data contoh; kebiasaan pertama harus dibuat secara manual.
- Penghapusan kebiasaan bersifat permanen dan ikut menghapus riwayat check-in terkait.
- Tampilan memerlukan browser modern dan server HTTP lokal karena memakai ES Modules.
