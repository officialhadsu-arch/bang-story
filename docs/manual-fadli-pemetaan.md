# Pemetaan Fadli → KenStory — Jalur semi-manual/ekstensi (tier 2, 0.3+)

Studi untuk Tier 2 (jalur B semi-manual/ekstensi + jalur C manual, ala Fadli). Tanggal studi:
12 Nov 2026. Biaya: Rp0. Branch `0.3-tier2-fadli` dari main `547d400`.

Sumber: Konsep v2.1 (Bab 5/6/7, D-02, D-03); De-Story
(github.com/ikrammf7/De-Story, HEAD `d894f9e4` — publik tanpa LICENSE, ambil POLA saja,
jangan salin kode); klon referensi `~/workspace/fase0-0.2a/de-story-reference/`;
server Flow2API `~/workspace/fase0-0.2a/flow2api-server/` (LICENSE MIT, TheSmallHanCat).
Fadli sendiri hanya klaim Threads — perlakukan sebagai pola, buktikan dari
kode/panduan De-Story dan konsep. Yang tidak bisa dibuktikan dari kode dicatat
sebagai klaim, bukan fakta.

## 1. Yang dipelajari dari De-Story — Extension Worker itu pekerja CAPTCHA

### 1.1 Apa yang ditangkap ekstensi dari Google Flow

Ekstensi De-Story bernama "Flow2API Captcha Worker" v1.1.0
(`flow2api-src/extension/`, manifest v3, izin storage/tabs/scripting/cookies,
host `flow.google.com`, `labs.google`, `*.google.com`). Yang ditangkapnya dari
Google Flow **hanya satu hal: token reCAPTCHA Enterprise** dari sesi Chrome
pengguna yang sudah login. Ekstensi TIDAK membuat gambar/video, TIDAK mengunduh
hasil, TIDAK menyentuh aplikasi.

Alur (`background.js`, 370 baris):
- Sambung WebSocket ke `ws://127.0.0.1:<port>/captcha_ws` (bawaan port `8765`,
  bisa diubah; query `key`, `route_key`, `client_label`). Kirim
  `{"type":"register","route_key","client_label"}` saat tersambung, heartbeat
  `{"type":"ping"}` tiap 20 dtk, sambung-ulang otomatis tiap 2 dtk.
- Saat server meminta `{"type":"get_token","req_id","action"}`: pakai tab Flow
  yang sudah terbuka, atau buka tab latar baru ke `https://flow.google.com/`;
  suntik `recaptchaRunner` ke dunia MAIN halaman lalu panggil
  `grecaptcha.enterprise.execute(siteKey, {action})` — siteKey
  `6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV`, action `IMAGE_GENERATION`
  (timeout 25 dtk) atau `VIDEO_GENERATION` (35 dtk). Ada pelindung anti-hijack
  yang membuang penimpaan action menjadi `extension_hijack_detected`.
- Jawab ke server `{"req_id","status":"success","token": <token reCAPTCHA>}`
  atau `{"req_id","status":"error","error": ...}`.

### 1.2 Sisi server (De-Story `flow2api_runtime.rs`, 714 baris)

`Flow2ApiManager` menjalankan server Flow2API bawaan. Port tetap loopback
(`fixed_port`, 0 = acak bawaan) hanya ada supaya ekstensi bisa dikonfigurasi
sekali — "Never anything but loopback". Alamat WS-nya
`ws://127.0.0.1:<port>/captcha_ws`. Server yang meminta token saat generate
butuh CAPTCHA; ekstensi yang menyediakannya dari Chrome pengguna.

### 1.3 Panduan Extension Worker De-Story (README baris 207–213, 7 langkah)

1. Pengaturan → Layanan AI dan kunci → Google Flow (Flow2API).
2. Di bagian Extension Worker, masukkan port tetap loopback (contoh `8765`),
   lalu Simpan dan nyalakan ulang.
3. Salin WebSocket URL dan Kunci yang ditampilkan.
4. Klik Buka folder ekstensi.
5. Buka `chrome://extensions`, aktifkan Developer mode, Load unpacked, pilih
   folder ekstensi.
6. Di opsi ekstensi, tempel WebSocket URL & Kunci. Pastikan sudah login ke
   akun Google Labs.
7. Pilih metode `extension` pada panel admin Flow2API.

Kekurangan panduan itu (yang harus dilampaui Tier 2): tanpa prasyarat akun,
tanpa penjelasan apa yang ditangkap ekstensi (token CAPTCHA, bukan hasil
generate), tanpa pemecahan masalah (WS tidak tersambung, token ditolak,
tab Flow belum login), tanpa penjelasan bahwa metode `extension` adalah
setelan server (bukan setelan aplikasi), tanpa alur manual sebagai cadangan.

## 2. Yang dipelajari dari konsep v2.1 — Manual = provider tingkat 2

- **D-02 DITETAPKAN: Manual = provider, bukan mode.** Skema 3 tingkat:
  1 otomatis, 2 Manual, 3 Motion. Motion adalah provider `motion` (Fase 4),
  bukan mode lahir.
- **D-03 DITETAPKAN: kunci sinkron = Clip.id + scene_key**
  (UNIQUE project_id, scene_key).
- **Migrasi Bab 5/6c:** Clip mendapat `visual_provider` (bukan `provider`);
  kolom status DIHAPUS (status diturunkan dari jobs + assets); tambah
  `script_hash`/`script_version`, `prompt_variant`, `motion_ref`, `scene_key`.
- **Routing:** fungsi routing sebelum `getImageModel`/`getVideoModel`; id
  berawalan tak dikenal gagal keras (B5).
- **Folder yang diawasi:** ujung semua jalur sama — berkas bernama scene_key
  di folder yang diawasi; sinkronisasi editor bekerja persis sama di semua
  jalur (server TIDAK dibundel, TIDAK dihidup-matikan dari Pengaturan).
- **Jalur C — Manual (provider tingkat 2):** tombol Salin Semua Prompt
  menyalin prompt bernomor adegan. Pengguna generate di mana pun, mengunduh
  hasil, lalu menekan Impor Gambar / Impor Video. Aplikasi mencocokkan nama
  berkas ke scene_key; berkas tanpa nomor cocok tampil di daftar
  "belum terpasang" untuk dipasangkan manual.
- **Kartu Storyboard (mode Gambar & Video):** thumbnail, nomor + judul,
  prompt (sunting), pemilih provider per adegan, status, Generate Ulang,
  Ganti (impor manual), Setujui. Tombol batch: Generate Semua, Generate
  yang Dipilih, Salin Semua Prompt, Impor Gambar, Impor Video, Impor Audio.
  Panel ringkasan batch sebelum jalan: jumlah adegan, jalur, model,
  perkiraan kredit/biaya, ukuran batch, tombol Jalan / Batal. Peringatan
  sinkronisasi: adegan yang visualnya berasal dari naskah lama diberi lencana
  "visual belum mengikuti naskah terbaru".
- **Aturan batch (KEPUTUSAN BOS):** batch TIDAK dipatok 10 — angka 10 pada
  versi Fadli adalah pilihannya sendiri, bukan aturan Google. Ukuran batch
  mengikuti aturan mode Agent Google Flow dan sisa kredit.
- **Rapuh (konsep):** ada pengguna yang terdeteksi Flow dan gagal generate;
  hasil bergantung pada tampilan UI Flow yang bisa berubah sewaktu-waktu;
  aplikasi harus tetap terbuka selama agent bekerja. **Ekstensi adalah jalur
  B, bukan satu-satunya.** Selalu ada jalur C manual dan jalur A Flow2API.
  Kegagalan satu jalur tidak menghentikan proyek. Fallback A ke B ke C.

## 3. Yang dipelajari dari Fadli — klaim, bukan fakta

Fadli (n.faddli, klaim Threads saja, tanpa kode yang bisa dibaca): Bang Story +
ekstensi Google Flow, harness folder kerja + agen coding, mode Talking Head
eksperimental. Yang diambil sebagai pola: (a) folder kerja sebagai harness —
prompt bernomor adegan di satu folder, hasil generate kembali ke folder yang
sama dengan nama scene_key; (b) ekstensi browser sebagai penggerak UI Flow
(jalur B); (c) impor manual sebagai cadangan (jalur C). Yang TIDAK diambil:
angka batch 10 (ditolak Bos), Talking Head (Fase 5, eksperimental), dan
klaim apa pun yang tidak bisa dibuktikan dari kode/panduan De-Story.

## 4. Titik sambung ke KenStory (main `547d400`, sudah dibaca)

| Titik | Keadaan sekarang | Sambungan Tier 2 |
|---|---|---|
| `src/main/generation.ts` (610 baris) | Routing berdasar prefix model: `flow:` → flow2api, sisanya higgsfield. Model dipilih per proyek (`project.imageModel`/`videoModel`). `clipPrompt()` membangun prompt gambar (dipakai ulang untuk salin). `finishFlow`/`finishHiggsfield` menyimpan hasil → `insertAsset` + `patchClip` (`imageAssetId`/`videoAssetId`). `generateMissingImages`/`generateMissingVideos` batch. `resumeJobs` hanya melanjutkan higgsfield; sisanya gagal. | Tambah cabang routing per adegan berdasar `visualProvider` (D2-02); `generateClipImage`/`generateClipVideo` membuat job manual bila provider adegan `manual`/`extension` (D2-03); `resumeJobs` melewatkan job manual (tetap menunggu). |
| `src/main/jobs.ts` (106 baris) | `QueueName` higgsfield 3, flow2api 1, tts 2, whisper 1, export 1. `runJob` menjalankan tugas async; status queued/running/done/failed/canceled. | Job manual = baris job tanpa tugas jalan (D2-03). Perlu `QueueName` baru? Tidak — job manual tidak masuk antrean eksekusi; ia menunggu di status `queued` sampai impor menandainya `done`. |
| `src/shared/types.ts` — `Clip` | `id, projectId, sort, title, story, visualPrompt, visualSource, narration, durationMs, characterIds, motionType, cameraPreset, motionStrength, videoPrompt, transition, videoCamera, videoStrength, transitionMs, voiceGainDb, mediaInMs, voiceInMs/Out/Start, imageAssetId, videoAssetId, audioAssetId`. Tanpa `sceneKey`, tanpa `visualProvider`, tanpa kolom status (status sudah diturunkan dari jobs — sesuai konsep). | Tambah `sceneKey: string`, `visualProvider: VisualProvider` (D2-01, D2-02). `visualSource` dipakai untuk lencana "visual belum mengikuti naskah terbaru" (D2-09). |
| `src/main/db/index.ts` — `MIGRATIONS` | Append-only; `PRAGMA user_version` menghitung yang sudah jalan. | Tambah satu migrasi di akhir: dua kolom + backfill + UNIQUE index (D2-01). |
| `src/main/repo.ts` | `saveSnapshot` (upsert), `duplicateProject`, `CLIP_COLS` (patch dari main), `insertClipAfter`, `toClip`. | Semua disentuh untuk dua kolom baru (aturan AGENTS.md butir 4) + nilai bawaan `addClip` di `renderer/src/store/project.ts`. |
| Impor W6(b) | IPC `assets:pickClipImage` (dialog berkas → salin ke `images/` → `insertAsset` kind `image` + `setActiveAsset`). | Dipakai ulang untuk Ganti/impor manual per adegan. Tambah IPC impor-dari-jalur (`manual:importFile`) untuk berkas hasil pindai folder kerja (D2-04). |
| `src/renderer/src/pages/project/StoryboardStep.tsx` | Sudah ada tombol batch "Generate gambar" / "Generate ulang" / "Generate N gambar". | Tambah tombol batch Salin Semua Prompt, Impor Gambar, Impor Video, Pindai Folder Kerja + pemilih provider per kartu adegan (D2-05, D2-04). |
| `src/renderer/src/pages/project/editor/Inspector.tsx` | Seksi "Gambar klip": Pilih/Ganti gambar (W6(b)). | Tambah Salin prompt + status jalur manual per adegan (bila murah; bila tidak, cukup di StoryboardStep). |
| `src/renderer/src/pages/Settings.tsx` + `FlowGuideSection.tsx` | Tab `flow-guide` ("Panduan Flow2API"); `FlowSection` di Pengaturan. | Tambah tab `manual-guide` ("Panduan Manual & Ekstensi") + tautan "Buka admin server" (D2-07). Tanpa setelan baru untuk ekstensi (metode CAPTCHA adalah setelan server). |
| `src/shared/flow2api.ts` / `src/main/services/flow2api.ts` | Klien + katalog Tier 1; `estimateCredits` → null untuk model flow. | `estimateCredits` → null juga untuk manual/extension (tidak ada server/harga per model). |

## 5. Keputusan desain Tier 2

- **D2-01 sceneKey (D-03):** kolom TEXT baru `scene_key`, angka 2 digit saat
  adegan dibuat (`01`, `02`, …; adegan baru = max+1 per proyek), UNIQUE
  `(project_id, scene_key)`, backfill dari urutan `sort` saat migrasi. Bila
  adegan dihapus lalu nomornya dipakai lagi oleh adegan baru, berkas lama
  bernomor sama di folder kerja bisa terpasang ke adegan baru — dicatat
  sebagai batas yang diketahui; daftar "belum terpasang" + tombol Ganti
  adalah pengamannya (bukan penghapusan diam-diam).
- **D2-02 visualProvider (D-02):** kolom TEXT baru, bawaan `'auto'`
  (mengikuti model proyek). Nilai: `'auto' | 'higgsfield' | 'flow2api' |
  'manual' | 'extension'`. Routing per adegan diputus SEBELUM pemanggilan
  model; nilai tak dikenal gagal keras (B5). `extension` dan `manual`
  berbagi mesin impor/pemasangan — bedanya hanya status dan panduan:
  `manual` = pengguna menyalin prompt dan generate di mana pun;
  `extension` = pengguna menjalankan ekstensi/agen Flow dengan prompt yang
  sama, hasilnya jatuh ke folder kerja.
- **D2-03 Job manual:** `insertJob({provider: 'manual', kind:
  'image'|'video', status: 'queued', payload: {sceneKey, prompt}})` TANPA
  tugas jalan — ia menunggu. Impor yang memasangkan hasil menandainya
  `done` (`resultAssetId` terisi); Batal menandainya `canceled`.
  `resumeJobs` melewatkan job manual (tetap `queued`, bukan gagal).
  `activeJobFor` menganggap job manual yang menunggu sebagai aktif (tombol
  Generate tidak menduplikasi). Status adegan diturunkan dari jobs + assets
  (sesuai konsep — tanpa kolom status baru).
- **D2-04 Folder kerja (harness):** `<folder aset proyek>/manual/`.
  "Salin Semua Prompt" menulis `prompts.txt` (prompt bernomor adegan,
  untuk manusia) + `manual.json` (manifest mesin: sceneKey, clipId, judul,
  kind, prompt, videoPrompt, aspek, durasi — untuk agen/ekstensi luar).
  Hasil generate kembali sebagai `<sceneKey>[-akhiran].<ext>` di folder
  yang sama (contoh `03.png`, `03-v2.mp4`, `scene-03.png` — awalan
  `scene-`/`clip-` diabaikan saat pencocokan; yang dihitung angka awal).
  "Pindai Folder Kerja" memasangkan berkas yang cocok (disalin ke
  `images/`/`videos/` seperti jalur lain, `insertAsset` provider
  `manual`/`extension` sesuai provider adegan, `patchClip`, job manual
  selesai). Berkas tak cocok masuk daftar "belum terpasang" dengan pemilih
  adegan (komponen `Select`, bukan `<select>` bawaan; seret-dan-jatuhkan
  TIDAK dibangun di tier ini — pemilih mencapai pemasangan yang sama).
- **D2-05 Salin Semua Prompt:** satu IPC `manual:prepareWorkFolder`
  (menulis manifest + prompts, mengembalikan teks bernomor); renderer
  menyalin ke clipboard. Prompt gambar memakai `clipPrompt()` yang sama
  dengan jalur otomatis (satu sumber prompt); prompt video memakai
  `videoPrompt` adegan atau turunan baku dari `generateClipVideo`.
- **D2-06 Pengawasan folder:** `fs.watch` non-rekursif di folder kerja
  (debounce 500 mdtk, emit ke renderer) + tombol Pindai. Pindai adalah
  jalur yang diuji (watcher hanya probe manual) — bila watcher bermasalah
  di satu platform, Pindai tetap bekerja.
- **D2-07 Ekstensi (jalur B):** KenStory TIDAK membangun ekstensi browser
  dan TIDAK menjalankan server WebSocket. Folder ekstensi sudah ada di
  checkout server Flow2API pengguna (`<folder server>/extension/`, LICENSE
  MIT TheSmallHanCat) — panduan menunjuk ke sana + tautan "Buka admin
  server" (alamat dari `flow2apiBaseUrl`). Metode CAPTCHA (`browser` /
  `extension` / berbayar) adalah setelan panel admin server, bukan setelan
  KenStory. Yang dibangun KenStory untuk jalur B: provider `extension`,
  folder kerja + pemasangan otomatis, dan panduan.
- **D2-08 Tanpa live:** TIDAK ada panggilan live ke Google Flow di VM.
  Verifikasi memakai mock/fixture. Uji live browser/server TETAP jatah PC
  Bos (seperti G3) — dicatat eksplisit sebagai gerbang PC, bukan diuji
  diam-diam di VM.
- **D2-09 Di luar tier ini:** `script_hash`/`script_version`,
  `prompt_variant`, `motion_ref` dari migrasi konsep TIDAK dibangun di sini
  (Fase 4/5). Lencana "visual belum mengikuti naskah terbaru" diturunkan
  dari `visualSource` yang sudah ada (teks naskah sumber rencana visual)
  — tanpa kolom baru.
- **D2-10 Biaya:** Rp0. `estimateCredits` → null untuk manual/extension.
  NexaBot adalah Tier 3, bukan tugas ini.

## 6. Rencana implementasi

1. **Skema + repo:** migrasi akhir di `src/main/db/index.ts` (D2-01);
   `Clip` di `src/shared/types.ts` + `VisualProvider` di `src/shared/manual.ts`
   (baru: tipe + aturan pencocokan nama berkas + bangun teks prompt bernomor);
   `toClip`, `saveSnapshot`, `duplicateProject`, `insertClipAfter`,
   `CLIP_COLS` di `src/main/repo.ts`; nilai bawaan `addClip`.
2. **Main:** `src/main/services/manual.ts` (baru: tulis manifest/prompts,
   pindai folder, impor berkas hasil, selesaikan job manual);
   `src/main/generation.ts` (cabang routing per adegan + `startManualJob` +
   `resumeJobs` melewatkan manual + `setActiveAsset` menuntaskan job manual);
   `src/main/manualWatch.ts` (baru: `fs.watch` + debounce + emit) atau
   lipat ke `services/manual.ts` bila lebih rapi; IPC baru
   `manual:prepareWorkFolder`, `manual:scanWorkFolder`,
   `manual:importFile`, `manual:openWorkFolder` (tiga tempat tiap IPC:
   `main/ipc.ts`, `shared/api.ts`, `preload/index.ts`).
3. **Renderer:** `StoryboardStep.tsx` (tombol batch + pemilih provider per
   kartu + daftar "belum terpasang"); `Settings.tsx` + `ManualGuideSection.tsx`
   (baru: tab "Panduan Manual & Ekstensi"); `Inspector.tsx` (Salin prompt,
   bila murah).
4. **Uji (tanpa live):** esbuild service-test (pencocokan nama, manifest,
   pindai, siklus job manual, restart → tetap menunggu); dev harness e2e
   (seed demo → adegan manual → Salin Semua Prompt → letakkan fixture di
   folder kerja → Pindai → aset terpasang → ekspor); regresi demo+P30
   byte-identik; screenshot UI; verifikasi independen.
5. **Dokumen:** atribusi Flow2API/De-Story di `NOTICE.md` bila ada penambahan;
   bagian Manual di `docs/layanan-ai.md`; laporan
   `laporan-0.3-tier2-fadli.md`.

## 7. Perbandingan tutorial — patokan yang harus dilampaui

| Topik | De-Story (7 langkah) | Panduan KenStory (rencana) |
|---|---|---|
| Apa yang ditangkap ekstensi | Tidak dijelaskan | Ada (token reCAPTCHA dari Chrome pengguna; bukan hasil generate) |
| Langkah pasang Extension Worker | Ada (7 langkah) | Ada, diperluas (prasyarat akun + login Google Labs + WS URL/Kunci dari admin server + folder ekstensi di checkout server) |
| Metode CAPTCHA server | Tabel 4 metode | Ada, dengan penegas: setelan server, bukan KenStory; `browser` gratis, `extension` gratis, berbayar butuh kunci |
| Alur manual lengkap | Tidak ada | Ada (Salin Semua Prompt → generate di mana pun → Impor/Pindai → pasangkan) |
| Folder kerja + manifest | Tidak ada | Ada (lokasi, isi `prompts.txt`/`manual.json`, aturan nama berkas) |
| Daftar "belum terpasang" | Tidak ada | Ada |
| Pemecahan masalah | Tidak ada | Ada (WS tak tersambung, token ditolak, tab belum login, berkas tak cocok, job manual macet) |
| Risiko akun (D-16/D-19) | Tidak ada | Ada (peringatan tertulis + fallback A→B→C) |
| Uji live 1 klip | Tidak ada | Ada (gerbang PC, seperti G3) |
