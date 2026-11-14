# Pemetaan opsi transkrip Groq → KenStory (0.6)

Tanggal: 14 Nov 2026. Cabang: `0.6-transkrip-groq` (dari main `4281623`).
Status: studi + pemetaan — sebelum implementasi.

Perintah Bos (14 Nov 08:31 WIB): bangun opsi transkrip via Groq API (gratis,
kelas large-v3) untuk KenStory. Latar: mode Talking Head (Fase 5, sudah di
main) hari ini HANYA punya transkrip Whisper Small lokal. Opsi Groq adalah
alternatif cloud — bukan pengganti lokal. Uji coba live (Groq large-v3 + LLM
API via Google Bos) adalah langkah terpisah SESUDAH implementasi ini, bukan
bagian dari tugas ini.

Aturan kerja yang mengikat tahap ini: **tanpa panggilan live berbayar, tanpa
kunci asli, tanpa daftar akun.** Semua verifikasi memakai mock. Pengambilan
kunci Google Bos adalah bagian uji coba nanti, BUKAN tugas ini.

## 1. Yang terverifikasi dari sumber utama

### Groq Speech-to-Text (console.groq.com/docs/speech-to-text, dibaca 14 Nov 2026)

- Endpoint transkripsi: `POST https://api.groq.com/openai/v1/audio/transcriptions`
  (OpenAI-compatible; endpoint terjemah terpisah, tidak dipakai).
- Model yang tersedia (keduanya masih tercantum di dokumen resmi):
  | Model ID | Biaya/jam audio | WER | Keterangan dokumen |
  |---|---|---|---|
  | `whisper-large-v3` | $0,111 | 10,3% | Akurasi tertinggi, multibahasa, dukung transkripsi + terjemah |
  | `whisper-large-v3-turbo` | $0,04 | 12% | Varian Large V3 yang dipangkas, harga/kinerja terbaik |
- **Model yang dipakai: `whisper-large-v3`** — ini model "large v3" harfiah
  yang Bos minta, dan masih tersedia. Turbo adalah alternatif yang lebih
  murah/cepat, BUKAN yang dipakai (keputusan G6-02). Bila Groq suatu hari
  menghapus `whisper-large-v3`, transport gagal-tertutup dengan pesan jelas
  — tidak ada ganti model diam-diam.
- Format respons: `json`, `verbose_json`, `text`. `timestamp_granularities`
  HANYA berlaku bila `response_format` = `verbose_json`; nilainya `segment`,
  `word`, atau keduanya. `word` mengembalikan kata + `start` + `end` per kata.
- Parameter: `file` (wajib bila tanpa `url`), `model` (wajib), `language`
  opsional ISO-639-1 (mempercepat + mempertajam), `prompt` opsional (maks 224
  token), `temperature` bawaan 0, `timestamp_granularities[]` bawaan `segment`.
- Batas ukuran: **25 MB (tier gratis)**, 100 MB (tier dev). Panjang minimum
  0,01 dtk; minimum yang ditagih 10 dtk. Tipe berkas: flac, mp3, mp4, mpeg,
  mpga, m4a, ogg, wav, webm. Hanya trek audio pertama yang ditranskrip.
- Groq menurunkan audio ke 16 kHz mono sendiri — persis format audio hasil
  ekstraksi KenStory (WAV 16 kHz mono), jadi tidak ada konversi tambahan.
- Tidak ada endpoint streaming/realtime, tidak ada diarization.

### Yang sudah ada di kode dan dipakai ulang

| Titik | Keadaan sekarang | Dipakai ulang |
| --- | --- | --- |
| Transkrip lokal (`src/main/whisper.ts` `recognize`) | Whisper Small lokal (487 MB), `-ml 1 -sow -ojf -nfa -dtw small`, tanpa `--prompt`, audio WAV 16 kHz mono | Tetap jadi provider bawaan; pola normalisasi kata dipakai ulang |
| Alur transkrip (`src/main/talkinghead.ts` `transcribeFootage`) | Job `transcribe` → `recognize` → `meta.words` + `droppedWordIndexes` + `timedBy` → ringkasan | Groq masuk sebagai cabang pengenal kata yang sama: hasil akhirnya tetap `WordTiming[]` di `meta.words` |
| Aturan potong/susun (`src/shared/talkinghead.ts`) | `computeCuts`, `keptRuns`, `arrangeDeterministic`, `normalizeSceneDefs`, `sceneWordsRebased` — semuanya hanya membaca `meta.words` | Tidak berubah: kata Groq mengalir ke alur yang sama |
| Kunci Groq (`src/main/secrets.ts` + `services/llm.ts`) | Provider `groq` sudah ada; kunci tersimpan terenkripsi (`KS1:`), dibaca lewat `getSecret('groq')`; base LLM Groq `https://api.groq.com/openai/v1` | Kunci yang SAMA dipakai ulang untuk transkrip — tanpa penyimpanan kunci kedua |
| Pola transport + mock (Tier 4) | `services/kieai.ts` (`STUDIO_KIE_BASE` di dev, `guard()` anti-bocor kunci, `friendlyError`) + `mock-kieai.mjs` | Pola yang sama untuk transport Groq + `mock-groq.mjs` |
| Pola uji koneksi (Tier 1/3) | `flow2api:testConnection`, `nexabot:testConnection` (probe `GET /v1/models`) | `talkinghead:testGroq` memakai `GET /openai/v1/models` |

## 2. Keputusan desain (G6-01–G6-10)

- **G6-01 — Pilihan provider eksplisit.** `transcriptProvider: 'local' |
  'groq'` di `AppSettings`, bawaan `'local'`. Disimpan lewat tabel settings
  key/value yang sudah ada (tanpa migrasi DB — kunci baru jatuh ke
  `DEFAULT_SETTINGS`, pola yang sama dengan setelan lain). Pilihan tampil di
  Pengaturan (seksi Talking Head) DAN di halaman Transkrip (langkah 2).
- **G6-02 — Model tetap `whisper-large-v3`.** Lihat §1: model harfiah yang
  Bos minta, masih tersedia, akurasi tertinggi di kelasnya. Turbo dicatat
  sebagai alternatif yang tidak dipakai.
- **G6-03 — Transport baru `src/main/services/groq-transcribe.ts`.**
  Multipart `POST /audio/transcriptions` dengan `file` (WAV hasil ekstraksi),
  `model=whisper-large-v3`, `language` (ISO-639-1; `jv` → `jw` seperti
  `whisper.ts`), `response_format=verbose_json`, `temperature=0`,
  `timestamp_granularities[]=word`. **Tanpa `prompt`** — alasan yang sama
  dengan lokal (prompt bisa membuat Whisper mengulang frasa). Timeout 300
  dtk. Base URL bisa ditimpa di dev lewat `STUDIO_GROQ_BASE` (pola
  `STUDIO_KIE_BASE`); aplikasi paket selalu memakai `api.groq.com`.
- **G6-04 — Kunci dipakai ulang, bukan disimpan ulang.** Transport menerima
  kunci dari pemanggil (`getSecret('groq')` di `talkinghead.ts`). Bila kunci
  belum tersimpan, transkrip Groq gagal-tertutup: "Kunci Groq belum diisi.
  Isi kunci Groq di Pengaturan › Kunci API dan model." Kunci tidak pernah
  masuk log/pesan galat (`guard()` seperti kieai).
- **G6-05 — Waktu kata langsung dari Groq, tanpa DTW.** `verbose_json`
  mengembalikan `words[]` berisi `{word, start, end}` per kata. Tidak ada
  langkah DTW (DTW hanya diperlukan Whisper lokal). Kata dinormalisasi
  dengan aturan yang sama seperti `recognize`: start hanya maju, `end`
  tidak melewati start kata berikut. `timedBy` baru:
  `'groq-whisper-large-v3'` (konstanta `GROQ_TIMING` di `src/shared/groq.ts`),
  sejajar `WHISPER_TIMING = 'whisper-dtw'`. `estimatedTimings: false`.
- **G6-06 — Tanpa fallback diam-diam antar provider.** Provider dipilih
  pengguna; bila provider yang dipilih gagal, job gagal dengan pesan
  Indonesia yang jelas (401 kunci ditolak · 413 berkas terlalu besar ·
  429 batas kecepatan tier gratis · 5xx server Groq bermasalah). Lokal yang
  gagal tetap gagal seperti sekarang.
- **G6-07 — Batas berkas 25 MB (tier gratis).** WAV 16 kHz mono ≈ 1,9
  MB/menit, jadi batas ini ≈ 13 menit rekaman. Berkas yang lebih besar
  gagal-tertutup dengan pesan yang menyarankan potong rekaman atau pakai
  Whisper lokal. Chunking TIDAK dibangun (lihat §4).
- **G6-08 — Uji koneksi.** IPC baru `talkinghead:testGroq` (3 tempat,
  pola AGENTS.md): `GET /openai/v1/models` dengan kunci tersimpan, lalu
  memastikan `whisper-large-v3` ada di daftar. Membuktikan kunci bekerja
  tanpa mengirim audio dan tanpa biaya.
- **G6-09 — Tampilan biaya + privasi.** Di Pengaturan dan halaman Transkrip:
  Groq tampil sebagai "Gratis (tier gratis Groq)" — $0,111/jam audio hanya
  berlaku bila akun sudah di tier berbayar; batas tier gratis berlaku.
  Panduan menyatakan eksplisit: **audio rekaman dikirim ke server Groq**
  (keluar dari mesin pengguna).
- **G6-10 — Yang TIDAK dibangun di 0.6:** chunking berkas >25 MB, endpoint
  terjemah, diarization, pilihan model di UI (model tetap
  `whisper-large-v3`), transkrip Groq untuk caption TTS di luar mode
  Talking Head (hanya jalur `transcribeFootage`), uji live (gerbang uji
  coba nanti).

## 3. Titik sambung ke KenStory

| Titik | Yang diubah 0.6 |
| --- | --- |
| `src/shared/groq.ts` (baru) | `TranscriptProvider`, `GROQ_DEFAULT_BASE_URL`, `GROQ_TRANSCRIPT_MODEL`, `GROQ_TRANSCRIPT_MAX_MB`, `GROQ_TIMING`, label + perkiraan biaya |
| `src/shared/types.ts` | `AppSettings.transcriptProvider: TranscriptProvider` |
| `src/main/settings.ts` | `transcriptProvider: 'local'` di `DEFAULT_SETTINGS` |
| `src/main/services/groq-transcribe.ts` (baru) | `transcribeWithGroq` (multipart + parse `verbose_json` + normalisasi kata), `testGroqConnection` (`GET /models`), `GroqTranscribeError` (pesan Indonesia) |
| `src/main/talkinghead.ts` | `transcribeFootage` bercabang menurut `getSettings().transcriptProvider`; job `provider` = `'groq'` bila Groq; pesan progres Groq |
| `src/main/ipc.ts` + `src/shared/api.ts` + `src/preload/index.ts` | IPC `talkinghead:testGroq` (3 tempat) |
| `src/renderer/src/pages/Settings.tsx` | Pemilih provider di `TalkingHeadSection` + status kunci Groq + tombol Uji Koneksi + teks biaya/privasi |
| `src/renderer/src/pages/project/TranscriptStep.tsx` | Pemilih provider ringkas di seksi 2 + petunjuk per provider (lokal: status model; Groq: status kunci) |
| `src/renderer/src/pages/TalkingHeadGuideSection.tsx` | Seksi Groq: cara pilih provider, isi kunci sekali, gratis + batas, privasi, pemecahan masalah |
| `docs/layanan-ai.md` | Baris transkrip di tabel Groq + seksi Groq |
| `docs/keputusan-teknis.md` | Entri: provider transkrip + waktu kata Groq tanpa DTW + batas 25 MB |
| Uji (di luar repo) | `mock-groq.mjs`, `groq-transcribe-test-entry.ts`, `test-groq-transcribe-service.mjs`, `harness-groq-transcript.json`, `run-groq-e2e.sh` |

## 4. Daftar periksa uji live (gerbang uji coba nanti, BUKAN bagian 0.6)

Dilakukan sesudah implementasi selesai, dengan opsi Groq large-v3 + LLM API
via Google Bos (kunci diambil induk lewat login Google Bos yang tersimpan,
saat uji coba berjalan — kunci tidak pernah tampil di chat). Yang harus
dikonfirmasi:

1. Transkrip Groq live atas satu rekaman nyata selesai; kata + waktunya
   benar (deviasi dilaporkan apa adanya).
2. Potong jeda/kata pengisi + susun adegan + ekspor dari kata Groq sama
   benarnya dengan jalur lokal.
3. Berkas >25 MB gagal-tertutup dengan pesan yang benar (bukan crash).
4. Kunci Groq yang salah/expired memberi pesan 401 yang benar.
5. Mode lain tidak regresi (demo+P30 byte-identik; proyek lama tetap terbuka).

## 5. Status

- **Pemetaan selesai (14 Nov 2026).** Dokumen ini + keputusan G6-01–G6-10.
- Berikutnya: implementasi §3 → 50/100; tutorial + verifikasi independen →
  80/100; penutup (branch siap merge + backup + laporan) → 100/100.
  **Tanpa merge tanpa perintah Bos.**
