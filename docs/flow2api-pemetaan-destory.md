# Pemetaan De-Story → KenStory — Adopsi Flow2API (tier 1, 0.3+)

Studi De-Story (github.com/ikrammf7/De-Story, HEAD `d894f9e4`, 29 Okt 2026; publik tanpa
LICENSE — ambil POLA saja, jangan salin kode mentah-mentah). Clone referensi:
`~/workspace/fase0-0.2a/de-story-reference/`. Tanggal studi: 12 Nov 2026. Biaya: Rp0.

## 1. Yang dipelajari dari De-Story

### 1.1 Klien Flow2API (`src-tauri/src/services/flow2api.rs`, 894 baris, 13 tes)

- **Endpoint:** `POST {base}/v1/chat/completions` (OpenAI-compatible), `stream: true`.
  Alamat bawaan `http://localhost:8000` (`sanitize_url`, kosong → bawaan).
- **Model gambar** (`flow:`): `gemini-3.1-flash-image` (Nano Banana 2.1),
  `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite), `gemini-3.0-pro-image` (Banana Pro).
  Aspek 16:9/9:16/1:1/4:3/3:4 (nama model akhir ditambah sufiks `-landscape`/`-portrait`/
  `-square`/`-four-three`/`-three-four`); resolusi 1k/2k/4k; prompt maks 4000; referensi
  maks 3/1/2 gambar, dikirim sebagai `image_url` data URI.
- **Model video** (`flow:`): `veo-3.1-fast`, `veo-3.1-quality`, `veo-3.1-lite`,
  `omni-1.1-flash`. Nama model akhir `{model}-i2v-{4|6|8|10}s-{landscape|portrait}`;
  Veo 4/6 dtk, Omni 4/6/8/10 dtk; frame pertama JPEG base64; prompt ditambah
  `Silent clip: no background music, no soundtrack, no singing or humming.`
- **Timeout:** gambar 300 dtk, video 600 dtk, unduh hasil 180 dtk.
- **Uji koneksi:** `GET {base}/health`, gagal → `GET {base}/v1/models`; timeout 8 dtk;
  kunci Bearer opsional.
- **Parsing respons:** SSE (`data: {...}` + `[DONE]`) → JSON biasa → fallback URL/data
  langsung. Galat bisa datang sebagai chunk biasa di stream HTTP 200 — jadi pembaca
  stream yang menemukan alasannya, bukan status HTTP. Pesan reCAPTCHA dibuat ramah
  tanpa menebak penyebab; `reasoning_content` dipakai sebagai petunjuk bila stream
  berhenti tanpa hasil; cuplikan pesan dibatasi 240 karakter; stream mentah tidak
  pernah sampai ke pengguna.
- **Unduh hasil:** data URI (base64) atau URL absolut/relatif terhadap base server.
- **`canonical_flow_id`:** memetakan id lama (mis. `nano-banana-2` →
  `gemini-3.1-flash-image`) supaya proyek lama tetap jalan.

### 1.2 Pool kunci Gemini (`src-tauri/src/services/gemini.rs`, L40–260)

- Pool = secret `gemini` terenkripsi, **satu kunci per baris**; satu kunci = pool berisi 1.
- Rotasi round-robin lewat counter atomik (dua perintah bersamaan tetap dapat kunci
  beda). Klasifikasi gagal: rate-limit/kuota → putar ke kunci berikut; galat lain →
  kembalikan tanpa putar. Kunci disensor dari pesan galat.
- **Daftar suara De-Story HANYA 5 statis** (Puck, Charon, Kore, Fenrir, Aoede) —
  ini yang dikoreksi W1. KenStory TIDAK mengadopsi ini.

### 1.3 Penyambungan (`generation.rs`, `commands/mod.rs`)

- Model id berawalan `flow:` dirutekan ke flow2api; provider tercatat `"flow2api"`.
- Pengaturan: `flow2apiMode` (bundled/external), `flow2apiBaseUrl`
  (bawaan `http://localhost:8000`), secret `flow2api`.
- Runtime bundled: `Flow2ApiManager` menjalankan server Python + Playwright bawaan;
  mode external memakai server pengguna. Perintah admin: status, restart, folder log,
  info panel, info ekstensi, port tetap.

### 1.4 Tutorial De-Story (`README.md` baris 148–287)

- **Ada:** Langkah 0–4 alur produksi (kunci API → ide → naskah → storyboard & visual →
  editor & ekspor, ~40 baris); Integrasi Google Flow & Flow2API (runtime bawaan,
  tabel metode reCAPTCHA 4 baris, Panduan Extension Worker 7 langkah); Keamanan &
  Privasi; Struktur Direktori; Perintah & Skrip.
- **Tidak ada:** prasyarat akun (Google + AI Pro, cara mendapat akses Flow); penjelasan
  cara kerja teknis (alur request → server → Playwright → Flow → tautan → unduh);
  batas/kredit (angka kredit per model, limit harian/bulanan); pemecahan masalah
  (generate gagal, 429, CAPTCHA, timeout, server mati); penjelasan pool kunci;
  perbandingan jalur A/B/C; peringatan risiko akun (upstream tanpa disclaimer);
  uji live 1 klip (G3).

## 2. Yang diadopsi sebagai pola

| Pola De-Story | Bentuk di KenStory | Catatan |
|---|---|---|
| Klien OpenAI-compatible (endpoint, SSE, ekstraksi media) | `src/main/services/flow2api.ts` — tulis ulang TypeScript, bukan salin Rust | Konsep Bab 4/11: klien di dalam aplikasi; server dijalankan pengguna, tidak dibundel |
| Katalog model `flow:` + aspek/resolusi/durasi | `src/shared/flow2api.ts` (tipe `HfModel`); `getImageModel`/`getVideoModel` fall-through untuk id `flow:` | Picker yang ada langsung menampilkan model Flow; aturan pratinjau=ekspor tetap karena model hidup di `shared/` |
| Uji koneksi (`/health` → `/v1/models`, 8 dtk) | IPC `flow2api:testConnection` + tombol Uji Koneksi di Pengaturan | Konsep Bab 11/14 |
| Pesan galat ramah (reCAPTCHA, error chunk, cuplikan 240 karakter) | Sama, teks Indonesia | Pola terbukti; jangan menebak penyebab |
| Rute via prefix `flow:`, provider tercatat `flow2api` | `generation.ts`: bila `model.id` diawali `flow:` → jalur Flow2API | Sama seperti `generation.rs` De-Story |
| Tutorial di README | Tutorial DI DALAM APLIKASI (halaman panduan) + `docs/` | Persyaratan Bos 12 Nov 09:03 |
| Pool kunci Gemini (satu per baris, rotasi, sensor) | Tidak diubah di tier 1: secret `gemini` KenStory dipakai apa adanya untuk LLM/TTS; Flow2API tidak memakai kunci Gemini langsung (server Flow2API yang memakai akun Google pengguna) | Pool relevan untuk LLM/TTS, bukan untuk Flow2API |

## 3. Yang TIDAK diadopsi dan mengapa

- **Runtime Flow2API bawaan** (Python Standalone + Playwright dibundel,
  `Flow2ApiManager`, `flow2api:stage`/`flow2api:smoke`) → server dijalankan pengguna,
  tidak dibundel (konsep Bab 4). Membundel Python + Chromium membesarkan installer
  dan menambah permukaan perawatan; tanpa server pun aplikasi tetap berfungsi penuh.
- **Extension Worker** (ekstensi Chrome + WebSocket loopback) → itu jalur B (Fadli),
  BUKAN tier 1; dikerjakan terpisah di 0.3 tingkat 2.
- **5 suara statis De-Story** → W1: KenStory mempertahankan daftar suara live API +
  fallback 60. Suara tidak disentuh tier 1.
- **Penyusutan editor De-Story** (tanpa potong klip, tanpa lepas audio, tanpa edit kata
  caption, 4 tab, tanpa gerak kamera, Whisper tanpa DTW, FFmpeg tidak terbundel) →
  putusan Bos 8 Nov 2026: TIDAK ADA yang dikorbankan; editor, suara, Whisper, dan
  FFmpeg tetap versi KenStory utuh.
- **Tauri/Rust** (commands, `secrets.rs` DPAPI, protokol `studio://`) → KenStory
  Electron + TypeScript; padanannya sudah ada (`secrets.ts`, `ipc.ts`).
- **Layanan captcha berbayar** (`yescaptcha`/`capsolver`/`2captcha`) dan
  `flow2api_team` → berbayar / pihak ketiga; tier 1 gratis saja. Metode `browser`/
  `extension` dibahas di tutorial sebagai info, tanpa kunci berbayar.
- **Salin kode** → De-Story tanpa LICENSE: ambil POLA saja, tulis ulang; atribusi
  De-Story dicatat di `NOTICE.md`/`docs` (bukan salin kode).

## 4. Perbandingan tutorial — patokan yang harus dilampaui

| Topik | De-Story | KenStory (rencana) |
|---|---|---|
| Alur produksi langkah demi langkah | Ada (Langkah 0–4) | Ada, dipersempit ke visual Flow2API (bukan seluruh alur produksi) |
| Prasyarat (akun Google, AI Pro, akses Flow, kunci Gemini) | Tidak ada | Ada, lengkap + cara mendapatkannya |
| Menjalankan server Flow2API sendiri | Singkat (runtime bawaan otomatis) | Ada, langkah demi langkah (unduh flow2api, jalankan, port, cek `/health`) |
| Menghubungkan KenStory (alamat server, Uji Koneksi, kunci opsional) | Ada (hanya Extension Worker) | Ada (jalur A server + Uji Koneksi + status) |
| Cara kerja teknis (alur request, SSE, ekstraksi media, unduh) | Tidak ada | Ada (diagram alur + penjelasan tiap langkah + timeout) |
| Model & kredit (Lite 10 / Fast 20 / Quality 100, limit AI Pro) | Tidak ada | Ada, dengan peringatan angka bisa berubah |
| Batas & limit (durasi, resolusi, aspek, prompt) | Sebagian (di katalog model saja) | Ada (tabel per model) |
| Pemecahan masalah (server mati, 429, reCAPTCHA, timeout, hasil kosong) | Tidak ada | Ada (tabel gejala → penyebab → langkah) |
| Keamanan & risiko akun (D-16/D-19, uji live 1 klip G3) | Tidak ada (upstream tanpa disclaimer) | Ada (peringatan tertulis sebelum menyalakan + uji live 1 klip wajib) |
| Perbandingan jalur A/B/C + kapan pindah jalur | Tidak ada | Ada |
| Pool kunci Gemini (rotasi, sensor) | Tidak ada (hanya di kode) | Ada (penjelasan singkat, relevan untuk LLM/TTS) |

## 5. Keputusan desain tier 1 (untuk implementasi)

- **Server Flow2API eksternal**, dijalankan pengguna; aplikasi TIDAK membundel dan
  TIDAK menghidup-matikan; tanpa server, aplikasi tetap berfungsi penuh
  (Higgsfield/manual tetap jalan).
- **Flow2API default MATI** (`flow2apiEnabled: false`); menyalakan butuh mencentang
  peringatan risiko tertulis (D-16). Keputusan akun (**D-19**) DITUNDA ke Fase 2 —
  tutorial menyatakan itu apa adanya, bukan diputus diam-diam.
- **Model Flow muncul di picker yang sama** (`ModelSection`, lewat `hfModelOptions`);
  proyek memilih model per proyek (`imageModel`/`videoModel`); timpa per adegan
  mengikuti pola konsep (cek saat implementasi apakah picker per adegan sudah ada;
  bila belum, catat sebagai batas, jangan membangun picker baru diam-diam).
- **Antrean kerja `flow2api` limit 1** (konkurensi 1; konsep mengizinkan 1–2 dengan
  peringatan — mulai dari 1).
- **Estimasi kredit Flow: null** (tidak ada endpoint estimasi) — picker menampilkan
  tanpa estimasi; angka kredit ada di tutorial sebagai info.
- **Referensi gambar** untuk Flow dikirim sebagai data URI (byte dari disk), bukan URL
  publik seperti Higgsfield — Flow tidak butuh URL publik, jadi tanpa unggah.
- **Video Flow** butuh frame pertama: byte gambar klip dari disk (sudah ada — klip
  tanpa gambar tidak bisa jadi video, sama seperti Higgsfield).
- **Uji: mock server lokal** (tanpa panggilan live ke Google Flow). Uji live 1 klip
  ditulis sebagai langkah PC Bos (gerbang G3), bukan diuji di VM.
- **Yang tidak disentuh:** suara/TTS (`gemini.ts`, `elevenlabs.ts`), Whisper/caption,
  exporter/FFmpeg, `NOTICE.md`/`LICENSE` (selain menambah atribusi De-Story bila
  diputuskan), dan semua provider lain.
