# Pemetaan Fase 4 — Renderer Motion (D-21 / D-22)

- **Tanggal:** 13 Nov 2026
- **Status:** studi + pemetaan 20/100 — BUKAN implementasi. Implementasi menyusul sesudah pemetaan ini + keputusan D-22.
- **Perintah:** Bos, 13 Nov 21:52 WIB — kerjakan Fase 4 dan 5 sekarang (uji PC tertunda karena laptop Bos masih dipakai hal lain).
- **Pangkal:** main `bfc019f` (Fase 0 + Tier 1 + Tier 2 + Tier 3 + label-fix + perbaikan rasio aspek).
- **Sumber utama:** konsep v2.1 Bab 8, 9, 14, 16 + Lampiran C (D-09, D-11, D-17, D-20, D-21, D-22); laporan 0.6 (`laporan-06-flakiness.md`); paket S3 v2 (`s3-06/spike-v2.mjs`, `electron-runner.cjs`); skill bang-motion v1.19.0; skill HyperFrames v0.9.40; laporan banding Starbucks + laporan render proyektor (uji murni stack 1-7, 13 Nov 2026); catatan Fadli (`~/memory/people/n-faddli.md`).
- **Biaya studi:** Rp0 — baca dokumen/kode/skill saja; tanpa panggilan API berbayar, tanpa kunci, tanpa daftar akun, tanpa uji live.

## Ringkasan

Fase 4 membangun **motion harness**: aplikasi menyiapkan folder kerja (`motion-work/`), agent coding eksternal (Claude Code, Antigravity, atau Kiro — langganan pengguna sendiri) menulis animasi sebagai kode HTML+JS per babak, dan **MP4 dirender oleh APLIKASI** lewat renderer kontrak v1 (D-21, DITETAPKAN). Motion bukan mode lahir — motion adalah provider `motion` di registry tingkat 3, dengan sakelar induk di Pengaturan yang mati secara bawaan (D-02, D-05).

**Rekomendasi D-22 (studi ini): jalur utama (i) Electron hidden + useContentSize; jalur cadangan/verifikasi (iii) Puppeteer; jalur (ii) offscreen DITOLAK dalam bentuknya sekarang.** Rekomendasi ini BERSYARAT: aturan putus di konsep (S1d 20/20 DAN ukuran sesuai konfigurasi; bila lebih dari satu lolos, pilih RAM terendah dengan metode RAM baru) baru bisa diterapkan penuh oleh spike tugas 4.0 — varian hidden+useContentSize belum pernah dijalankan, dan angka RAM antar-jalur belum sebanding metodenya. Spike-lah yang memutus final; studi ini menetapkan kandidat + kriteria lolos/gagalnya (lihat §7).

## §1. Keputusan D-22 — rekomendasi dan alasannya

### 1.1. Tiga opsi dan kriteria putus (dari konsep, Lampiran C)

| Opsi | Jalur | Kriteria lolos (konsep) |
|---|---|---|
| (i) | Electron hidden + useContentSize | S1d 20/20 DAN ukuran capture == konfigurasi |
| (ii) | Electron offscreen | S1d 20/20 DAN ukuran capture == konfigurasi |
| (iii) | Puppeteer + S1d | S1d 20/20 DAN ukuran capture == konfigurasi |

Bila lebih dari satu lolos: pilih RAM terendah (metode RAM baru — hanya PID proses browser + turunannya). Bila Puppeteer menang: ukuran distribusi jadi keputusan pemilik (Chromium kedua harus dibundel).

### 1.2. Tabel bukti (semua angka terverifikasi dari sumbernya)

Kecepatan = menit-render per 1 menit-video, 720p/30, kelas Ringan. S1d = render penuh 60 frame vs render rentang 20–39, dihitung hash identik.

| Jalur | S1d | Ukuran capture | Kecepatan (PNG / JPEG q90) | RAM puncak | Vonis studi |
|---|---|---|---|---|---|
| (i) hidden | **20/20 di semua pengukuran** (S3 v2 + 0.6 hid1) | **SALAH saat diuji** (1280×692 / 1264×655, bukan 1280×720) — karena spike TIDAK memakai setContentSize; varian +useContentSize belum pernah dijalankan | PNG 9,58 / 6,95; JPEG 4,41 (S3 v2 / 0.6) | 772 MB/kombinasi (920 MB satu run, 0.6) | **Jalur utama (bersyarat)** — stabil terbukti; cacat ukuran diketahui persis cara memperbaikinya (D-11) |
| (ii) offscreen | **FLAKY 36%** (4/11 pengukuran; 3/9 dari berkas 0.6) — akar TERBUKTI | Tidak ditandai salah di S3/0.6 (tanpa window, tak ada chrome yang memakan piksel) — tapi S1d sudah menggugurkannya | PNG 6,02 / 3,50–3,89; JPEG 2,63 (tercepat) | 721–789 MB/kombinasi (814–836 MB satu run) | **DITOLAK bentuk sekarang** — gagal kriteria S1d; perbaikannya menghapus keunggulan kecepatannya |
| (iii) Puppeteer | **20/20** (S3 v2; S3 v1 laptop juga 20/20) | **TEPAT** — clip `{x:0, y:0, w:1280, h:720}` memaksa ukuran | PNG 6,22 (S3 v2) | 506 MB (S3 v1, laptop Bos, tasklist — metode lain, tidak sebanding langsung) | **Cadangan/verifikasi** — lolos S1d + ukuran, tapi butuh Chromium kedua (keputusan distribusi pemilik) |

### 1.3. Alasan per opsi

**(i) Hidden + useContentSize — jalur utama.** Satu-satunya jalur yang stabilnya TERBUKTI di semua pengukuran (S1d 20/20: S3 v2, 0.6 hid1, semua run hidden) DAN memakai Chromium yang sudah dibundel Electron — tanpa biaya distribusi tambahan. Mekanisme stabilnya diketahui persis (W7 di `electron-runner.cjs`): jeda settle 50 ms + tangkap dua kali, maju hanya bila hash sha256 keduanya sama, maks 3 percobaan, kegagalan dicatat apa adanya. Lambatnya (~2× offscreen di PNG) BUKAN bug: harga verifikasi ganda + encode PNG di CPU (0.6 §4). Cacatnya satu dan spesifik: ukuran capture salah 28 px karena window Electron memakan frame (bukti S2: `capturePage()` 1280×692 padahal window 1280×720) — dan kontrak D-11 sudah menulis obatnya: paksa ukuran konten eksplisit (`setContentSize`/`useContentSize`) dari konfigurasi aplikasi, lalu VERIFIKASI ukuran frame pertama sebelum lanjut; bila tidak sama, render berhenti dengan pesan jelas. Yang belum terbukti hanyalah varian yang sudah diperbaiki itu — itulah tugas spike 4.0, bukan alasan menolak jalur ini.

**(ii) Offscreen — DITOLAK bentuk sekarang.** Flaky 36% dengan akar TERBUKTI (0.6 §3): seek → 2× `requestAnimationFrame` → satu tangkapan langsung, tanpa jeda settle dan tanpa verifikasi ganda; `capturePage` memicu satu BeginFrame tanpa jaminan frame yang dihasilkan sudah memuat hasil seek terakhir. Bukti kunci: di run off7-2, hash frame 19 dan 20 identik — tangkapan frame 20 mengembalikan gambar frame 19 utuh; frame 20 (frame pertama rentang) gagal di SEMUA 4 run yang gagal. Perbaikan yang diusulkan 0.6 (settle dan/atau verifikasi ganda di jalur offscreen) memang mungkin — tetapi biayanya sama persis dengan overhead hidden (2× tangkap + settle), sehingga keunggulan kecepatan offscreen hilang, sementara offscreen tetap menyimpan risiko khasnya (tanpa window = lebih sulit di-debug; perilaku offscreen Electron berubah-ubah antar versi). Tidak ada alasan memilihnya di atas hidden bila sudah diperbaiki. Hanya ditinjau ulang bila spike menunjukkan varian offscreen-yang-diperbaiki mengalahkan hidden pada kecepatan DENGAN S1d 20/20 DAN RAM lebih rendah — skenario yang tidak didukung bukti apa pun saat ini.

**(iii) Puppeteer — cadangan dan verifikasi.** Lolos kedua kriteria (S1d 20/20 di S3 v2 dan S3 v1 laptop; ukuran tepat karena clip dipaksa). Kecepatannya di tengah (PNG 6,22). Kelemahannya bukan teknis melainkan distribusi: Puppeteer bukan bagian aplikasi Electron — ia butuh Chromium sendiri yang dibundel (ukuran installer bertambah; besarnya WAJIB diukur spike, jangan ditebak). Karena itu ia bukan jalur utama, tetapi ia punya dua peran yang tak tergantikan: (a) jalur verifikasi silang di spike (bila hidden dan Puppeteer menghasilkan frame yang sama, kepercayaan pada renderer naik dua kali lipat); (b) jalur darurat bila hidden+useContentSize gagal uji ukuran di spike. Catatan: Puppeteer di sini adalah JALUR, bukan produk HyperFrames — lihat §2.3 soal posisi HyperFrames.

### 1.4. Yang masih harus diukur spike 4.0 (bukan diputuskan studi ini)

1. **Hidden+useContentSize, S1d + ukuran** — belum pernah dijalankan dalam bentuk apa pun. Lolos bila S1d 20/20 DAN capture tepat 1280×720 (dan 1080×1920 untuk 9:16).
2. **RAM metode baru, per jalur, metode sama** — angka yang ada tidak sebanding (0.6 per-kombinasi VM vs S3 v1 tasklist laptop). Spike memakai pelacak PID proses browser + turunannya saja (sudah ada di `spike-v2.mjs`).
3. **Delta ukuran installer bila Puppeteer menang** — ukur, jangan tebak.
4. **JPEG q90 vs PNG sebagai intermediate** — kecepatan vs kualitas hasil akhir (apakah JPEG q90 sebagai frame intermediate merusak hasil x264 akhir secara kasatmata).
5. **S3 v2 di laptop Bos (Syarat Mulai E(3))** — belum pernah dijalankan di laptop; konsep menyatakan butir ini "hanya menahan Fase 4". Spike 4.0 melipatnya masuk.
6. **Kelas Berat (WebGL/Three.js/partikel)** — D-17 tidak berlaku; gaya Berat mati bawaan sampai diukur di Fase 4. Spike mengukur satu gaya Berat representatif atau mencatatnya tetap mati.

## §2. Bukti pendukung

### 2.1. Tugas 0.6 — determinisme & flakiness (VM, 12 Nov 2026)

Sumber: `workspace/your_files/tanggapan-konsultan-ronde-1/laporan-06-flakiness.md`.

- **S1d offscreen flaky, akar terbukti (§3):** 11 pengukuran, 7 lolos / 4 gagal (36%); dari berkas 0.6 saja: 9 run, 6 lolos / 3 gagal (33%). Mekanisme: balapan seek→tangkap tanpa settle dan tanpa verifikasi ganda; tangkapan basi = frame sebelumnya utuh (bukti hash `0fcd5769…` di indeks 19 dan 20). Render-nya sendiri deterministik (hash full-run identik di off1/2/3/4/5/6/8) — yang flaky hanya tangkapannya.
- **Hidden PNG lambat, bukan bug (§4):** tiga lapis akar — (1) encode PNG jauh lebih lambat dari JPEG q90 di CPU saja (satu tangkapan offscreen PNG 124,6 ms vs JPEG 22,1 ms); (2) verifikasi ganda W7 menggandakan biaya tangkap hidden (50 ms settle + 2× tangkapan ≈ 287,7 ms PNG); (3) tulis file bukan penyebab (1,5–3,5 ms). Rasio hidden ≈ 2× offscreen stabil di S3 v2 (1,59×) dan 0.6 (1,95×).
- **Jitter ekor AAC demo (§2c):** akar pasti TIDAK ditemukan; dampak praktis nol (0,42 dtk terakhir, maks 0,3% skala penuh, tidak terdengar). Dicatat di sini karena renderer Fase 4 memakai jalur ekspor yang sama — bukan cacat renderer motion.
- **§6 spesifikasi tes laptop (belum dijalankan):** ulang ekspor demo+P30, S1d offscreen 2× di laptop, p50 hidden PNG vs JPEG di laptop. Dilipat ke spike 4.0 (§7).

### 2.2. bang-motion v1.19.0 — mesin resmi mode Motion Grafik (skill, MIT)

Sumber: `~/workspace/custom-skills/bang-motion/` (terpasang 13 Nov 2026; repo `bangtutorial/bang-motion`, HEAD `c1aa65e`).

- **Deliverable:** satu `index.html` (HTML+CSS+GSAP, + Three.js bila perlu), autoplay tanpa player, loop; `?debug=1` panel scrub, `?clean=1` menahan autoplay untuk export. Verifikasi visual lewat `scripts/snap.mjs` (Puppeteer, potret detik kunci → lembar kontak); export MP4 lewat `scripts/export-frames.mjs` (render tiap frame → PNG → FFmpeg).
- **Hukum #2 — deterministik atau mati:** tidak ada satu baris pun yang membaca jam sistem; semua visual adalah fungsi murni dari `tl.time()` (waktu timeline GSAP). Konsekuensi: scrub akurat dan render frame-by-frame menghasilkan gambar identik setiap kali. Ini HUKUM yang sama dengan yang dibutuhkan renderer kontrak v1 — bang-motion bukan sekadar gaya, ia adalah spesifikasi determinisme untuk HTML babak.
- **Hukum #1/#3/#4 (anti-PPT, gaya lahir dari tema, teks hidup):** aturan kualitas yang dipakai agent saat menulis babak — dan dipakai peninjau (Rancangan) saat menilai frame kunci. Kontrak v1 tidak perlu mengulang hukum-hukum ini; ia cukup merujuknya.
- **Starter yang relevan:** `starter-explainer-*.html` (kartun/jurnalisme/katalog/sketsa/panggung/aksi-kontinu) untuk explainer; `starter-opener.html` untuk opener/promo. Starter adalah arsitektur, bukan gaya — token warna/font/latar wajib diganti dari style brief.
- **Batas yang dicatat:** deliverable butuh browser + internet untuk CDN (GSAP, font). Untuk renderer aplikasi, ini berarti babak HTML harus membawa font-nya sebagai file lokal (aturan yang sama dengan HyperFrames: hanya font yang dibundel yang resolve by name) — lihat §3.3.

### 2.3. HyperFrames + Remotion — bukti uji murni stack 1-7 (13 Nov 2026)

Sumber: `workspace/uji-stack-1-7/starbucks/LAPORAN-BANDING.md`, `workspace/uji-stack-1-7/proyektor/LAPORAN-RENDER.md`; skill HyperFrames v0.9.40 (Apache-2.0).

**Apa yang dibuktikan (dan apa yang TIDAK):**

- **Tekniknya bekerja pada skala nyata.** HyperFrames (headless Chrome + seek frame-by-frame + FFmpeg — model yang SAMA dengan jalur Puppeteer) merender video long proyektor 280,43 dtk, 1920×1080 30 fps, dalam 22 mnt 15 dtk (CRF 16, 33,6 MB, laju tangkap ±6,3 frame/dtk, 2 worker Chrome ±256 MB tiap worker, render software SwiftShader tanpa GPU). Verifikasi dari MP4 hasil (7 frame ditonton). Ini membuktikan model "seek timeline yang dijeda → tangkap frame → encode" sanggup menangani video panjang, bukan hanya starter 60 frame.
- **Perbandingan Starbucks (1 konsep, 2 mesin, VO sama 55,52 dtk):** HyperFrames 10,1 MB / render 8 mnt 45 dtk (`looks`); Remotion 4,7 MB / 6 mnt 13 dtk. Visual per frame: HyperFrames menang (lebih penuh/kaya); sinkron angka↔VO: Remotion menang (angka diikat timestamp kata Whisper; HyperFrames longgar ±1 langkah angka — timing per adegan, bukan per kata). Catatan adil laporan: kedua versi dibangun penulis berbeda, jadi selisih visual sebagian soal usaha/desain, bukan murni mesin. **Keputusan Bos (13 Nov 08:56): HyperFrames mesin utama konten cepat (timing diikat timestamp kata VO seperti Remotion), Remotion cadangan.**
- **Posisi di KenStory — jangan campur jalur.** Keputusan Bos di atas berlaku untuk lane konten cepat (chat lain), BUKAN untuk renderer KenStory. Di KenStory, HyperFrames berperan sebagai: (a) **kontrak referensi** — kontrak rendernya (setiap elemen timed: `class="clip"`, `data-start`, `data-duration`; satu paused timeline terdaftar di `window.__timelines["<id>"]`; larangan `Date.now()` / `Math.random()` tanpa seed / network fetch / timer / `repeat: -1`; jangan tween `display`/`visibility`/`autoAlpha` pada `.clip`; `npx hyperframes check --json`) adalah model yang dipakai kontrak v1 (§3); (b) **jalur verifikasi silang** — babak HTML yang sama dapat dirender HyperFrames CLI untuk membandingkan frame dengan renderer aplikasi; (c) **calon fallback** bila jalur Electron gagal — dengan catatan distribusi (HyperFrames CLI butuh Node + Chrome sendiri; sama seperti Puppeteer, ini keputusan pemilik). **Remotion TIDAK diadopsi untuk renderer KenStory** (model React + bundler; konsep mengunci HTML+GSAP). Remotion tetap cadangan Bos di lane lain, bukan di sini.

### 2.4. Fadli — harness dan dua penyesuaian alur (klaim Threads, 8–13 Nov 2026)

Sumber: `~/memory/people/n-faddli.md`; asumsi tambahan Bos 13 Nov 21:50 (screenshot Threads).

- **Harness TERBUKTI dari screenshot:** folder kerja `motion-work/` berisi `CLAUDE.md`/`AGENTS.md` (instruksi kerja agent — lihat `folme.md`, berkas markdown instruksi global, BUKAN skill), `input/` (naskah per adegan, audio narasi, waktu kata, referensi gaya), `style/` (kode referensi gaya, mis. `style.js`), `tools/` (validator beat, pratinjau frame kunci), `out/` (`beats.json`, frame kunci, `act-1.js`/`act-2.js`/`act-3.js`). Di UI ada tombol Perbarui Folder Kerja dan Buka Folder; aplikasi tetap terbuka selama agent bekerja.
- **Perintah dua tahap dengan gerbang manusia:** Tahap 1 Rancangan (agent hasilkan `out/beats.json` + frame kunci per beat — contoh 26 beat / 26 frame kunci; aplikasi menampilkan frame kunci untuk disetujui/ditolak per beat; agent BERHENTI, tidak lanjut sendiri). Tahap 2 Animasi penuh (agent tulis kode animasi per babak + `style.js` + `beats.json` ke `out/`; boleh jalankan `snap.mjs`; MP4 dirender APLIKASI lewat renderer kontrak v1, per adegan via rentang waktu; agent tidak wajib me-render).
- **Dua penyesuaian alur (asumsi tambahan 13 Nov 21:50):** (a) motion = ganti langkah generate gambar/video jadi generate code + render video di aplikasi; (b) talking head = karena naskah mengikuti video mentah, alur berubah dari "mengembangkan ide" jadi "memahami narasi video". Butir (a) = D-21 persis. Butir (b) adalah masukan desain Fase 5 (pintu masuk dari narasi video mentah, transkrip → adegan) — dicatat di studi Fase 5, bukan di sini.
- **Jawaban desain atas dua pertanyaan Alya (konsep Bab 8):** timing/easing — waktu mulai dan durasi tiap beat mengikuti waktu kata (data, bukan selera agent); easing dan gaya gerak mengikuti prompt motion + berkas gaya; pengguna bisa menimpa easing per beat di panel Rancangan sebelum Tahap 2. Template — dua tingkat: pustaka template gaya di tingkat aplikasi/channel (dipakai ulang lintas proyek) dan timpa per proyek di folder kerja; mengubah pustaka tidak menyentuh proyek jadi; mengubah timpa proyek hanya menandai beat terkait "perlu Tahap 2 ulang".
- **Batas klaim:** semua detail Fadli adalah klaim dari screenshot/chat — tidak ada repo atau tautan; tidak ada yang terverifikasi sampai tingkat kode. Yang dipakai di sini hanyalah POLA (folder kerja + 2 tahap + beats.json), bukan kode.

## §3. Kontrak D-21 — renderer kontrak v1

D-21 (DITETAPKAN, Verdict Final W3): **agen menghasilkan HTML+JS babak + beats.json (boleh menjalankan snap.mjs untuk verifikasi); MP4 dirender APLIKASI lewat renderer kontrak v1; agen tidak wajib merender.** Kontrak ini merumuskan pembagian kerja itu sampai tingkat field dan tanggung jawab.

### 3.1. Input: satu babak (unit penulisan, D-09)

Unit penulisan = **BABAK** (3–8 adegan, kira-kira ≤30 dtk) dengan `style.js` bersama — bukan HTML per adegan (pilihan lama ditarik: bukti S1d + materi Fadli 26 beat dalam 3 babak mengalahkannya). Folder babak (`motion-work/out/<babakId>/`):

```
index.html      satu berkas, CSS/JS inline (boleh modul inline; module lokal <script src> diblokir CORS saat file://)
style.js        gaya bersama babak (palet, font, bahasa gerak — dari pustaka template / timpa proyek)
act-1.js        kode animasi babak 1 (GSAP timeline; satu babak = satu timeline dijeda)
beats.json      kontrak data (lihat §3.2)
assets/         gambar/font lokal babak (font WAJIB file lokal — lihat §3.3)
keyframes/      frame kunci per beat dari Tahap 1 (untuk persetujuan Rancangan)
```

Sisipan hybrid (satu adegan motion di proyek gambar) = babak berisi 1 adegan. Pratinjau ringan: yang dimuat hanya satu babak, bukan proyek utuh.

### 3.2. beats.json — skema v1

Satu-satunya sumber kebenaran soal timing dan status beat. Timing mengikuti waktu kata narator (data), bukan selera agent.

```jsonc
{
  "version": 1,
  "babakId": "babak-1",
  "fps": 30,
  "width": 1280, "height": 720,
  "durationSec": 24.5,
  "styleId": "kartun-panggung-03",      // dari pustaka template / timpa proyek
  "captionZone": { "enabled": false, "bottomPct": 12 },  // B6, lihat §3.4
  "beats": [
    {
      "id": "b01",
      "sceneKey": "03",
      "startSec": 2.10, "endSec": 5.40,
      "narration": "Kalimat narasi adegan ini.",
      "words": [ { "w": "Kalimat", "start": 2.10, "end": 2.55 } ],
      "keyframe": "keyframes/b01.png",
      "easing": "power2.out",           // dari prompt motion + berkas gaya
      "easingOverride": null,           // timpa manual per beat di panel Rancangan
      "motionPrompt": "Raka mengangkat lengan; kamera push pelan.",
      "status": "approved"              // pending | approved | redo
    }
  ]
}
```

Aturan: `startSec`/`endSec` tiap beat WAJIB berasal dari waktu kata (Whisper + `align.ts`); agent tidak boleh menebak durasi. `easing` bawaan dari prompt motion + berkas gaya; `easingOverride` hanya diisi pengguna di panel Rancangan sebelum Tahap 2. `status: "redo"` menandai beat yang perlu Tahap 2 ulang (mis. karena timpa template proyek berubah). Validator beat (di `tools/`) menolak beats.json yang: beat tumpang tindih, beat di luar durasi babak, kata tanpa waktu, atau keyframe hilang.

### 3.3. Permukaan kendali HTML babak (OPENER) + aturan determinisme

Renderer aplikasi memuat `index.html` babak dan mengendalikannya lewat permukaan yang SAMA dengan starter S3 (sudah terbukti di spike) — diperketat dengan aturan HyperFrames/bang-motion:

```js
window.OPENER = {
  ready: true,                    // true bila halaman + font + aset siap
  DURATION: 24.5,                 // detik, harus == beats.json durationSec
  tl: <GSAP timeline, dijeda>,    // satu timeline per babak
  seek: async (t) => {},          // pindah ke detik t (atau seekFrame)
  seekFrame: async (t) => {},
  clipsReady: () => true,         // semua klip/media siap
};
```

Aturan determinisme (wajib; pelanggaran = beats.json/HTML ditolak validator, bukan diperbaiki diam-diam):

1. Semua visual adalah fungsi murni dari `tl.time()` (bang-motion Hukum #2). Larangan: `Date.now()`, `Math.random()` tanpa seed, timer (`setTimeout`/`setInterval` di jalur animasi), network fetch setelah load, `repeat: -1` (HyperFrames kontrak 4).
2. Elemen timed memakai `class="clip"` + `data-start` + `data-duration` (detik), tampil pada `[start, start+duration)`; timeline didaftarkan sebagai `window.__timelines["<babakId>"] = tl` (HyperFrames kontrak 1–3) — supaya HTML yang sama bisa dirender jalur Electron MAUPUN HyperFrames CLI (§2.3).
3. Jangan tween `display`/`visibility`/`autoAlpha` pada `.clip`; animasikan anaknya. Jangan pakai CSS `transform` pada elemen yang dianimasikan GSAP. Jangan `play()`/`pause()`/seek media di dalam HTML — media diatur renderer.
4. Font: hanya font yang dibundel (file di `assets/fonts/`) yang resolve by name; CDN font tidak dijamin (renderer aplikasi tidak wajib online saat render). Aset: path relatif `assets/...`, tanpa `/` di depan.
5. `executeJavaScript` TIDAK PERNAH mengembalikan objek GSAP — selalu bungkus IIFE yang mengembalikan primitif (jebakan S2: mengembalikan `tl` membuat Electron menserialisasi objek siklik raksasa; panggilan tidak pernah kembali, 132 dtk, 0 frame).

### 3.4. Caption — aturan B6 (pemiliknya aplikasi)

- Caption pada adegan motion bersifat OPSIONAL dengan default MATI; pada adegan gambar/video default MENYALA (karaoke). Setelan ini per adegan.
- **Pemilik lapisan caption adalah APLIKASI, bukan HTML motion** — HTML motion tidak pernah menggambar caption; aplikasi membakarnya di ekspor (FFmpeg ASS) atau tidak, sesuai setelan per adegan.
- Zona aman: bila caption menyala, pita bawah frame dicadangkan untuk caption (ditentukan di style brief sebagai "zona caption", bawaan **12% bawah frame**) dan motion HTML dilarang menaruh teks kunci di pita itu; bila caption mati, frame penuh boleh dipakai.
- Implementasi memakai jalur caption yang sudah ada (`captions.ts`, `buildAss` di `exporter.ts`, metrik `cell` per font) — bukan jalur baru.

### 3.5. Tanggung jawab renderer (aplikasi)

1. **Muat** babak HTML di hidden `BrowserWindow` dengan ukuran konten dipaksa dari konfigurasi aplikasi (`useContentSize`/`setContentSize`) — BUKAN dari `OPENER.W/H` (kontrak D-11).
2. **Verifikasi ukuran frame pertama** sebelum lanjut: bila ukuran capture ≠ konfigurasi, render BERHENTI dengan pesan jelas — bukan diam-diam menghasilkan video berukuran salah (bukti S2: 1280×692 vs 1280×720).
3. **Seek per frame** pada fps konfigurasi (bawaan 30): `seek(t)` → 2× `requestAnimationFrame` → jeda settle 50 ms → tangkap DUA kali, maju hanya bila hash sha256 keduanya sama (maks 3 percobaan; kegagalan dicatat, dipakai tangkapan terakhir supaya terlihat di laporan — metode W7 dari `electron-runner.cjs`).
4. **Tangkap** ke intermediate (format diputus spike: PNG lossless vs JPEG q90 — §1.4 butir 4), catat hash + ukuran tiap frame.
5. **Stitch:** render per adegan via rentang waktu `[t0,t1]` dari satu HTML babak (S1d terbukti: 60/60 hash identik VM, 20/20 laptop); stitch antar babak memakai FFmpeg hard cut bawaan; xfade hanya di dalam babak bila dirancang, dengan bantalan 2 frame per segmen agar transisi tidak memakan durasi adegan; transisi antar babak harus lolos verifikasi `snap.mjs`.
6. **Audio:** VO + musik/SFX lewat jalur yang sudah ada (`narration.ts`, `timeline.ts`, `loudnorm` −14 LUFS di `exporter.ts`). Audio dari file video motion tidak pernah dipakai (aturan yang sama dengan prompt video: `NO_MUSIC`).
7. **Ekspor sebagai job antrean:** persen, tombol Batalkan, berkas sementara (`.part`) sehingga ekspor terputus bisa dilanjutkan (Bab 14). Verifikasi keluaran: jumlah frame, durasi, hash sampel.
8. **Yang TIDAK dilakukan renderer:** tidak menulis animasi (itu kerja agent); tidak menjalankan `export-frames.mjs` bang-motion (itu alat verifikasi agent); tidak menggambar caption (itu lapisan aplikasi, §3.4).

### 3.6. Peran bang-motion, HyperFrames, Remotion di kontrak ini

| Alat | Peran di kontrak v1 |
|---|---|
| **bang-motion** (skill, MIT) | Hukum penulisan HTML babak: anti-PPT, determinisme (Hukum #2), style brief, starter. Agent WAJIB mengikuti; validator + peninjau Rancangan memeriksanya. `snap.mjs` = alat verifikasi agent (diizinkan D-21). |
| **HyperFrames** (CLI, Apache-2.0) | Kontrak referensi (§3.3 butir 2) + jalur verifikasi silang (bandingkan frame renderer aplikasi vs CLI) + calon fallback bila jalur Electron gagal (keputusan distribusi pemilik). BUKAN renderer dalam aplikasi. |
| **Remotion** | TIDAK dipakai di renderer KenStory. Tetap cadangan Bos di lane lain. |

## §4. Integrasi ke KenStory

### 4.1. Motion = provider, bukan mode lahir (D-02, D-05)

- Registry provider 3 tingkat (Bab 6): Tingkat 1 otomatis (Flow2API, Ekstensi, NexaBot, Higgsfield); Tingkat 2 Manual (selalu tersedia sebagai cadangan); **Tingkat 3 Motion — provider `motion` (harness Bab 8); hanya aktif bila sakelar induk di Pengaturan menyala**.
- Sakelar induk di Pengaturan, **mati secara bawaan**. Preset "Motion Grafik penuh" mengaktifkan provider motion di semua adegan; preset "Hybrid" hanya di adegan kunci. Pada adegan motion, efek otomatis, gerak kamera, dan transisi editor TIDAK dipakai — tertulis di UI.
- Mode lahir proyek TIDAK berubah: Gambar & Video (langkah 3 = Storyboard) dan Talking Head / Fase 5 (langkah 3 = Transkrip → Adegan). Untuk adegan motion, langkah 3 bernama **Rancangan** (Bab 11.4).
- Per-ade­gan: `visualProvider` mendapat nilai baru `'motion'` (lihat §6.1). `auto` tidak pernah memilih motion sendiri — motion hanya bila pengguna (atau preset) memilihnya eksplisit. Ini menjaga gerbang biaya: motion memakai langganan agent pengguna (AI Pro/Kiro/lainnya); aplikasi tidak menambah biaya di lapisan ini, dan tidak ada pemanggilan berbayar yang diam-diam.

### 4.2. Yang dipakai ulang dari pipeline yang ada

| Bagian | Dipakai untuk motion | Catatan |
|---|---|---|
| `story.ts` (naskah + rencana visual) | Naskah per adegan + prompt motion per adegan | Prompt motion lahir dari rencana visual yang sama |
| `narration.ts` (satu rekaman VO utuh, dipotong per adegan) | Audio narasi + potongan per adegan | Prasyarat harness: narasi sudah direkam SEBELUM folder kerja dibuat |
| `whisper.ts` + `align.ts` + `cuts.ts` | Waktu kata per adegan | Timing beat = data waktu kata (§3.2); potongan adegan mengikuti kata |
| `captions.ts` + `exporter.ts` (ASS) | Caption B6 (§3.4) | Jalur yang sama dengan adegan gambar/video |
| `exporter.ts` (segmen, xfade, loudnorm −14 LUFS, `.part`, Batalkan) | Stitch + audio + keluaran MP4 | Segmen motion dirender renderer (§3.5), bukan `cameraChain` |
| `motion.ts` (shared) | TIDAK dipakai di adegan motion | Gerak kamera/transisi editor nonaktif di adegan motion (D-02) — `motion.ts` tetap untuk adegan gambar/video |
| `jobs.ts` + `events.ts` | Antrean job motion + progres ke renderer | Job motion menunggu (seperti manual): `queued` tanpa tugas jalan sampai Tahap 1/2 selesai |
| `secrets.ts` | — | Agent coding memakai langganan/kunci pengguna SENDIRI di luar aplikasi; aplikasi tidak menyimpan kunci agent dan tidak mengirim kunci apa pun ke agent |
| `Clip` + `scene_key` (kontrak data Bab 5) | Kunci sinkronisasi babak ↔ adegan | `sceneKey` di beats.json = `scene_key` yang sama dengan Tier 1–3 |
| Dev harness (`STUDIO_CAPTURE_PLAN`) | E2E + UI motion | Pola yang sama dengan Tier 1–3 |
| Pengaturan + `settings.ts` | Sakelar induk + preset + pustaka template | Lihat §6.5 |

### 4.3. Yang baru

1. **Folder kerja motion** (`motion-work/` per proyek): `CLAUDE.md`/`AGENTS.md` (instruksi kerja agent; `folme.md` instruksi global), `input/` (naskah per adegan, audio narasi, waktu kata, referensi gaya), `style/` (kode referensi gaya), `tools/` (validator beat, pratinjau frame kunci), `out/` (`beats.json`, frame kunci, `act-*.js` + `style.js`). Tombol UI: Perbarui Folder Kerja, Buka Folder. Aplikasi harus tetap terbuka selama agent bekerja.
2. **Halaman Rancangan** (langkah 3 untuk adegan motion): daftar beat + frame kunci, setuju/tolak per beat, timpa easing per beat sebelum Tahap 2. Gerbang Tahap 1 benar-benar berhenti menunggu persetujuan (gerbang Fase 4).
3. **Renderer kontrak v1** (`services/renderer.ts` + `shared/motion-contract.ts`): §3.5.
4. **Pustaka template gaya** (tingkat aplikasi/channel) + timpa per proyek (folder kerja). Mengubah pustaka tidak menyentuh proyek jadi; mengubah timpa proyek hanya menandai beat terkait "perlu Tahap 2 ulang".
5. **Provider `motion`** di registry + wiring `generation.ts` + job menunggu (§6).
6. **Tutorial motion di dalam aplikasi** (2 tahap + `folme.md` + perintah Claude/Kiro/Antigravity + gerbang persetujuan), mengikuti pola tutorial Flow2API/NexaBot/Manual.

## §5. Keputusan desain (F4-01 – F4-11)

| # | Keputusan | Alasan / sumber |
|---|---|---|
| F4-01 | **D-22: jalur utama (i) hidden + useContentSize; cadangan (iii) Puppeteer; (ii) offscreen ditolak bentuk sekarang** — bersyarat spike 4.0 (§1.4) | §1.2–§1.3; 0.6 §3–§4; S3 v2 |
| F4-02 | **Kontrak D-21 dirumuskan §3** (beats.json v1 + OPENER + determinisme + B6 + tanggung jawab renderer) | Konsep Bab 8/14; bang-motion Hukum #2; HyperFrames kontrak |
| F4-03 | **bang-motion = hukum penulisan babak; HyperFrames = kontrak referensi + verifikasi silang + calon fallback; Remotion tidak dipakai di renderer KenStory** | §2.2–§2.3; keputusan Bos 13 Nov 08:56 (lane lain) |
| F4-04 | **Motion = provider `motion` tingkat 3** (bukan mode lahir); sakelar induk mati bawaan; preset penuh/hybrid; `auto` tidak pernah memilih motion sendiri | Konsep Bab 6/9 (D-02, D-05) |
| F4-05 | **Unit penulisan = babak (D-09); unit render/persetujuan = adegan via rentang [t0,t1]**; stitch antar babak hard cut; xfade hanya di dalam babak bila dirancang | Konsep Bab 8; S1d 60/60 VM, 20/20 laptop |
| F4-06 | **Timing beat = waktu kata (data); easing = prompt + berkas gaya, bisa ditimpa per beat di Rancangan** | Konsep Bab 8 (jawaban atas pertanyaan Alya) |
| F4-07 | **Caption milik aplikasi (B6): default MATI di adegan motion; zona caption 12% bawah bila menyala; HTML motion dilarang menaruh teks kunci di pita itu** | Konsep Bab 8/13; `captions.ts` sudah ada |
| F4-08 | **Template dua tingkat** (pustaka aplikasi/channel + timpa proyek); ubah pustaka tidak menyentuh proyek jadi; ubah timpa hanya menandai beat "perlu Tahap 2 ulang" | Konsep Bab 8 (jawaban atas pertanyaan Alya) |
| F4-09 | **Job motion menunggu seperti manual** (`queued` tanpa tugas jalan; `resumeJobs` melewatkannya) sampai Tahap 1/2 selesai; deteksi selesai = berkas `out/` hadir (beats.json + keyframes + act-*.js) | Pola Tier 2 (D2-03/D2-04); konsep Bab 8 |
| F4-10 | **Tanpa fallback otomatis antar jalur capture** — bila renderer utama gagal, aplikasi berhenti dengan pesan jelas (D-11), bukan diam-diam memakai jalur lain | Kontrak D-11; prinsip gagal-tertutup (W2/D-07) |
| F4-11 | **Biaya motion = Rp0 tunai dari aplikasi** — agent memakai langganan pengguna sendiri; tidak ada kunci agent yang disimpan aplikasi; gerbang biaya tidak berlaku (tidak ada pemanggilan berbayar aplikasi), tetapi UI menyatakan ini eksplisit | Konsep Bab 14 (tabel biaya); AGENTS.md aturan 2 |

## §6. Rencana implementasi (file-per-file)

Mengikuti pola Tier 1–3 (katalog → transport/mock → penyambungan → UI → dokumen → verifikasi). Urutan kerja: 1–3 kontrak+tipe, 4–6 harness+renderer, 7–8 penyambungan, 9–10 UI, 11 dokumen, 12 verifikasi.

1. **`src/shared/motion-contract.ts` (baru)** — tipe `BeatsJson`, `Beat`, `CaptionZone`; validator beats.json (tumpang tindih, di luar durasi, kata tanpa waktu, keyframe hilang); interface `Opener` (ready/DURATION/tl/seek/clipsReady); konstanta kontrak (fps bawaan 30, zona caption 12%, settle 50 ms, percobaan maks 3); aturan determinisme sebagai daftar periksa.
2. **`src/shared/manual.ts`** — tambah `'motion'` ke `VisualProvider` + entri `VISUAL_PROVIDERS` (label "Motion", hint "Kode HTML+GSAP, render aplikasi") + `isVisualProvider`.
3. **`src/shared/types.ts` + `src/main/db/index.ts` + `src/main/repo.ts` + `renderer/src/store/project.ts`** — kolom klip baru `motionBabakId: string | null` dan `motionBeatId: string | null` (status beat tinggal di beats.json — satu sumber kebenaran, bukan duplikat di Clip). Ikuti daftar periksa `docs/data-model.md` (8 tempat: tipe Clip, migrasi baru di akhir array, `toClip`, upsert `saveSnapshot`, `duplicateProject`, `insertClipAfter`, `CLIP_COLS`, nilai bawaan `addClip`).
4. **`src/main/services/motion.ts` (baru)** — harness folder kerja: buat `motion-work/` (CLAUDE.md/AGENTS.md dari template + `folme.md` pengguna, `input/` dari naskah/audio/waktu-kata, `style/` dari template terpilih, `tools/` validator + pratinjau frame kunci, `out/`); baca/tulis/validasi beats.json; deteksi selesai Tahap 1 (beats.json + keyframes hadir) dan Tahap 2 (act-*.js + style.js hadir); pustaka template (baca/tulis tingkat aplikasi/channel) + timpa proyek.
5. **`src/main/services/renderer.ts` (baru)** — renderer kontrak v1 (§3.5): hidden window + `useContentSize`, verifikasi ukuran frame pertama (D-11), seek + settle + double-verify (W7), tangkap intermediate, S1d range render, stitch FFmpeg, progres/batalkan. Dipakai `exporter.ts` untuk segmen motion.
6. **`src/main/services/motion.ts` (lanjutan) + `src/main/generation.ts`** — `resolveVisualProvider` tambah cabang `'motion'`; `startMotionJob` (job `queued`, menunggu Tahap 1/2 — seperti manual); estimasi biaya motion = Rp0 tunai (F4-11); preset penuh/hybrid (aktifkan `motion` per adegan sesuai preset).
7. **IPC (3 tempat, AGENTS.md aturan 5)** — `motion:prepareWorkFolder`, `motion:getBeats`, `motion:approveBeat`, `motion:overrideEasing`, `motion:renderBabak`, `motion:getTemplates`: `handle(...)` di `src/main/ipc.ts`, tipe di `src/shared/api.ts`, `call(...)` di `src/preload/index.ts`.
8. **`src/main/exporter.ts`** — segmen motion: bila klip `visualProvider === 'motion'`, render via `renderer.ts` (bukan `cameraChain`); stitch antar babak hard cut; caption ASS per B6; audio seperti biasa (loudnorm −14 LUFS). Pratinjau ringan satu babak di Editor (bukan proyek utuh).
9. **UI (renderer)** — halaman **Rancangan** (langkah 3 untuk adegan motion): daftar beat + frame kunci + setuju/tolak per beat + timpa easing; **Pengaturan**: sakelar induk motion + preset penuh/hybrid + pustaka template; **StoryboardStep**: badge `motion` per adegan + tombol Perbarui/Buka Folder Kerja; **Editor**: pratinjau satu babak + setelan caption per adegan (B6: default mati di motion); teks Indonesia, komponen `Select`/`Popover` (bukan `<select>` bawaan).
10. **Dokumen** — `docs/layanan-ai.md` (+motion agent), `docs/keputusan-teknis.md` (entri D-21/D-22), tutorial motion di dalam aplikasi (2 tahap + `folme.md` + perintah Claude/Kiro/Antigravity + gerbang persetujuan), `docs/masalah-diketahui.md` (batas yang diketahui).
11. **Verifikasi (pola Tier 1–3)** — `npm run typecheck` + `npm run build` bersih; service-test mock (validator beats, kontrak vs HTML fixture, renderer vs fixture); e2e harness (babak fixture → S1d 20/20 + ukuran tepat + MP4 jadi; gerbang Tahap 1 berhenti menunggu persetujuan); regresi demo+P30 tanpa regresi (baseline: demo mp4 `1e348c47…`, P30 `5bcf2ec7…`, SRT `f403c5ec…`/`6aa500d6…`, frame 504/504); UI screenshot + baca satu per satu; verifikasi independen (12 butir, pola Tier 4).
12. **Spike 4.0 (bagian dari implementasi, BUKAN studi ini)** — §7 butir spike; hasilnya memutus final D-22 dan mengunci intermediate (PNG vs JPEG) + angka RAM + delta installer Puppeteer.

## §7. Daftar periksa uji live PC + spike 4.0

### 7.1. Spike 4.0 (tugas implementasi — memutus final D-22)

Jalankan di VM dulu, lalu konfirmasi di laptop Bos (E(3) + §6 laporan 0.6):

1. Hidden+useContentSize: S1d 20/20 DAN capture tepat 1280×720 (dan 1080×1920 untuk 9:16). Gagal salah satu = jalur utama gugur, naikkan Puppeteer.
2. Offscreen+perbaikan (settle 50 ms + double-verify): S1d 20/20? Kecepatan vs hidden? Hanya ditinjau ulang bila mengalahkan hidden pada kecepatan DENGAN S1d 20/20 DAN RAM lebih rendah.
3. Puppeteer: S1d 20/20 DAN ukuran tepat (konfirmasi ulang) + ukur delta ukuran installer (Chromium bundel).
4. RAM metode baru per jalur (lacak PID proses browser + turunannya saja) — bandingkan dengan metode SAMA; ambang D-17: Hijau ≤1,2 GB, Kuning ≤1,8 GB.
5. Intermediate PNG vs JPEG q90: kecepatan + kualitas hasil akhir (tonton frame; ukur PSNR/SSIM bila perlu — jangan klaim tanpa angka).
6. S3 v2 di laptop Bos (E(3)): satu lari penuh; catat p50 hidden PNG vs JPEG + S1d offscreen 2× (spesifikasi 0.6 §6).
7. Satu gaya Berat (WebGL) diukur — atau dicatat tetap mati bawaan (D-17).

### 7.2. Uji live PC (gerbang Bos, sesudah implementasi)

1. Satu babak fixture → MP4 end-to-end lewat renderer aplikasi (bukan CLI luar).
2. Gerbang Tahap 1 benar-benar berhenti menunggu persetujuan (tidak lanjut sendiri).
3. Satu proyek motion penuh selesai (gerbang Fase 4, konsep Bab 16).
4. Caption B6: default mati di adegan motion; bila dinyalakan, zona 12% dihormati (tidak ada teks kunci di pita bawah).
5. Biaya Rp0 tunai dari aplikasi (agent = langganan Bos; tidak ada kunci agent di aplikasi).
6. Pratinjau ringan satu babak (bukan proyek utuh) + persetujuan per beat bekerja.
7. Regresi: proyek gambar/video lama tetap ekspor identik (demo+P30).
8. G4: penggunaan pribadi (motion via style brief + agent) → G4 tidak aktif; dicatat bila rencana rilis publik muncul.

## §8. Catatan dan batas studi

1. **D-22 final diputus spike 4.0, bukan studi ini.** Studi ini merekomendasikan (i) utama + (iii) cadangan + (ii) ditolak-bentuk-sekarang, dengan kriteria lolos/gagal yang eksplisit (§7.1). Bila spike membalikkan rekomendasi (mis. hidden+useContentSize gagal ukuran, atau Puppeteer menang RAM dengan selisih besar), keputusan mengikuti data spike — bukan dokumen ini.
2. **Syarat Mulai E(3) masih terbuka.** Paket S3 v2 belum pernah dijalankan di laptop Bos; konsep menyatakan butir ini "hanya menahan Fase 4". Bos memerintahkan studi Fase 4 sekarang dan laptopnya sedang dipakai hal lain — studi ini tidak butuh E(3), tetapi spike 4.0 WAJIB melipat lari S3 v2 laptop ke dalamnya (§7.1 butir 6).
3. **D-17 kelas Berat belum diukur.** Gaya Berat (WebGL/Three.js/partikel) mati bawaan sampai diukur di Fase 4 (§7.1 butir 7).
4. **G4 tidak aktif** untuk pemakaian pribadi (motion via style brief + agent). Aktif hanya bila ada rencana rilis publik DAN fitur editor motion visual tanpa kode — saat itu berhenti sampai ada persetujuan tertulis Webflow atas lisensi GSAP, atau fitur dibatalkan.
5. **Bukti HyperFrames/Remotion berasal dari lane lain** (uji murni stack 1-7, chat lain). Yang dipakai di sini hanyalah validasi teknik + kontrak referensi; keputusan D-22 tetap berdiri di atas S3/0.6 (bukti KenStory sendiri).
6. **Semua detail Fadli adalah klaim** (screenshot/chat, tanpa repo). Yang diadopsi hanyalah POLA (folder kerja + 2 tahap + beats.json); kode tidak disalin.
7. **Studi ini Rp0, tanpa uji live, tanpa kunci, tanpa merge.** Implementasi (§6) menunggu perintah Bos/induk sesudah pemetaan + keputusan D-22.
