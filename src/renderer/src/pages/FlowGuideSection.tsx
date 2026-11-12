import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

/**
 * In-app Flow2API tutorial (tier 1, 0.3+). Deliberately more complete and more
 * technical than De-Story's tutorial: it covers prerequisites, the server setup,
 * the request flow, model and credit behaviour, limits, troubleshooting, the
 * D-16 account risk, and the A/B/C path comparison — all of which De-Story's
 * guide leaves out. Model names change upstream; when in doubt, the server's
 * own list at /v1/models is the truth.
 */

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 font-display text-[22px] font-bold leading-tight">{children}</h2>
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{children}</p>
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-3 flex list-decimal flex-col gap-2 pl-6 text-[15px] leading-relaxed text-ink-2 marker:font-semibold marker:text-ink">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-[13px] leading-relaxed">
        <thead>
          <tr className="border-b border-line bg-sand">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top text-ink-2 first:font-medium first:text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => void window.api.app.openExternal(href)}
      className="inline-flex items-center gap-1 font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
    >
      {children}
      <ExternalLink className="size-3.5" />
    </button>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-[13px] text-ink">{children}</code>
}

function Cmd({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-paper">{children}</pre>
  )
}

export function FlowGuideSection() {
  return (
    <div className="flex max-w-[900px] flex-col gap-3.5 px-14 pb-24 pt-8">
      <div>
        <h1 className="font-display text-[34px] font-bold tracking-[-0.015em]">Panduan Flow2API</h1>
        <p className="mt-2 max-w-[700px] text-[15px] text-ink-2">
          Cara memakai Google Flow (Nano Banana, Veo, Omni) dari dalam KenStory lewat server Flow2API di komputer kamu sendiri — memakai
          kredit dari langganan Google AI Pro kamu, tanpa kunci Higgsfield.
        </p>
      </div>

      <H2>Apa itu Flow2API?</H2>
      <P>
        Google Flow adalah alat resmi Google untuk membuat gambar (Nano Banana) dan video (Veo, Omni). Flow2API adalah server kecil sumber
        terbuka (TheSmallHanCat/flow2api, lisensi MIT) yang berdiri di antara KenStory dan Google Flow: KenStory mengirim permintaan ke server
        itu dalam format yang sama dengan API OpenAI, server itu meneruskannya ke Flow memakai login Google kamu, lalu mengembalikan hasilnya.
        Alurnya:
      </P>
      <Cmd>{'KenStory  →  Flow2API (localhost:8000)  →  Google Flow  →  hasil'}</Cmd>
      <P>
        Login Google kamu disimpan di server Flow2API di komputer ini, bukan di KenStory — KenStory hanya menyimpan alamat server dan
        sakelar nyala/mati. Flow2API bukan produk Google; ia mengotomatisasi layanan Google dengan login kamu sendiri. Risiko dari hal itu
        dijelaskan di bagian Keamanan &amp; risiko akun di bawah, dan wajib dibaca sebelum menyalakan fitur ini.
      </P>

      <H2>Prasyarat</H2>
      <Steps
        items={[
          <>
            <strong className="text-ink">Akun Google dengan langganan Google AI Pro.</strong> Kredit Flow yang dipakai adalah kredit dari
            langganan itu. Tanpa AI Pro, Flow tetap bisa dipakai dengan kuota gratis yang jauh lebih kecil.
          </>,
          <>
            <strong className="text-ink">PC Windows dengan Python 3.8+ atau Docker.</strong> Server Flow2API berjalan di komputer ini; di
            laptop 4 GB, jalankan server hanya saat membuat gambar/video, lalu matikan lagi.
          </>,
          <>
            <strong className="text-ink">Browser Chrome/Edge dengan akun Google yang sama.</strong> Dipakai untuk menyambungkan login ke
            server lewat ekstensi Token-Updater.
          </>,
          <>
            <strong className="text-ink">KenStory 0.3+.</strong> Model Google Flow baru muncul di pemilih model setelah fitur ini dinyalakan
            di Pengaturan.
          </>
        ]}
      />

      <H2>Langkah 1: Menjalankan server Flow2API</H2>
      <P>
        Di PC Windows, buka <strong className="text-ink">Command Prompt (cmd)</strong> — bukan PowerShell — lalu jalankan:
      </P>
      <Cmd>{`git clone https://github.com/TheSmallHanCat/flow2api.git
cd flow2api
python -m venv venv
venv\\Scripts\\activate
pip install -r requirements.txt
python main.py`}</Cmd>
      <P>
        Alternatif bila Docker sudah terpasang: <Code>docker-compose up -d</Code> dari folder yang sama. Server mendengarkan di{' '}
        <Code>http://localhost:8000</Code>. Buka alamat itu di browser: masuk dengan nama pengguna <Code>admin</Code> dan kata sandi{' '}
        <Code>admin</Code>, lalu <strong className="text-ink">segera ganti kata sandinya</strong>. Antarmuka server memakai bahasa Mandarin
        atau Inggris (pilih di pojok kanan atas) — belum ada bahasa Indonesia.
      </P>

      <H2>Langkah 2: Menyambungkan akun Google ke server</H2>
      <P>
        Server butuh login Google kamu agar bisa memanggil Flow. Cara termudah: pasang ekstensi{' '}
        <ExtLink href="https://github.com/TheSmallHanCat/Flow2API-Token-Updater">Flow2API-Token-Updater</ExtLink> di Chrome, masuk ke
        Google Flow di browser yang sama, dan ekstensi itu otomatis mendorong status login ke server. Cara manual: di halaman admin server,
        buka manajemen Token dan isi formulirnya (token ST, cookie Google, dan akun login).
      </P>
      <P>
        Periksa di halaman admin bahwa Token berstatus aktif. Server memperbarui cookie secara otomatis; bila login kedaluwarsa, sambungkan
        ulang dengan cara yang sama. Saldo kredit bisa dilihat di halaman admin (VideoFX Credits) — catat angkanya sebelum dan sesudah uji
        pertama supaya pemakaianmu tercatat.
      </P>

      <H2>Langkah 3: Menghubungkan KenStory</H2>
      <Steps
        items={[
          <>
            Buka <strong className="text-ink">Pengaturan › Layanan AI dan kunci › Google Flow (Flow2API)</strong>.
          </>,
          <>
            Baca peringatan risiko akun, centang kotak persetujuan, lalu nyalakan sakelarnya. Tanpa centang, sakelar tidak bisa dinyalakan.
          </>,
          <>
            Isi alamat server bila bukan bawaan (<Code>http://localhost:8000</Code>), lalu klik <strong className="text-ink">Uji Koneksi</strong>.
            KenStory memeriksa <Code>GET /health</Code>, dan bila tidak ada, <Code>GET /v1/models</Code>.
          </>,
          <>
            Buka proyek, di langkah <strong className="text-ink">Ide cerita › Model AI</strong> pilih model Google Flow untuk gambar dan/atau
            video. Sejak itu tombol buat gambar/video memakai Flow2API, bukan Higgsfield.
          </>
        ]}
      />

      <H2>Cara kerja teknis</H2>
      <P>
        KenStory memakai pembangun prompt yang sama untuk kedua penyedia — adegan, tokoh, dan gaya seni tidak berubah. Yang berubah hanya
        pengiriman dan nama model:
      </P>
      <Steps
        items={[
          <>
            <strong className="text-ink">Nama model diterjemahkan.</strong> Model gambar dikirim dengan akhiran aspek (
            <Code>gemini-3.1-flash-image-landscape</Code> untuk 16:9, <Code>-portrait</Code> untuk 9:16). Model video Veo dikirim sebagai{' '}
            <Code>veo-3.1-fast-i2v-4s-landscape</Code> (i2v = image-to-video, durasi 4 atau 6 detik); Omni dikirim sebagai{' '}
            <Code>omni-1.2-flash-6s-landscape</Code> (durasi 4/6/8/10 detik). Nama lama yang tersimpan di proyek lama dipetakan otomatis ke nama
            yang dilayani server sekarang (misalnya omni-1.1-flash → omni-1.2-flash).
          </>,
          <>
            <strong className="text-ink">Permintaan dikirim sebagai POST /v1/chat/completions</strong> dengan <Code>stream: true</Code> —
            format yang sama dengan API chat OpenAI. Gambar referensi (lembar karakter) dikirim sebagai data URI di dalam pesan; frame pertama
            video dikirim sebagai data URI juga. Tidak seperti Higgsfield, Flow2API tidak butuh URL publik untuk gambar referensi.
          </>,
          <>
            <strong className="text-ink">Jawaban dibaca sebagai aliran SSE</strong> (<Code>data: …</Code> sampai <Code>[DONE]</Code>), lalu JSON
            biasa, lalu URL/data media langsung. Galat dari Flow sering tiba sebagai potongan biasa di tengah aliran dengan HTTP 200 — jadi
            pembaca aliranlah yang menemukan alasan sebenarnya, bukan status HTTP.
          </>,
          <>
            <strong className="text-ink">Hasil diunduh lalu disimpan sebagai aset</strong> (penyedia <Code>flow2api</Code>) dan dipasang ke
            klip atau tokoh seperti hasil Higgsfield. Narasi dan musik tetap dari editor — karena itu prompt video selalu ditambahi{' '}
            <Code>Silent clip: no background music, no soundtrack, no singing or humming.</Code>
          </>,
          <>
            <strong className="text-ink">Tidak ada kunci Bearer di tier 1.</strong> Server yang butuh kunci Bearer belum didukung; jalur yang
            didokumentasikan adalah server lokal tanpa kunci. Resolusi gambar/video memakai bawaan server.
          </>
        ]}
      />

      <H2>Model &amp; kredit</H2>
      <Table
        head={['Model', 'Jenis', 'Durasi / referensi', 'Catatan']}
        rows={[
          ['Nano Banana 2.1 (Flash)', 'Gambar', 'Referensi maks 3', 'Bawaan. Cepat, kualitas umum terbaik.'],
          ['Nano Banana 2 Lite', 'Gambar', 'Referensi maks 1', 'Paling ringan; cocok untuk draf.'],
          ['Banana Pro', 'Gambar', 'Referensi maks 2', 'Kualitas tertinggi; lebih lambat.'],
          ['Veo 3.1 Fast', 'Video', '4 atau 6 detik', 'Cepat; untuk gerak sederhana.'],
          ['Veo 3.1 Quality', 'Video', '4 atau 6 detik', 'Kualitas tertinggi; lebih lambat.'],
          ['Veo 3.1 Lite', 'Video', '4 atau 6 detik', 'Paling ringan di keluarga Veo.'],
          ['Omni 1.2 Flash', 'Video', '4, 6, 8, atau 10 detik', 'Bawaan untuk video; dinamis, bisa lebih panjang.']
        ]}
      />
      <P>
        Biaya memakai kredit Google Flow dari langganan AI Pro kamu — bukan kredit Higgsfield, bukan uang tunai. KenStory{' '}
        <strong className="text-ink">tidak menampilkan perkiraan kredit</strong> untuk model Google Flow karena server Flow2API tidak punya
        endpoint estimasi; saldo dilihat di halaman admin server. Nama dan ketersediaan model bisa berubah dari sisi Google — daftar yang
        dilayani server saat ini bisa dicek di <Code>http://localhost:8000/v1/models</Code> atau halaman uji{' '}
        <Code>http://localhost:8000/test</Code>.
      </P>

      <H2>Batas &amp; limit</H2>
      <Table
        head={['Hal', 'Batas']}
        rows={[
          ['Waktu tunggu gambar', '300 detik (5 menit) per gambar'],
          ['Waktu tunggu video', '600 detik (10 menit) per video'],
          ['Waktu tunggu unduh hasil', '180 detik'],
          ['Uji koneksi', '8 detik'],
          ['Antrean di KenStory', '1 pekerjaan Flow2API dalam satu waktu (server melayani satu akun Google)'],
          ['Durasi video Veo', '4 atau 6 detik (image-to-video saja)'],
          ['Durasi video Omni', '4, 6, 8, atau 10 detik'],
          ['Prompt gambar', 'Maks 4.000 karakter'],
          ['Prompt video', 'Maks 2.500 karakter (Veo Lite 2.000)'],
          ['Gambar referensi', 'Maks 3 (Flash), 2 (Pro), 1 (Lite) — lembar karakter tokoh'],
          ['Resolusi', 'Bawaan server (varian 2K/4K adalah upscale sesudah generate, bukan pilihan di sini)']
        ]}
      />

      <H2>Pemecahan masalah</H2>
      <Table
        head={['Gejala', 'Kemungkinan penyebab & perbaikan']}
        rows={[
          ['Uji Koneksi gagal: tidak dapat terhubung', 'Server belum jalan. Jalankan python main.py (atau docker-compose up -d) dan pastikan http://localhost:8000 bisa dibuka di browser. Periksa alamat server di Pengaturan.'],
          ['Uji Koneksi: status HTTP bukan 200', 'Server jalan tapi endpoint /health atau /v1/models mengembalikan galat. Lihat log terminal server; mulai ulang server bila perlu.'],
          ['Generate gagal: Flow2API belum dinyalakan', 'Sakelar Google Flow di Pengaturan masih mati. Baca peringatan, centang persetujuan, nyalakan.'],
          ['Generate gagal: masalah reCAPTCHA', 'Flow meminta verifikasi manusia dan server tidak bisa melewatinya sendiri. Periksa log server untuk metode captcha yang dipilih. Jalur gratis: setel mode captcha server ke browser atau personal (browser berkepala di server). Layanan captcha berbayar TIDAK dipakai KenStory.'],
          ['Galat 429 / akun dibatasi', 'Google membatasi otomatisasi dari akun ini. Berhenti sejenak, kurangi frekuensi, dan baca bagian risiko akun. Bila berulang, pertimbangkan akun terpisah (keputusan Fase 2).'],
          ['Generate timeout (gambar 5 mnt / video 10 mnt)', 'Antrean Flow sedang padat atau video panjang. Coba lagi nanti; untuk video, pilih durasi lebih pendek atau model Fast/Lite.'],
          ['Tidak dapat menemukan URL atau data di respons', 'Server mengembalikan jawaban yang tidak dikenali (misalnya halaman galat HTML). Lihat log server; kemungkinan model sudah tidak dilayani — cek /v1/models.'],
          ['Model tidak dikenal / 404', 'Nama model berubah di sisi Google. Pilih model lain di Ide cerita, atau perbarui server Flow2API ke versi terbaru.'],
          ['Hasil gambar/video tidak sesuai prompt', 'Periksa prompt di riwayat aset; perbaiki adegan di Naskah/Storyboard. Referensi hanya memengaruhi identitas tokoh, bukan komposisi.'],
          ['Dua pekerjaan Flow2API menumpuk', 'Antrean dibatasi 1. Tunggu pekerjaan pertama selesai atau batalkan dari daftar pekerjaan.']
        ]}
      />

      <H2>Keamanan &amp; risiko akun (D-16)</H2>
      <P>
        Flow2API adalah alat tidak resmi yang mengotomatisasi layanan Google memakai login Google kamu sendiri dan melewati pemeriksaan
        reCAPTCHA. Google bisa mendeteksi otomatisasi ini, membatasi (galat 429), atau membatasi/menonaktifkan akses akun. Akun ini sama
        dengan akun kerja harianmu, jadi kredit, Gemini, dan layanan Google lain yang terikat ke akun itu ikut terdampak. Praktik amannya:
        jangan menjalankan batch besar di akun kerja utama tanpa jeda, catat saldo sebelum dan sesudah sesi, dan hentikan pemakaian bila
        muncul pembatasan.
      </P>
      <P>
        Pilihan akun untuk Flow2API (D-19) masih terbuka dan diputuskan di Fase 2: (a) tetap memakai akun utama dengan peringatan tertulis
        ini, (b) memakai akun Google terpisah, atau (c) tidak memakai Flow2API sama sekali. Sampai diputuskan, panduan ini menganggap opsi
        (a) dengan peringatan di atas.
      </P>

      <H2>Perbandingan jalur gerak (A/B/C)</H2>
      <Table
        head={['Jalur', 'Cara', 'Biaya', 'Kapan dipakai']}
        rows={[
          ['A — Flow2API (otomatis)', 'KenStory mengirim ke server lokal, hasil langsung masuk klip', 'Kredit AI Pro (sudah berlangganan)', 'Bawaan bila server jalan; tercepat untuk batch'],
          ['B — Manual (semi-otomatis)', 'Salin prompt dari KenStory, generate di Google Flow lewat browser/ekstensi, lalu muat hasilnya sebagai gambar klip', 'Kredit AI Pro yang sama', 'Bila server bermasalah atau kamu mau kontrol penuh tiap generate'],
          ['C — NexaBot (berbayar murah)', 'API berbayar pihak ketiga', 'Perlu persetujuan biaya dulu', 'Cadangan bila jalur A dan B tidak bisa dipakai']
        ]}
      />
      <P>
        Ketiga jalur memakai editor, suara, dan alur yang sama — tidak ada yang dikorbankan. Jalur B memakai tombol impor gambar klip yang
        sudah ada (tab Klip › Pilih/Ganti gambar).
      </P>

      <H2>Uji live 1 klip (G3)</H2>
      <P>Uji minimal untuk membuktikan ujung-ke-ujungnya bekerja, sebelum memakai Flow2API untuk proyek sungguhan:</P>
      <Steps
        items={[
          <>Catat saldo VideoFX Credits di halaman admin server.</>,
          <>Di proyek apa pun, pilih model gambar Nano Banana 2.1 (Flash) dan buat 1 gambar klip. Pastikan gambarnya muncul di klip.</>,
          <>Pilih model video Veo 3.1 Fast dan buat 1 video dari gambar itu. Pastikan videonya bisa diputar di Editor.</>,
          <>Catat lagi saldo di halaman admin — selisihnya adalah kredit yang terpakai untuk uji ini.</>,
          <>Bila salah satu langkah gagal, catat pesan galat persisnya dan lihat tabel pemecahan masalah di atas.</>
        ]}
      />
      <P>
        Catatan: nama model, limit kredit, dan perilaku captcha bisa berubah dari sisi Google dan server Flow2API. Bila panduan ini tidak
        lagi cocok dengan yang kamu lihat, sumber kebenarannya adalah halaman admin server dan daftar model di{' '}
        <Code>http://localhost:8000/v1/models</Code>.
      </P>
    </div>
  )
}
