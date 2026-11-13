# Layanan AI dan kunci API

Semua panggilan ke layanan luar dilakukan di **proses utama** (`src/main/services/`). Renderer tidak pernah
memegang kunci API.

## Kunci API (BYOK)

Pengguna memasukkan kuncinya sendiri di **Pengaturan › Layanan AI dan kunci**.

- Disimpan di tabel `secrets` setelah dienkripsi dengan Electron `safeStorage`. Di Windows ini memakai DPAPI,
  terikat ke akun Windows pengguna, jadi salinan `studio.db` di komputer lain tidak bisa membuka kuncinya.
- Kunci kriptonya dibuat saat startup (`warmUpEncryption`) supaya tidak hilang kalau aplikasi ditutup paksa tepat
  setelah menyimpan kunci pertama.
- **D-07 gagal-tertutup:** bila `safeStorage` tidak tersedia (mis. Linux tanpa keyring), `setSecret` MENOLAK
  menyimpan dan melempar pesan jelas — kunci tidak pernah disimpan tanpa enkripsi. Nilai tersimpan memakai
  amplop `KS1:` + hasil `encryptString`; nilai lama tanpa amplop (teks polos dari versi lama) ditolak dibaca
  dan pengguna diminta memasukkan ulang kuncinya. Pengaturan menampilkan peringatan bila enkripsi tidak tersedia.
- Kunci uji dev-harness hanya di memori (`setTestKey`, tidak pernah ke disk) supaya alur kunci tetap bisa diuji
  di mesin tanpa keyring.
- H7: `scripts/h7-check-no-secrets.mjs` (`npm run h7`) memeriksa repo, ekspor, dan log agar tidak ada kunci yang bocor.
- `requireSecret(provider)` melempar error berbahasa Indonesia kalau kunci belum ada.
- `revealSecret` hanya dipanggil tombol "tampilkan kunci" di Pengaturan.
- **Jangan pernah** menulis kunci ke log, pesan error, file, URL, atau mengirimnya ke layanan lain.
- Mengganti kunci Higgsfield menghapus cache estimasi kredit (`forgetEstimates`).

| Penyedia (`ApiProvider`) | Dipakai untuk |
|---|---|
| `higgsfield` | gambar, lembar karakter, video |
| `gemini` | LLM (naskah/visual) dan Gemini TTS |
| `elevenlabs` | TTS |
| `openrouter`, `groq`, `custom` | LLM lewat API kompatibel OpenAI |

## LLM (`services/llm.ts`, `services/gemini.ts`)

- `generateJson({ system, prompt, schema, name })` memanggil penyedia aktif (`settings.llmProvider` +
  `llmModels[provider]`).
  - Gemini: `@google/genai` dengan `responseJsonSchema` (dan cadangan: skema ditulis di system instruction).
  - Lainnya: `/chat/completions`, dicoba berurutan `json_schema` (strict) → `json_object` → teks biasa, lalu JSON
    diambil dari teks (`extractJson`) untuk model yang tidak mendukung structured output.
- `listModels(source)`: daftar model live dari penyedia, dicache di tabel `cache` dan disegarkan saat basi.
- **Menambah penyedia LLM baru** yang kompatibel OpenAI: tambahkan ke `LlmProvider` dan `ApiProvider`
  (`types.ts`), `LLM_PROVIDERS` (`shared/models.ts`), konfigurasi base URL di `llm.ts`, dan `DEFAULT_SETTINGS.llmModels`.

## TTS

| Penyedia | File | Catatan |
|---|---|---|
| Gemini TTS | `services/gemini.ts` | PCM 24 kHz → WAV; daftar suara dari Voice Library (`listVoices`, cache 24 jam) dengan cadangan statis di `shared/models.ts`; contoh suara bawaan di `renderer/src/assets/voices` |
| ElevenLabs | `services/elevenlabs.ts` | memakai endpoint with-timestamps untuk waktu per kata; tag `<...>` diubah ke `[tag]` untuk model v3, atau ke `<break>` untuk model lama (`toElevenLabsText`) |

Narasi selalu dibuat satu rekaman utuh lalu dipotong. Lihat [alur-produksi.md](alur-produksi.md#4-narasi-srcmainnarrationts).

## Higgsfield (`services/higgsfield.ts`, `shared/higgsfield.ts`)

- Base URL `https://api.higgsfield.ai`, header `Authorization: Key <kunci>`.
- Alur: `submit(endpoint, body)` → polling `getStatus` → unduh hasil. `uploadFile` mengunggah gambar referensi
  (lembar karakter, gambar klip untuk video).
- `estimate(endpoint, body)` memanggil `/estimate/<endpoint>` → `{ credits, usd }`, dicache 24 jam di tabel `cache`.
  Endpoint ini gratis (tidak memakai kredit). API Higgsfield tidak punya daftar harga maupun endpoint saldo, jadi
  biaya per model selalu diambil dari sini.
- Pesan error dibuat ramah (`friendly`): kunci salah, kredit habis, terlalu banyak proses, model tidak tersedia.
- Untuk pengembangan, `STUDIO_HF_BASE` bisa diarahkan ke server tiruan (mock) supaya UI bisa diuji tanpa kredit.

### Katalog model (`src/shared/higgsfield-catalog.json`)

48 model: 14 model gambar (teks ke gambar) dan 34 model video yang bisa menganimasikan gambar klip. Model yang butuh
video masukan (edit video, motion control) atau hanya teks-ke-video sengaja tidak dimasukkan. Seedream belum tersedia
di API Higgsfield (hanya di aplikasi webnya). Satu entri:

```json
{
  "id": "kling-video/v3.0/std/image-to-video",
  "name": "Kling 3.0 · Standard · Image to video",
  "family": "Kling",
  "kind": "video",
  "input": { "field": "image_url", "mode": "first-frame", "max": 1 },
  "required": ["image_url"],
  "props": { "prompt": { "type": "string" }, "duration": { "type": "integer", "minimum": 3, "maximum": 15 }, "sound": { "enum": ["on", "off"] } },
  "durations": { "min": 3, "max": 15 },
  "tags": ["Kling"]
}
```

- `input.field`/`mode`/`max`: tempat gambar referensi atau frame pertama dikirim, dan berapa banyak.
- `props`: skema parameter dari dokumentasi Higgsfield. `imageBody`/`videoBody` di `shared/higgsfield.ts`
  mengisinya secara umum: rasio, resolusi, kualitas, durasi, mematikan `enhance_prompt`, `prompt_extend`, dan audio.
- `durations`: rentang (`min`/`max`) atau daftar (`values`) durasi video.
- **Menambah model**: tambahkan entri baru dengan format yang sama dari dokumentasi API Higgsfield
  (`https://docs.higgsfield.ai/docs/llms.txt`), lalu pastikan `imageBody`/`videoBody` tidak melempar error
  "butuh <field>" (`checkRequired`). Ikon keluarga model diatur di `components/ModelLogo.tsx`.
- Model bawaan: `DEFAULT_IMAGE_MODEL` dan `DEFAULT_VIDEO_MODEL` di `shared/higgsfield.ts`.

## Flow2API (`services/flow2api.ts`, `shared/flow2api.ts`)

Tier 1 (0.3+): gambar dan video dari Google Flow (Nano Banana, Veo 3.1, Omni) lewat server Flow2API
yang dijalankan pengguna sendiri di `http://localhost:8000` (bawaan). Polanya ditulis ulang dalam TypeScript
dari klien Flow2API De-Story (`flow2api.rs`) — pola saja, bukan salinan kode.

- Katalog model di `shared/flow2api.ts`: 3 model gambar, 4 model video, semuanya berawalan `flow:`. `getImageModel`/
  `getVideoModel` jatuh ke katalog ini bila id berawalan `flow:`; `canonicalFlowId` memetakan id lama ke nama yang
  dilayani server sekarang (misalnya `omni-1.1-flash` → `omni-1.2-flash`). Nama yang dikirim ke server memakai
  akhiran aspek (`gemini-3.1-flash-image-landscape`) dan, untuk Veo, sisipan `-i2v-{4|6}s-` (`veo-3.1-fast-i2v-4s-landscape`).
- Alur: `POST {base}/v1/chat/completions` dengan `stream: true` → baca aliran SSE (`data:` sampai `[DONE]`), lalu JSON
  biasa, lalu URL/data media langsung. Galat dari Flow sering tiba sebagai potongan biasa di tengah aliran dengan HTTP 200,
  jadi pembaca aliranlah yang menemukan alasannya, bukan status HTTP. Hasil berupa URL diunduh (timeout 180 dtk) atau
  data URI yang didekode. Timeout: gambar 300 dtk, video 600 dtk, uji koneksi 8 dtk.
- Referensi (lembar karakter) dan frame pertama video dikirim sebagai data URI dengan MIME dari ekstensi berkas
  (PNG/JPEG/WebP) — tidak seperti Higgsfield, Flow2API tidak butuh URL publik. Prompt video selalu ditambahi
  `Silent clip: no background music, no soundtrack, no singing or humming.` karena narasi dan musik datang dari editor.
- Penyambungan (`generation.ts`): model `flow:` bercabang ke antrean `flow2api` (limit 1) dengan penyedia `flow2api`;
  jalur Higgsfield tidak berubah. `estimateCredits` mengembalikan null untuk model flow — server tidak punya endpoint
  estimasi; biayanya kredit Google Flow dari langganan AI Pro pengguna.
- Pengaturan: `flow2apiEnabled` (mati bawaan) dan `flow2apiBaseUrl` (`AppSettings`). Sakelarnya terkunci di balik
  peringatan risiko akun D-16 dan kotak persetujuan di Pengaturan (`Settings.tsx`, `FlowSection`). IPC
  `flow2api:testConnection` memeriksa `GET /health`, cadangan `GET /v1/models`.
- Tier 1 tidak memakai kunci Bearer dan tidak memakai layanan captcha berbayar; server yang butuh kunci Bearer belum
  didukung. Tutorial lengkap berbahasa Indonesia ada di dalam aplikasi (Pengaturan › Panduan Flow2API,
  `FlowGuideSection.tsx`) dan pemetaannya di `docs/flow2api-pemetaan-destory.md`.

## NexaBot (`services/nexabot.ts`, `shared/nexabot.ts`)

Tier 3 (0.3+): gambar dan video berbayar murah lewat REST API NexaBot (`api.nexabot.id`) dengan kunci pengguna
sendiri (BYOK, terenkripsi seperti kunci lain). Tarif terverifikasi dari beranda nexabot.id (12 Nov 2026): 1 kredit =
Rp1.000; Nano Banana Pro Rp150, GPT Image 2.5 Rp100, Omni Flash 1.2 Rp300 per generate. Angka Rp400/video dari konsep
v2.1 sudah tidak berlaku.

- Katalog model di `shared/nexabot.ts`: 2 model gambar, 1 model video, semuanya berawalan `nexabot:`. `getImageModel`/
  `getVideoModel` jatuh ke katalog ini bila id berawalan `nexabot:`. Harga katalog dipakai estimasi biaya tanpa
  panggilan server (`nexaPriceIdr`, `idrLabel`).
- **Bentuk API adalah asumsi berlabel (D3-01)** — dokumentasi resmi tidak ditemukan di publik. Semua asumsi tinggal di
  satu modul transport: `POST /v1/images/generations` `{model, prompt, aspect_ratio, images: [data URI]}` →
  `{data: [{url | b64_json}]}`; `POST /v1/videos/generations` `{model, prompt, image: data URI, duration}` →
  `{id, status}`; `GET /v1/videos/{id}` → `{status: queued|processing|completed|failed, video: {url}}`;
  `POST /v1/videos/{id}/cancel`; probe `GET /v1/models`; auth `Authorization: Bearer <kunci>`. Daftar periksa pertama
  uji live PC. Durasi video katalog `[15]` mengikuti dua produk yang memakai API ini (PAWARNA, tokogame.ai.id);
  beranda alat web menyebut sampai 10 detik — uji live yang menentukan.
- Alur: gambar satu POST lalu hasilnya diunduh (atau didekode dari `b64_json`); video submit → simpan remote id →
  polling backoff 2 dtk → 10 dtk, timeout 20 menit, lalu unduh. Timeout: gambar 300 dtk, video 600 dtk, unduh 180 dtk,
  probe 8 dtk. Referensi dan frame pertama dikirim sebagai data URI (bukan URL publik). Pesan galat ramah Bahasa
  Indonesia (401 kunci tidak valid; 402/403 kredit tidak cukup; 429 batas rate; 5xx server); kunci tidak pernah bocor
  ke pesan galat.
- Penyambungan (`generation.ts`): model `nexabot:` bercabang ke antrean `nexabot` (limit 1) dengan penyedia `nexabot`.
  `requireNexa` gagal keras bila sakelar mati atau kunci belum diisi — tanpa fallback diam-diam ke provider lain
  (D3-03). `estimateCredits` mengembalikan harga katalog tetap tanpa panggilan server. `resumeJobs` melanjutkan polling
  video yang sudah disubmit sesudah restart; gambar tidak punya remote id sehingga gagal seperti biasa. `cancelJob`
  memberitahu server NexaBot agar berhenti (tagihan tidak jalan terus).
- Pengaturan: `nexabotEnabled` (mati bawaan) dan `nexabotBaseUrl` (`AppSettings`). Sakelarnya terkunci di balik
  peringatan biaya dan kotak persetujuan di Pengaturan (`Settings.tsx`, `NexaSection`); kunci BYOK lewat `KeyForm`
  yang sama dengan provider lain. IPC `nexabot:testConnection` memeriksa `GET /v1/models` dengan kunci tersimpan, dan
  `settings:testKey` punya cabang NexaBot.
- Gerbang biaya batch (D3-05b): Storyboard menampilkan ringkasan biaya Rupiah dan meminta konfirmasi sebelum satu job
  NexaBot pun dimulai; membatalkan di tengah jalan tidak mengembalikan kredit generate yang sudah jadi. Harga per
  generate tampil di pemilih model (`creditCurrency: 'Rp'`) dan di kartu Model AI.
- Suara/musik TIDAK dibangun untuk NexaBot (D3-09). Tutorial lengkap berbahasa Indonesia ada di dalam aplikasi
  (Pengaturan › Panduan NexaBot, `NexaBotGuideSection.tsx`) dan pemetaannya di `docs/nexabot-pemetaan.md`.

## Jalur manual & ekstensi (`services/manual.ts`, `shared/manual.ts`, `manualWatch.ts`)

Tier 2 (0.3+): gambar dan video adegan dibuat di luar KenStory — oleh pengguna, agen, atau ekstensi browser — lalu
dibawa kembali lewat folder kerja. Manual adalah provider (`visualProvider` per adegan: `auto` | `higgsfield` |
`flow2api` | `nexabot` | `manual` | `extension`), bukan mode; tiap adegan punya nomor stabil 2 digit (`sceneKey`, `01`, `02`, …,
UNIQUE per proyek, backfill dari `sort`) yang dipakai untuk mencocokkan berkas hasil.

- Skema: migrasi akhir di `db/index.ts` (`scene_key` + `visual_provider`, bawaan `auto`); `Clip` di `shared/types.ts`
  + `VisualProvider` di `shared/manual.ts` (juga aturan pencocokan nama berkas + teks prompt bernomor + manifest).
  `clipPrompt`/`videoPromptForClip` tinggal di `shared/prompts.ts` supaya jalur manual memakai pembangun prompt yang
  sama dengan jalur otomatis.
- Routing (`generation.ts`): diputus per adegan SEBELUM pemanggilan model (`resolveVisualProvider`); nilai tak dikenal
  gagal keras. `manual`/`extension` membuat job manual (`insertJob` provider `manual`, `queued`, tanpa tugas jalan)
  lewat `startManualJob`; `resumeJobs` melewatkan job manual (tetap menunggu, bukan gagal); `setActiveAsset`
  menuntaskan job manual yang menunggu. `estimateCredits` mengembalikan null untuk manual/extension.
- Folder kerja (`services/manual.ts`): `<folder aset proyek>/manual/`. `manual:prepareWorkFolder` menulis
  `prompts.txt` (prompt bernomor adegan, untuk manusia) + `manual.json` (manifest mesin: sceneKey, clipId, judul,
  kind, prompt, videoPrompt, aspek, durasi). `manual:scanWorkFolder` memasangkan berkas `<sceneKey>[-akhiran].<ext>`
  (awalan `scene-`/`clip-` diabaikan; PNG/JPG/WebP, MP4/MOV/WebM) — disalin ke `images/`/`videos/`, `insertAsset`
  provider `manual`/`extension` sesuai provider adegan, `patchClip`, job manual selesai; berkas tak cocok masuk
  daftar "belum terpasang" dan dipasangkan lewat `manual:importFile`. Pindai dua kali tidak menduplikasi.
  `manualWatch.ts` mengawasi folder (`fs.watch` non-rekursif, debounce 500 mdtk) dan hanya memberi tahu renderer
  supaya menekan Pindai.
- Ekstensi (D2-07): KenStory TIDAK membangun ekstensi browser dan TIDAK menjalankan WebSocket. Folder ekstensi ada
  di checkout server Flow2API (`<folder server>/extension/`, Flow2API Captcha Worker, manifest v3); yang ditangkapnya
  hanya token reCAPTCHA Enterprise dari Chrome pengguna, bukan hasil generate. Metode CAPTCHA (`browser` gratis,
  `extension` gratis, berbayar butuh kunci, `flow2api_team`) adalah setelan panel admin server, bukan KenStory.
- UI: Storyboard (`StoryboardStep.tsx`) — Salin Semua Prompt, Impor Gambar/Video, Pindai Folder Kerja, pemilih jalur
  per adegan, lencana jalur + status "Menunggu hasil", panel folder kerja + daftar belum terpasang; Inspector —
  Salin prompt gambar + status jalur manual. Tutorial lengkap berbahasa Indonesia ada di dalam aplikasi
  (Pengaturan › Panduan Manual & Ekstensi, `ManualGuideSection.tsx`) dan pemetaannya di
  `docs/manual-fadli-pemetaan.md`. Uji live 1 klip adalah gerbang PC (belum diuji di VM, seperti G3 tier 1).

## Motion (`services/motion.ts`, `services/renderer.ts`, `shared/motion-contract.ts`, `shared/motion-templates.ts`)

Fase 4 (0.4+): adegan motion digambar sebagai kode animasi (HTML + GSAP) oleh agent coding — Claude, Kiro, atau
Antigravity — lalu aplikasi merendernya jadi MP4. Motion adalah provider tingkat 3 (`visualProvider: 'motion'`),
bukan mode lahir; sakelar induknya mati bawaan dan `auto` tidak pernah memilih motion sendiri.

- Alur dua tahap + satu gerbang: **Tahap 1** agent menulis `beats.json` (waktu tiap adegan dari waktu kata narasi)
  dan satu frame kunci per adegan, lalu **berhenti**; pengguna menyetujui/menolak tiap beat di langkah Rancangan.
  **Gerbang Tahap 1** — ekspor berhenti dengan pesan jelas bila ada beat motion yang belum disetujui
  (`renderMotionSegment` menolak beat yang statusnya bukan `approved`). **Tahap 2** agent menulis halaman babak
  (`index.html` + `style.js` + `act-*.js`); aplikasi merendernya frame demi frame.
- Kontrak babak (D-21, `shared/motion-contract.ts`): `beats.json` v1 (`version`, `fps`, `width`, `height`,
  `durationSec`, `styleId`, `captionZone`, `beats[]` dengan `words` berwaktu kata); `validateBeatsJson` menolak
  tumpang tindih, beat di luar durasi, kata tanpa waktu, kata di luar rentang beat, keyframe hilang, easing/status
  tak dikenal. `validateBabakHtml` mewajibkan `window.OPENER` (`ready`, `DURATION`, `clipsReady`, `seek`) dan
  melarang nondeterminisme (`Date.now`, `Math.random`, `setTimeout`/`setInterval`, `repeat: -1`), font CDN, dan
  `<script src>` lokal (file:// + CORS — JS harus inline). Satu babak 3–8 adegan.
- Renderer (`services/renderer.ts`): jendela tersembunyi + `useContentSize`, ukuran dipaksa dari konfigurasi
  (D-11: frame pertama yang ukurannya ≠ konfigurasi menghentikan render), settle 50 ms + tangkap dua kali, maju
  hanya bila hash sha256 sama, maks 3 percobaan (W7). Cadangan Puppeteer lewat dynamic import (dependensi opsional,
  tidak terpasang — gagal dengan pesan jelas bila belum dipasang); jalur offscreen hanya pembanding spike, bukan
  jalur produksi. Render berjalan satu per satu (mutex) demi puncak RAM di laptop 4 GB. Jalur utama D-22 diputus
  spike 4.0 (`harness-fase4-spike.json`, `run-fase4-spike.sh`): S1d 20/20 DAN ukuran sesuai konfigurasi; bila lebih
  dari satu lolos, pilih RAM terendah (metode pohon proses). **Putusan: hidden menang untuk landscape; potret 9:16
  butuh Puppeteer** (kedua jalur Electron terjepit ke tinggi layar — lihat `keputusan-teknis.md` D-22). HyperFrames hanya kontrak referensi + verifikasi
  silang, bukan renderer dalam aplikasi; Remotion tidak dipakai di renderer.
- Folder kerja (`services/motion.ts`): `<folder aset proyek>/motion-work/`. `motion:prepareWorkFolder` menulis
  `CLAUDE.md`/`AGENTS.md` (instruksi agent), `folme.md` (instruksi global pengguna — tidak pernah ditimpa),
  `input/` (naskah + waktu kata + audio narasi + `gaya.md`), `style/style.js` (skeleton), `tools/validate-beats.mjs`
  + README. `motion:listBabak`/`getBabak` membaca `out/<babakId>/` (stage 0/1/2 + galat/missing); `approveBeat`
  dan `overrideEasing` mengubah `beats.json`; `syncMotionBeatIds` menautkan beat ke klip lewat `sceneKey`;
  `renderBabak` merender satu babak utuh ke `out/<babakId>/render/babak.mp4`.
- Gaya: 6 template di `shared/motion-templates.ts` (Kartun Panggung, Jurnalisme Visual, Katalog, Sketsa,
  Aksi Kontinu, WebGL/Partikel). WebGL/Partikel adalah gaya Berat — terkunci sampai diukur di Fase 4 (D-17).
  Timpa gaya proyek (`motion-work/style/style.js`) menandai beat yang sudah disetujui jadi `redo`.
- Caption (B6, `shared/captions.ts`): `captionOnForClip` — setelan eksplisit per adegan menang; default motion
  MATI, adegan lain MENYALA. Dipakai pratinjau dan ekspor (satu fungsi, paritas terjaga). Caption milik aplikasi;
  halaman motion tidak pernah menggambar caption sendiri; bila menyala, pita bawah 12% frame dicadangkan.
- Biaya (F4-11): **Rp0 tunai dari aplikasi.** Agent memakai langganan pengguna sendiri di luar aplikasi; KenStory
  tidak menyimpan kunci agent apa pun. `estimateCredits` mengembalikan null untuk motion; `startMotionJob` membuat
  job `video` provider `motion` (queued, tanpa tugas jalan — selesai saat agent menulis babak + pengguna menyetujui).
  `generateMissingVideos` tidak menuntut gambar untuk adegan motion; `resumeJobs` melewatkan provider `motion`
  seperti `manual`.
- UI: Pengaturan › Motion (sakelar induk, preset "Motion Grafik penuh"/"Hybrid", daftar gaya, Panduan Motion);
  langkah Rancangan (label langkah 3 berubah jadi "Rancangan" bila proyek punya adegan motion) — kartu per babak,
  daftar beat + keyframe + easing override + Setujui/Minta ulang, tombol Render babak, editor timpa gaya proyek.
  Pratinjau v1 = keyframe + render MP4 on-demand (bukan iframe HTML live — scripting iframe `file://` diblokir
  CORS). Tutorial lengkap berbahasa Indonesia ada di dalam aplikasi (Pengaturan › Panduan Motion,
  `MotionGuideSection.tsx`) dan pemetaannya di `docs/fase4-renderer-pemetaan.md`. Uji live adalah gerbang PC
  (belum diuji di VM, seperti G3 tier 1); lari S3 v2 di laptop Bos (E(3)) tetap gerbang PC.

## Whisper lokal (`src/main/whisper.ts`)

- Biner: `resources/whisper/whisper-cli.exe` + DLL (whisper.cpp, lisensi MIT). Saat ini hanya untuk Windows.
- Model: `ggml-small.bin` (sekitar 488 MB) dari Hugging Face (`ggerganov/whisper.cpp`), diunduh di Pengaturan ke
  `<folder data>\models\whisper`, bisa dijeda dan dilanjutkan (HTTP Range), lalu dicek SHA-256. Untuk pengembangan, `STUDIO_WHISPER_URL` bisa menunjuk salinan lokal.
- Dijalankan di antrean `whisper` (satu per satu). Detail argumennya di [alur-produksi.md](alur-produksi.md#5-caption-akurat-whisper-lokal).

## YouTube (halaman About)

Video tutorial diputar lewat iframe `https://www.youtube.com/embed/<id>`. Sejak 2025 YouTube mewajibkan pemutar
embed mengirim identitas lewat header HTTP Referer (tanpa itu: Error 153). Aplikasi yang memuat halaman dari
`file://` tidak mengirim Referer, jadi `identifyToYouTube()` (`src/main/index.ts`) menambahkan
`Referer: https://id.kenstory.app/` (ID aplikasi) hanya untuk permintaan embed. Iframe tanpa
autoplay, supaya putaran dari pengguna terhitung sebagai view.

## Membuka tautan

`app:openExternal` hanya menerima URL `https://` dan membukanya di browser bawaan. Pakai ini untuk semua tautan
ke luar (dokumentasi penyedia, channel YouTube, Suno, dan lainnya).
