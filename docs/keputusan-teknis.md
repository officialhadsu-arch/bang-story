# Keputusan teknis

Catatan kenapa sesuatu dibuat begitu. Sebagian besar lahir dari bug nyata, jadi baca dulu sebelum mengubah
bagian terkait. Tambahkan entri baru di akhir setiap kali membuat keputusan penting.

### Narasi direkam satu kali utuh, lalu dipotong per adegan
TTS yang dipanggil per klip menghasilkan suara dan intonasi yang berbeda-beda. Satu rekaman utuh lalu dipotong
membuat suaranya konsisten. Jangan menambah tombol "buat suara" per klip.

### Whisper tanpa `--prompt`, dengan DTW
Naskah yang dikirim sebagai prompt membuat Whisper berhalusinasi: dalam uji coba, Whisper mengulang "tidak tidak
tidak..." puluhan kali. Caption klip 1 selesai 2 detik lebih cepat dari suaranya, dan kata-kata awal klip lain
tertumpuk di detik 0. Waktu per kata bawaan whisper.cpp juga kurang presisi. Dari tiga cara yang diuji,
`-nfa -dtw small` tanpa prompt paling akurat: caption hanya meleset sekitar 0,1–0,2 detik dari suara (diuji pada
proyek nyata). Ejaan caption tetap dari naskah (`align.ts`); dari Whisper hanya diambil waktunya.

### Potongan adegan mengikuti kata
Dengan Whisper, adegan dipotong di jeda antara kata terakhir satu adegan dan kata pertama adegan berikutnya
(`cutsFromWords`), jadi potongan tidak pernah jatuh di tengah kata. Tanpa waktu kata, `chooseCuts` memilih dari
jeda yang dideteksi FFmpeg. Gemini diberi `<long pause>` di antara adegan supaya jedanya jelas. ElevenLabs
memakai waktu kata dari API-nya sendiri.

### Sorotan caption bertahan di jeda antar kata
Di jeda antar kata, sorotan tetap di kata terakhir yang sudah diucapkan (`captionAt`), sama seperti ekspor.
Dulu sorotan lompat ke kata terakhir baris lalu balik lagi, sehingga terlihat berkedip.

### Segmen ekspor dibulatkan ke frame + 2 frame cadangan
`xfade` menghentikan seluruh video kalau klip pertama habis sebelum offset transisi. Dengan transisi `cut`
(1 frame) dan durasi klip yang tidak pas di frame, gambar video pernah berhenti setelah klip 1 sementara audio
tetap jalan. `planSegments` membulatkan awal klip ke frame utuh dan menambah 2 frame cadangan.

### Gerak kamera di ekspor memakai filter `perspective`, bukan `zoompan`
`zoompan` membulatkan potongan gambar ke piksel bulat setiap frame, sehingga gerak lambat bergoyang 0,6–0,7 px
per frame (terlihat bergetar, terutama garis tipis). `perspective` (sense=source, cubic) bergerak pecahan piksel:
getarannya 0,02–0,16 px dengan kecepatan hampir sama. Gambar diproses di resolusi aslinya (1×–2× output) lalu
diperkecil, supaya tetap tajam. Catatan: penghitung frame `perspective` mulai dari 1, jadi rumusnya memakai `(on-1)`.

### Kotak caption rounded digambar sendiri
libass hanya bisa membuat kotak bersudut siku. Kotak rounded digambar sebagai drawing ASS di layer bawah teks.
Lebarnya dihitung dari metrik file font (`fontMetrics.ts`), dan baris dipecah dengan fungsi yang sama dengan
pratinjau (`layoutCaptionLines`).

### Ukuran caption memakai metrik `cell` per font
libass mengukur ukuran font dengan winAscent+winDescent, CSS dengan em. Tanpa konversi, caption di ekspor hanya
sekitar 57% ukuran pratinjau. Setiap font di `CAPTION_FONTS` punya nilai `cell` hasil pengukuran file TTF-nya.

### Pratinjau menjaga tiga klip tetap terpasang
Membuat elemen `<video>` baru setiap pindah klip sempat menampilkan frame pertama video (atau poster) sebelum
seek. Akibatnya ada kilasan di sambungan potongan dan di transisi. Klip sebelum/sekarang/sesudah selalu
terpasang dalam urutan timeline. Klip berikutnya menunggu di titik mulainya, dan langsung diputar tanpa seek
ulang (seek ulang menahan video sekitar 150 ms).

### Video overlay hardware dimatikan
Di Windows, Chromium menyerahkan video ke overlay hardware (DirectComposition) yang membulatkan posisi dan
ukuran ke piksel bulat. Gerak kamera di atas video jadi gemetar di pratinjau, padahal gambar halus.
Switch `disable-direct-composition-video-overlays` dan opasitas 0,999 untuk video yang bergerak menahan video
di jalur render biasa. (Pemilik aplikasi masih melihat getaran di pratinjau; lihat masalah-diketahui.md.)

### Suara milik klipnya ("klip tertaut")
Seperti suara bawaan klip video di editor lain: suara bisa dipotong dan digeser di dalam klip, dan terpotong di
akhir klip. Ini menjaga sinkron naskah per adegan dan rekam ulang narasi tetap sederhana.

### Potong klip ikut membelah suara dan naskah
Saat klip dibelah, file suara dipotong di jeda antar kata terdekat, dan teks narasinya dibagi
(`splitNarration`). Dengan begitu tiap bagian punya aset dan naskah yang cocok (tidak dianggap basi), dan bisa
direkam ulang sendiri. Bagian pertama diberi transisi `cut` agar sambungannya mulus.

### Panel Transisi, bukan popup
Popup di timeline menutupi pratinjau, padahal pengguna ingin melihat contoh transisinya. Tombol sambungan
membuka panel di kanan, lalu pratinjau memutar sambungan itu berulang-ulang (audition).

### Prompt visual berlabel dan baris Wardrobe
Model gambar tidak membaca naskah. Prompt yang kurang spesifik menghasilkan latar Bumi dan alien untuk cerita di
Mars, dan baju astronot di semua adegan. Setiap prompt kini menyebut dunia/era dengan jelas, orang disebut
"human", dan baju per adegan ditulis di baris `Wardrobe` (bawaan lembar karakter atau custom).

### Prompt video selalu melarang musik
Beberapa model video (Veo, Grok, MiniMax) membuat musik sendiri tanpa saklar. Setiap prompt diakhiri `NO_MUSIC`,
dan audio dimatikan lewat parameter kalau modelnya punya. Audio dari file video tidak pernah dipakai di ekspor.

### Kunci API dienkripsi safeStorage, kunci kripto dibuat saat startup
Kunci kriptografi `safeStorage` baru tertulis ke `Local State` sekitar 10 detik setelah dibuat. Membuatnya saat
startup (`warmUpEncryption`) mencegah kunci API tidak terbaca setelah aplikasi ditutup paksa.

### YouTube embed diberi Referer berisi ID aplikasi
Halaman dari `file://` tidak mengirim Referer, dan YouTube menolak embed tanpa identitas (Error 153). Header
ditambahkan hanya untuk `https://www.youtube.com/embed/*`.

### D-21: kontrak babak motion (Fase 4)
Babak motion adalah `index.html` + `style.js` + `act-*.js` + `beats.json`, dengan waktu dari kata narasi (bukan
tebakan agent). `window.OPENER` wajib punya `ready`, `DURATION`, `clipsReady`, dan `seek(t)`; `seek` harus
deterministik (murni fungsi dari `t`) supaya render penuh dan render rentang menghasilkan frame yang sama (S1d).
Caption milik aplikasi (default mati di adegan motion); halaman motion tidak menggambar caption sendiri.

### D-22: jalur render motion (Fase 4, diputus spike 4.0)
Jalur utama (bersyarat): jendela tersembunyi + `useContentSize`, ukuran dipaksa dari konfigurasi (D-11), verifikasi
frame pertama, settle 50 ms + double-verify (W7). Cadangan: Puppeteer (dependensi opsional, tidak terpasang).
Offscreen ditolak sebagai jalur produksi (flaky) dan hanya dipakai sebagai pembanding spike. Yang memutus final
adalah spike 4.0: S1d 20/20 DAN ukuran sesuai konfigurasi; bila lebih dari satu jalur lolos, pilih RAM terendah
dengan metode pohon proses (bukan RSS proses tunggal).

**Putusan final spike 4.0 (VM, 13 Nov 2026, fixture minimal tanpa GSAP):** landscape 1280×720 — hidden
MENANG (S1d 20/20 tiga kali — log lari r1/r2/r3: `run-fase4-spike-r1/r2/r3.log`, 0 mismatch, frame pertama tepat, RAM renderer ±88–89 MB; waktu 60 frame berisik antar lari — hidden 15,1–37,6 dtk vs offscreen 15,9–38,7 dtk — jadi kecepatan bukan penentu); offscreen juga lolos S1d dengan perbaikan W7 tapi tidak lebih hemat RAM dan punya riwayat flaky, jadi tetap ditolak sebagai jalur produksi. **Potret 9:16 — kedua jalur Electron GAGAL di layar
landscape** (frame pertama 1080×1080, bukan 1080×1920: jendela hidden terjepit ke tinggi layar 1080 — display-bound, Xvfb 1920×1080; di layar
portrait 1080×1920 offscreen memberi 1079×1919 — kurang 1 px di kedua sumbu, off-by-one, bukan jepitan layar — dan D-11 menghentikan
render dengan benar di kedua kasus, bukan menghasilkan video berukuran salah). **Puppeteer LULUS 9:16** (1080×1920 tepat,
deterministik, ganti adegan bekerja; headless, tanpa layar) — jadi Puppeteer WAJIB untuk potret sampai ada jalur
Electron yang terbukti display-independent. Delta installer Puppeteer: ±684 MB (Chrome penuh) atau ±282 MB
(headless-shell saja) + 8,2 MB puppeteer-core. Intermediate tetap PNG bawaan (JPEG q90 lebih cepat tangkap
7,3 dtk vs 9,0 dtk tapi video +11% pada fixture warna datar dan berisiko artefak di tepi teks — PNG lossless
lebih aman untuk konten vektor datar). Angka RAM di atas adalah lantai (fixture satu div) — babak GSAP asli
harus diukur ulang di gerbang PC. E(3) — lari S3 v2 di laptop Bos — tetap gerbang PC.
### Talking Head: audio rekaman diekstrak sekali, trek audio file video tidak dipakai (F5-07)
Sama seperti aturan "audio dari file video tidak pernah dipakai di ekspor" di atas, tapi di mode Talking Head
ini disengaja dan struktural: saat impor, audio rekaman diekstrak sekali jadi WAV 16 kHz mono, dan semua suara
adegan dipotong dari ekstraksi itu. Eksporter tidak pernah membaca trek audio file video mana pun. Alasannya:
transkrip Whisper, potongan, dan caption semuanya hidup di atas ekstraksi yang sama, jadi satu sumber waktu
untuk kata, potongan, dan suara.

### Talking Head: adegan adalah file video + audio sendiri, bukan rentang (F5-08)
Satu adegan bisa merentang beberapa interval potong (contoh: 55 potongan dalam 14 adegan), dan satu rentang
`mediaInMs` tidak bisa menyatakan potongan di dalam adegan. Jadi `buildScenes` merender satu file video + satu
file audio per adegan yang hanya berisi materi terpakai, dipotong dari daftar potong yang sama di kedua trek —
video dan audio tetap sinkron. File rekaman mentah tetap disimpan untuk transkrip ulang / susun ulang.
`exporter` tidak diubah untuk ini: adegan adalah klip video biasa (`motionType: 'video'`, tanpa
`imageAssetId`), dan syarat "tiap klip harus punya gambar" sudah dipenuhi lewat konstruksi itu.

### Talking Head: komposisi close-up 60%, rumus sama di pratinjau dan ekspor (F5-09)
Close-up adalah crop 60% frame (tengah/kiri/kanan), diperbesar kembali ke ukuran frame. Pratinjau memakai
`cameraCss` (translate + scale) dan ekspor memakai filter FFmpeg `crop` + `scale` dengan angka yang sama
(`compositionFrame` / `compositionCropFilters` di `src/shared/talkinghead.ts`), supaya yang tampil itulah yang
keluar. Zoom otomatis v1 hanya zoom-in halus di tengah frame — tanpa pelacakan wajah.

### Talking Head: susun adegan LLM + fallback deterministik, tanpa jalan buntu (F5-05)
`arrangeScenes` meminta LLM mengelompokkan transkrip (JSON ketat, batas berupa indeks kata), lalu batasnya
divalidasi `normalizeSceneDefs` (dipotong ke transkrip, tumpang tindih dirapikan, tiap kata terpakai masuk
tepat satu adegan). Kalau LLM tidak tersedia atau hasilnya tidak valid, fallback deterministik (kelompokkan
run kata terpakai jadi adegan 30–60 detik) selalu menghasilkan adegan — susun adegan tidak pernah gagal
diam-diam.

### Run kata terpakai putus di jeda yang dipotong
`keptRuns` dulu hanya memutus run bila sebuah kata tumpang tindih dengan interval potong. Interval jeda
terletak seluruhnya di antara dua kata, jadi jeda ikut terhitung "terpakai" dan ikut masuk media adegan.
Sekarang run juga putus bila interval potong tumpang tindih dengan celah antara dua kata terpakai.
Ditemukan service-test `talkinghead` (Fase 5, 62 butir).
