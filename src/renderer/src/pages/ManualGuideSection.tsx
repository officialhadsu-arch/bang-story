import type { ReactNode } from 'react'
import { FolderOpen } from 'lucide-react'
import { FLOW_DEFAULT_BASE_URL } from '@shared/flow2api'

/**
 * In-app manual / extension tutorial (tier 2, 0.3+). Deliberately more complete than De-Story's
 * 7-step Extension Worker guide: it explains what the extension actually captures (a reCAPTCHA
 * token, not generated media), the full manual flow with the work folder and manifest, the
 * server-side captcha methods, the "belum terpasang" list, troubleshooting, the D-16/D-19
 * account risk with the A/B/C fallback, and the 1-clip live test. KenStory builds no browser
 * extension and runs no WebSocket server (D2-07) — the extension lives in the Flow2API server
 * checkout, and the captcha method is a setting of that server's admin panel, not of KenStory.
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

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-[13px] text-ink">{children}</code>
}

export function ManualGuideSection({ baseUrl }: { baseUrl: string }) {
  const adminUrl = baseUrl.trim() || FLOW_DEFAULT_BASE_URL
  return (
    <div className="flex max-w-[900px] flex-col gap-3.5 px-14 pb-24 pt-8">
      <div>
        <h1 className="font-display text-[34px] font-bold tracking-[-0.015em]">Panduan Manual &amp; Ekstensi</h1>
        <p className="mt-2 max-w-[700px] text-[15px] text-ink-2">
          Cara membuat gambar dan video adegan di luar KenStory — salin prompt, generate di Google Flow lewat browser atau ekstensi, lalu
          bawa hasilnya kembali lewat folder kerja. Jalur ini tetap memakai editor, suara, dan ekspor yang sama; yang berbeda hanya cara
          gambar/video dibuat.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void window.api.app.openExternal(adminUrl)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border-[1.5px] border-ink bg-surface px-4 text-sm font-semibold shadow-ink hover:shadow-ink-md"
          >
            <FolderOpen className="size-4" />
            Buka admin server
          </button>
          <span className="self-center text-[13px] text-muted">Halaman admin server Flow2API ({adminUrl}) — untuk WebSocket URL, kunci, dan metode CAPTCHA.</span>
        </div>
      </div>

      <H2>Apa itu jalur manual &amp; ekstensi?</H2>
      <P>
        Di KenStory, Manual adalah <strong className="text-ink">provider</strong>, bukan mode — sama seperti Higgsfield atau Google Flow,
        hanya saja yang bekerja adalah kamu (atau agen/ekstensi di browser), bukan server. Tiap adegan punya jalurnya sendiri di Storyboard
        (pemilih Jalur visual di panel kanan): Otomatis mengikuti model proyek, Higgsfield dan Google Flow generate sendiri, sedangkan{' '}
        <strong className="text-ink">Manual</strong> berarti kamu menyalin prompt dan generate di mana pun, dan{' '}
        <strong className="text-ink">Ekstensi</strong> berarti kamu generate lewat Google Flow di browser dengan bantuan ekstensi — prompt
        yang dipakai sama, hasilnya sama-sama jatuh ke folder kerja. Keduanya berbagi mesin impor dan pemasangan yang sama; bedanya hanya
        status dan panduan.
      </P>
      <Table
        head={['Jalur', 'Cara', 'Biaya', 'Kapan dipakai']}
        rows={[
          ['A — Flow2API (otomatis)', 'KenStory mengirim ke server lokal, hasil langsung masuk klip', 'Kredit AI Pro (sudah berlangganan)', 'Bawaan bila server jalan; tercepat untuk batch'],
          ['B — Ekstensi (semi-otomatis)', 'Generate di Google Flow lewat browser/ekstensi, hasil jatuh ke folder kerja lalu dipindai', 'Kredit AI Pro yang sama', 'Bila server otomatis bermasalah tapi kamu mau tetap memakai Flow'],
          ['C — Manual', 'Salin prompt, generate di mana pun (Flow, situs AI lain, atau tangan sendiri), lalu impor hasilnya', 'Tergantung tempat generate', 'Cadangan yang selalu bisa dipakai — tidak butuh server sama sekali'],
          ['D — NexaBot (berbayar murah)', 'API berbayar pihak ketiga', 'Perlu persetujuan biaya dulu', 'Cadangan bila jalur A, B, dan C tidak bisa dipakai (Tier 3)']
        ]}
      />
      <P>
        Kegagalan satu jalur tidak menghentikan proyek: adegan yang gagal di jalur A bisa dipindah ke B atau C tanpa mengulang naskah,
        suara, atau adegan lain. Urutan cadangannya A → B → C (lihat bagian Risiko akun di bawah).
      </P>

      <H2>Apa yang ditangkap ekstensi — dan apa yang tidak</H2>
      <P>
        Ini bagian yang paling sering disalahpahami, jadi ditulis tegas: ekstensi <strong className="text-ink">Flow2API Captcha Worker</strong>{' '}
        (manifest v3, di folder <Code>extension/</Code> dalam checkout server Flow2API) hanya menangkap <strong className="text-ink">satu hal</strong>{' '}
        dari Google Flow di Chrome kamu: <strong className="text-ink">token reCAPTCHA Enterprise</strong> dari sesi Chrome pengguna yang
        sudah login. Saat server meminta token, ekstensi membuka (atau memakai) tab Flow, menjalankan{' '}
        <Code>grecaptcha.enterprise.execute</Code> dengan action <Code>IMAGE_GENERATION</Code> atau <Code>VIDEO_GENERATION</Code>, lalu
        mengirim token itu kembali ke server lewat WebSocket. Ekstensi <strong className="text-ink">TIDAK</strong> membuat gambar/video,{' '}
        <strong className="text-ink">TIDAK</strong> mengunduh hasil generate, dan <strong className="text-ink">TIDAK</strong> menyentuh
        aplikasi KenStory. Hasil generate tetap dibuat dan diunduh oleh server Flow2API (jalur A) atau oleh kamu di browser (jalur B/C).
        Token itu hanya membuktikan ke Google bahwa yang meminta adalah manusia yang login — bukan robot.
      </P>
      <P>
        KenStory sendiri <strong className="text-ink">TIDAK membangun ekstensi browser dan TIDAK menjalankan server WebSocket</strong>.
        Folder ekstensi sudah ada di checkout server Flow2API kamu (<Code>&lt;folder server&gt;/extension/</Code> — berisi{' '}
        <Code>manifest.json</Code>, <Code>background.js</Code>, <Code>content.js</Code>, <Code>options.html</Code>). Yang dibangun KenStory
        untuk jalur B hanyalah provider <Code>extension</Code>, folder kerja + pemasangan otomatis, dan panduan ini.
      </P>

      <H2>Prasyarat</H2>
      <Steps
        items={[
          <>
            <strong className="text-ink">Akun Google dengan langganan Google AI Pro</strong> (untuk kredit Flow). Jalur manual murni (C)
            tidak butuh AI Pro bila kamu generate di tempat lain — tapi generate di Flow tetap memakai kredit akun itu.
          </>,
          <>
            <strong className="text-ink">Login ke Google Labs / Google Flow di Chrome</strong> dengan akun yang sama — ekstensi hanya bisa
            mengambil token dari sesi yang sudah login. Bila tab Flow belum login, token gagal (lihat pemecahan masalah).
          </>,
          <>
            <strong className="text-ink">Server Flow2API berjalan</strong> (untuk jalur B dan untuk halaman admin tempat WS URL, kunci, dan
            metode CAPTCHA diatur). Jalur manual murni (C) tidak butuh server sama sekali.
          </>,
          <>
            <strong className="text-ink">KenStory 0.3+</strong> dengan proyek yang sudah punya naskah dan rencana visual (langkah Naskah →
            Storyboard), supaya ada prompt yang bisa disalin.
          </>
        ]}
      />

      <H2>Langkah A: alur manual lengkap</H2>
      <Steps
        items={[
          <>
            Di <strong className="text-ink">Storyboard</strong>, buka adegan dan atur <strong className="text-ink">Jalur visual</strong> ke{' '}
            <strong className="text-ink">Manual</strong> (atau Ekstensi, bila generate lewat browser). Tombol Generate pada adegan itu kini
            membuat <em>job manual yang menunggu</em> — bukan generate otomatis. Job itu tetap menunggu sampai hasilnya dipasangkan; menutup
            lalu membuka aplikasi tidak membatalkannya.
          </>,
          <>
            Klik <strong className="text-ink">Salin Semua Prompt</strong> di atas storyboard. KenStory menulis dua berkas ke folder kerja
            proyek (<Code>&lt;folder aset proyek&gt;/manual/</Code>) — <Code>prompts.txt</Code> untuk manusia dan <Code>manual.json</Code>{' '}
            untuk mesin/agen — lalu menyalin semua prompt bernomor adegan ke clipboard.
          </>,
          <>
            Generate di mana pun: tempel prompt adegan ke Google Flow di browser, ke situs AI lain, atau serahkan berkas{' '}
            <Code>manual.json</Code> ke agen/ekstensi. Prompt gambarnya <strong className="text-ink">sama persis</strong> dengan yang
            dipakai jalur otomatis (adegan, tokoh, gaya seni) — jadi hasil manual dan otomatis berangkat dari kata yang sama.
          </>,
          <>
            Simpan hasil generate ke folder kerja dengan nama bernomor adegan (aturan nama di bawah). Tidak perlu membuka KenStory selama
            generate berjalan.
          </>,
          <>
            Kembali ke KenStory, klik <strong className="text-ink">Pindai Folder Kerja</strong>. Berkas yang namanya cocok terpasang
            otomatis ke adegannya (disalin ke <Code>images/</Code>/<Code>videos/</Code> seperti jalur lain) dan job manualnya selesai.
            Berkas yang tidak cocok masuk daftar <strong className="text-ink">belum terpasang</strong> — pilih adegannya, lalu Pasangkan.
          </>,
          <>
            Periksa gambar/video di kartu adegan. Bila salah pasang, pakai tombol <strong className="text-ink">Ganti</strong> (Pilih/Ganti
            gambar di panel adegan) — tidak ada penghapusan diam-diam.
          </>
        ]}
      />
      <P>
        Jalan pintas per adegan: tombol <strong className="text-ink">Impor Gambar</strong> / <strong className="text-ink">Impor Video</strong>{' '}
        memilih satu berkas dari mana pun di komputer untuk adegan yang sedang dipilih (tanpa lewat folder kerja). Di Editor, seksi{' '}
        <strong className="text-ink">Jalur manual</strong> pada panel adegan juga punya tombol <strong className="text-ink">Salin prompt gambar</strong>{' '}
        untuk satu adegan saja.
      </P>

      <H2>Folder kerja, manifest &amp; aturan nama berkas</H2>
      <P>
        Folder kerja ada di <Code>&lt;folder aset proyek&gt;/manual/</Code> (satu folder per proyek). Isinya:
      </P>
      <Table
        head={['Berkas', 'Isi', 'Untuk siapa']}
        rows={[
          ['prompts.txt', 'Prompt bernomor adegan, untuk dibaca manusia (satu adegan satu blok: Gambar, lalu Video bila adegannya video).', 'Kamu'],
          ['manual.json', 'Manifest mesin: sceneKey, clipId, judul, kind (image/video), prompt, videoPrompt, aspek, durasi per adegan.', 'Agen/ekstensi luar'],
          ['03.png, 03-v2.mp4, …', 'Hasil generate, bernama nomor adegan. Disalin ke images//videos/ saat dipindai; berkas aslinya tetap di folder kerja.', 'Pindai']
        ]}
      />
      <P>Aturan nama berkas hasil — yang dihitung hanya angka di awal nama (awalan scene-/clip- diabaikan):</P>
      <Table
        head={['Nama berkas', 'Hasil']}
        rows={[
          ['03.png', 'Terpasang ke adegan 03 sebagai gambar'],
          ['03-v2.mp4', 'Terpasang ke adegan 03 sebagai video (akhiran -v2 bebas, untuk revisi)'],
          ['scene-03.png', 'Terpasang ke adegan 03 (awalan scene- diabaikan)'],
          ['clip-12.mp4', 'Terpasang ke adegan 12 sebagai video'],
          ['gajah-mada.png', 'Tidak terpasang — tidak diawali nomor adegan; masuk daftar belum terpasang'],
          ['03.txt', 'Tidak terpasang — bukan gambar/video yang bisa dipakai (PNG, JPG, WebP, MP4, MOV, WebM)']
        ]}
      />
      <P>
        Satu batas yang diketahui: nomor adegan bersifat stabil per adegan, bukan posisi urutan. Bila sebuah adegan dihapus lalu adegan baru
        memakai nomor yang sama, berkas lama bernomor itu di folder kerja bisa terpasang ke adegan baru. Daftar belum terpasang + tombol
        Ganti adalah pengamannya — periksa gambar yang terpasang sebelum ekspor.
      </P>

      <H2>Langkah B: memasang Extension Worker</H2>
      <P>
        Ini jalur B (semi-otomatis): ekstensi di Chrome kamu menyediakan token CAPTCHA ke server Flow2API, supaya generate otomatis server
        (jalur A) bisa lewat pemeriksaan reCAPTCHA — atau supaya agen Flow di browser bisa bekerja. Langkah-langkah ini memperluas panduan
        7 langkah De-Story (yang tidak menjelaskan prasyarat, apa yang ditangkap ekstensi, atau pemecahan masalah).
      </P>
      <Steps
        items={[
          <>
            <strong className="text-ink">Prasyarat dulu:</strong> akun Google dengan AI Pro sudah login di Chrome (buka{' '}
            <Code>flow.google.com</Code> dan pastikan kamu masuk dengan akun yang benar), server Flow2API sudah jalan, dan kamu sudah masuk
            ke halaman admin server (tombol <strong className="text-ink">Buka admin server</strong> di atas).
          </>,
          <>
            Di halaman admin server, buka pengaturan <strong className="text-ink">Extension Worker</strong> / CAPTCHA. Salin{' '}
            <strong className="text-ink">WebSocket URL</strong> dan <strong className="text-ink">Kunci</strong> yang ditampilkan — untuk
            server mandiri biasanya <Code>ws://127.0.0.1:8000/captcha_ws</Code> (port = port server; runtime bawaan De-Story memakai port
            loopback tetap <Code>8765</Code>). Jangan bagikan kunci ini ke siapa pun; ia hanya berlaku di komputer ini.
          </>,
          <>
            Cari folder ekstensi di checkout server Flow2API kamu: <Code>&lt;folder server&gt;/extension/</Code> (berisi{' '}
            <Code>manifest.json</Code> dan <Code>background.js</Code>). Bila kamu menjalankan server dari Docker, salin folder itu dulu ke
            komputer ini.
          </>,
          <>
            Buka <Code>chrome://extensions</Code> di Chrome, aktifkan <strong className="text-ink">Developer mode</strong> (pojok kanan
            atas), klik <strong className="text-ink">Load unpacked</strong>, lalu pilih folder <Code>extension/</Code> tadi. Ekstensi{' '}
            <strong className="text-ink">Flow2API Captcha Worker</strong> muncul di daftar.
          </>,
          <>
            Klik <strong className="text-ink">Details</strong> → <strong className="text-ink">Extension options</strong> (atau buka halaman
            opsi ekstensi), lalu tempel <strong className="text-ink">WebSocket URL &amp; Kunci</strong> dari langkah 2 dan simpan. Pastikan
            statusnya tersambung (ikon ekstensi / halaman opsi menunjukkan koneksi WS aktif; ekstensi mengirim heartbeat tiap 20 detik dan
            menyambung ulang otomatis tiap 2 detik bila putus).
          </>,
          <>
            Pastikan tab Google Flow / Google Labs sudah login dengan akun yang sama di Chrome yang sama — ekstensi mengambil token dari tab
            itu. Tanpa login, token gagal (lihat pemecahan masalah).
          </>,
          <>
            Kembali ke halaman admin server dan pilih metode <strong className="text-ink">extension</strong> (lihat tabel metode di bawah).
            Metode ini adalah <strong className="text-ink">setelan server</strong>, bukan setelan KenStory — KenStory tidak punya setelan
            ekstensi, dan tidak perlu dinyalakan ulang.
          </>
        ]}
      />

      <H2>Metode CAPTCHA server</H2>
      <P>
        Google Flow meminta validasi reCAPTCHA Enterprise sebelum generate. Server Flow2API memilih cara melewatinya lewat metode CAPTCHA —
        ini setelan <strong className="text-ink">panel admin server</strong>, bukan setelan KenStory:
      </P>
      <Table
        head={['Metode', 'Kebutuhan', 'Biaya', 'Catatan']}
        rows={[
          ['browser', 'Chromium berkepala di server (Playwright bawaan)', 'Gratis', 'Berjalan otomatis di latar belakang; bawaan yang disarankan bila tidak mau memasang ekstensi.'],
          ['extension', 'Chrome pribadi + akun Google + ekstensi Captcha Worker', 'Gratis', 'Token diambil dari Chrome kamu sendiri; butuh langkah B di atas.'],
          ['yescaptcha / capsolver / 2captcha', 'Kunci API layanan captcha pihak ketiga', 'Berbayar (butuh kunci)', 'Solusi otomatis yang stabil; jangan dipakai tanpa persetujuan biaya.'],
          ['flow2api_team', 'Tanpa konfigurasi', 'Bawaan server', 'Layanan resolver bawaan Flow2API.']
        ]}
      />
      <P>
        Bawaan server di VM adalah <Code>yescaptcha</Code> (berbayar) — jadi sebelum uji pertama, ubah metodenya ke <Code>browser</Code>{' '}
        atau <Code>extension</Code> (keduanya gratis) bila kamu tidak bermaksud membayar layanan captcha. Bila generate gagal dengan pesan
        reCAPTCHA, periksa dulu metode yang aktif di halaman admin sebelum mengubah apa pun di KenStory.
      </P>

      <H2>Daftar &quot;belum terpasang&quot;</H2>
      <P>
        Sesudah Pindai, berkas yang tidak bisa dipasangkan otomatis tampil di panel folder kerja Storyboard dengan nama berkas dan jenisnya
        (gambar/video/tidak dikenal). Pilih adegan tujuan di pemilih (bukan ketik nomor), lalu klik <strong className="text-ink">Pasangkan</strong>.
        Berkas tetap di folder kerja sesudah dipasangkan, jadi kamu bisa memasangkan berkas yang sama ke adegan lain bila perlu. Berkas yang
        namanya tidak diawali nomor adegan tidak bisa dipasangkan otomatis — ganti namanya jadi <Code>03.png</Code> atau sejenisnya, lalu
        Pindai lagi.
      </P>

      <H2>Pemecahan masalah</H2>
      <Table
        head={['Gejala', 'Kemungkinan penyebab & perbaikan']}
        rows={[
          ['Ekstensi: WebSocket tak tersambung', 'Server belum jalan, atau WS URL/Kunci salah. Jalankan server, buka halaman admin, salin ulang WS URL + Kunci ke opsi ekstensi. Pastikan URL memakai 127.0.0.1 dan port yang sama dengan server.'],
          ['Token ditolak / generate gagal: reCAPTCHA', 'Metode CAPTCHA di admin server bukan extension, atau token kedaluwarsa. Pilih metode extension di admin, pastikan ekstensi tersambung, lalu coba lagi. Bila server memakai yescaptcha bawaan tanpa kunci, ubah ke browser atau extension.'],
          ['Tab Flow belum login', 'Chrome memakai akun lain atau belum login. Buka flow.google.com di Chrome yang sama dan masuk dengan akun Google Labs yang benar, lalu ulangi.'],
          ['Pindai: berkas tidak terpasang', 'Nama berkas tidak diawali nomor adegan, atau adegan bernomor itu tidak ada di proyek ini. Periksa tabel aturan nama di atas; berkas yang tidak cocok ada di daftar belum terpasang.'],
          ['Pindai: tidak ada berkas baru', 'Berkas belum tersimpan di folder kerja proyek yang benar. Klik Buka folder di panel folder kerja dan pastikan berkasnya ada di sana (bukan di folder proyek lain).'],
          ['Job manual macet (tetap Menunggu hasil)', 'Job manual memang menunggu sampai hasil dipasangkan — itu bukan macet. Bila kamu tidak jadi menunggu, batalkan jobnya dari daftar pekerjaan (status jadi dibatalkan) atau ganti jalur adegan ke Otomatis lalu Generate ulang.'],
          ['Gambar terpasang ke adegan yang salah', 'Nomor adegan dipakai ulang sesudah adegan lama dihapus (batas yang diketahui). Pakai Ganti gambar di panel adegan, atau ganti nama berkas dan Pindai lagi.'],
          ['Salin Semua Prompt: prompt adegan kosong', 'Adegan itu belum punya rencana visual. Buat visual dulu di Storyboard (tombol Buat visual), lalu salin lagi.']
        ]}
      />

      <H2>Keamanan &amp; risiko akun (D-16/D-19)</H2>
      <P>
        Jalur B memakai alat tidak resmi (Flow2API + ekstensi) yang mengotomatisasi layanan Google memakai login Google kamu sendiri dan
        melewati pemeriksaan reCAPTCHA. Google bisa mendeteksi otomatisasi ini, membatasi (galat 429), atau membatasi/menonaktifkan akses
        akun. Akun ini sama dengan akun kerja harianmu, jadi kredit, Gemini, dan layanan Google lain yang terikat ke akun itu ikut terdampak.
        Jalur manual murni (C) tidak mengotomatisasi apa pun — kamu generate sendiri di browser seperti pengguna biasa — jadi risikonya
        paling kecil. Praktik amannya: jangan menjalankan batch besar di akun kerja utama tanpa jeda, catat saldo sebelum dan sesudah sesi,
        dan hentikan pemakaian bila muncul pembatasan.
      </P>
      <P>
        Pilihan akun untuk Flow2API (D-19) masih terbuka dan diputuskan di Fase 2: (a) tetap memakai akun utama dengan peringatan tertulis
        ini, (b) memakai akun Google terpisah, atau (c) tidak memakai Flow2API sama sekali. Sampai diputuskan, panduan ini menganggap opsi
        (a) dengan peringatan di atas.
      </P>
      <P>
        <strong className="text-ink">Fallback A → B → C.</strong> Bila jalur otomatis (A) gagal atau kena pembatasan akun: pindah adegan
        ke Ekstensi (B) dan generate lewat browser; bila B juga gagal: pindah ke Manual (C), salin prompt, dan generate di mana pun —
        proyek tetap jalan, tidak ada adegan yang hilang.
      </P>

      <H2>Uji live 1 klip (gerbang PC)</H2>
      <P>
        Uji minimal untuk membuktikan ujung-ke-ujungnya bekerja, sebelum memakai jalur manual/ekstensi untuk proyek sungguhan. Uji ini{' '}
        <strong className="text-ink">hanya bisa dilakukan di PC</strong> (butuh Chrome + login Google + server di mesin yang sama) — belum
        diuji di VM, seperti gerbang G3 tier 1:
      </P>
      <Steps
        items={[
          <>Di proyek apa pun, atur 1 adegan ke jalur Manual dan klik Generate (job manual muncul, status Menunggu hasil).</>,
          <>Klik Salin Semua Prompt, lalu generate gambar adegan itu di Google Flow lewat browser dan simpan hasilnya sebagai 01.png (atau nomor adegannya) ke folder kerja.</>,
          <>Klik Pindai Folder Kerja. Pastikan gambarnya terpasang di adegan dan job manualnya selesai.</>,
          <>Ulangi untuk 1 video pendek (jalur Ekstensi bila ekstensi sudah terpasang): hasil video bernama 01.mp4 terpasang dan bisa diputar di Editor.</>,
          <>Bila salah satu langkah gagal, catat pesan galat persisnya dan lihat tabel pemecahan masalah di atas.</>
        ]}
      />
      <P>
        Catatan: nama metode CAPTCHA, perilaku ekstensi, dan tampilan halaman admin bisa berubah dari sisi server Flow2API. Bila panduan ini
        tidak lagi cocok dengan yang kamu lihat, sumber kebenarannya adalah halaman admin server dan folder <Code>extension/</Code> di
        checkout server. Panduan Flow2API otomatis (jalur A) ada di tab <strong className="text-ink">Panduan Flow2API</strong>.
      </P>
    </div>
  )
}
