# Proyek 04 — Weather Dashboard (Cuaca Kita)

Cuaca Kita adalah dashboard cuaca berbasis browser yang menampilkan kondisi aktual dan prakiraan dari Open-Meteo. Pengguna dapat mencari kota, memilih salah satu hasil geocoding, melihat prakiraan 24 jam dan 7 hari, atau memakai lokasi perangkat jika izin diberikan.

## Fitur

- Pencarian kota melalui Open-Meteo Geocoding API.
- Daftar pilihan lokasi ketika hasil pencarian lebih dari satu; hasil teratas dimuat otomatis.
- Nama kota, wilayah administratif, dan negara untuk lokasi hasil pencarian.
- Suhu aktual, kondisi cuaca, kelembapan, kecepatan angin, suhu terasa, curah hujan, waktu pengamatan, serta waktu matahari terbit dan terbenam.
- Prakiraan per jam untuk 24 jam mulai dari jam pengamatan saat ini.
- Prakiraan harian hingga 7 hari, lengkap dengan suhu minimum, suhu maksimum, dan peluang hujan.
- Ikon cuaca SVG lokal yang dipetakan dari kode cuaca WMO.
- Tombol **Gunakan lokasi saya** dengan penanganan izin, timeout, dan kegagalan geolokasi.
- Tombol **Kembali ke awal** untuk memuat kembali lokasi awal, Jakarta.
- Loading state, skeleton, pesan error yang spesifik, dan tombol coba lagi untuk kegagalan yang dapat diulang.
- Validasi respons agar data kosong, rusak, atau tidak lengkap tidak pernah diganti dengan data karangan.
- Tampilan responsif untuk desktop, tablet, dan layar kecil.
- Mendukung navigasi keyboard, `aria-live` untuk keadaan pemuatan, `role="alert"` untuk error, dan `prefers-reduced-motion`.

## Teknologi dan API

- HTML5
- CSS3
- Vanilla JavaScript (tanpa framework atau build tool)
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)

### Endpoint geocoding

```text
GET https://geocoding-api.open-meteo.com/v1/search
  ?name=Bandung
  &count=5
  &language=id
  &format=json
```

Parameter `name` diisi dari kata kunci pengguna. Aplikasi memakai maksimal lima hasil, lalu menampilkan daftar jika hasilnya lebih dari satu.

### Endpoint prakiraan

```text
GET https://api.open-meteo.com/v1/forecast
  ?latitude=-6.2088
  &longitude=106.8456
  &current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day
  &hourly=temperature_2m,weather_code,precipitation_probability,is_day
  &daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max
  &timezone=auto
  &forecast_days=7
  &temperature_unit=celsius
  &wind_speed_unit=kmh
```

Unit yang diminta dan ditampilkan:

- Suhu: derajat Celsius (`°C`).
- Kecepatan angin: kilometer per jam (`km/jam`).
- Kelembapan: persen (`%`).
- Curah hujan: milimeter (`mm`).
- Zona waktu: otomatis mengikuti lokasi (`timezone=auto`), ditampilkan bersama singkatan zona waktu dari API.

Tidak ada API key. Aplikasi hanya mengirim permintaan ke kedua host Open-Meteo di atas dan tidak memakai CDN, font eksternal, layanan analitik, atau dependensi frontend tambahan.

## Prasyarat

- Browser modern yang mendukung JavaScript dan `fetch`.
- Koneksi internet untuk mengakses Open-Meteo.
- Tidak ada API key, dependency, atau proses build.

## Cara Menjalankan

Aplikasi tidak memerlukan instalasi, build, atau API key.

1. Buka folder `proyek-04-weather-dashboard/`.
2. Buka `index.html` langsung di browser, atau jalankan static server lokal:

   ```bash
   cd proyek-04-weather-dashboard
   python -m http.server 8000
   ```

3. Buka `http://localhost:8000` di browser.

Static server lokal direkomendasikan, terutama untuk menguji geolokasi. Beberapa browser membatasi geolokasi pada halaman `file://`, meskipun halaman tersebut dapat dibuka langsung. Aplikasi tetap dapat digunakan lewat pencarian kota tanpa geolokasi.

## Struktur Direktori

```text
proyek-04-weather-dashboard/
├── index.html   # Struktur halaman, form pencarian, panel status, dan sprite ikon SVG
├── style.css    # Tema visual, kartu cuaca, layout responsif, animasi, dan reduced motion
├── script.js    # Permintaan API, validasi respons, pencarian, geolokasi, dan rendering
└── README.md    # Dokumentasi proyek ini
```

Tidak ada gambar atau aset eksternal. Ikon cuaca disimpan sebagai sprite SVG di dalam `index.html`.

## Alur Singkat

1. Saat dibuka, aplikasi memuat cuaca Jakarta sebagai lokasi awal.
2. Pencarian mengirim kata kunci ke Geocoding API. Hasil pertama dimuat otomatis dan hasil lain dapat dipilih.
3. Koordinat hasil pencarian dikirim ke Forecast API dengan `timezone=auto`.
4. Respons divalidasi sebelum dirender. Jika respons tidak lengkap, kosong, atau gagal, aplikasi menampilkan error dan tidak menampilkan data pengganti.
5. Prakiraan per jam dimulai dari jam pengamatan saat ini. Prakiraan harian menampilkan maksimal tujuh hari.

## Pengujian

Repository ini tidak menyertakan suite pengujian otomatis. Pemeriksaan manual yang disarankan:

1. Buka aplikasi dan pastikan cuaca Jakarta tampil sebagai lokasi awal.
2. Cari kota, pilih hasil geocoding, lalu periksa prakiraan 24 jam dan 7 hari.
3. Coba tombol **Gunakan lokasi saya** dengan izin diberikan, ditolak, dan timeout.
4. Putuskan koneksi atau blokir request untuk memeriksa error state dan tombol coba lagi.
5. Uji tombol **Kembali ke awal** serta layout desktop dan ponsel.
6. Periksa navigasi keyboard dan `prefers-reduced-motion`.

Pembaruan dokumentasi ini tidak menjalankan pengujian browser atau integrasi API live.

## Sumber Data

Data cuaca dan geocoding berasal dari [Open-Meteo](https://open-meteo.com/), melalui [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) dan [Forecast API](https://open-meteo.com/en/docs). Aplikasi tidak memerlukan API key dan tidak menyimpan riwayat cuaca atau lokasi pengguna.

## Batasan dan Catatan

- Aplikasi memerlukan koneksi internet untuk mengakses Open-Meteo.
- Geolokasi memerlukan izin browser dan biasanya hanya tersedia pada secure context (`https://` atau `localhost`). Jika akses ditolak, pengguna dapat mencari kota secara manual.
- Open-Meteo Geocoding API yang digunakan adalah pencarian berdasarkan nama, bukan reverse geocoding. Karena itu, mode geolokasi menampilkan **“Lokasi saat ini”** beserta koordinat GPS, bukan nama kota dan negara. Untuk melihat nama kota dan negara, gunakan pencarian kota.
- Prakiraan cuaca bersifat informatif dan bukan peringatan cuaca resmi.
- Data cuaca dan geocoding berasal dari Open-Meteo. Aplikasi tidak menyimpan riwayat cuaca atau lokasi pengguna.
