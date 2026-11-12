# Pemetaan NexaBot → KenStory — Adopsi jalur berbayar murah (tier 3, 0.3+)

Tanggal: 12 Nov 2026. Cabang: `0.3-tier3-nexabot` (dari main `c3a41c2`).
Status: studi + pemetaan selesai — **20/100**.

NexaBot adalah jalur C dalam skema 3 tingkat konsep v2.1: (1) otomatis gratis
Flow2API, (2) semi-otomatis/manual, (3) NexaBot berbayar murah sebagai cadangan
bila tier 1/2 tidak bisa dipakai. NexaBot **tidak pernah dipanggil otomatis**:
fallback A→B→C gratis, D (NexaBot) dan E (Higgsfield) butuh persetujuan biaya
eksplisit per pemakaian (gerbang biaya Bab 14 konsep v2.1).

Aturan kerja yang mengikat tahap ini: **tanpa panggilan live berbayar apa pun**
di VM (mock/fixture saja), **tanpa memperoleh atau memakai API key NexaBot
asli** (kunci hanya diisi Bos sendiri nanti lewat Pengaturan), biaya tunai
pengerjaan Rp0. Uji live tetap gerbang PC + persetujuan Bos per pemakaian,
seperti G3 untuk tier 1.

## 1. Yang terverifikasi dari nexabot.id (sumber primer, dibaca 12 Nov 2026)

Beranda https://nexabot.id dibaca langsung (crawl 12 Nov 11:20 UTC). Semua
angka di bawah berasal dari halaman itu, bukan dari konsep.

### Tarif (1 kredit = Rp1.000)

| Layanan | Harga | Keterangan |
| --- | --- | --- |
| Request umum | 0,15 kredit = **Rp150** | per request |
| Video | 0,2–0,3 kredit = **Rp200–300** | per generate |
| Video Omni Flash 1.2 | 0,3 kredit = **Rp300** | per generate |
| Gambar GPT Image 2.5 | 0,1 kredit = **Rp100** | per gambar |
| Unlimited Standard | mulai **Rp3.000/hari** (1 hari–1 bulan, s.d. Rp85.000) | Omni Flash 1.2, Voice, Music, Nano Banana Pro; GPT Image 2 **tidak** termasuk |
| API Unlimited | aktif 24 jam, 14 paralel per pengguna, antrean otomatis | |

- Beli kredit mulai 5 kredit; kredit **tidak kedaluwarsa**; tanpa langganan.
- **Semua pembelian final, tanpa refund** — peringatan ini wajib tampil di
  Pengaturan dan tutorial.
- **Koreksi atas konsep v2.1:** konsep (9 Nov 2026) mencatat video
  Rp400/generate. Angka itu **sudah tidak berlaku**: beranda kini menulis
  Rp200–300, Omni Flash 1.2 Rp300. Yang dipakai Tier 3 adalah angka beranda
  (Rp300), dan tutorial wajib menulis Rp300, bukan Rp400.

### Platform dan model

- **REST API · v1**; **satu kunci** untuk video, gambar, suara, dan musik.
- Model yang disebut di beranda: Omni, GPT Image, Nano Banana, ElevenLabs.
- Video (alat web): s.d. **10 detik** per generate.
- Suara: 30+ suara, 9 bahasa. Musik: 10+ genre. Gambar: upscale 4K.
- Saluran: Web + Telegram.

### Yang TIDAK ditemukan di publik (batas dokumentasi)

- **Dokumentasi API resmi tidak ditemukan di publik.** Pencarian 12 Nov 2026
  hanya mengembalikan layanan bernama "Nexa" yang lain — Nexotao,
  NexaAPI/nexa-api.com, NexoVirt — yang **berbeda dan tidak boleh dicampur**
  dengan NexaBot.
- Tautan "View all endpoints" di beranda kemungkinan mengarah ke dokumentasi
  di balik login dashboard; tidak terindeks publik dan tidak dibuka (tidak
  ada akun yang dibuat — dilarang oleh gerbang biaya).
- Akibatnya: **alamat endpoint, skema autentikasi, format kunci,
  bentuk request/response, limit rate, dan kode galat TIDAK terverifikasi**
  dari sumber primer. Semuanya ditampung sebagai asumsi berlabel di satu
  modul transport (§5, D3-01) dan menjadi daftar periksa pertama uji live PC
  (§7). Ini bukan kekurangan riset — ini batas yang dicatat apa adanya.

## 2. Yang dipelajari dari referensi hidup

### tokogame.ai.id (direview 12 Nov 2026, catatan di MEMORY.md)

Bukan toko game: generator video AI satu halaman berbasis NexaBot. Yang
relevan untuk Tier 3:

- Harga **eceran** (bukan tarif API — jangan dicampur): 720p Rp520/scene,
  1080p Rp680/scene, VO Rp200, storyboard gratis; top-up min Rp5.000 via
  QRIS. Harga eceran ini membuktikan ada margin di atas tarif API Rp300:
  satu scene 1080p dijual Rp680 terhadap biaya API ±Rp300.
- Alur Manual vs Otomatis-nya jadi pembanding, tapi Tier 3 tetap mengikuti
  konsep v2.1, bukan meniru situs itu. 12 masalah UI/UX situs itu sudah
  dicatat terpisah dan bukan urusan Tier 3.

### PAWARNA DramaMaker (aplikasi BYOK pihak ketiga, dibaca 12 Nov 2026)

- Menyambung **langsung ke "Nexabot Omni Flash" dengan kunci pengguna
  sendiri** (pola BYOK yang sama dengan yang dibangun Tier 3).
- Biaya **0,3 kredit per PART 15 detik** — cocok dengan tarif beranda
  (Rp300) dan memberi satuan durasi video: **15 detik per generate**.
- Menyebut mode **"Nexabot sfv/i2v"** (start-frame-video / image-to-video):
  video NexaBot memakai gambar pertama sebagai acuan — sama seperti
  image-to-video Higgsfield/Flow2API, jadi penyambungan ke jalur video
  KenStory tidak butuh bentuk baru.

### Pertanyaan terbuka soal durasi video

- Beranda: video alat web s.d. **10 detik**.
- PAWARNA + tokogame.ai.id: klip/PART **15 detik**.
- Katalog Tier 3 memakai durasi **[15]** (mengikuti dua referensi hidup
  yang memakai API-nya, bukan alat web). Uji live yang menentukan mana
  yang benar; bila API menolak 15 detik, katalog diubah ke [10] tanpa
  menyentuh penyambungan lain (durasi hanya hidup di katalog).

## 3. Yang TIDAK dibangun di Tier 3 dan mengapa

| Tidak dibangun | Alasan |
| --- | --- |
| Suara NexaBot (30+ suara, 9 bahasa) | Suara KenStory sudah ada jalurnya (Gemini TTS, ElevenLabs). Menambah provider suara = permukaan baru (pemilihan suara, biaya per karakter) tanpa kebutuhan dari konsep. |
| Musik NexaBot (10+ genre) | Musik KenStory berasal dari berkas pengguna. Generator musik bukan bagian jalur motion. |
| Paket Unlimited Standard (Rp3.000/hari) | Itu paket langganan harian, bukan tarif per generate. Tier 3 memakai tarif per generate (pay-as-you-go) supaya biaya per batch bisa dihitung pasti sebelum generate. |
| Panggilan live / akun NexaBot | Dilarang gerbang biaya. Semua verifikasi memakai mock. |
| Ekstensi browser / WebSocket | Itu Tier 2 (Fadli/De-Story). NexaBot adalah REST API — tidak butuh ekstensi. |
| Fallback otomatis ke NexaBot | Konsep Bab 14: D dan E tidak pernah dipanggil otomatis. NexaBot hanya jalan bila proyek secara eksplisit memilih model `nexabot:*`. |

## 4. Titik sambung ke KenStory (pola Tier 1/2 yang dipakai ulang)

Dibaca sebelum menulis rencana ini: `src/main/generation.ts` (607 baris),
`src/shared/flow2api.ts`, `src/main/services/flow2api.ts`,
`src/main/services/higgsfield.ts`, `src/main/jobs.ts`, `src/main/settings.ts`,
`src/main/secrets.ts`, `src/main/ipc.ts`, `src/shared/types.ts`,
`src/renderer/src/pages/project/ModelSection.tsx`,
`src/renderer/src/pages/Settings.tsx`, `src/renderer/src/pages/FlowGuideSection.tsx`.

| Titik | Keadaan sekarang | Yang diubah Tier 3 |
| --- | --- | --- |
| `VisualProvider` (`src/shared/manual.ts`) | `auto \| higgsfield \| flow2api \| manual \| extension` | Tambah `nexabot`. `resolveVisualProvider` di `generation.ts` tetap gagal keras untuk nilai tak dikenal. |
| `generateClipImage` / `generateClipVideo` (`generation.ts`) | Cabang `startFlow`/`finishFlow`, `startHiggsfield`/`finishHiggsfield`, `startManualJob` | Tambah cabang `startNexa`/`finishNexa`, mengikuti pola `startFlow`/`finishFlow` (submit → unduh → simpan; antrean; idempotensi per klip). |
| `generateCharacterSheet` (`generation.ts`) | Jalur gambar (Flow2API/Higgsfield) | Cabang NexaBot memakai model gambar yang sama — lembar karakter adalah gambar. |
| `estimateCredits` (`generation.ts`) | Flow2API/manual mengembalikan `null` (tanpa endpoint estimasi); Higgsfield memanggil endpoint estimasi | NexaBot mengembalikan harga **tetap dari katalog** (tanpa panggilan server): gambar Rp150 / Rp100, video Rp300. Harga tampil **sebelum** kunci diisi — justru lebih baik untuk gerbang biaya. |
| `resumeJobs` (`generation.ts`) | Hanya Higgsfield dengan `remote_id` yang dilanjutkan; Flow2API/manual gagal saat restart | NexaBot seperti Higgsfield: job yang sudah terkirim (`remote_id` + payload tersimpan) dilanjutkan polling-nya; yang belum terkirim gagal dan bisa dicoba ulang. |
| Antrean (`src/main/jobs.ts`) | `higgsfield: 3, flow2api: 1, tts: 2, whisper: 1, export: 1` | Tambah `nexabot: 1` — berurutan, supaya biaya berbayar tidak pernah berlipat diam-diam oleh paralelisme. |
| Katalog model (`src/shared/higgsfield.ts` + `src/shared/flow2api.ts`) | `hfModelOptions` menggabungkan model Higgsfield + Flow; `getImageModel`/`getVideoModel`/`fitDuration`/`maxRefs`/`resolutionOptions` sudah menangani banyak provider | Model NexaBot digabung ke daftar yang sama (`isNexaModelId`), supaya pemilih model, estimasi, dan Storyboard tidak butuh jalur khusus. |
| Kunci (`src/main/secrets.ts`) | `PROVIDERS = ['higgsfield', 'gemini', 'elevenlabs', 'openrouter', 'groq', 'custom']`, tersimpan terenkripsi, tidak pernah ke log (D-07) | Tambah `'nexabot'` ke `PROVIDERS` + `PROVIDER_NAMES`. Kunci NexaBot mengikuti aturan yang sama. |
| Pengaturan (`src/main/settings.ts`, `src/shared/types.ts`) | `flow2apiEnabled` + `flow2apiBaseUrl` (default dari `FLOW_DEFAULT_BASE_URL`); `setSettings` hanya menyimpan kunci yang ada di `DEFAULT_SETTINGS` | Tambah `nexabotEnabled: boolean` (default `false`) + `nexabotBaseUrl: string` (default `NEXA_DEFAULT_BASE_URL`). |
| Uji kunci (`src/main/ipc.ts` `settings:testKey`) | Cabang per provider (`elevenlabs` → `eleven.testKey`, dst.) | Tambah cabang `nexabot` → `nexabot.testCredentials`. |
| Uji koneksi (`ipc.ts:307` `flow2api:testConnection` + `api.ts` + `preload`) | Pola IPC 3 tempat (ingat AGENTS.md repo: IPC baru butuh `main/ipc.ts`, `shared/api.ts`, `preload/index.ts`) | Tambah `nexabot:testConnection` di ketiga tempat yang sama. |
| Pemilih model (`ModelSection.tsx`) | `withCosts` + `useEstimate`/`useEstimates` menampilkan "≈ X kredit"; Flow menampilkan "Tanpa estimasi — kredit Google Flow dari langganan AI Pro kamu."; `hasKey` mengecek `provider === 'higgsfield'` | Cabang NexaBot menampilkan **Rupiah** ("≈ Rp300 per video · N klip ≈ RpX"), bukan kredit Higgsfield. Harga dari katalog, tanpa menunggu kunci. `tagFilters` ditambah "NexaBot". |
| Pengaturan UI (`Settings.tsx` `FlowSection`) | Sakelar + URL dasar + tombol uji koneksi + peringatan risiko akun D-16 + tautan panduan | `NexaSection` dengan pola yang sama, tapi peringatannya adalah **peringatan biaya** (berbayar per generate, semua pembelian final tanpa refund), bukan risiko akun. |
| Tutorial (`FlowGuideSection.tsx`, `ManualGuideSection.tsx`) | Tab panduan di Pengaturan | `NexaBotGuideSection.tsx`: cara dapat kunci, tarif, batas, pemecahan masalah, peringatan biaya + gerbang persetujuan, perbandingan jalur A/B/C, uji live 1 klip sebagai gerbang PC. |
| Dokumen | `docs/layanan-ai.md`, `NOTICE.md` | Tambah entri NexaBot di keduanya. |

## 5. Keputusan desain Tier 3

- **D3-01 — Transport terisolasi, asumsi berlabel.** Semua yang belum
  terverifikasi soal API NexaBot hidup di **satu modul**
  `src/main/services/nexabot.ts`, dalam satu blok konfigurasi
  (`NEXA_API`: alamat dasar, path endpoint, skema auth). Bentuk yang
  diasumsikan (hipotesis terbaik, **bukan fakta**): REST v1, alamat bawaan
  `https://api.nexabot.id` (bisa diubah di Pengaturan), auth
  `Authorization: Bearer <kunci>`, endpoint khusus per modalitas
  (`POST /v1/images/generations`, `POST /v1/videos/generations` → async
  `{id, status}` → poll `GET /v1/videos/{id}`), probe `GET /v1/models`.
  OpenAI-compat **tidak** diklaim untuk NexaBot. Mock mengimplementasikan
  bentuk yang sama, sehingga semua penyambungan terverifikasi; modul
  transport adalah bagian yang wajib dikonfirmasi/dikoreksi di uji live PC.
  Bila API nyata ternyata OpenAI-compatible, yang diganti hanya modul ini.
- **D3-02 — Katalog (`src/shared/nexabot.ts`).** Tiga model, harga tetap:
  gambar `nexabot:nano-banana-pro` (Nano Banana Pro, 0,15 kredit =
  Rp150, referensi maks 3), `nexabot:gpt-image-2.5` (GPT Image 2.5, 0,1
  kredit = Rp100, referensi maks 1); video `nexabot:omni-flash-1.2`
  (Omni Flash 1.2, 0,3 kredit = Rp300 per generate, input gambar pertama,
  durasi [15]). `maxRefs` dan durasi adalah asumsi katalog (lihat §2) —
  bila uji live membuktikan lain, yang berubah hanya katalog.
  Model NexaBot **bukan** default aplikasi; default tetap Higgsfield.
- **D3-03 — Tidak ada fallback otomatis.** NexaBot hanya jalan bila proyek
  memilih model `nexabot:*`. Bila model NexaBot dipilih tapi kunci belum
  diisi → gagal keras dengan pesan jelas ("Isi kunci NexaBot di Pengaturan"),
  bukan jatuh diam-diam ke provider lain. Alasan: pilihan berbayar tidak
  boleh diganti tanpa sepengetahuan pengguna.
- **D3-04 — Estimasi biaya dari katalog, tanpa panggilan server.**
  `estimateCredits` untuk NexaBot mengembalikan harga tetap; `CreditEstimate`
  yang dipakai ulang adalah `{credits, usd}` dengan `credits` = kredit
  NexaBot dan `usd: null` (harga dalam Rupiah, bukan dolar). Pemilih model
  menampilkan Rupiah (Rp1.000 per kredit, format `id-ID`), bukan "kredit".
- **D3-05 — Gerbang persetujuan biaya (dua lapis).** (a) Satu klip: harga
  per model sudah tampil di pemilih model sebelum tombol generate ditekan —
  klik itu sendiri adalah persetujuan untuk satu klip itu. (b) Batch
  (generateMissingImages/Videos): bila ada adegan yang memakai model
  NexaBot, sebelum satu job pun dimulai tampil ringkasan biaya (jumlah
  klip × harga per klip = total Rp) dan menunggu konfirmasi eksplisit;
  batal = tidak ada job yang dimulai, tidak ada kredit terpotong. Ini
  panel ringkasan biaya yang diminta konsep Bab 14.
- **D3-06 — Kunci BYOK terenkripsi.** Kunci NexaBot disimpan lewat
  `secrets.ts` seperti kunci lain (amplop `KS1:`, tidak pernah ke log).
  `testCredentials` memakai panggilan terautentikasi termurah yang
  didokumentasikan API (bila tidak ada endpoint estimasi seperti
  Higgsfield, memakai probe `GET /v1/models` — diputuskan saat transport
  ditulis, dicatat di modul). Pesan galat ramah berbahasa Indonesia:
  401 → kunci tidak valid; 402/403 → kredit tidak cukup; 429 → batas
  rate (bisa dicoba lagi); 5xx → server bermasalah (bisa dicoba lagi).
- **D3-07 — Antrean berurutan + resume.** Queue `nexabot` limit 1.
  Video async: submit mengembalikan id jarak jauh, polling dengan backoff
  seperti `higgsfield.waitForResult` (mulai 2 dtk → maks 10 dtk, timeout
  20 menit). `Idempotency-Key` per submit seperti Higgsfield. Upload
  referensi: bila API butuh URL publik untuk gambar pertama, memakai pola
  presigned-upload Higgsfield (`uploadFile`) — bila ternyata API menerima
  data URI/base64 langsung, itu yang dipakai; diputuskan di transport.
- **D3-08 — Mock dulu, live belakangan.** Seperti Higgsfield
  (`STUDIO_HF_BASE`), transport membaca `STUDIO_NEXA_BASE` di build
  pengembangan untuk mengarah ke mock lokal. Semua uji VM memakai mock.
  Tidak ada panggilan ke `api.nexabot.id` dari VM.
- **D3-09 — Suara/musik tidak dibangun** (lihat §3).
- **D3-10 — Tutorial di dalam aplikasi + dokumen.** `NexaBotGuideSection`
  (Bahasa Indonesia) + entri `docs/layanan-ai.md` + `NOTICE.md`. Tutorial
  wajib memuat: cara dapat kunci (dashboard NexaBot, top-up), tabel tarif
  terverifikasi (§1), peringatan "semua pembelian final, tanpa refund",
  cara kerja gerbang biaya, perbandingan jalur A (Flow2API, gratis) / B
  (Manual, gratis) / C (NexaBot, berbayar), pemecahan masalah, dan uji live
  1 klip sebagai gerbang PC.

## 6. Rencana implementasi (menuju 50/100, lalu 80/100)

Urutan kerja, per kelompok maksud (satu commit per kelompok, mengikuti
skill `commit`):

1. **Katalog + tipe** — `src/shared/nexabot.ts` (baru): `NEXA_MODELS`,
   `NEXA_DEFAULT_BASE_URL`, `isNexaModelId`, `getNexaImageModel`,
   `getNexaVideoModel`, harga Rupiah per model, `nexaPriceIdr(modelId)`.
   `src/shared/manual.ts`: tambah `'nexabot'` ke `VisualProvider`.
   `src/shared/types.ts`: tambah `nexabotEnabled`, `nexabotBaseUrl` ke
   `AppSettings`.
2. **Transport + mock** — `src/main/services/nexabot.ts` (baru): klien
   mengikuti pola `higgsfield.ts` (`submit`, `getStatus`, `waitForResult`,
   `testCredentials`, galat ramah Indonesia) + `STUDIO_NEXA_BASE`.
   Mock server lokal (skrip di `scripts/` atau dev harness) yang
   mengimplementasikan bentuk asumsi D3-01: `GET /v1/models`,
   `POST /v1/images/generations` (balas URL data URI), `POST
   /v1/videos/generations` (balas id → status `completed` + URL mp4
   fixture setelah 1–2 poll).
3. **Penyambungan inti** — `src/main/generation.ts`: cabang `nexabot` di
   `generateClipImage`/`generateClipVideo`/`generateCharacterSheet`
   (`startNexa`/`finishNexa`), `estimateCredits` (harga katalog),
   `resumeJobs` (lanjutkan polling `remote_id`); `src/main/jobs.ts`:
   antrean `nexabot` limit 1; `src/main/settings.ts`: default baru;
   `src/main/secrets.ts`: provider `'nexabot'`; `src/main/ipc.ts` +
   `src/shared/api.ts` + `src/preload/index.ts`: `nexabot:testConnection`
   + cabang `settings:testKey`.
4. **UI** — `ModelSection.tsx`: cabang Rupiah + tag "NexaBot" + `hasKey`
   untuk `'nexabot'`; `Settings.tsx`: `NexaSection` (sakelar, URL dasar,
   uji koneksi, peringatan biaya, tautan panduan) + tab panduan;
   `NexaBotGuideSection.tsx` (baru); Storyboard batch: ringkasan biaya +
   konfirmasi sebelum batch NexaBot (D3-05b) — lokasi persis tombol batch
   ditentukan saat implementasi.
5. **Dokumen** — `docs/layanan-ai.md` + `NOTICE.md` (entri NexaBot).
6. **Verifikasi (tanpa live)** — `npm run typecheck` lalu `npm run build`
   bersih; service-test klien terhadap mock (submit → poll → unduh,
   galat 401/402/429/5xx, estimasi katalog, kunci belum diisi → gagal
   keras); e2e harness: proyek demo memakai model NexaBot (mock) end-to-
   end; regresi ekspor demo+P30 terhadap baseline (demo mp4 `1e348c47…` /
   srt `f403c5ec…`, P30 `5bcf2ec7…` / `6aa500d6…`; ingat jitter ekor audio
   AAC demo yang sudah diketahui — bukan regresi).
7. **Verifikasi independen (80/100)** — satu subagent verifikator memeriksa
   ulang semua klaim dari bukti mentah (tarif vs beranda nexabot.id,
   penyambungan vs kode, mock vs bentuk asumsi, regresi vs hash baseline).
   Verifikator tidak spawn subagent lagi.

## 7. Daftar periksa uji live PC (gerbang Bos, bukan bagian Tier 3 ini)

Dilakukan di laptop Bos, dengan kunci Bos sendiri, 1 klip, sesudah
persetujuan biaya per pemakaian. Yang harus dikonfirmasi/dikoreksi:

1. Alamat dasar API yang benar (`https://api.nexabot.id` atau lain) dan
   apakah `GET /v1/models` merespons.
2. Skema auth yang benar (Bearer atau lain) dan format kunci.
3. Path + bentuk request/response gambar dan video yang benar; apakah
   video async (poll) atau sinkron.
4. Durasi video per generate: 10 detik atau 15 detik.
5. Dukungan referensi gambar (jumlah maks, URL publik vs base64).
6. Pesan galat nyata untuk 401/402/429; ada/tidaknya endpoint saldo.
7. Biaya nyata yang terpotong untuk 1 gambar + 1 video vs tabel §1.
8. Bila salah satu gagal → koreksi modul transport (D3-01) saja; bila
   gagal total/kena 429/ban → jalur C dihentikan, kembali ke Manual
   (seperti aturan go/no-go G3 untuk tier 1).

## 8. Status

- **20/100 — studi + pemetaan selesai (12 Nov 2026).** Dokumen ini +
  tarif terverifikasi dari sumber primer + keputusan desain D3-01–D3-10
  + rencana implementasi §6.
- Berikutnya: implementasi §6 langkah 1–6 → 50/100; tutorial +
  verifikasi independen → 80/100; penutup (branch siap merge + backup +
  laporan) → 100/100. **Tanpa merge/push tanpa perintah Bos.**
