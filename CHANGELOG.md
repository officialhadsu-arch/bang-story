# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/),
dan nomor versi mengikuti [Semantic Versioning](https://semver.org/lang/id/): **mayor** untuk perubahan yang merusak
data atau alur lama, **minor** untuk fitur baru, **patch** untuk perbaikan.

Cara menaikkan versi ada di [docs/pengembangan.md](docs/pengembangan.md#versi-dan-rilis).

## [Belum dirilis]

- **Generate berurutan (gambar, 0.3)** — tombol baru di header Storyboard, di antara "Rekam ulang suara narasi" dan
  "Generate N gambar": gambar dibuat satu adegan demi satu adegan sesuai urutan storyboard, dengan jeda acak 0–20
  detik antar-adegan (bukan sebelum adegan pertama), hitung mundur "Adegan berikut dalam X detik", dan tombol
  Batalkan (berhenti sesudah job yang sedang jalan selesai). Tiap adegan dicoba maks 3× (1 + 2 retry); bila tetap
  gagal, adegan ditandai gagal dan batch lanjut. Pengaman gerbang G3: gagal dengan 401 / 429 / UNUSUAL_ACTIVITY /
  reCAPTCHA menghentikan seluruh batch segera tanpa retry. Adegan manual/extension dilewati (job-nya menunggu berkas
  dan tidak pernah selesai). Antrean in-memory, tanpa migrasi DB dan tanpa setelan baru; mode batch lama tidak
  berubah; konfirmasi biaya NexaBot/kie.ai dipakai kedua tombol. Jeda adalah ritme yang lebih mirip manusia mengikuti
  pola KenFlow v3.6.6 — bukan jaminan lolos dari kontrol risiko Google. Mesin di `src/main/sequential.ts` (murni,
  bisa diuji) + wiring di `generation.ts` + IPC `generate:sequentialImages` / `cancelSequential` /
  `sequentialStatus` + event `event:sequential`.
- **Panduan Flow2API diperjelas** (dalam aplikasi, Pengaturan › Panduan Flow2API, dan `docs/layanan-ai.md`):
  pemasangan ekstensi Token-Updater langkah-demi-langkah (ZIP → ekstrak → `chrome://extensions` → Developer mode →
  Load unpacked; folder `extension/` di dalam server adalah ekstensi CAPTCHA, bukan Token-Updater), jebakan
  placeholder abu-abu di popup addon (ketik ulang sampai hitam pekat), langkah sambung token (Random → Copy → Save
  settings → Simpan → Allow → Tes sekarang; berhasil = Total 1, Active 1 + Credits), metode CAPTCHA bawaan YesCaptcha
  itu berbayar dan kuncinya kosong (ganti ke Built-in browser atau Flow2API Team, lalu klik Save settings), cara isi
  Kunci API server yang benar (klik Simpan sampai kolom jadi titik-titik; tulisan hijau "Terhubung" hanya mengecek
  servernya jalan) dan arti dua pesan 401, jendela login Google yang bisa menutup sendiri (jalan pintas: login
  flow.google.com di Chrome sendiri), `Failed to obtain reCAPTCHA token`, dan UNUSUAL_ACTIVITY (berhenti, jangan
  Generate berulang, pakai jalur Manual / Generate berurutan). Urutan uji minimal: isi kunci → Uji Koneksi →
  1 gambar + 1 video dulu, baru batch.
- **Dua tombol salin prompt Manual (Storyboard)** — "Salin Semua Prompt" menjadi "Salin Prompt Teks to Image" (satu
  `Gambar:` per adegan, `prompts.txt` + `manual.json`), dan tombol baru di sebelahnya "Salin Prompt Image to Video"
  (satu `Video:` per adegan dari field `videoPrompt` yang sama, `prompts-video.txt` + `manual.json`). Kedua daftar
  sengaja terpisah — tiap langkah kerja butuh satu daftar saja. `manual.json` tetap memuat kedua field; pemindai
  mengabaikan `prompts-video.txt` seperti `prompts.txt`.
- **Naskah per bagian + Lanjutkan naskah + durasi custom sampai 30 menit** — naskah kini ditulis
  per bagian 30 adegan dan tiap bagian langsung disimpan, jadi video 20 menit (218 adegan, 8 panggilan)
  atau 30 menit (327 adegan, 11 panggilan) tidak lagi mentok di batas keluaran model; bila berhenti di
  tengah jalan (gagal, rate limit, atau dibatalkan), adegan yang sudah tersimpan tetap utuh dan tombol
  "Lanjutkan naskah" di langkah Naskah melanjutkannya dari adegan terakhir yang tersimpan — adegan
  terakhir yang narasinya terpotong (kosong, kurang dari 10 kata, atau tanpa tanda baca akhir) dibuang
  dulu. Selama belum lengkap, langkah Naskah menampilkan "Tersimpan X dari Y adegan". Progres tampil
  ("Menulis adegan 31–60 dari 218…") dengan tombol Batalkan. Durasi video bisa diisi bebas 15–1800
  detik lewat kolom "Atau durasi lain" di langkah Ide; lima preset tetap sama (30 detik→5, 1 menit→11,
  3 menit→33, 5 menit→55, 10 menit→109 adegan). Rumus adegan tidak berubah (1 adegan per ~5,5 detik).
- **Impor naskah bawa sendiri** — tombol "Impor naskah" di langkah Naskah (header dan empty state): tempel teks
  atau pilih berkas `.txt`/`.md`, pratinjau hasil parse (jumlah adegan, total ±menit, judul adegan), lalu ganti
  seluruh naskah. Format: `# Judul Video` (opsional) + `## Judul Adegan` + `Alur:`/`Narasi:` per adegan; adegan
  tanpa label dibaca sebagai narasi; adegan kosong dilewati dan dilaporkan nomornya; teks tanpa adegan valid
  ditolak dan naskah lama utuh. Durasi proyek mengikuti total estimasi narasi impor (min. 10 detik), bukan preset.
  Penulisan memakai `replaceScript` yang sama dengan naskah hasil generate. Mode tambah belum ada (v1 hanya ganti).
- Rebrand aplikasi menjadi **KenStory** (fork dari bangtutorial/bang-story tetap berlisensi MIT, lihat NOTICE.md).
- **Flow2API: kunci API server (Bearer)** — server Flow2API versi sekarang menuntut `Authorization: Bearer <kunci>` di
  tiap permintaan; tanpanya generate gagal HTTP 401 (terbukti di uji live PC, 20 Nov 2026). Kolom baru "Kunci API
  server" di Pengaturan › Google Flow, tersimpan terenkripsi; kosong berarti permintaan tanpa header seperti
  sebelumnya. Pesan galat 401 kini membedakan kunci belum diisi vs kunci tersimpan yang ditolak.
- **Unggah lembar karakter (0.3+)** — modal Lembar karakter kini punya tombol "Unggah lembar" di sebelah
  "Buat lembar karakter": gambar karakter yang sudah dimiliki (PNG/JPG/WebP) bisa dipakai sebagai lembar
  referensi, tanpa harus digenerate dulu. Berkas diperiksa bisa dibaca dengan dimensi nyata sebelum disimpan;
  lembar yang diunggah bekerja identik dengan lembar hasil generate untuk semua generate berikutnya.
  Mengganti lembar meminta konfirmasi dulu; gambar adegan yang sudah jadi tidak berubah. Semua pesan galat
  di jalur ini berbahasa Indonesia sederhana (apa yang terjadi + apa yang harus dilakukan).
- **Motion (Fase 4, 0.4+)**: adegan motion sebagai provider visual tingkat 3 — agent coding (Claude/Kiro/
  Antigravity) menulis babak HTML+GSAP di `motion-work/`, pengguna menyetujui tiap beat di langkah Rancangan,
  aplikasi merender MP4 di jendela tersembunyi (D-22, diputus spike 4.0). Sakelar induk mati bawaan, preset
  "Motion Grafik penuh"/"Hybrid", 6 template gaya (WebGL/Partikel terkunci sampai diukur), caption per adegan
  (default mati di motion), tutorial Bahasa Indonesia di dalam aplikasi. Biaya tunai dari aplikasi Rp0.
  Pemetaan: `docs/fase4-renderer-pemetaan.md`.

## [1.0.0] - 2026-10-02

Rilis pertama Bang Story (sebelumnya bernama Studio Cerita).

### Alur produksi
- Empat langkah: **Ide cerita → Naskah → Storyboard → Editor**, tersimpan otomatis di database lokal.
- Penyusun cerita memakai Gemini, OpenRouter, Groq, atau endpoint custom yang kompatibel dengan OpenAI. Daftar
  modelnya diambil langsung dari penyedia.
- Naskah bisa diubah, ditambah, dihapus, dan diurutkan ulang. Narasi boleh memuat tag ekspresi suara.
- Rencana visual dibuat dari naskah final: prompt gambar berlabel (dunia dan era, aksi, baju per adegan, hal yang
  harus dihindari), pemeran beserta lembar karakter, gerak kamera, transisi, dan arahan gerak video.
- 14 model gambar dan 34 model video Higgsfield, dengan perkiraan kredit dari endpoint `estimate`. Resolusi video
  bisa dipilih per proyek.
- Narasi dibuat dalam satu rekaman utuh (Gemini TTS atau ElevenLabs), lalu dipotong otomatis per adegan.
- Caption akurat dengan Whisper lokal (mode DTW). Klip lama bisa disinkronkan ulang dari tab Caption.
- Panel Musik bisa membuat prompt musik latar untuk Suno atau AI musik lain.

### Editor
- Pratinjau langsung dengan gerak kamera, transisi, caption karaoke, musik latar, dan overlay (logo, watermark,
  teks) yang bisa digeser di pratinjau.
- Timeline seperti editor video:
  - tarik tepi klip untuk mengatur panjangnya (video tidak bisa melebihi panjang aslinya);
  - geser dan potong suara, caption, musik, dan overlay;
  - **Potong** (S atau Ctrl+B) dan **Hapus** (Delete);
  - snap ke playhead dan sambungan;
  - overlay bertumpuk di baris masing-masing.
- Transisi diatur per sambungan dari tombol di antara klip. Panelnya punya pratinjau yang diputar berulang, durasi
  0,2–2 detik, dan tombol terapkan ke semua.
- Gerak kamera bisa diatur untuk klip gambar maupun video. Pratinjaunya diputar tanpa menggeser playhead.
- Caption:
  - 4 gaya dan pilihan tanpa caption;
  - 15 font (4 tegas, 9 kartun/komik, 2 tulisan tangan/elegan) dengan contoh di daftar;
  - ukuran, posisi, warna, dan kotak latar rounded;
  - teksnya bisa diedit langsung dan tersimpan otomatis.
- Suara: volume per klip dan volume narasi. Musik: volume, otomatis mengecil saat narasi, dipotong, dan digeser.

### Ekspor
- MP4 dirender dengan FFmpeg di komputer pengguna. Hasilnya sama dengan pratinjau karena aturan gerak, transisi,
  caption, dan potongan suara dipakai bersama (`src/shared/`).
- Gerak kamera halus memakai filter `perspective`. Caption memakai libass dengan kotak rounded, dan ukurannya
  sama dengan pratinjau.
- Proyek bisa diekspor berulang kali setelah diedit.

### Lainnya
- Kunci API milik pengguna (BYOK), disimpan terenkripsi dengan DPAPI Windows (`safeStorage`).
- Halaman About menampilkan versi aplikasi, tautan ke channel Bang Tutorial, dan video tutorial.
- Salinan siap jalan dengan skrip START untuk Windows dan macOS.
- Dokumentasi pengembang: [AGENTS.md](AGENTS.md) dan folder [docs/](docs/README.md).
- Kode dirilis dengan [lisensi MIT](LICENSE). README dilengkapi badge dan screenshot.
- Installer Windows (`BangStory-Setup-1.0.0.exe`) dengan ikon dari logo Bang Story.

### Batasan yang diketahui
Lihat [docs/masalah-diketahui.md](docs/masalah-diketahui.md). Yang paling terasa:
- gerak kamera di atas video masih bergetar di pratinjau (hasil ekspor halus);
- belum ada undo/redo;
- Whisper dan installer baru tersedia untuk Windows.
