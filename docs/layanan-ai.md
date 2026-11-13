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

## kie.ai (`services/kieai.ts`, `shared/kieai.ts`)

Tier 4 (0.3+): gambar dan video berbayar **premium** lewat REST API kie.ai (`api.kie.ai`) dengan kunci pengguna
sendiri (BYOK, terenkripsi seperti kunci lain). kie.ai BUKAN pengganti NexaBot: untuk model yang tumpang tindih
NexaBot 5–11× lebih murah; nilai kie.ai adalah luas katalog (Veo 3.1, Seedance, Kling, Grok) + dokumentasi API publik
yang nyata. Tarif terverifikasi dari kie.ai/pricing (13 Nov 2026, kurs Rp18.200/USD): 1 kredit ≈ $0,005; gambar
Rp546–Rp1.638; video Veo 3.1 Rp3.185–Rp23.205 per klip 8 detik; model per detik Rp410–Rp1.547/dtk. Omni Flash 1.2
sengaja tidak masuk katalog (NexaBot Rp300 vs kie.ai Rp2.912). Tugas gagal tidak ditagih; kredit tidak kedaluwarsa;
media hasil hanya disimpan 14 hari.

- Katalog model di `shared/kieai.ts`: 3 model gambar, 6 model video, semuanya berawalan `kieai:`. `getImageModel`/
  `getVideoModel` jatuh ke katalog ini bila id berawalan `kieai:`. Harga katalog dipakai estimasi biaya tanpa
  panggilan server (`kiePriceIdr`, `kieaiCredits`, `kieaiUsd`); model per detik mengalikan tarif/dtk dengan durasi
  klip (dibulatkan ke atas per detik).
- **Bentuk API terverifikasi dari docs.kie.ai, kecuali string model + bentuk input (asumsi berlabel, K4-01).**
  Alamat dasar `https://api.kie.ai`, auth `Authorization: Bearer <kunci>`; tugas asinkron
  `POST /api/v1/jobs/createTask` `{model, input}` → `{code: 200, data: {taskId}}` lalu
  `GET /api/v1/jobs/recordInfo?taskId=…` → status `waiting → queuing → generating → success | fail`, hasil di
  `resultJson` (string berisi `resultUrls`); Veo memakai endpoint sendiri `POST /api/v1/veo/generate` +
  `GET /api/v1/veo/record-info` (`successFlag`: 1 berhasil, 2 gagal — asumsi); probe
  `GET /api/v1/chat/credit`. Galat datang sebagai **HTTP 200 + `code` di body** — transport selalu memeriksa `code`,
  bukan status HTTP. String `model` persis + bentuk `input` per model adalah asumsi berlabel di `KIE_API_MODEL` +
  transport; pola `google/<model>` terkonfirmasi live 13 Nov 2026 lewat TTS (`google/gemini-3-1-flash-tts`), slug
  gambar/video tetap menunggu uji live PC. Batas rate 20 generate baru/10 detik; request yang ditolak tidak masuk
  antrean. Tidak ada endpoint batal yang terdokumentasi — membatalkan hanya menghentikan polling lokal.
- Alur: gambar dan video submit → simpan taskId → polling backoff 2 dtk → 10 dtk, timeout 20 menit, lalu unduh.
  Timeout: gambar 300 dtk, video 600 dtk, unduh 180 dtk, probe 8 dtk. Frame pertama dikirim sebagai data URI
  (`image_urls`/`imageUrls` — asumsi). Gambar referensi (lembar karakter) TIDAK dikirim di tier 4 — dukungan
  referensi masih menunggu uji live. Pesan galat ramah Bahasa Indonesia (401 kunci tidak valid; 402/403 kredit tidak
  cukup; 429 batas rate, tidak masuk antrean; 5xx server); kunci tidak pernah bocor ke pesan galat.
- Penyambungan (`generation.ts`): model `kieai:` bercabang ke antrean `kieai` (limit 1) dengan penyedia `kieai`.
  `requireKie` gagal keras bila sakelar mati atau kunci belum diisi — tanpa fallback diam-diam ke provider lain
  (K4-03). `estimateCredits` mengembalikan harga katalog (kredit kie.ai + USD asli, bukan null seperti NexaBot).
  `resumeJobs` melanjutkan polling tugas yang sudah disubmit sesudah restart — gambar, lembar, dan video, karena
  ketiganya menyimpan taskId.
- Pengaturan: `kieaiEnabled` (mati bawaan) dan `kieaiBaseUrl` (`AppSettings`). Sakelarnya terkunci di balik
  peringatan biaya dan kotak persetujuan di Pengaturan (`Settings.tsx`, `KieSection`); kunci BYOK lewat `KeyForm`
  yang sama dengan provider lain. IPC `kieai:testConnection` memeriksa `GET /api/v1/chat/credit` dengan kunci
  tersimpan, dan `settings:testKey` punya cabang kie.ai.
- Gerbang biaya batch (K4-05b, lebih tegas dari D3-05b): Storyboard menampilkan ringkasan biaya total Rupiah + USD
  dan meminta konfirmasi sebelum satu job kie.ai pun dimulai; judul dialog menyebut Kie.ai; membatalkan di tengah
  jalan tidak mengembalikan kredit generate yang sudah jadi, dan tugas yang sudah terkirim di server bisa terus
  berjalan. Harga per generate tampil di pemilih model (kredit + USD) dan di kartu Model AI (Rupiah + USD +
  tarif/dtk untuk model per detik).
- Suara/musik/LLM TIDAK dibangun untuk kie.ai (K4-09). Tutorial lengkap berbahasa Indonesia ada di dalam aplikasi
  (Pengaturan › Panduan Kie.ai, `KieAiGuideSection.tsx`) dan pemetaannya di `docs/kieai-pemetaan.md`.

## Jalur manual & ekstensi (`services/manual.ts`, `shared/manual.ts`, `manualWatch.ts`)

Tier 2 (0.3+): gambar dan video adegan dibuat di luar KenStory — oleh pengguna, agen, atau ekstensi browser — lalu
dibawa kembali lewat folder kerja. Manual adalah provider (`visualProvider` per adegan: `auto` | `higgsfield` |
`flow2api` | `nexabot` | `kieai` | `manual` | `extension`), bukan mode; tiap adegan punya nomor stabil 2 digit (`sceneKey`, `01`, `02`, …,
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
