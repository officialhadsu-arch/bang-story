# Pemetaan kie.ai → KenStory — Provider berbayar murah TAMBAHAN (tier 4, 0.3+)

Tanggal: 13 Nov 2026. Cabang implementasi: `0.3-tier4-kieai-impl` (dari main
`2d7705f`, sudah termasuk merge Tier 3 + label-fix Tier 2; riset awal di cabang
`0.3-tier4-kieai` dari main `c3a41c2` — lihat catatan di §8).
Status: studi + pemetaan selesai — **20/100**; implementasi berjalan.

kie.ai adalah jalur D dalam skema 3 tingkat konsep v2.1 yang diperluas: (1)
otomatis gratis Flow2API, (2) semi-otomatis/manual, (3) NexaBot berbayar murah
(tier 3), (4) kie.ai berbayar (tier 4) sebagai cadangan **premium**: bukan
pengganti NexaBot, melainkan penyedia model-model yang tidak ada di NexaBot
(Veo 3.1, Seedance, Kling, Wan, Grok Imagine). Seperti NexaBot, kie.ai
**tidak pernah dipanggil otomatis**: hanya jalan bila proyek secara eksplisit
memilih model `kieai:*`, dan setiap pemakaian berbayar butuh persetujuan biaya
eksplisit per pemakaian (gerbang biaya Bab 14 konsep v2.1).

Aturan kerja yang mengikat tahap ini: **tanpa panggilan live berbayar apa pun**
di VM (riset baca saja), **tanpa memperoleh atau memakai API key kie.ai**
(kunci hanya diisi Bos sendiri nanti lewat Pengaturan), biaya tunai pengerjaan
Rp0. Uji live tetap gerbang PC + persetujuan Bos per pemakaian, seperti G3
untuk tier 1.

## 1. Yang terverifikasi dari kie.ai (sumber primer, dibaca 13 Nov 2026)

Beranda https://kie.ai, halaman harga https://kie.ai/pricing, dan dokumentasi
https://docs.kie.ai dibaca langsung (crawl 12 Nov 23:19–23:22 UTC). Semua angka
di bawah berasal dari halaman-halaman itu, kecuali yang ditandai sekunder.

### Apa itu kie.ai

- **"The Multimodel Layer"** — agregator/reseller API: satu kunci API, satu
  saldo kredit, untuk ratusan model dari Google, OpenAI, ByteDance, xAI,
  Kling, Suno, ElevenLabs, dan lain-lain. **Bukan pembuat model** — kie.ai
  menjual ulang akses, dengan klaim hemat sampai 88% vs harga resmi API.
- Operator: NEXUSAI SERVICES LLC (menurut footer, dilaporkan sumber sekunder).
- Klaim situs: 120.000+ pengembang, 80+ negara, uptime 99,9%, biaya bulanan
  $0, dukungan 24/7.
- 142 model, 667 harga di halaman pricing. Katalog mencakup video, gambar,
  musik, dan LLM — tetapi untuk KenStory yang relevan hanya **gambar dan
  video** (suara/musik/LLM tidak dibangun — lihat §3 dan K4-09).
- Tim kecil (startup) menurut docs; docs sendiri menulis: *"We are not
  perfect. Occasional instability can happen. This is a conscious
  trade-off."*

### Skema kredit (1 kredit ≈ $0,005)

| Butir | Isi | Sumber |
| --- | --- | --- |
| Harga kredit | 1 kredit ≈ **$0,005** (200 kredit = $1) | kie.ai/pricing |
| Langganan | **Tidak ada** — pay-as-you-go, biaya bulanan $0 | kie.ai/pricing |
| Kedaluwarsa kredit | **Tidak pernah kedaluwarsa** | kie.ai/pricing |
| Gagal | Tugas gagal **tidak ditagih** | kie.ai/pricing |
| Bonus top-up | Top-up $1.250 → bonus **+10%** kredit | kie.ai/pricing + FAQ beranda |
| Kredit gratis | **80 kredit** (≈ $0,40) untuk pengguna baru, untuk uji coba | FAQ beranda kie.ai |
| Top-up minimum | ±$5 ≈ 1.000 kredit | **Sekunder** (beberapa sumber sepakat; halaman billing butuh login — belum terverifikasi langsung) |
| Pembayaran | Kartu via Stripe (sekunder); invoice perusahaan tersedia sesudah top-up | kie.ai/pricing (invoice) + sekunder (Stripe) |
| Refund | **Belum terverifikasi resmi** — satu sumber sekunder menyebut saldo tak terpakai bisa direfund dalam 30 hari; JANGAN jadikan fakta sampai terverifikasi | Sekunder (APIPod) — kontras dengan NexaBot yang terverifikasi "semua pembelian final, tanpa refund" |

80 kredit gratis cukup untuk ±13 gambar GPT Image 2 ($0,03) atau 2 klip Veo
3.1 Lite ($0,175) atau 1 klip Veo 3.1 Fast ($0,325) — cukup untuk uji coba,
bukan untuk produksi.

### Tarif gambar (terverifikasi dari kie.ai)

Kurs perbandingan: **Rp18.200/USD** (dibulatkan dari mid-market 12 Nov 2026
≈ Rp18.234 — Finnhub/JISDOR; kurs hanya untuk perbandingan, wajib
diperbarui saat uji live karena kie.ai menagih dalam USD).

| Model | Harga USD | Harga Rupiah | Keterangan |
| --- | --- | --- | --- |
| GPT Image 2.5 1K | $0,03/gambar | **Rp546** | |
| GPT Image 2 1K / 2K / 4K | $0,03 / $0,05 / $0,08 | **Rp546 / Rp910 / Rp1.456** | |
| Nano Banana 2 1K | $0,04/gambar | **Rp728** | = Gemini 3.1 Flash Image |
| Nano Banana Pro 1K/2K | $0,09/gambar | **Rp1.638** | |
| Nano Banana Pro 4K | $0,12/gambar | **Rp2.184** | |
| Imagen 4 | dari $0,02/request | **Rp364** | |
| Seedream 5 Pro | $0,035/gambar | **Rp637** | |
| Flux 2 Pro | dari $0,025/gambar | **Rp455** | |

### Tarif video (terverifikasi dari kie.ai)

Harga per video = harga tetap per klip; harga per detik × durasi klip.
Satuan adegan KenStory: 8 detik (durasi klip Flow/Veo yang dipakai selama
ini); kolom 15 detik dicantumkan karena itu satuan PART NexaBot/PAWARNA.

| Model | Harga USD | Per klip 8 dtk (Rp) | Per 15 dtk (Rp) | Keterangan |
| --- | --- | --- | --- | --- |
| Veo 3.1 Fast 1080p | $0,325/video | **Rp5.915** | — (klip 8 dtk) | endpoint Veo khusus (§1, API) |
| Veo 3.1 Lite 1080p | $0,175/video | **Rp3.185** | — (klip 8 dtk) | endpoint Veo khusus |
| Veo 3.1 Quality 1080p | $1,275/video | **Rp23.205** | — (klip 8 dtk) | endpoint Veo khusus |
| Veo 3.1 Quality i2v 4K | $1,85/video | **Rp33.670** | — | image-to-video |
| Grok Imagine 720p | $0,0225/dtk | **Rp3.276** | **Rp6.143** | text- dan image-to-video |
| Seedance 2.5 | $0,085/dtk | **Rp12.376** | **Rp23.205** | s.d. 30 dtk 4K, 50 referensi |
| Seedance 2 fast | $0,034/dtk | **Rp4.950** | **Rp9.282** | |
| Seedance 2 mini | $0,012/dtk | **Rp1.747** | **Rp3.276** | |
| Kling 3.0 | $0,0755/dtk | **Rp10.993** | **Rp20.612** | s.d. 15 dtk, audio asli |
| Wan 3.0 | $0,04/dtk | **Rp5.824** | **Rp10.920** | s.d. 30 dtk |
| Wan 2.6 flash | $0,10/video | **Rp1.820** | — | |
| Gemini Omni Flash 1.2 | $0,02/dtk | **Rp2.912** | **Rp5.460** | model yang sama dengan NexaBot |
| gemini-omni-video | dari $0,315/video | **Rp5.733** | — | |

Catatan: harga "dari" (from) adalah opsi termurah model itu, bukan tarif
tetap — tiap model punya banyak opsi (Veo 3.1: 29 opsi). Harga pasti per
opsi dikonfirmasi di halaman model masing-masing dan di uji live.

### Bentuk API (terverifikasi dari docs.kie.ai)

- Alamat dasar: **`https://api.kie.ai`**.
- Autentikasi: header **`Authorization: Bearer <KIE_API_KEY>`** +
  `Content-Type: application/json`. Jangan pakai `x-api-key` (menurut sumber
  sekunder yang mengutip docs, itu diam-diam mengembalikan 401).
- Kunci dibuat/dikelola di **kie.ai/api-key**; tersedia batas per kunci
  (per jam, per hari, total) dan **IP whitelist**.
- **Model tugas asinkron** (gambar, video, musik): buat tugas → polling
  atau webhook. Model chat sinkron.
  - Buat tugas: `POST /api/v1/jobs/createTask` dengan body
    `{model, input, callBackUrl?}` → `{"code": 200, "data": {"taskId": "…"}}`.
  - Periksa: `GET /api/v1/jobs/recordInfo?taskId=…` → status `waiting →
    queuing → generating → success | fail`; hasil di `resultJson` (string
    berisi resultUrls) saat `success`.
  - **Pengecualian Veo**: Veo 3.1 memakai endpoint sendiri —
    `POST /api/v1/veo/generate` + `GET /api/v1/veo/record-info?taskId=…`
    dengan kosakata statusnya sendiri.
  - Cek saldo/kunci: `GET /api/v1/chat/credit` (pemeriksaan auth termurah,
    tanpa biaya generate).
  - Unggah berkas (untuk gambar referensi): host terpisah
    `https://kieai.redpandaai.co` (sekunder).
- **Kebiasaan galat yang wajib ditangani**: galat pada `/api/v1/*` dan
  endpoint unggah dikembalikan dengan **HTTP 200 + `code` galat di body**
  (mis. `{"code":429,…}`) — selalu periksa `code`, jangan andalkan status
  HTTP. Contoh docs: 401 → `{"code":401,"msg":"You do not have access
  permissions"}`.
- **Batas rate**: 20 request generate baru per 10 detik, per akun; biasanya
  100+ tugas berjalan bersamaan; bila lewat → kode 429 dan request yang
  ditolak **tidak masuk antrean** (harus dicoba ulang dengan backoff).
- **Retensi**: berkas media 14 hari, log 2 bulan — hasil WAJIB diunduh
  segera (URL hasil kedaluwarsa ±24 jam menurut sumber sekunder).
- Dukungan: Discord/Telegram (dari dashboard), email support@kie.ai; jam
  UTC 21:00–17:00.

### Yang TIDAK ditemukan di publik (batas dokumentasi)

- **String `model` persis + bentuk `input` per model** (nama field prompt,
  rasio aspek, durasi, URL gambar referensi): tidak ada di halaman Getting
  Started; tiap model mendokumentasikannya di halaman modelnya sendiri
  (docs.kie.ai/market/…). Ditampung sebagai asumsi berlabel di modul
  transport (K4-01) dan dikonfirmasi di uji live PC.
- **Kosakata status Veo** (`successFlag`) dan verifikasi HMAC webhook:
  dilaporkan sumber sekunder yang mengutip docs — belum diverifikasi
  langsung; daftar periksa uji live.
- **Kebijakan konten / watermark**: tidak ditemukan pernyataan kebijakan
  konten atau watermark di sumber terbuka — kebijakan model masing-masing
  yang berlaku; daftar periksa uji live.
- **Refund resmi**: belum terverifikasi (lihat tabel kredit di atas).
- **Top-up minimum $5**: belum terverifikasi langsung (halaman billing
  butuh login).

## 2. Perbandingan dengan NexaBot (Tier 3)

Tarif NexaBot terverifikasi (docs/nexabot-pemetaan.md §1): 1 kredit NexaBot =
Rp1.000; request umum Rp150; video Rp200–300; Omni Flash 1.2 Rp300; GPT
Image 2.5 Rp100. Kurs kie.ai: Rp18.200/USD (12 Nov 2026).

### Harga per gambar (Rupiah)

| Model | NexaBot | kie.ai | Pemenang |
| --- | --- | --- | --- |
| GPT Image 2.5 1K | **Rp100** | Rp546 | NexaBot (5,5× lebih murah) |
| Nano Banana Pro 1K/2K | **Rp150** | Rp1.638 | NexaBot (11× lebih murah) |
| Nano Banana 2 1K | tidak ada | Rp728 | hanya kie.ai |
| GPT Image 2 1K | tidak ada | Rp546 | hanya kie.ai |
| Imagen 4 | tidak ada | Rp364 | hanya kie.ai |

### Harga per video 8 detik (Rupiah)

| Model | NexaBot | kie.ai | Pemenang |
| --- | --- | --- | --- |
| Omni Flash 1.2 | **Rp300** | Rp2.912 | NexaBot (10× lebih murah) |
| Veo 3.1 Fast 1080p | tidak ada | Rp5.915 | hanya kie.ai |
| Veo 3.1 Lite 1080p | tidak ada | Rp3.185 | hanya kie.ai |
| Veo 3.1 Quality 1080p | tidak ada | Rp23.205 | hanya kie.ai |
| Grok Imagine 720p | tidak ada | Rp3.276 | hanya kie.ai |
| Seedance 2.5 | tidak ada | Rp12.376 | hanya kie.ai |
| Kling 3.0 | tidak ada | Rp10.993 | hanya kie.ai |
| Wan 3.0 | tidak ada | Rp5.824 | hanya kie.ai |

### Contoh batch 30 adegan (8 detik per adegan)

| Jalur | Per klip | Total 30 klip |
| --- | --- | --- |
| NexaBot Omni Flash 1.2 | Rp300 | **Rp9.000** |
| kie.ai Grok Imagine 720p | Rp3.276 | Rp98.280 |
| kie.ai Veo 3.1 Fast | Rp5.915 | Rp177.450 |
| kie.ai Veo 3.1 Quality | Rp23.205 | Rp696.150 |

### Kesimpulan perbandingan — dibaca jujur

- **"Murah" kie.ai itu relatif terhadap harga resmi API (sampai 88%),
  BUKAN relatif terhadap NexaBot.** Untuk model yang tumpang tindih,
  NexaBot 5–11× lebih murah per gambar/video. Bos benar bahwa kie.ai
  "murah juga" — murah dibanding harga resmi — tetapi NexaBot tetap juara
  harga.
- **Nilai kie.ai adalah LUASNYA katalog, bukan harganya**: Veo 3.1 (video
  flagship Google: audio asli, 1080p, referensi multi-gambar), Seedance
  2.5 (s.d. 30 dtk 4K), Kling 3.0 (s.d. 15 dtk, audio asli), Wan 3.0,
  Grok Imagine, PixVerse, Hailuo, Runway — semuanya tidak ada di NexaBot.
  Tier 4 adalah **tier premium (luas model)**, bukan pengganti tier 3.
- **kie.ai lebih mudah diintegrasi dengan benar**: dokumentasi API publik
  lengkap (alamat, auth, endpoint, envelope galat, batas rate) — kebalikan
  dari NexaBot yang dokumentasi resminya tidak ditemukan di publik.
  Verifikasi tier 4 lebih banyak bersandar pada sumber primer.
- **kie.ai menagih USD + kartu (Stripe)**; NexaBot menagih Rupiah + QRIS.
  Biaya kie.ai bergerak mengikuti kurs — katalog wajib menyimpan kurs
  tanggal riset dan menampilkannya.
- **Sinyal kepercayaan berimbang**: kie.ai punya FAQ/dokumentasi terbuka,
  kredit gratis 80, dan kebijakan gagal-tidak-ditagih; tetapi juga
  Trustpilot ±2,5/5 dari sedikit ulasan + keluhan kredit hilang (sekunder,
  belum terverifikasi), bukan mitra berlisensi kebanyakan provider,
  Midjourney dicabut 2025 atas permintaan Midjourney (sekunder), dan docs
  mengakui ketidakstabilan sesekali. NexaBot adalah layanan Indonesia
  (QRIS, Rupiah) dengan rantai yang sudah terlihat hidup lewat
  tokogame.ai.id.
- **Tumpang tindih yang sengaja TIDAK ditawarkan di kie.ai**: Omni Flash
  1.2 tidak masuk katalog awal tier 4 — NexaBot sudah menawarkannya 10×
  lebih murah; tidak ada alasan menawarkan model yang sama lewat jalur
  yang lebih mahal (K4-02).

### Catatan jalur lain: kie.ai TTS — sudah diriset di lane lain, kini diverifikasi sebagian dari sumber primer

Riset live 13 Nov 2026 (lane stack 1-7, catatan di MEMORY.md): kie.ai
Gemini Flash TTS ±$0,018/menit VO → $5 ≈ 270–360 menit VO ("sampai
muntah"); tetapi Bos sudah punya Google AI Pro (Gemini TTS yang sama
kemungkinan $0 tambahan) — rekomendasi lane itu: jangan deposit dulu, uji
banding suara dulu; deposit $5 wajib persetujuan Bos.

Verifikasi dari sumber primer kie.ai (halaman model Gemini 2.5 Pro Preview
TTS, `kie.ai/gemini-2.5-pro-preview-tts`, dibaca 13 Nov 2026):
- Tarif: input teks 140 kredit/1M token (≈ $0,70); output audio **2.800
  kredit/1M token (≈ $14,00)**; kie.ai menyebutnya ~30% di bawah tarif
  standar Google ($1,00 input / $20,00 output per 1M token, Nov 2026).
- Turunan per menit (audio Google = 25 token/detik → 1.500 token/menit):
  1.500/1.000.000 × $14 ≈ **$0,021/menit** → $5 (1.000 kredit) ≈ **238
  menit**. Angka turunan independen kie-mcp (~4,2 kredit/menit, sekunder)
  konsisten dengan $0,021/menit.
- **Vonis jujur: klaim lane "$0,018/menit → $5 ≈ 270–360 menit" TIDAK
  terverifikasi persis dari tarif kie.ai sendiri** — angka kie.ai ~15–35%
  lebih mahal per menit (238 vs 270–360 menit). Angka $0,018/menit cocok
  dengan harga Google langsung seri 3.8 (Flash-Lite $12/1M token per Jan
  2027 → $0,018/menit), bukan tarif kie.ai. Substansi "sampai muntah"
  tetap benar (238 menit VO untuk $5 tetap sangat banyak), tetapi angka
  pastinya lebih rendah.
- Pembanding: harga peluncuran Google 3.8 Flash TTS langsung $9/1M token
  (≈ $0,0135/menit → ~370 menit per $5) — LEBIH MURAH dari kie.ai
  ($14/1M). Ini memperkuat rekomendasi lane: **jangan deposit dulu, uji
  banding suara dulu** — jalur Google langsung (AI Pro Bos) kemungkinan
  lebih murah daripada kie.ai untuk VO.
- Model TTS di kie.ai: `google/gemini-2-5-pro-tts`,
  `google/gemini-3-1-flash-tts` (tarif output sama 2.800 kredit/1M token
  menurut halaman pricing), ElevenLabs TTS dari $0,03/1.000 karakter.
  Pola API TTS sama dengan gambar/video (`POST /api/v1/jobs/createTask`
  + `GET /api/v1/jobs/recordInfo`, galat HTTP 200 + `code`) — halaman
  model ini mengonfirmasi pola itu secara independen, memperkuat K4-01.
  Detail lain: 30 suara, aksen (Neutral/American/British/Transatlantic/
  Australian), gaya, pace, maks 2 speaker, 10.000 karakter per giliran
  dialog, output WAV 16-bit PCM 24 kHz mono.
- Top-up minimum $5 = 1.000 kredit **tetap sekunder** (halaman billing
  butuh login; laporan lane live) — bukan fakta terverifikasi primer.

Tier 4 **tidak** membangun suara (K4-09) supaya pekerjaan tidak ganda;
bila VO kie.ai dibutuhkan nanti, itu keputusan terpisah sesudah uji banding
suara lane tersebut.

## 3. Yang TIDAK dibangun di Tier 4 dan mengapa

| Tidak dibangun | Alasan |
| --- | --- |
| Suara kie.ai (ElevenLabs/Gemini TTS) | Suara KenStory sudah ada jalurnya (Gemini TTS, ElevenLabs). Sudah diriset di lane lain (stack 1-7). Menambah provider suara = permukaan baru tanpa kebutuhan dari konsep. |
| Musik kie.ai (Suno V6, $0,06/request) | Musik KenStory berasal dari berkas pengguna. Generator musik bukan bagian jalur motion. |
| LLM kie.ai (Claude/GPT/Gemini/Grok/DeepSeek) | Naskah KenStory sudah ditulis LLM yang ada (Gemini/Groq/OpenRouter). Bukan jalur motion. |
| Omni Flash 1.2 via kie.ai | NexaBot menawarkannya 10× lebih murah (Rp300 vs Rp2.912 per 8 dtk). Sengaja tidak masuk katalog awal. |
| Paket/top-up di dalam aplikasi | Top-up dilakukan di dashboard kie.ai (kartu/Stripe). Aplikasi hanya memakai kunci + menampilkan estimasi biaya. |
| Panggilan live / akun kie.ai | Dilarang gerbang biaya. Semua verifikasi memakai mock. |
| Fallback otomatis ke kie.ai | Seperti D3-03: jalur berbayar tidak pernah dipanggil otomatis. kie.ai hanya jalan bila proyek memilih model `kieai:*`. |
| Ekstensi browser / WebSocket | Itu Tier 2. kie.ai adalah REST API — tidak butuh ekstensi. |

## 4. Titik sambung ke KenStory (pola Tier 1/2/3 yang dipakai ulang)

Dibaca sebelum menulis rencana ini: `docs/nexabot-pemetaan.md` §4 (titik
sambung Tier 3) dan AGENTS.md repo (aturan IPC 3 tempat, kunci BYOK via
`secrets.ts`, tanpa framework unit test, typecheck+build). Titik sambung
Tier 4 mengikuti Tier 3 persis, kecuali yang dicatat di bawah.

| Titik | Keadaan sekarang (main `b4b6993`, sudah termasuk Tier 3) | Yang diubah Tier 4 |
| --- | --- | --- |
| `VisualProvider` (`src/shared/manual.ts`) | `auto \| higgsfield \| flow2api \| manual \| extension \| nexabot` | Tambah `kieai`. `resolveVisualProvider` tetap gagal keras untuk nilai tak dikenal. |
| `generateClipImage` / `generateClipVideo` (`generation.ts`) | Cabang `startFlow`/`finishFlow`, `startHiggsfield`/`finishHiggsfield`, `startManualJob`, `startNexa`/`finishNexa` | Tambah cabang `startKie`/`finishKie`, mengikuti pola `startNexa`/`finishNexa` (submit → poll → unduh → simpan; antrean; idempotensi per klip bila didukung API). |
| `generateCharacterSheet` (`generation.ts`) | Jalur gambar (Flow2API/Higgsfield/NexaBot) | Cabang kie.ai memakai model gambar yang sama — lembar karakter adalah gambar. |
| `estimateCredits` (`generation.ts`) | NexaBot mengembalikan harga tetap dari katalog; Flow2API/manual `null` | kie.ai mengembalikan harga dari katalog — **tergantung durasi** untuk model per detik (tarif/dtk × durasi klip) dan tetap untuk model per video. `CreditEstimate` dipakai ulang `{credits, usd}` dengan `credits` = kredit kie.ai dan `usd` = harga USD (bukan null seperti NexaBot — kie.ai memang menagih USD). Rupiah dihitung di UI dengan kurs katalog. |
| `resumeJobs` (`generation.ts`) | Higgsfield/NexaBot melanjutkan polling `remote_id` | kie.ai seperti NexaBot: job yang sudah terkirim (`taskId` + payload tersimpan) dilanjutkan polling-nya; yang belum terkirim gagal dan bisa dicoba ulang. |
| Antrean (`src/main/jobs.ts`) | `higgsfield: 3, flow2api: 1, nexabot: 1, tts: 2, whisper: 1, export: 1` | Tambah `kieai: 1` — berurutan, supaya biaya berbayar tidak pernah berlipat diam-diam oleh paralelisme. |
| Katalog model (`src/shared/nexabot.ts` + `src/shared/flow2api.ts`) | `NEXA_MODELS` + `isNexaModelId`, dsb. | `src/shared/kieai.ts` (baru) mengikuti pola `nexabot.ts`: `KIE_MODELS`, `KIE_DEFAULT_BASE_URL`, `isKieModelId`, `getKieImageModel`, `getKieVideoModel`, `kiePriceIdr(modelId, durationMs?)`, konstanta kurs `KIE_USD_TO_IDR`. |
| Kunci (`src/main/secrets.ts`) | `PROVIDERS` sudah termasuk `'nexabot'` (D3) | Tambah `'kieai'` ke `PROVIDERS` + `PROVIDER_NAMES`. Kunci kie.ai mengikuti aturan yang sama (amplop `KS1:`, tidak pernah ke log). |
| Pengaturan (`src/main/settings.ts`, `src/shared/types.ts`) | `nexabotEnabled` + `nexabotBaseUrl` (default dari `NEXA_DEFAULT_BASE_URL`) | Tambah `kieaiEnabled: boolean` (default `false`) + `kieaiBaseUrl: string` (default `KIE_DEFAULT_BASE_URL` = `https://api.kie.ai`). |
| Uji kunci (`src/main/ipc.ts` `settings:testKey`) | Cabang per provider (`nexabot` → `nexabot.testCredentials`) | Tambah cabang `kieai` → `kieai.testCredentials` (memakai `GET /api/v1/chat/credit` — pemeriksaan auth termurah, tanpa biaya generate). |
| Uji koneksi (`ipc.ts` `kieai:testConnection` + `api.ts` + `preload`) | Pola IPC 3 tempat (AGENTS.md: `main/ipc.ts`, `shared/api.ts`, `preload/index.ts`) | Tambah `kieai:testConnection` di ketiga tempat yang sama. |
| Pemilih model (`ModelSection.tsx`) | Cabang NexaBot menampilkan Rupiah ("≈ Rp300 per video · N klip ≈ RpX"); tag "NexaBot" | Cabang kie.ai menampilkan **Rupiah + USD** ("≈ Rp5.915/video (≈ $0,325) · N klip ≈ RpX") + tag "Kie.ai". Harga dari katalog, tanpa menunggu kunci. Model per detik menampilkan tarif/dtk. |
| Pengaturan UI (`Settings.tsx` `NexaSection`) | Sakelar + URL dasar + tombol uji koneksi + peringatan biaya + tautan panduan | `KieSection` dengan pola yang sama; peringatannya: berbayar per generate dalam **USD** (kurs bergerak), kredit gratis 80 untuk uji coba, media hanya 14 hari (unduh segera), dan catatan Trustpilot/ketidakstabilan yang diakui docs. |
| Tutorial (`NexaBotGuideSection.tsx`) | Tab panduan di Pengaturan | `KieAiGuideSection.tsx`: cara dapat kunci, tarif, kredit gratis 80, top-up $5, batas, pemecahan masalah, peringatan biaya + gerbang persetujuan, perbandingan jalur A/B/C/D, uji live 1 klip sebagai gerbang PC. |
| Dokumen | `docs/layanan-ai.md`, `NOTICE.md` (sudah ada entri NexaBot) | Tambah entri kie.ai di keduanya. |

## 5. Keputusan desain Tier 4

- **K4-01 — Transport terisolasi, asumsi berlabel.** Semua yang belum
  terverifikasi soal API kie.ai hidup di **satu modul**
  `src/main/services/kieai.ts`, dalam satu blok konfigurasi (`KIE_API`:
  alamat dasar, path endpoint, skema auth). Yang **sudah terverifikasi**
  dari docs.kie.ai (lebih banyak daripada NexaBot): alamat dasar
  `https://api.kie.ai`, auth `Authorization: Bearer`, endpoint gabungan
  `POST /api/v1/jobs/createTask` + `GET /api/v1/jobs/recordInfo`, endpoint
  Veo `POST /api/v1/veo/generate` + `GET /api/v1/veo/record-info`,
  pemeriksaan saldo `GET /api/v1/chat/credit`, envelope galat HTTP 200 +
  `code`, status `waiting → queuing → generating → success | fail`, batas
  20 request/10 dtk. Yang **masih asumsi berlabel** (hipotesis terbaik,
  **bukan fakta**): string `model` persis per model, bentuk `input` per
  model (field prompt, rasio, durasi, URL gambar referensi), kosakata
  status Veo, verifikasi HMAC webhook, alur unggah berkas referensi (host
  `kieai.redpandaai.co`, berkas dihapus 24 jam — sekunder), dan apakah
  `createTask` mendukung kunci idempotensi (tidak terlihat di docs).
  Mock mengimplementasikan bentuk yang sudah terverifikasi + asumsi yang
  dicatat, sehingga semua penyambungan terverifikasi; modul transport
  adalah bagian yang wajib dikonfirmasi/dikoreksi di uji live PC. Pola
  async + envelope galat yang sama dikonfirmasi independen oleh halaman
  model Gemini 2.5 Pro Preview TTS kie.ai (`createTask` + `recordInfo` +
  galat HTTP 200 + `code`) — lihat §2.
- **K4-02 — Katalog (`src/shared/kieai.ts`).** Model awal (harga katalog,
  kurs Rp18.200/USD):
  gambar `kieai:gpt-image-2-5` (GPT Image 2.5 1K, Rp546, referensi maks —
  lihat uji live), `kieai:nano-banana-2` (Nano Banana 2 1K, Rp728),
  `kieai:nano-banana-pro` (Nano Banana Pro 1K/2K, Rp1.638);
  video `kieai:veo-3-1-lite` (Veo 3.1 Lite 1080p, Rp3.185/klip 8 dtk),
  `kieai:veo-3-1-fast` (Veo 3.1 Fast 1080p, Rp5.915/klip 8 dtk),
  `kieai:veo-3-1-quality` (Veo 3.1 Quality 1080p, Rp23.205/klip 8 dtk),
  `kieai:seedance-2-5` (Seedance 2.5, Rp1.547/dtk),
  `kieai:kling-3-0` (Kling 3.0, Rp1.374/dtk),
  `kieai:grok-imagine-720p` (Grok Imagine 720p, Rp410/dtk).
  Durasi: Veo tetap **[8]** (klip 8 detik); model per detik memakai
  `durationMs` adegan. `maxRefs` dan durasi adalah asumsi katalog — bila
  uji live membuktikan lain, yang berubah hanya katalog. **Omni Flash 1.2
  sengaja tidak masuk katalog awal** (§2). Model kie.ai **bukan** default
  aplikasi; default tetap Higgsfield, dan jalur berbayar termurah tetap
  NexaBot. Kurs `KIE_USD_TO_IDR` hidup di katalog sebagai konstanta
  berlabel tanggal riset (13 Nov 2026) — diperbarui saat uji live.
- **K4-03 — Tidak ada fallback otomatis.** kie.ai hanya jalan bila proyek
  memilih model `kieai:*`. Bila model kie.ai dipilih tapi kunci belum
  diisi → gagal keras dengan pesan jelas ("Isi kunci kie.ai di
  Pengaturan"), bukan jatuh diam-diam ke provider lain. Alasan: pilihan
  berbayar tidak boleh diganti tanpa sepengetahuan pengguna.
- **K4-04 — Estimasi biaya dari katalog, tergantung durasi.** Model per
  video: harga tetap. Model per detik: tarif/dtk × durasi klip.
  `CreditEstimate` dipakai ulang `{credits, usd}` dengan `credits` =
  kredit kie.ai dan `usd` = harga USD sebenarnya (kie.ai menagih USD —
  beda dengan NexaBot yang `usd: null`). Pemilih model menampilkan Rupiah
  (kurs katalog, format `id-ID`) + USD dalam kurung, bukan "kredit".
- **K4-05 — Gerbang persetujuan biaya (dua lapis, lebih tegas dari D3-05).**
  (a) Satu klip: harga per model sudah tampil di pemilih model sebelum
  tombol generate ditekan. (b) Batch: bila ada adegan yang memakai model
  kie.ai, sebelum satu job pun dimulai tampil ringkasan biaya (jumlah
  klip × harga per klip = total Rp) dan menunggu konfirmasi eksplisit;
  batal = tidak ada job yang dimulai, tidak ada kredit terpotong. Alasan
  penegasan: video kie.ai sekitar **10–75× lipat** tarif NexaBot per klip
  (contoh 30 adegan Veo Fast = Rp177.450 vs NexaBot Rp9.000) — total
  batch wajib tampil mencolok, bukan angka kecil di sudut.
- **K4-06 — Kunci BYOK terenkripsi.** Kunci kie.ai disimpan lewat
  `secrets.ts` seperti kunci lain (amplop `KS1:`, tidak pernah ke log).
  `testCredentials` memakai `GET /api/v1/chat/credit` (pemeriksaan saldo —
  tidak memakan biaya generate). Pesan galat ramah berbahasa Indonesia:
  401 → kunci tidak valid; 402/403 → kredit tidak cukup; 429 → batas
  rate, request ditolak dan tidak masuk antrean (coba lagi dengan jeda);
  5xx → server bermasalah (bisa dicoba lagi). Perhatian khusus: galat
  datang sebagai HTTP 200 + `code` — transport wajib memeriksa `code`,
  bukan status HTTP.
- **K4-07 — Antrean berurutan + resume.** Queue `kieai` limit 1. Video
  async: submit mengembalikan `taskId`, polling `recordInfo` dengan
  backoff seperti `higgsfield.waitForResult` (mulai 2 dtk → maks 10 dtk,
  timeout 20 menit). `resumeJobs`: job yang sudah terkirim (`taskId` +
  payload tersimpan) dilanjutkan polling-nya. Upload referensi: bila API
  butuh URL publik untuk gambar pertama, memakai pola presigned-upload
  Higgsfield (`uploadFile`) atau host unggah kie.ai — diputuskan di
  transport sesudah bentuk `input` terverifikasi di uji live.
- **K4-08 — Mock dulu, live belakangan.** Seperti `STUDIO_NEXA_BASE`,
  transport membaca `STUDIO_KIE_BASE` di build pengembangan untuk
  mengarah ke mock lokal. Semua uji VM memakai mock. Tidak ada panggilan
  ke `api.kie.ai` dari VM.
- **K4-09 — Suara/musik/LLM tidak dibangun** (lihat §3).
- **K4-10 — Tutorial di dalam aplikasi + dokumen.** `KieAiGuideSection`
  (Bahasa Indonesia) + entri `docs/layanan-ai.md` + `NOTICE.md`. Tutorial
  wajib memuat: cara dapat kunci (kie.ai/api-key, kredit gratis 80),
  tabel tarif terverifikasi (§1), top-up $5 + bonus $1.250 +10%, peringatan
  tagihan USD (kurs bergerak) + media 14 hari (unduh segera), cara kerja
  gerbang biaya, perbandingan jalur A (Flow2API, gratis) / B (Manual,
  gratis) / C (NexaBot, berbayar murah) / D (kie.ai, berbayar premium —
  model yang tidak ada di tempat lain), pemecahan masalah (termasuk
  envelope galat HTTP 200), dan uji live 1 klip sebagai gerbang PC.
- **K4-11 — Tier 4 adalah tier premium, bukan pengganti Tier 3.** Urutan
  jalur berbayar: NexaBot dulu (termurah) — kie.ai hanya bila proyek
  secara eksplisit memilih model `kieai:*` karena butuh model yang tidak
  ada di NexaBot (Veo 3.1, Seedance, Kling). Tutorial dan pemilih model
  wajib menjelaskan perbedaan ini, supaya Bos tidak salah pilih jalur
  mahal untuk model yang ada versi murahnya.

## 6. Rencana implementasi (menuju 50/100, lalu 80/100)

Urutan kerja, per kelompok maksud (satu commit per kelompok, mengikuti
skill `commit`). Dilakukan SESUDAH merge Tier 3 selesai, dari main hasil
merge — bukan bagian fase riset ini.

1. **Katalog + tipe** — `src/shared/kieai.ts` (baru): `KIE_MODELS`,
   `KIE_DEFAULT_BASE_URL`, `KIE_USD_TO_IDR`, `isKieModelId`,
   `getKieImageModel`, `getKieVideoModel`, harga Rupiah per model
   (per video / per detik), `kiePriceIdr(modelId, durationMs?)`.
   `src/shared/manual.ts`: tambah `'kieai'` ke `VisualProvider`.
   `src/shared/types.ts`: tambah `kieaiEnabled`, `kieaiBaseUrl` ke
   `AppSettings`.
2. **Transport + mock** — `src/main/services/kieai.ts` (baru): klien
   mengikuti pola `nexabot.ts`/`higgsfield.ts` (`submit`, `getStatus`,
   `waitForResult`, `testCredentials`, galat ramah Indonesia + pemeriksaan
   `code` pada HTTP 200) + `STUDIO_KIE_BASE`; **dua keluarga endpoint**:
   gabungan (`/api/v1/jobs/createTask` + `/api/v1/jobs/recordInfo`) dan
   Veo (`/api/v1/veo/generate` + `/api/v1/veo/record-info`).
   Mock server lokal yang mengimplementasikan bentuk terverifikasi K4-01:
   `createTask` (balas `taskId`) → `recordInfo` (`waiting → queuing →
   generating → success` + `resultJson` berisi URL fixture) + galat
   401/429 dalam envelope HTTP 200.
3. **Penyambungan inti** — `src/main/generation.ts`: cabang `kieai` di
   `generateClipImage`/`generateClipVideo`/`generateCharacterSheet`
   (`startKie`/`finishKie`), `estimateCredits` (harga katalog, tergantung
   durasi untuk model per detik), `resumeJobs` (lanjutkan polling
   `taskId`); `src/main/jobs.ts`: antrean `kieai` limit 1;
   `src/main/settings.ts`: default baru; `src/main/secrets.ts`: provider
   `'kieai'`; `src/main/ipc.ts` + `src/shared/api.ts` +
   `src/preload/index.ts`: `kieai:testConnection` + cabang
   `settings:testKey`.
4. **UI** — `ModelSection.tsx`: cabang Rupiah + USD + tag "Kie.ai" +
   `hasKey` untuk `'kieai'`; `Settings.tsx`: `KieSection` (sakelar, URL
   dasar, uji koneksi, peringatan biaya USD + 14 hari + kredit gratis,
   tautan panduan) + tab panduan; `KieAiGuideSection.tsx` (baru);
   Storyboard batch: ringkasan biaya + konfirmasi sebelum batch kie.ai
   (K4-05b) — lokasi persis tombol batch ditentukan saat implementasi.
5. **Dokumen** — `docs/layanan-ai.md` + `NOTICE.md` (entri kie.ai).
6. **Verifikasi (tanpa live)** — `npm run typecheck` lalu `npm run build`
   bersih; service-test klien terhadap mock (submit → poll → unduh,
   galat 401/429 dalam envelope HTTP 200, estimasi katalog termasuk
   model per detik, kunci belum diisi → gagal keras); e2e harness:
   proyek demo memakai model kie.ai (mock) end-to-end; regresi ekspor
   demo+P30 terhadap baseline (demo mp4 `1e348c47…` / srt `f403c5ec…`,
   P30 `5bcf2ec7…` / `6aa500d6…`; ingat jitter ekor audio AAC demo yang
   sudah diketahui — bukan regresi).
7. **Verifikasi independen (80/100)** — satu subagent verifikator memeriksa
   ulang semua klaim dari bukti mentah (tarif vs kie.ai/pricing, bentuk
   API vs docs.kie.ai, penyambungan vs kode, mock vs bentuk asumsi,
   regresi vs hash baseline). Verifikator tidak spawn subagent lagi.

## 7. Daftar periksa uji live PC (gerbang Bos, bukan bagian Tier 4 ini)

Dilakukan di laptop Bos, dengan kunci Bos sendiri, 1 gambar + 1 video,
sesudah persetujuan biaya per pemakaian. Yang harus dikonfirmasi/dikoreksi:

1. Kunci kie.ai dibuat di kie.ai/api-key; 80 kredit gratis masuk; saldo
   terbaca lewat `GET /api/v1/chat/credit`.
2. String `model` persis + bentuk `input` per model katalog (prompt, rasio,
   durasi, URL gambar referensi) — koreksi modul transport (K4-01) bila
   berbeda.
3. Jalur Veo: `POST /api/v1/veo/generate` + `record-info` berfungsi; durasi
   klip Veo per generate (8 detik atau lain); kosakata status Veo.
4. Durasi model per detik: apakah durasi yang ditagih = durasi yang diminta
   (Seedance/Kling/Grok/Wan).
5. Dukungan referensi gambar (jumlah maks, URL publik vs base64 vs unggah
   ke host kie.ai; berkas unggah dihapus 24 jam — sekunder).
6. Pesan galat nyata untuk 401/402/429; apakah galat benar datang sebagai
   HTTP 200 + `code`.
7. Biaya nyata yang terpotong untuk 1 gambar + 1 video vs tabel §1; kurs
   saat top-up vs kurs katalog (perbarui `KIE_USD_TO_IDR`).
8. Top-up minimum $5 + cara bayar (kartu/Stripe) + kebijakan refund —
   verifikasi langsung di dashboard (halaman billing butuh login).
9. Kebijakan konten / watermark hasil generate.
10. Bila salah satu gagal → koreksi modul transport (K4-01) saja; bila
    gagal total/kena 429 berulang → jalur D dihentikan, kembali ke
    NexaBot/Manual (seperti aturan go/no-go G3 untuk tier 1).

## 8. Status

- **20/100 — studi + pemetaan selesai (13 Nov 2026).** Dokumen ini +
  tarif terverifikasi dari sumber primer + keputusan desain K4-01–K4-11
  + rencana implementasi §6.
- Catatan cabang: branch ini dibuat dari main GitHub `c3a41c2` (sesuai
  perintah tugas). Merge Tier 3 (`b4b6993`, parent `c3a41c2` + `f5ea950`)
  sudah ada di repo lokal saat riset berjalan, tetapi **belum ter-push ke
  GitHub** saat branch ini dibuat (main GitHub masih `c3a41c2` —
  diverifikasi via API 13 Nov 2026; koordinator merge masih berjalan saat
  itu). Dokumen ini berkas baru yang berdiri sendiri, jadi tidak ada
  konflik yang diantisipasi; saat implementasi (§6) dimulai, cabang kerja
  direbase ke main hasil merge.
- Berikutnya: implementasi §6 langkah 1–6 → 50/100; tutorial +
  verifikasi independen → 80/100; penutup (branch siap merge + backup +
  laporan) → 100/100. **Tanpa merge/push tanpa perintah Bos.**
