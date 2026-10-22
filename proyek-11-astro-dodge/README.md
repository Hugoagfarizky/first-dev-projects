# Proyek 11 — Astro Dodge

Astro Dodge adalah game arcade survival bertema luar angkasa yang dibuat dengan HTML5 Canvas, CSS, dan JavaScript vanilla. Pesawat berada di bagian bawah arena, asteroid jatuh dari atas, dan pemain harus bertahan selama mungkin untuk menambah skor.

Game ini dibuat sebagai latihan membangun game 2D tanpa framework, game engine, dependency npm, atau proses build. Seluruh visual pesawat, asteroid, bintang, planet, dan partikel digambar menggunakan Canvas 2D API.

## Tujuan Pembelajaran

- Menggambar dan menganimasikan objek 2D langsung di Canvas.
- Mengatur satu game loop dengan `requestAnimationFrame` dan delta time.
- Memisahkan pembaruan simulasi dari proses rendering.
- Menerapkan input keyboard dan pointer untuk perangkat sentuh.
- Mendeteksi tabrakan antara hitbox pesawat dan asteroid.
- Mengelola state permainan, skor, kesulitan, dan rekor lokal.
- Menjaga canvas tetap tajam dan responsif tanpa mengubah ukurannya setiap frame.

## Fitur Gameplay

- Pesawat bergerak horizontal di bagian bawah arena dan tidak dapat keluar dari batas.
- Asteroid muncul dari atas dengan posisi, ukuran, dan kecepatan yang bervariasi.
- Interval kemunculan asteroid memendek dan kecepatannya meningkat secara bertahap selama sekitar 75 detik pertama.
- Asteroid yang melewati bawah arena langsung dihapus dari daftar objek.
- Jumlah asteroid aktif dibatasi agar objek tidak menumpuk tanpa batas.
- Skor bertambah berdasarkan durasi bertahan, yaitu 10 poin per detik.
- Tabrakan mengakhiri permainan dan menampilkan skor akhir.
- Rekor tertinggi disimpan di `localStorage` dan hanya diperbarui saat game over jika skor baru lebih tinggi.
- Pause menghentikan simulasi dan skor; restart memakai loop yang sama, bukan membuat loop baru.
- Tab yang tidak aktif otomatis membuat permainan dijeda.
- Efek bintang, planet, semburan mesin, dan partikel dibuat dengan Canvas primitives tanpa aset eksternal.
- `prefers-reduced-motion` mengurangi animasi dekoratif dan partikel.
- UI memakai Bahasa Indonesia dan menyediakan status tekstual, bukan hanya warna.

## Kontrol

| Aksi | Keyboard | Sentuh |
| --- | --- | --- |
| Gerak ke kiri | `ArrowLeft` atau `A` | Tombol **Kiri** |
| Gerak ke kanan | `ArrowRight` atau `D` | Tombol **Kanan** |
| Jeda / lanjutkan | `P`, `Escape`, atau `Space` saat fokus berada di arena | Tombol **Jeda** / **Lanjutkan** |
| Mulai / main lagi | Tombol **Mulai permainan** / **Main lagi** | Tombol yang sama |

Keyboard tidak menggerakkan pesawat ketika fokus berada pada tombol atau elemen interaktif. Setelah permainan dimulai, fokus dipindahkan ke canvas; setelah dijeda, fokus dipindahkan ke tombol **Lanjutkan**.

## Teknologi

- HTML5
- CSS3
- JavaScript vanilla dengan ES Modules
- Canvas 2D API
- `requestAnimationFrame`
- `localStorage` hanya untuk rekor tertinggi

Tidak menggunakan framework, game engine, backend, API eksternal, dependency npm, build tool, Service Worker, atau fitur PWA.

## Struktur Direktori

```text
proyek-11-astro-dodge/
├── index.html
├── style.css
├── README.md
└── js/
    ├── app.js
    ├── game.js
    ├── player.js
    ├── asteroid.js
    └── collision.js
```

- `index.html`: struktur UI, canvas, overlay menu/pause/game over, HUD, dan tombol sentuh.
- `style.css`: tema luar angkasa, layout responsif, state tombol, focus ring, dan reduced motion.
- `js/app.js`: referensi DOM, input keyboard/pointer, state UI, rekor `localStorage`, resize, dan visibility.
- `js/game.js`: game loop, simulasi fixed-step, spawning, skor, kesulitan, background, dan rendering.
- `js/player.js`: posisi, batas gerak, hitbox, dan penggambaran pesawat.
- `js/asteroid.js`: bentuk, rotasi, kecepatan, hitbox, dan pembersihan asteroid.
- `js/collision.js`: helper clamp, deteksi lingkaran terhadap persegi panjang, dan tabrakan pemain-asteroid.

## Cara Menjalankan

Karena JavaScript dimuat sebagai ES Modules, gunakan static server lokal. Game tidak memerlukan instalasi dependency.

Dari root repository:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/proyek-11-astro-dodge/
```

Alternatifnya, gunakan static server lokal lain atau fitur Live Server di editor. Membuka `index.html` langsung melalui `file://` tidak diandalkan karena import ES Modules dapat diblokir oleh browser.

## Cara Kerja

### Game loop dan delta time

Game membuat satu loop `requestAnimationFrame` saat objek `Game` dibuat. Loop tersebut menjadwalkan dirinya sendiri, tetapi tidak membuat loop kedua saat mulai, pause, resume, atau restart.

Delta time dari browser dibatasi maksimal 0,1 detik agar tab yang sempat tidak aktif tidak membuat objek meloncat jauh. Simulasi berjalan dalam langkah tetap 1/120 detik menggunakan accumulator, dengan maksimal 12 langkah per frame. Pendekatan ini menjaga gerakan dan tabrakan tetap konsisten ketika frame rate berubah, sekaligus menghindari spiral of death.

Saat state bukan `playing`, simulasi dan skor tidak diperbarui. Rendering tetap berjalan untuk mempertahankan tampilan background dan overlay. Saat tab kembali terlihat, permainan tetap dijeda sampai pengguna menekan **Lanjutkan**.

### Collision detection

Hitbox asteroid dimodelkan sebagai lingkaran, sedangkan pesawat memakai persegi panjang yang lebih kecil dari gambar pesawat. Fungsi `circleIntersectsRect()` mencari titik terdekat antara pusat lingkaran dan persegi panjang, lalu membandingkan jaraknya dengan radius.

Pemeriksaan tabrakan dilakukan pada setiap langkah fixed-step 1/120 detik. Asteroid yang keluar dari bawah arena dihapus dari array. Jika tabrakan terdeteksi, state berubah menjadi `gameover`, simulasi berhenti, dan skor akhir dikirim ke UI.

### Skor, kesulitan, dan rekor

- Waktu bertahan dihitung hanya selama state `playing`.
- Skor adalah `floor(waktuBertahan × 10)`, sehingga bertambah 10 poin setiap detik.
- Kesulitan meningkat selama 75 detik: interval spawn mendekati 0,35 detik dan kecepatan asteroid bertambah. Kecepatan serta interval tetap memiliki variasi acak.
- Maksimal 26 asteroid aktif; asteroid offscreen dibersihkan setiap langkah.
- Rekor tertinggi disimpan dengan kunci `astroDodgeHighScore`.
- Rekor hanya diganti saat game over jika skor akhir lebih besar dari rekor sebelumnya.
- Tidak ada data permainan lain yang disimpan secara persisten.

### Rendering dan responsivitas

- Canvas mengikuti ukuran elemen stage melalui `ResizeObserver` dan event `resize`.
- Backing store canvas mengikuti device pixel ratio, dibatasi maksimal 2 agar tetap tajam tanpa membebani perangkat ber-DPR tinggi.
- Ukuran canvas tidak diubah setiap frame.
- Saat resize, posisi pemain dan asteroid diskalakan terhadap ukuran arena baru; posisi horizontal pemain juga dijepit ke batas.
- Background memakai gradien, bintang, planet, dan garis horizon yang seluruhnya digambar dengan Canvas.
- Posisi pemain, ukuran asteroid, dan hitbox disimpan dalam koordinat CSS yang sama dengan konteks setelah transform DPR.

### Aksesibilitas dan keamanan

- Tombol memiliki label aksesibel; tombol sentuh memakai `aria-label`.
- Canvas memiliki label dan terhubung ke instruksi kontrol melalui `aria-describedby`.
- Status permainan diumumkan melalui live region `role="status"` dengan `aria-live="polite"` pada momen mulai, dijeda, dilanjutkan, dan game over. Skor tidak diumumkan setiap frame.
- Status memakai teks, bukan hanya warna.
- Fokus keyboard tidak menggerakkan pesawat ketika berada pada elemen interaktif.
- `prefers-reduced-motion` mengurangi animasi CSS, twinkle bintang, dan partikel.
- Teks dinamis ditulis dengan `textContent`; tidak ada penggunaan `innerHTML`.
- `localStorage` dibungkus `try/catch` agar kegagalan penyimpanan tidak menghentikan permainan.

## Checklist Pengujian Manual

- [ ] Buka game melalui static server dan pastikan menu awal tampil.
- [ ] Tekan **Mulai permainan** dan cek skor bertambah selama bermain.
- [ ] Gerakkan pesawat dengan panah kiri/kanan dan `A`/`D`.
- [ ] Tahan tombol gerak sampai batas arena; pesawat tidak keluar dari arena.
- [ ] Tekan **Jeda**, tunggu beberapa detik, lalu pastikan skor tidak berubah.
- [ ] Tekan **Lanjutkan** dan pastikan permainan berjalan kembali.
- [ ] Biarkan asteroid menabrak pesawat dan cek overlay game over.
- [ ] Tekan **Main lagi** dan pastikan skor kembali dari awal tanpa gerakan ganda.
- [ ] Muat ulang halaman dan pastikan rekor tetap tampil.
- [ ] Di ponsel, gunakan tombol **Kiri** dan **Kanan** serta cek layout tidak melebar.
- [ ] Fokuskan tombol dengan keyboard, lalu tekan panah; pesawat tidak boleh bergerak.
- [ ] Aktifkan reduced motion dan pastikan efek dekoratif berkurang.
- [ ] Pindahkan tab ke background saat bermain dan pastikan permainan dijeda.
- [ ] Ubah ukuran jendela saat bermain atau dijeda; state tidak boleh rusak.

## Status Pengujian yang Benar-Benar Dijalankan

Pengujian dilakukan pada 22 Oktober 2026 dengan:

- Node.js `v24.21.0` untuk pemeriksaan sintaks.
- Python `3.14.8` sebagai static server lokal.
- Google Chrome `155.0.8059.85` mode headless dengan profil pengguna sementara yang terisolasi.
- Emulasi `prefers-reduced-motion: reduce`.
- Viewport desktop 1440 × 1100 dan viewport mobile 390 × 844, ditambah resize ke 430 × 900.

Hasil yang benar-benar teramati:

- `node --check` berhasil untuk kelima modul JavaScript.
- Tidak ada referensi ID DOM yang hilang antara `app.js` dan `index.html`.
- Tidak ada exception, console error, atau permintaan resource yang gagal setelah favicon inline ditambahkan.
- Canvas desktop menggunakan ukuran backing store yang sesuai DPR; mobile memakai DPR efektif 2 dan rasio lebar/tinggi canvas mendekati 1.
- Tidak ada overflow horizontal pada kedua viewport yang diuji.
- Tombol **Mulai permainan** mengubah state ke `playing`; fokus berpindah ke canvas.
- Tombol **Jeda** mengubah state ke `paused`; skor tetap `4` setelah menunggu 700 ms.
- `ArrowRight` mengubah piksel area permainan, yang menunjukkan pesawat bergerak.
- Saat fokus dipindahkan ke tombol Jeda dan tombol panah dikirim ke elemen tersebut, signature canvas tidak berubah. Ini memverifikasi input gerak diabaikan ketika fokus berada pada elemen interaktif.
- Tabrakan yang dipaksa secara deterministik menghasilkan state `gameover`, skor akhir `56`, rekor `56`, pesan “Rekor baru: 56.”, dan fokus pada tombol **Main lagi**.
- `localStorage` hanya berisi kunci `astroDodgeHighScore` dengan nilai `"56"`.
- **Main lagi** memulai permainan baru dengan skor kembali rendah; penghitung `requestAnimationFrame` sebelum dan sesudah restart menghasilkan rasio sekitar `0.93`, sehingga tidak ada loop ganda.
- Setelah reload halaman, rekor `56` tetap tampil.
- Tombol sentuh **Kanan** mengubah signature canvas pada viewport mobile.
- Resize saat paused mempertahankan state `paused` dan ukuran canvas menyesuaikan DPR.
- Simulasi event `visibilitychange` saat tab dianggap tidak aktif mengubah state menjadi `paused`.
- Total 41 pemeriksaan browser dijalankan dan seluruhnya lulus pada harness sementara. Harness dan profil browser kemudian dibersihkan.

Pengujian loop berjalan pada sekitar 27–29 callback `requestAnimationFrame` per detik di lingkungan headless. Perbandingan benchmark khusus antara 60 Hz dan 120 Hz tidak dijalankan; konsistensi tabrakan didukung oleh simulasi fixed-step 1/120 detik dan pembersihan objek, bukan oleh klaim hasil benchmark yang belum diukur.

## Batasan yang Belum Diselesaikan

- Game memerlukan static HTTP server karena memakai ES Modules; membuka langsung melalui `file://` tidak dijamin berfungsi.
- Jika `localStorage` diblokir browser, rekor tetap tampil selama sesi berjalan tetapi tidak bertahan setelah reload.
- Pengujian browser dilakukan secara otomatis di Chrome headless; belum diuji pada Firefox, Safari, perangkat fisik, atau pembaca layar nyata.
- Tampilan canvas tidak sepenuhnya dapat dimainkan oleh pengguna pembaca layar; live region hanya mengumumkan perubahan state penting.
- Belum ada pengujian beban jangka panjang, profil memori, atau benchmark perbandingan refresh rate 60/120 Hz.
- Keseimbangan kesulitan dan rasa kontrol belum diuji melalui playtest manusia dalam jumlah besar.
- Tidak ada audio, sistem nyawa, power-up, atau mode permainan tambahan.
