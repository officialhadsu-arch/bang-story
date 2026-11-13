# Pemetaan Fase 5 Talking Head → KenStory — Mode keempat, narasi-dulu (0.5)

Tanggal: 13 Nov 2026. Cabang: `0.5-fase5-talking-head` (dari main `bfc019f`).
Status: studi + pemetaan selesai — **20/100**.

Fase 5 adalah mode keempat KenStory: **Talking Head**, di balik feature flag,
dibangun terakhir, dan **tidak menahan tiga mode lain** (konsep v2.1 Bab 16).
Pintu masuknya **narasi-dulu** — bukan mengembangkan ide, melainkan memahami
narasi video mentah — sesuai asumsi tambahan Fadli (13 Nov 21:50).

Aturan kerja yang mengikat tahap ini: **studi saja — baca dokumen/kode.
Tanpa panggilan API berbayar, tanpa memperoleh atau memakai API key apa pun,
tanpa daftar akun, tanpa uji live.** Uji live tetap gerbang PC + persetujuan
Bos per pemakaian. Tanpa merge tanpa perintah Bos.

## 1. Yang terverifikasi dari sumber (Fadli + konsep v2.1 + kode)

### Asumsi Fadli (Threads, 13 Nov 21:50, screenshot Bos)

- Blueprint Bang Story: ide → naskah → storyboard → hasil akhir.
- Motion: ganti langkah generate gambar/video jadi generate code + render
  video di aplikasi.
- Talking head: **karena naskah mengikuti video mentah, alur berubah dari
  'mengembangkan ide' jadi 'memahami narasi video'**; selebihnya tuning
  berulang.
- Detail dari `~/memory/people/n-faddli.md` (klaim dari screenshot/chat
  saja, tanpa repo): alur **Impor video → Transkrip → Adegan → Editor**.
  Halaman Transkrip: "Susun adegan dengan AI", Potong jeda, Kata pengisi
  Buang/Biarkan, Zoom otomatis. Contoh: **14 adegan, 55 potongan, 1:22
  dipertahankan dari 2:35, 1:13 dipotong.** Fadli: "lebih sulit ternyata",
  masih tahap uji.

### Konsep v2.1 (31 hlm, dikunci Verdict Final)

- **Bab 9 — mode lahir terkunci hanya Gambar & Video atau Talking Head;
  Motion = provider** (bukan mode). Sakelar induk motion di Pengaturan +
  preset "Motion Grafik penuh".
- **Bab 11.4 — halaman Transkrip** (persis pola tangkapan layar Fadli):
  Susun Ulang Adegan dengan AI, potong jeda, kata pengisi Buang/Biarkan,
  zoom otomatis Ya/Tidak, daftar kata per kata dengan cap waktu dan sorotan
  kata terbuang, pratinjau video di kanan, ringkasan adegan/potongan/durasi
  terbuang, lalu Buat Adegan.
- **Bab 11.5 — Editor:** "Di mode Talking Head, komposisi per adegan
  dipilih di Editor." Gerak kamera dan transisi editor tidak dipakai untuk
  adegan motion (gerak diatur di Rancangan); untuk talking head yang
  dipilih adalah komposisi.
- **Bab 12 — Skenario 4 (eksperimental):** impor video ceramah 2:35 →
  Transkrip: buang jeda di atas **0,5 detik** + kata pengisi → Susun Ulang
  Adegan dengan AI menjadi **14 adegan (1:22 terpakai, 1:13 terbuang)** →
  periksa komposisi per adegan di langkah Adegan → Editor → Ekspor.
  Skenario ini **target Fase 5, bukan janji versi pertama**.
- **Bab 16 — gerbang Fase 5:** satu rekaman nyata selesai ke MP4; bila
  kualitas belum layak, mode tetap mati secara bawaan **tanpa menahan rilis
  lain**.
- **Waktu kata adalah produk wajib tahap Suara:** ia menggerakkan caption
  karaoke, gerak motion code, dan pemotongan Talking Head. **Tanpa waktu
  kata, tahap berikutnya tidak boleh jalan** — UI menjelaskan alasannya.
- **Penyelarasan transkrip memakai Whisper dengan penyelarasan urutan kata**
  (pola De-Story: Whisper CPP + Needleman-Wunsch) agar caption menempel
  pada kata yang benar, termasuk untuk mode Talking Head.
- **Dua pertanyaan konsultan yang belum terjawab (Bab 16)** dan dijawab
  dokumen ini di §5 (F5-06, F5-09): (a) kontrak data `Clip.id` +
  `scene_key` (Bab 5) cukup untuk semua provider termasuk Talking Head —
  apa yang kurang? (b) pendekatan deteksi komposisi (wajah/panel/
  explainer) dan zoom otomatisnya bagaimana, dan apa batas jujurnya?

## 2. Yang sudah ada di kode dan bisa dipakai ulang

Dibaca sebelum menulis rencana ini: `src/main/whisper.ts`,
`src/main/align.ts`, `src/main/cuts.ts`, `src/main/narration.ts`,
`src/main/editing.ts`, `src/main/exporter.ts`, `src/main/ipc.ts`,
`src/main/settings.ts`, `src/shared/types.ts`,
`src/renderer/src/pages/project/ProjectPage.tsx`,
`src/renderer/src/pages/project/IdeaStep.tsx`,
`docs/alur-produksi.md`, `docs/data-model.md`,
`docs/editor-dan-ekspor.md`, `docs/keputusan-teknis.md`.

| Titik | Keadaan sekarang (bukti kode) | Dipakai ulang untuk Talking Head |
| --- | --- | --- |
| Transkrip kata-per-kata (`whisper.ts:156` `recognize`, `:190` `timeScript`) | Whisper Small lokal (487 MB, dicek SHA-256), `-ml 1 -sow -ojf -nfa -dtw small`, **tanpa `--prompt`** (prompt membuat halusinasi), audio diubah ke WAV 16 kHz mono | Transkrip rekaman mentah: `recognize` atas audio hasil ekstraksi, lalu `timeScript` untuk waktu kata naskah adegan |
| Penyelarasan kata (`align.ts:55` `alignWords`, `:39` `splitHeard`) | Kata naskah dicocokkan ke kata yang didengar Whisper (edit distance); ejaan caption tetap dari naskah, hanya waktunya dari Whisper | Sama — ejaan dari transkrip, waktu dari Whisper; kata yang dipotong tidak masuk caption |
| Titik potong (`cuts.ts:61` `cutsFromWords`, `:7` `chooseCuts`) | Potong di jeda yang tumpang-tindih dengan celah antar kata adegan, **tidak pernah di tengah kata**; tanpa waktu kata, DP atas jeda `silencedetect` FFmpeg | Potong jeda >0,5 dtk dan kata pengisi memakai `cutsFromWords` yang sama — potongan tidak pernah jatuh di tengah kata |
| Narasi + caption (`narration.ts:241` `generateNarration`, `:292` `syncCaptions`) | Satu rekaman utuh lalu dipotong per adegan; `syncCaptions` mode `stale`/`all`; hasil ditandai `meta.timedBy = 'whisper-dtw'` | Pola potong-per-adegan dipakai ulang; `syncCaptions` dipakai untuk caption talking head (bukan `generateNarration` — lihat F5-07) |
| Belah klip (`editing.ts:61` `splitClip`, `:133` `detachVoice`) | Belah di playhead, digeser ke jeda antar kata terdekat; suara dan teks narasi dibelah (`splitNarration`) | Mekanisme belah yang sama untuk koreksi manual adegan hasil AI |
| Ekspor video (`exporter.ts`) | Klip video: `-ss mediaIn`, `fps`, `tpad`, gerak kamera `perspective`; rantai `xfade`; caption ASS (libass); audio `atrim` → `adelay` → `amix`; `loudnorm` −14 LUFS; `.srt` opsional | Seluruhnya dipakai ulang — segmen talking head adalah klip video biasa dengan `mediaInMs` |
| Impor video per klip (`ipc.ts:237` `assets:pickClipVideo` + `shared/api.ts` + `preload`) | Dialog file native → salin ke folder aset → `insertAsset` (kind `video`) + `setActiveAsset` | Pola IPC yang sama untuk impor rekaman mentah tingkat proyek (F5-03) |
| Sakelar fitur (`settings.ts:18,20`) | `flow2apiEnabled: false`, `nexabotEnabled: false` (mati bawaan); kunci baru wajib ada di `DEFAULT_SETTINGS` | `talkingHeadEnabled: false` mengikuti pola yang sama |
| Langkah proyek (`ProjectPage.tsx:73-76`) | `step` 1 Ide, 2 Naskah, 3 Storyboard, 4 Editor; komponen diganti per nomor langkah | Nomor langkah tetap 1–4; komponen langkah 2/3 berganti menurut mode (F5-02) |
| Buat proyek (`IdeaStep.tsx:106-320`) | Field sinopsis, durasi, bahasa, rasio aspek, suara TTS, gaya — semuanya `updateProject` (chip/picker) | Pemilih mode lahir ditaruh di sini sebagai chip, seperti rasio aspek |
| Aturan bersama (`src/shared/`) | `captions.ts` (gaya, pemenggalan, kotak rounded), `timeline.ts` (`voiceSpan`, `clipCaptionWords`, `splitNarration`), `motion.ts` (`cameraAt`) — dipakai pratinjau DAN ekspor | Caption karaoke, potongan suara, dan zoom memakai aturan yang sama di kedua sisi (pratinjau = ekspor) |
| Model data (`data-model.md`) | `Clip`: `sceneKey` 2 digit stabil, `visualProvider`, `mediaInMs`, `videoAssetId`, `audioAssetId`, `durationMs`, `motionType`; `Asset.meta.words` = `WordTiming[]` + `timedBy` | Adegan talking head = `Clip` biasa (F5-06); kata transkrip = `meta.words` (F5-04) |

## 3. Yang BELUM ada / celah

| Tidak ada | Akibat bila tidak ditangani |
| --- | --- |
| Field mode di `Project` (`src/shared/types.ts` tidak punya `mode`/`entry_mode`); tidak ada pemilih mode di `IdeaStep` | Mode lahir (Bab 9) hanya ada di konsep, belum ada di kode |
| Feature flag `talkingHeadEnabled` di `AppSettings` | Mode tidak bisa dimatikan bawaan seperti yang dituntut gerbang Fase 5 |
| Impor video mentah tingkat proyek | `pickClipVideo` hanya per klip; tidak ada jalan masuk satu rekaman panjang |
| Halaman Transkrip (Bab 11.4) | Tidak ada tempat melihat kata per kata, menandai buang/pakai, dan melihat ringkasan potongan |
| Penyimpanan transkrip mentah + status kata | Kata yang dibuang vs dipakai belum punya tempat; halaman Transkrip butuh sumber ini |
| "Susun adegan dengan AI" | Tidak ada pengelompok transkrip jadi adegan (LLM maupun fallback) |
| Daftar kata pengisi + pemotong jeda | Ambang 0,5 detik dan kata pengisi hanya ada di konsep; belum ada daftar maupun pemotongnya |
| Komposisi per adegan / zoom otomatis | Tidak ada kontrol crop per adegan; tidak ada detektor wajah di stack |
| Syarat ekspor: `exporter.ts:355` **mewajibkan `imageAssetId` tiap klip** (`belum punya gambar`) | Klip talking head (video saja, tanpa gambar) **akan ditolak ekspor** — wajib dilonggarkan (F5-10) |
| Jalur "suara dari video" | Narasi selalu TTS (`generateNarration`); aturan "audio dari file video tidak pernah dipakai di ekspor" (`keputusan-teknis.md`) belum punya pengecualian |
| Mode "tanpa TTS" | Tidak ada jalan yang mematikan `generateNarration` dan memakai suara rekaman sebagai VO |

## 4. Titik sambung ke KenStory

| Titik | Keadaan sekarang | Yang diubah Fase 5 |
| --- | --- | --- |
| Mode proyek (`shared/types.ts`, `db/index.ts`) | Tidak ada field mode | Tambah `mode: 'gambar-video' \| 'talking-head'` (nama akhir diputus saat implementasi), migrasi baru di akhir `MIGRATIONS`, nilai bawaan `gambar-video` untuk proyek lama |
| Sakelar fitur (`settings.ts`) | `flow2apiEnabled`, `nexabotEnabled` (mati bawaan) | Tambah `talkingHeadEnabled: boolean` (default `false`) |
| Langkah Ide (`IdeaStep.tsx`) | Field sinopsis/durasi/bahasa/rasio/suara/gaya | Tambah pemilih mode lahir (chip Gambar & Video / Talking Head); Talking Head hanya tampil bila flag nyala; mode terkunci begitu ada klip |
| Langkah proyek (`ProjectPage.tsx`) | Langkah 2 Naskah, 3 Storyboard | Bila `mode === 'talking-head'`: langkah 2 = Transkrip, langkah 3 = Adegan; langkah 1 dan 4 sama |
| Impor rekaman (`ipc.ts` + `shared/api.ts` + `preload`) | `assets:pickClipVideo` per klip | Tambah `talkinghead:importFootage` (pola IPC 3 tempat): pilih berkas video → salin ke folder aset proyek (kind `video`, tingkat proyek) → probe FFmpeg (durasi/resolusi) |
| Ekstraksi audio (baru, `src/main/`) | Tidak ada | Ekstrak trek audio rekaman jadi WAV 16 kHz mono (FFmpeg, pola `whisper.ts:recognize`); simpan sebagai aset audio proyek; sumber transkrip |
| Transkrip (baru, halaman + `src/main/`) | `recognize`/`timeScript` hanya untuk narasi TTS | Panggil atas audio rekaman; simpan kata di `meta.words` aset audio rekaman; halaman Transkrip menampilkan kata + cap waktu + sorotan buang + ringkasan (adegan/potongan/durasi terbuang) |
| Susun adegan (baru) | `generateScript`/`generateVisuals` dari ide (LLM, `story.ts`) | `susunAdegan` dari transkrip berwaktu (LLM strict JSON seperti `story.ts` + fallback deterministik, F5-05); tiap adegan jadi satu `Clip` (F5-06) |
| Potong jeda/kata pengisi (baru) | `cutsFromWords` untuk potong antar-adegan TTS | Daftar potong dari ambang jeda + daftar kata pengisi; diterapkan ke video DAN audio bersamaan (F5-08) |
| Komposisi/zoom (baru, Editor) | `cameraPreset`/`motionStrength` untuk gambar; `videoCamera` untuk video AI | Crop per adegan + zoom otomatis v1 (F5-09); kontrol di panel Klip Editor |
| Ekspor (`exporter.ts:343-355`) | Gambar wajib tiap klip; audio hanya dari aset audio | Longgarkan syarat gambar untuk klip video (F5-10); selebihnya pakai ulang |
| Suara (`narration.ts`) | `generateNarration` TTS per proyek | Tidak jalan di mode talking head; VO = audio segmen hasil ekstraksi (F5-07) |
| Panduan (Pengaturan) | Tab panduan Flow2API/Manual/NexaBot | Tab panduan Talking Head (Bahasa Indonesia): cara impor rekaman, batas, pemecahan masalah, uji live 1 rekaman sebagai gerbang PC |
| Dokumen | `docs/layanan-ai.md`, `NOTICE.md`, `docs/keputusan-teknis.md` | Entri baru di `keputusan-teknis.md` (pengecualian audio video + syarat gambar ekspor); panduan di atas |

## 5. Keputusan desain Fase 5

- **F5-01 — Mode lahir + feature flag.** `Project.mode` adalah atribut
  lahir proyek (`gambar-video` | `talking-head`), dipilih di langkah Ide
  dan **terkunci begitu ada klip/adegan** (ganti mode = buat proyek baru —
  sama seperti keputusan mode di Bab 10 §10.4 untuk mode lain). Proyek
  kosong yang belum punya klip masih boleh ganti mode, karena belum ada
  yang dibangun di atasnya. `talkingHeadEnabled`
  di `AppSettings`, default `false`; pilihan Talking Head hanya tampil
  bila flag nyala. Tiga mode lain tidak mengenal flag ini dan tidak
  tersentuh.
- **F5-02 — Langkah per mode, nomor tetap.** Langkah tetap 1–4. Mode
  talking head: langkah 1 Ide (dengan impor rekaman), langkah 2 Transkrip,
  langkah 3 Adegan (periksa komposisi), langkah 4 Editor. Mode lain:
  langkah 2 Naskah, langkah 3 Storyboard seperti sekarang. Komponen yang
  dirender di langkah 2/3 dipilih dari `project.mode` di `ProjectPage`.
- **F5-03 — Impor rekaman mentah tingkat proyek.** Satu berkas video per
  proyek (ceramah/rekaman orang berbicara). IPC baru
  `talkinghead:importFootage` mengikuti pola `assets:pickClipVideo`:
  dialog file native → salin ke folder aset proyek (kind `video`,
  tanpa `clipId` — milik proyek) → probe FFmpeg untuk durasi/resolusi.
  Rekaman bisa diganti (impor ulang = rekaman baru; adegan lama ditandai
  basi seperti `needsVisual`).
- **F5-04 — Transkrip sekali untuk seluruh rekaman.** Audio rekaman
  diekstrak (WAV 16 kHz mono) lalu `recognize` + `alignWords` — Whisper
  Small lokal yang sama dengan caption, tanpa `--prompt`, waktu kata dari
  DTW. Kata disimpan di `meta.words` aset audio rekaman (bentuk
  `WordTiming[]` yang sama). Halaman Transkrip menampilkan kata per kata
  dengan cap waktu, sorotan kata terbuang, pratinjau video di kanan, dan
  ringkasan (adegan/potongan/durasi terbuang) — sesuai Bab 11.4. Transkrip
  yang gagal (Whisper belum diunduh / audio tidak terbaca) gagal keras
  dengan pesan jelas; tidak ada transkrip palsu.
- **F5-05 — Susun adegan dengan AI + fallback deterministik.** LLM
  (pola `story.ts`, strict JSON) menerima transkrip berwaktu dan
  mengembalikan batas adegan (rentang kata) + judul per adegan. Bila LLM
  gagal/tidak tersedia, fallback deterministik: potong pada jeda panjang
  (ambang di atas 0,5 dtk, terpanjang dulu) hingga tiap adegan ±30–60
  detik. Fallback selalu menghasilkan adegan — tidak ada jalan buntu
  diam-diam. Judul adegan dari AI boleh diedit pengguna.
- **F5-06 — Adegan = Clip biasa; kontrak `Clip.id` + `scene_key` CUKUP.**
  Jawaban pertanyaan konsultan (a): tiap adegan adalah satu `Clip` —
  `videoAssetId` menunjuk file rekaman yang sama, `mediaInMs` = awal
  segmen di dalam rekaman, `durationMs` = panjang segmen, `audioAssetId`
  = audio segmen hasil ekstraksi (F5-07), `narration` = kata-kata adegan
  itu (verbatim dari transkrip, bukan hasil tulis ulang), `sceneKey`
  stabil 2 digit. **Tidak perlu tabel baru untuk adegan.** Satu-satunya
  nilai baru: `visualProvider` tambah `'footage'` (visual dari rekaman
  impor) supaya Storyboard/Editor tahu adegan ini bukan dari provider AI.
  Aturan timeline yang sudah ada berlaku apa adanya (klip video tidak
  boleh lebih panjang dari sisa videonya).
- **F5-07 — Audio dari rekaman, bukan TTS.** Audio tiap segmen adegan
  diekstrak dari rekaman (FFmpeg) menjadi aset audio; `meta.words`-nya
  adalah potongan kata transkrip segmen itu (waktu relatif ke segmen).
  `generateNarration` **tidak jalan** di mode talking head; VO adegan =
  audio segmen. Caption karaoke memakai `meta.words` seperti biasa
  (prinsip: akurasi waktu dan VO harus valid — kata dan waktunya berasal
  dari suara orang yang sama, bukan dari TTS). Volume per adegan memakai
  `voiceGainDb` yang sudah ada.
- **F5-08 — Potong jeda & kata pengisi: satu daftar, dua trek.** Daftar
  potong dihitung dari transkrip: jeda antar kata **>0,5 detik**
  (ambang Skenario 4) + kata pengisi dari daftar bawaan Bahasa Indonesia
  (mis. "eh", "anu", "apa", "ya", "kan", "gitu", "nah" — daftar akhir
  diputus saat implementasi dan bisa diubah pengguna di halaman
  Transkrip). Daftar yang sama diterapkan ke **video dan audio
  bersamaan** supaya keduanya tetap sinkron; kata yang dipotong tidak
  masuk caption dan ditandai di halaman Transkrip. Aturan potong ditulis
  sekali di `src/shared/` dan dipakai pratinjau dan ekspor (pratinjau =
  ekspor). Pengguna bisa mengembalikan potongan (Buang/Biarkan per kata,
  sesuai Bab 11.4).
- **F5-09 — Komposisi per adegan + zoom otomatis v1; tanpa pelacakan
  wajah.** Jawaban pertanyaan konsultan (b): **komposisi = crop per
  adegan, dipilih manual di Editor** (Bab 11.5: penuh / close-up tengah /
  kiri / kanan — nilai akhir diputus saat implementasi), disimpan sebagai
  crop di `Clip` dan dirender sama di pratinjau dan ekspor. **Zoom
  otomatis v1 = zoom-in halus di tengah frame** (memakai mesin
  `cameraAt`/kenburns yang sudah ada), bukan mengikuti wajah. **Pelacakan
  wajah eksplisit DI LUAR cakupan Fase 5 v1** — tidak ada detektor wajah
  di stack (tanpa OpenCV/MediaPipe), biaya RAM di laptop 4 GB belum
  terukur, dan klaim Fadli soal zoom otomatisnya tidak terverifikasi
  (klaim screenshot saja). Batas jujur ini ditulis di panduan, bukan
  disembunyikan. Bila nanti ada detektor yang terukur ringan, ia masuk
  sebagai F5-lanjutan, bukan v1.
- **F5-10 — Eksporter: longgarkan syarat gambar, selebihnya pakai ulang.**
  `exporter.ts:355` diubah: klip dengan `motionType === 'video'` dan
  `videoAssetId` terisi **boleh tanpa `imageAssetId`** (visualnya video
  itu sendiri). Klip gambar tetap wajib punya gambar. Aturan
  "audio dari file video tidak pernah dipakai di ekspor" **tetap berlaku
  apa adanya** — yang dipakai ekspor adalah aset audio hasil ekstraksi
  (F5-07), bukan trek audio video. Jadi pengecualian talking head
  ditangani di impor, bukan di exporter. Entri baru di
  `docs/keputusan-teknis.md` untuk kedua hal ini.
- **F5-11 — Gerbang Fase 5 + tidak menahan rilis lain.** Mode Talking
  Head hidup hanya bila `talkingHeadEnabled` nyala. Gerbang lulus: satu
  rekaman nyata selesai ke MP4 di PC Bos. Bila kualitas belum layak, flag
  tetap mati secara bawaan dan **tiga mode lain jalan terus** — Fase 5
  tidak pernah menjadi penghambat rilis. Proyek talking-head tidak bisa
  ganti mode sesudah dibuat.
- **F5-12 — Yang TIDAK dibangun di Fase 5 v1:** deteksi/pelacakan wajah,
  diarization multi-pembicara, B-roll otomatis, penulisan ulang naskah
  oleh LLM (transkrip **verbatim** — hanya dipotong; naskah adegan adalah
  kata-kata orang itu sendiri), TTS di mode talking head, terjemahan
  subtitle. Masing-masing dicatat sebagai "tidak dipenuhi — butuh putusan
  Bos" bila ditanyakan, bukan dianggap selesai diam-diam.

## 6. Rencana implementasi (menuju 50/100, lalu 80/100)

Urutan kerja, per kelompok maksud (satu commit per kelompok, mengikuti
skill `commit`):

1. **Mode + flag** — `src/shared/types.ts`: `Project.mode` +
   `VisualProvider` tambah `'footage'`; migrasi baru di akhir
   `MIGRATIONS` (`projects.mode`, bawaan `gambar-video`); `src/main/
   settings.ts`: `talkingHeadEnabled` (default `false`); `IdeaStep.tsx`:
   pemilih mode lahir (hanya bila flag nyala); `ProjectPage.tsx`:
   komponen langkah 2/3 menurut mode.
2. **Impor rekaman + ekstraksi audio** — IPC `talkinghead:importFootage`
   (3 tempat: `main/ipc.ts`, `shared/api.ts`, `preload/index.ts`); salin
   + probe FFmpeg; ekstrak audio WAV 16 kHz mono jadi aset audio proyek.
3. **Transkrip** — panggil `recognize`/`timeScript` atas audio rekaman;
   simpan `meta.words`; halaman Transkrip baru (langkah 2 mode talking
   head): daftar kata + cap waktu + sorotan buang + pratinjau video +
   ringkasan; simpan status Buang/Biarkan per kata.
4. **Potong + susun adegan** — daftar potong (jeda >0,5 dtk + kata
   pengisi, F5-08); `susunAdegan` LLM + fallback deterministik (F5-05);
   buat satu `Clip` per adegan (F5-06: `mediaInMs`, `durationMs`,
   `audioAssetId` segmen, `visualProvider: 'footage'`); halaman Adegan
   (langkah 3): periksa komposisi per adegan.
5. **Komposisi + zoom** — crop per adegan + zoom otomatis v1 di Editor
   (F5-09); aturan di `src/shared/` supaya pratinjau = ekspor.
6. **Eksporter + suara** — longgarkan syarat `imageAssetId` untuk klip
   video (F5-10); pastikan `generateNarration` tidak jalan di mode
   talking head; entri baru di `docs/keputusan-teknis.md`.
7. **Tutorial + dokumen** — tab panduan Talking Head di Pengaturan
   (Bahasa Indonesia: cara impor rekaman, batas jujur F5-09/F5-12,
   pemecahan masalah, uji live 1 rekaman sebagai gerbang PC).
8. **Verifikasi (tanpa live)** — `npm run typecheck` lalu `npm run build`
   bersih; service-test transkrip/potong/susun-adegan terhadap fixture
   (rekaman contoh + transkrip contoh); e2e harness: proyek talking head
   contoh end-to-end (impor fixture → transkrip → adegan → editor →
   ekspor); regresi ekspor demo+P30 terhadap baseline (demo mp4
   `1e348c47…` / srt `f403c5ec…`, P30 `5bcf2ec7…` / `6aa500d6…`; ingat
   jitter ekor audio AAC demo yang sudah diketahui — bukan regresi).
9. **Verifikasi independen (80/100)** — satu subagent verifikator memeriksa
   ulang semua klaim dari bukti mentah (alur vs kode, keputusan vs
   konsep, mock vs bentuk, regresi vs hash baseline). Verifikator tidak
   spawn subagent lagi.

## 7. Daftar periksa uji live PC (gerbang Bos, bukan bagian studi ini)

Dilakukan di laptop Bos (HP 14s, RAM 4 GB), dengan satu rekaman nyata
(ceramah ±2–3 menit), sesudah implementasi selesai. Yang harus
dikonfirmasi/dikoreksi:

1. Impor rekaman → transkrip selesai dalam waktu yang wajar; RAM selama
   transkrip Whisper Small tercatat (laptop 4 GB).
2. Akurasi waktu kata vs suara yang terdengar — deviasi dilaporkan apa
   adanya (bukan sekadar dilabeli).
3. Jeda >0,5 dtk + kata pengisi terpotong **sinkron** di video dan audio
   (cek frame + audio di sambungan potongan).
4. Caption karaoke menempel pada kata yang benar; kata yang dibuang tidak
   muncul di caption.
5. Komposisi per adegan + zoom otomatis: yang tampil di pratinjau sama
   dengan yang keluar di ekspor.
6. Adegan hasil AI masuk akal (judul + batas adegan); fallback deterministik
   bekerja bila LLM gagal.
7. Mode lain tidak regresi (demo+P30 byte-identik; proyek lama tetap
   terbuka; flag mati → mode Talking Head tidak tampil).
8. Satu rekaman nyata selesai ke MP4 — gerbang lulus Fase 5; bila kualitas
   belum layak, mode tetap mati bawaan tanpa menahan rilis lain.

## 8. Status

- **20/100 — studi + pemetaan selesai (13 Nov 2026).** Dokumen ini +
  model mode + alur narasi-dulu + keputusan desain F5-01–F5-12 +
  rencana implementasi §6.
- Berikutnya: implementasi §6 langkah 1–8 → 50/100; tutorial +
  verifikasi independen → 80/100; penutup (branch siap merge + backup +
  laporan) → 100/100. **Tanpa merge tanpa perintah Bos.**
- Catatan: koordinator studi Fase 4 (motion/D-21) berjalan paralel di
  branch-nya sendiri; Fase 4 dan Fase 5 tidak saling menahan (motion =
  provider per adegan; talking head = mode lahir). Keduanya menunggu
  perintah implementasi sesudah pemetaan.
