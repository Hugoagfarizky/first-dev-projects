# Proyek 12 — Soundwave Studio

Soundwave Studio adalah pemutar audio lokal dengan visualisasi real-time di browser. Pengguna dapat memilih file audio dari perangkat, memutar dan menjeda audio, mengubah posisi serta volume, lalu melihat spektrum frekuensi atau bentuk gelombang yang dihitung langsung dari sinyal audio.

Aplikasi dibuat sebagai latihan menggunakan HTML5 Audio, Web Audio API, Canvas 2D, dan JavaScript vanilla. Tidak ada framework, backend, dependency npm, build tool, library visualisasi, atau aset internet.

## Tujuan Pembelajaran

- Memahami peran `AudioContext` dan siklus hidupnya.
- Menghubungkan `HTMLAudioElement` ke `MediaElementAudioSourceNode`.
- Membaca data frekuensi dan time-domain melalui `AnalyserNode`.
- Menggambar visualisasi audio yang benar-benar mengikuti sinyal.
- Menjaga satu loop `requestAnimationFrame` untuk visualisasi.
- Mengelola object URL file lokal dan membersihkannya saat tidak diperlukan.
- Menangani metadata, durasi, error dekode, play/pause, seek, volume, dan akhir pemutaran.
- Membuat UI audio yang responsif, dapat digunakan dengan keyboard, dan tidak bergantung pada warna saja.

## Fitur Pemutar

- Memilih file audio lokal melalui file picker dengan filter `audio/*` dan beberapa ekstensi audio umum.
- Menampilkan nama file, ukuran, dan tipe MIME yang dilaporkan browser.
- Play, pause, dan putar ulang setelah audio selesai.
- Seek melalui progress bar, termasuk penggunaan panah, Home, dan End dari keyboard.
- Menampilkan waktu berjalan dan durasi total.
- Volume dan mute/unmute, keduanya dapat dikontrol dengan keyboard.
- Status tekstual: belum ada audio, memuat, siap, sedang diputar, dijeda, selesai, dan error.
- Tombol **Ganti audio** tetap tersedia tanpa meninggalkan pemutar.
- Pesan error untuk file kosong, tipe non-audio, file rusak, dan format yang tidak dapat didekode browser.
- Preferensi mode visualisasi dan volume disimpan di `localStorage` bila tersedia.

## Mode Visualisasi

### Spectrum

- Batang frekuensi digambar dari `AnalyserNode.getByteFrequencyData()`.
- Pemetaan batang memakai skala logaritmik dari sekitar 40 Hz sampai batas aman di bawah Nyquist, sehingga frekuensi rendah, menengah, dan tinggi sama-sama memiliki ruang visual.
- Warna batang memberikan kontras visual, tetapi informasi mode dan status tetap disampaikan melalui teks.
- Label frekuensi membantu membaca rentang yang ditampilkan.

### Waveform

- Garis gelombang digambar dari `AnalyserNode.getByteTimeDomainData()`.
- Amplitudo dan bentuk garis berasal dari sampel audio aktual, bukan animasi dekoratif.
- Garis tengah menunjukkan level nol dan label `+1`, `0`, serta `−1` menunjukkan skala ternormalisasi.

### Perilaku saat audio tidak berjalan

- Loop visualisasi berhenti saat audio dijeda, selesai, error, atau saat tab tidak terlihat.
- Saat dijeda atau selesai, frame terakhir dipertahankan dan diredupkan; tidak ada data baru yang seolah-olah masih aktif.
- Indikator energi menampilkan `—` ketika analyser tidak sedang menerima audio aktif.
- Saat file diganti, data visualisasi lama dibersihkan sebelum file baru siap.
- Memulai audio kembali memakai loop yang sama; tidak ada loop baru yang dibuat setiap kali Play ditekan.

## Teknologi

- HTML5 dan elemen `HTMLAudioElement`
- CSS3
- JavaScript vanilla dengan ES Modules
- Web Audio API: `AudioContext`, `MediaElementAudioSourceNode`, `AnalyserNode`
- Canvas 2D API
- `requestAnimationFrame`
- File API dan object URL
- `localStorage` hanya untuk mode visualisasi dan volume

Tidak menggunakan mikrofon, perekaman audio, upload file, backend, API eksternal, CDN, font eksternal, atau dependency npm.

## Struktur Direktori

```text
proyek-12-soundwave-studio/
|-- index.html
|-- style.css
|-- README.md
|-- assets/
|   `-- icon.svg
`-- js/
    |-- app.js
    |-- audio-engine.js
    |-- visualizer.js
    `-- player-ui.js
```

- `index.html`: struktur pemutar, canvas, kontrol, status, indikator energi, dan live region.
- `style.css`: tema dark studio, layout responsif, state kontrol, focus ring, dan reduced motion.
- `js/app.js`: inisialisasi aplikasi, referensi DOM, preferensi reduced motion, dan cleanup saat halaman ditinggalkan.
- `js/audio-engine.js`: lifecycle `HTMLAudioElement`, `AudioContext`, source node, analyser, object URL, metadata, dan error audio.
- `js/visualizer.js`: satu loop visualisasi, pembacaan analyser, mode spectrum/waveform, ukuran canvas, dan indikator energi.
- `js/player-ui.js`: interaksi pemutar, status UI, seek, volume, mode, keyboard shortcut, dan penyimpanan preferensi.
- `assets/icon.svg`: favicon lokal.

## Cara Menjalankan

Gunakan static HTTP server lokal. Aplikasi memakai ES Modules, sehingga membuka `index.html` langsung melalui `file://` tidak diandalkan.

Dari root repository:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/proyek-12-soundwave-studio/
```

Alternatifnya, gunakan static server lokal lain. Tidak ada dependency yang perlu dipasang.

## Cara Menggunakan

1. Tekan **Pilih audio** dan pilih file dari perangkat.
2. Tunggu status berubah menjadi **Siap diputar**.
3. Tekan **Putar** untuk memulai audio dan visualisasi.
4. Gunakan **Spectrum** atau **Waveform** untuk berganti mode.
5. Geser progress bar untuk berpindah posisi; waktu berjalan dan durasi ditampilkan di atasnya.
6. Atur volume dengan slider atau tekan tombol mute.
7. Tekan **Ganti audio** untuk memilih file lain. File lama akan dilepas dari pemutar.
8. Saat audio selesai, tombol berubah menjadi **Putar ulang**.

Tombol **Spasi** juga memutar atau menjeda audio ketika fokus tidak berada pada kontrol interaktif. Range seek dan volume mendukung tombol panah, Home, dan End sesuai perilaku kontrol range browser.

## Cara Kerja Audio

### AudioContext dan source node

`AudioContext` tidak dibuat saat halaman dimuat. Context baru dibuat saat pengguna menekan Play, sehingga pembuatan dan resume terjadi dalam interaksi pengguna yang sesuai dengan kebijakan autoplay browser.

Saat pertama kali dibutuhkan, engine:

1. Membuat `AudioContext`.
2. Membuat satu `AnalyserNode` dengan `fftSize = 2048`.
3. Membuat satu `MediaElementAudioSourceNode` dari elemen audio.
4. Menghubungkan source ke analyser, lalu analyser ke destination.
5. Menjalankan atau melanjutkan context dan memeriksa bahwa statusnya `running`.

Source node disimpan dan dipakai kembali untuk seluruh sesi elemen audio. Menekan Play berulang kali tidak membuat source node baru. Mengganti file hanya mengubah `src` pada elemen audio yang sama; koneksi Web Audio tetap dipertahankan.

Jika `AudioContext` sedang `suspended`, engine mencoba `resume()` saat Play. Jika context gagal dibuat atau tidak mencapai status `running`, aplikasi menampilkan pesan. Bila Web Audio tidak tersedia, audio masih dapat diputar langsung melalui elemen audio, tetapi visualisasi dinonaktifkan dan UI menjelaskan bahwa data analyser tidak tersedia.

### File lokal dan object URL

- File dipilih melalui input file dan tidak pernah dibaca ulang secara manual atau diunggah.
- `URL.createObjectURL(file)` dipakai sebagai `src` elemen audio.
- Object URL file sebelumnya di-revoke segera setelah file baru dipasang.
- Object URL aktif di-revoke saat halaman ditinggalkan dalam kondisi yang tidak masuk back/forward cache.
- AudioContext, source node, dan analyser dilepas saat cleanup halaman.
- Nama file dan pesan dinamis ditulis dengan `textContent`, bukan `innerHTML`.

### Metadata dan durasi

Status **Memuat audio** ditampilkan setelah file dipilih. Durasi baru dianggap valid setelah `loadedmetadata` jika nilainya finite dan lebih besar dari nol. Jika metadata belum tersedia, kontrol seek tetap nonaktif dan durasi ditampilkan sebagai `0:00`.

Kegagalan pemuatan atau dekode dipetakan ke pesan yang lebih jelas berdasarkan `MediaError.code`. Ekstensi file tidak dianggap sebagai jaminan format; browser tetap melakukan dekode sebenarnya.

## Cara Kerja Visualisasi

### Satu loop

Visualizer tidak membuat loop baru setiap kali Play. Loop dimulai hanya ketika state visualisasi adalah `playing` dan analyser tersedia, lalu dihentikan saat audio tidak aktif. Pemanggilan `start()` bersifat idempoten, sehingga Play berulang atau perubahan state tidak menumpuk callback `requestAnimationFrame`.

### Spectrum

Data FFT diambil dari `getByteFrequencyData()`. Setiap batang mewakili rentang frekuensi pada skala logaritmik. Nilai batang diberi smoothing visual untuk pergerakan yang nyaman, tetapi tetap berasal dari data analyser terbaru. Saat `prefers-reduced-motion: reduce` aktif, easing dan glow dikurangi.

### Waveform

Data time-domain diambil dari `getByteTimeDomainData()`. Nilai byte 0–255 dipetakan kembali menjadi sampel ternormalisasi −1 sampai +1, lalu digambar sebagai garis. Tidak ada gelombang sintetis yang ditampilkan ketika data belum siap.

### Ukuran canvas

- Ukuran CSS canvas mengikuti container.
- Backing store mengikuti `devicePixelRatio`, dibatasi maksimal 2.
- Canvas hanya diubah ukurannya ketika container berubah melalui `ResizeObserver` atau event resize, bukan setiap frame.
- Saat resize dalam keadaan dijeda, frame terakhir digambar ulang dengan ukuran baru.

### Indikator energi rendah, menengah, tinggi

Indikator dihitung dari data frekuensi yang sama:

- Rendah: 40–250 Hz
- Menengah: 250 Hz–2 kHz
- Tinggi: 2–8 kHz

Untuk setiap rentang, aplikasi mengambil rata-rata magnitudo byte dari bin FFT yang masuk ke rentang tersebut, membaginya dengan 255, lalu menampilkannya sebagai persentase relatif 0–100. Nilai diperbarui sekitar setiap 100 ms.

Indikator ini hanya alat bantu visual. Ini bukan pengukuran ilmiah, kalibrasi SPL, analisis loudness, atau equalizer profesional.

## Aksesibilitas dan Privasi

- Semua tombol memiliki label aksesibel dan focus ring yang terlihat.
- Mode visualisasi memakai `aria-pressed`.
- Status audio diumumkan melalui live region `role="status"`; error memakai `role="alert"`.
- Status dan mode tidak hanya dibedakan dengan warna; teks dan atribut aksesibel tetap tersedia.
- Range seek dan volume adalah kontrol native yang dapat digunakan dengan keyboard.
- Preferensi `prefers-reduced-motion` mengurangi animasi CSS serta efek visual canvas.
- Nama file dan pesan dinamis tidak dimasukkan dengan `innerHTML`.
- Audio diproses sepenuhnya di browser dan tidak dikirim ke server.
- `localStorage` hanya menyimpan `soundwaveStudioMode` dan `soundwaveStudioVolume`; isi file audio tidak pernah disimpan.
- Akses penyimpanan dibungkus `try/catch`, sehingga kegagalan storage tidak menghentikan pemutar.

## Dukungan Format dan Keterbatasan Browser

- File picker menerima `audio/*` dan beberapa ekstensi umum, tetapi format yang benar-benar dapat diputar bergantung pada browser, sistem operasi, dan codec yang tersedia.
- File dengan ekstensi audio tetap bisa gagal jika isinya rusak atau codec-nya tidak didukung.
- File dengan tipe MIME yang tidak dilaporkan browser akan dicoba diputar; keberhasilan tetap ditentukan oleh dekoder browser.
- Browser yang tidak menyediakan Web Audio API masih dapat memutar audio, tetapi tidak dapat menampilkan visualisasi.
- Aplikasi memerlukan static HTTP server karena memakai ES Modules.
- Tidak ada fallback untuk browser yang tidak mendukung Canvas 2D; aplikasi menampilkan pesan fatal.
- Backing store canvas dibatasi 2× DPR untuk menjaga beban rendering.
- File audio yang sangat panjang belum diuji secara khusus; durasi ditampilkan dengan format jam bila melewati 60 menit.

## Checklist Pengujian Manual

- [ ] Buka aplikasi melalui static server dan pastikan status awal **Belum ada audio**.
- [ ] Pilih file WAV atau MP3 yang valid dan pastikan nama, ukuran, serta durasi muncul.
- [ ] Tekan **Putar** dan pastikan audio bergerak serta visualisasi berubah.
- [ ] Ganti ke **Waveform** dan pastikan bentuk gelombang mengikuti audio.
- [ ] Ganti kembali ke **Spectrum** dan pastikan batang frekuensi bergerak.
- [ ] Geser progress bar dan gunakan tombol panah saat range fokus.
- [ ] Ubah volume dan gunakan tombol mute.
- [ ] Jeda audio; pastikan visualisasi berhenti dan indikator energi menjadi `—`.
- [ ] Lanjutkan audio; pastikan loop tetap satu dan tidak ada visualisasi ganda.
- [ ] Pilih file lain saat audio berhenti atau sedang diputar; pastikan file baru dimuat.
- [ ] Biarkan audio selesai; pastikan status **Pemutaran selesai** dan tombol **Putar ulang**.
- [ ] Pilih file teks; pastikan ditolak dengan pesan yang jelas.
- [ ] Pilih file audio kosong atau rusak; pastikan muncul error.
- [ ] Uji di viewport ponsel dan pastikan tidak ada overflow horizontal.
- [ ] Aktifkan reduced motion dan pastikan animasi dekoratif berkurang.
- [ ] Gunakan Tab dan keyboard untuk mengakses tombol, mode, seek, dan volume.
- [ ] Pindahkan tab ke background saat visualisasi aktif, lalu kembali; pastikan tidak ada error.

## Status Pengujian yang Benar-Benar Dijalankan

Pengujian dilakukan pada 22 Oktober 2026 dengan:

- Node.js `v24.21.0` untuk pemeriksaan sintaks.
- Python `3.14.8` sebagai static server lokal.
- Google Chrome `155.0.8059.85` mode headless dengan profil pengguna sementara yang terisolasi.
- Fixture lokal: WAV PCM 16-bit 44,1 kHz berdurasi 7 detik, MP3 LAME berdurasi 4 detik, file MP3 berisi teks, file WAV 0 byte, dan file teks.
- Viewport desktop 1440 × 1100 dan viewport mobile 390 × 844 dengan DPR 2.
- Emulasi `prefers-reduced-motion: reduce`.
- Interaksi Play dan tombol utama dikirim sebagai input mouse CDP; file dipasang melalui `DOM.setFileInputFiles`.

Hasil yang benar-benar teramati:

- `node --check` berhasil untuk keempat modul JavaScript (`app.js`, `audio-engine.js`, `visualizer.js`, `player-ui.js`).
- Pemeriksaan referensi menemukan 35 ID di HTML, 30 referensi `getElement()` di `app.js`, tanpa ID hilang, duplikat, atau referensi dinamis yang tidak cocok.
- Pemindaian kode tidak menemukan `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `getUserMedia`, `MediaRecorder`, `fetch`, `XMLHttpRequest`, atau URL aset eksternal.
- Tidak ada trailing whitespace pada file HTML, CSS, JavaScript, Markdown, dan SVG.
- Status awal **Belum ada audio**; tombol Play dan seek dinonaktifkan.
- Sebelum interaksi, belum ada `AudioContext` yang dibuat.
- Viewport 1440 px tidak memiliki overflow horizontal; canvas 1044 × 468 CSS px memakai backing store 1044 × 468 pada DPR 1.
- File WAV 7 detik berhasil dimuat, nama file dan durasi `0:07` tampil, seek aktif, dan hanya satu object URL dibuat.
- Setelah Play, `AudioContext` berstatus `running`, tepat satu context dan satu `MediaElementAudioSourceNode` dibuat, dan hanya satu loop visualisasi aktif.
- Waktu audio maju dari `0.00` menjadi `0.36`, `0.87`, dan `1.38` pada sampel 0,5 detik. Audio tidak paused.
- Indikator energi menampilkan nilai persentase yang berasal dari analyser, bukan placeholder.
- Signature piksel canvas spectrum berubah antar-frame.
- Mode Waveform aktif, label canvas berubah, preferensi `waveform` tersimpan, dan gambar berbeda dari spectrum.
- Seek ke 50% menghasilkan `currentTime` sekitar 3,75 dari 7,00 detik dan label waktu berubah.
- Volume berubah menjadi 35%, nilai tersimpan, dan teks volume berubah.
- Mute mengubah `audio.muted`, `aria-pressed`, label tombol, dan teks volume menjadi **Bisu**.
- Jeda menghentikan loop (`requestAnimationFrame` aktif menjadi 0), canvas tetap identik setelah 600 ms, badge **Dijeda**, dan indikator energi menjadi `—`.
- Play ulang dua kali tidak menambah context atau source node; tidak ada loop ganda.
- File MP3 kedua berhasil dimuat dengan durasi `0:04`; object URL lama di-revoke (`created=2`, `revoked=1`) sementara context dan source node tetap satu.
- Mode tetap tersimpan setelah pergantian file.
- Audio selesai menampilkan status **Pemutaran selesai**, badge **Selesai**, tombol **Putar ulang**, loop berhenti, indikator energi `—`, dan progress mencapai 100%.
- Putar ulang memulai dari awal dan memakai audio graph yang sama.
- File teks ditolak sebagai tipe non-audio, file saat ini tidak berubah, dan tidak ada object URL baru.
- File MP3 berisi teks menghasilkan status error dengan pesan format tidak didukung, sementara context tetap satu.
- File WAV 0 byte ditolak dengan pesan file kosong dan tidak membuat object URL.
- Pemuatan file valid setelah error memulihkan status dan me-revoke object URL file gagal.
- Simulasi `pagehide` non-bfcache me-revoke semua object URL aktif, menutup `AudioContext`, melepas `src`, dan menghentikan loop.
- Range seek dan volume berhasil diubah dengan tombol keyboard.
- Tombol Spasi memutar dan menjeda audio saat fokus tidak berada pada kontrol.
- Chrome accessibility tree menunjukkan seluruh tombol dan slider yang aktif memiliki nama aksesibel; live region `status` sengaja kosong sebelum ada pengumuman.
- Lima perhentian Tab pertama berada pada kontrol yang tepat; kontrol Play dan seek yang nonaktif dilewati. Setiap perhentian menampilkan outline fokus `3px solid`.
- Reduced motion aktif dan animasi dekoratif header berhenti.
- Viewport 390 px dengan DPR 2 tidak memiliki overflow horizontal; canvas memakai backing store 668 × 636 untuk area CSS 334 × 318.
- Total 85 pemeriksaan browser lulus, tanpa console error, uncaught exception, atau kegagalan resource tak terduga. Dua `net::ERR_ABORTED` untuk blob media lama tercatat saat pergantian file dan merupakan pembatalan pemuatan media yang memang diganti.

Pengujian di atas memverifikasi pemutaran dan analisis di Chrome headless, bukan kualitas suara melalui speaker fisik.

## Fitur dan Skenario yang Belum Teruji

- Firefox, Safari, dan browser seluler fisik belum diuji.
- Pembaca layar nyata belum diuji; live region, label, dan struktur aksesibel baru diperiksa secara implementasi dan DOM.
- Dialog file picker native tidak diuji secara manual; file dipasang melalui CDP.
- Pengujian audio dilakukan dengan mode headless dan audio dimute; output akustik ke speaker/headphone belum diverifikasi.
- Format audio selain WAV PCM dan MP3 LAME belum diuji, termasuk AAC, FLAC, Ogg/Opus, dan file ber-codec eksotis.
- Kondisi `AudioContext` gagal dibuat atau tidak dapat `resume()` belum dipaksa dalam pengujian runtime.
- File audio berdurasi sangat panjang, file berukuran sangat besar, dan playback jangka panjang belum diuji.
- Touch drag pada slider dan gesture ponsel nyata belum diuji.
- Tampilan pada pembesaran teks browser, mode kontras tinggi, dan pembaca layar dengan berbagai kombinasi browser belum diuji.
- Belum ada pengukuran performa formal untuk canvas pada perangkat ber-DPR tinggi atau CPU lambat.
