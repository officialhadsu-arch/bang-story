import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

/**
 * In-app NexaBot tutorial (tier 3, 0.3+). Prices are the verified homepage rates
 * (nexabot.id, 12 Nov 2026): video Rp200–300, Omni Flash 1.2 Rp300 — NOT the
 * Rp400/video figure the v2.1 concept recorded. The API shape itself is
 * undocumented in public, so the guide says plainly which parts are assumptions
 * and what the first live PC test must confirm.
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
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-accent-dark underline underline-offset-2"
      onClick={(e) => {
        e.preventDefault()
        void window.api.app.openExternal(href)
      }}
    >
      {children}
      <ExternalLink className="size-3.5" />
    </a>
  )
}

export function NexaBotGuideSection() {
  return (
    <div className="flex max-w-[760px] flex-col pb-24 pt-8">
      <h1 className="font-display text-[34px] font-bold tracking-[-0.015em]">Panduan NexaBot</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        NexaBot adalah jalur berbayar murah untuk gambar dan video AI: kamu isi saldo sekali, lalu setiap generate memotong kredit. Jalur ini
        cocok saat kredit Google Flow kamu habis atau saat kamu mau hasil yang konsisten tanpa antrean Flow — tapi setiap klip ada harganya,
        jadi baca bagian biaya dulu sebelum menyalakan.
      </p>

      <H2>1. Cara kerja</H2>
      <P>
        KenStory mengirim prompt dan gambar acuan langsung ke API NexaBot (api.nexabot.id) memakai kunci API kamu sendiri. Gambar kembali
        dalam satu panggilan; video dibuat lewat tugas asinkron — KenStory mengirim tugas, lalu mengecek statusnya tiap beberapa detik sampai
        videonya siap dan diunduh. Tidak ada server perantara di komputer kamu, tidak ada ekstensi browser, dan tidak ada login Google yang
        dipakai.
      </P>
      <Steps
        items={[
          <>
            <strong>Gambar:</strong> prompt + sampai 3 gambar referensi (lembar karakter) → satu gambar kembali.
          </>,
          <>
            <strong>Video:</strong> prompt + gambar pertama klip → tugas video (15 detik) → KenStory mengecek status sampai selesai, lalu
            mengunduh hasilnya.
          </>,
          <>
            <strong>Biaya:</strong> dipotong per generate, langsung dari kredit NexaBot kamu. Tidak ada biaya bulanan di KenStory.
          </>
        ]}
      />

      <H2>2. Mendapatkan kunci API</H2>
      <Steps
        items={[
          <>
            Buka <ExtLink href="https://nexabot.id">nexabot.id</ExtLink> dan buat akun (masuk dengan Google atau email).
          </>,
          <>Buka dashboard, lalu isi saldo lewat QRIS (top-up minimum Rp5.000). Kredit tidak kedaluwarsa.</>,
          <>Salin kunci API dari dashboard, lalu tempel di Pengaturan → Layanan AI dan kunci → NexaBot.</>,
          <>
            Tekan <strong>Uji Koneksi</strong> di seksi yang sama. Kalau hasilnya “Terhubung ke NexaBot”, kuncinya benar dan saldonya cukup
            untuk satu panggilan uji.
          </>
        ]}
      />
      <P>
        Kunci tersimpan terenkripsi di perangkat ini (seperti semua kunci lain) dan hanya dikirim ke api.nexabot.id. Jangan membagikan kunci
        ke siapa pun — siapa pun yang memegangnya bisa memakai saldomu.
      </P>

      <H2>3. Tarif (terverifikasi dari nexabot.id, 12 Nov 2026)</H2>
      <P>
        Satu kredit = Rp1.000. Tarif di bawah ini dibaca langsung dari beranda nexabot.id — angka Rp400 per video yang tertulis di konsep
        lama sudah tidak berlaku.
      </P>
      <Table
        head={['Model di KenStory', 'Kegunaan', 'Harga per generate']}
        rows={[
          ['Nano Banana Pro', 'Gambar, sampai 3 referensi', 'Rp150'],
          ['GPT Image 2.5', 'Gambar, 1 referensi', 'Rp100'],
          ['Omni Flash 1.2', 'Video 15 detik dari gambar pertama', 'Rp300']
        ]}
      />
      <P>
        Contoh biaya satu proyek 30 adegan: 30 gambar Nano Banana Pro (Rp4.500) + 30 video Omni Flash 1.2 (Rp9.000) = Rp13.500. Bandingkan
        dengan harga eceran produk sejenis (misalnya Rp520–Rp680 per scene di layanan web berbasis NexaBot) — memakai API langsung jauh
        lebih murah karena tidak ada margin per scene.
      </P>
      <P>
        Ketentuan pembelian NexaBot: semua pembelian bersifat final, tanpa refund. Isi saldo secukupnya dulu (misalnya Rp10.000–Rp20.000)
        sebelum mengerjakan proyek besar, dan periksa saldo di dashboard sebelum batch besar.
      </P>

      <H2>4. Menyalakan NexaBot di KenStory</H2>
      <Steps
        items={[
          <>Isi kunci API seperti langkah 2, lalu tekan Uji Koneksi sampai berhasil.</>,
          <>Baca peringatan biaya di Pengaturan → Layanan AI dan kunci → NexaBot, centang kotak persetujuan, lalu nyalakan sakelarnya.</>,
          <>Pilih model NexaBot di langkah Ide cerita, bagian Model AI — harganya tampil dalam Rupiah di samping nama model.</>,
          <>Generate seperti biasa. Harga tiap generate tampil sebelum kamu menekan tombolnya.</>
        ]}
      />

      <H2>5. Gerbang persetujuan biaya</H2>
      <P>
        NexaBot tidak pernah memotong kredit diam-diam. Ada dua gerbang:
      </P>
      <Steps
        items={[
          <>
            <strong>Satu klip:</strong> harga tampil di pemilih model dan di kartu Model AI sebelum generate dimulai.
          </>,
          <>
            <strong>Batch (semua gambar / semua video):</strong> sebelum satu job pun dimulai, muncul ringkasan biaya total dalam Rupiah
            dan kamu harus menekan tombol konfirmasi. Membatalkan di sini tidak memotong apa pun.
          </>
        ]}
      />
      <P>
        Yang tidak bisa dikembalikan: kredit untuk generate yang sudah selesai. Kalau kamu membatalkan batch di tengah jalan, video dan
        gambar yang sudah jadi tetap terpotong, tapi yang belum dimulai tidak dipotong. Tombol Batal pada job video juga memberitahu server
        NexaBot untuk berhenti, supaya tagihan tidak jalan terus.
      </P>

      <H2>6. Batas dan hal yang belum pasti</H2>
      <Steps
        items={[
          <>
            <strong>Durasi video 15 detik</strong> mengikuti dua produk yang memakai API ini (PAWARNA dan tokogame.ai.id). Beranda alat web
            NexaBot menyebut sampai 10 detik — uji live pertama yang menentukan mana yang benar. Kalau API menolak 15 detik, KenStory akan
            menyesuaikan katalognya.
          </>,
          <>
            <strong>Referensi gambar video:</strong> video Omni Flash memakai gambar pertama klip sebagai acuan. Gambar referensi tambahan
            (lembar karakter) hanya dipakai untuk gambar, bukan video.
          </>,
          <>
            <strong>Antrean:</strong> NexaBot menjalankan satu generate dalam satu waktu. Batch 30 video berarti 30 generate berurutan —
            siapkan waktu, dan jangan menutup aplikasi di tengah batch video (tugas video yang sudah disubmit akan dilanjutkan saat aplikasi
            dibuka lagi).
          </>,
          <>
            <strong>Tidak ada suara:</strong> NexaBot hanya membuat gambar dan video. Suara narator tetap dari Gemini atau ElevenLabs
            seperti biasa.
          </>
        ]}
      />

      <H2>7. Yang masih asumsi — dan uji live pertama</H2>
      <P>
        NexaBot tidak mempublikasikan dokumentasi API resmi. Alamat endpoint, bentuk request/response, dan kode galat yang dipakai KenStory
        adalah <strong>asumsi berlabel</strong> yang ditulis di satu modul transport — bukan fakta terverifikasi. Karena itu ada satu uji
        live yang wajib dilakukan di PC sebelum jalur ini dipakai untuk proyek sungguhan:
      </P>
      <Steps
        items={[
          <>Nyalakan NexaBot dan isi kunci (saldo minimal Rp1.000).</>,
          <>Buat proyek uji 1 adegan, pilih model Nano Banana Pro, generate 1 gambar (Rp150). Periksa gambarnya masuk dan biayanya terpotong Rp150.</>,
          <>Jadikan gambar itu video Omni Flash 1.2 (Rp300). Periksa videonya 15 detik dan biayanya terpotong Rp300.</>,
          <>
            Kalau ada galat, catat pesan persisnya — kemungkinan besar bentuk API-nya berbeda dari asumsi, dan transportnya perlu
            diperbaiki. Jangan mengulang generate yang gagal berulang kali: setiap percobaan yang lolos ke server bisa memotong kredit.
          </>
        ]}
      />

      <H2>8. Pemecahan masalah</H2>
      <Table
        head={['Gejala', 'Artinya', 'Yang dilakukan']}
        rows={[
          ['“Kunci NexaBot tidak valid”', 'Kunci salah atau belum diisi', 'Salin ulang kunci dari dashboard nexabot.id; pastikan tidak ada spasi di ujung.'],
          ['“Kredit NexaBot tidak cukup”', 'Saldo habis di tengah generate', 'Isi ulang di nexabot.id, lalu generate ulang klip yang gagal. Klip yang sudah jadi tidak perlu diulang.'],
          ['“Terlalu banyak permintaan (429)”', 'NexaBot membatasi kecepatan', 'Tunggu beberapa menit, lalu coba lagi. Batch besar sebaiknya dipecah.'],
          ['“Server NexaBot bermasalah”', 'Galat 5xx dari server', 'Tunggu dan coba lagi; tidak ada kredit yang terpotong untuk generate yang tidak selesai.'],
          ['“Endpoint tidak ditemukan (404)”', 'Bentuk API berubah dari asumsi', 'Laporkan ke pengembang — kemungkinan besar transport perlu diperbaiki, jangan dipaksa berulang kali.'],
          ['Video tidak selesai setelah 20 menit', 'Tugas macet di server', 'Batalkan job-nya; periksa saldo di dashboard sebelum generate ulang.'],
          ['Gambar/video tidak muncul padahal job selesai', 'Hasil kosong dari server', 'Periksa berkas proyek; generate ulang klip itu.']
        ]}
      />

      <H2>9. NexaBot vs jalur lain</H2>
      <Table
        head={['Jalur', 'Biaya', 'Kapan dipakai']}
        rows={[
          ['A. Google Flow (otomatis)', 'Kredit AI Pro (±1.000/bulan)', 'Gratis selama kredit ada; hasil paling bervariasi, antrean server Flow.'],
          ['B. Manual / Ekstensi', 'Gratis (kredit Flow yang sama)', 'Kamu generate sendiri di browser; tanpa otomatisasi, tanpa risiko akun.'],
          ['C. NexaBot (berbayar)', 'Rp100–Rp300 per generate', 'Kredit Flow habis, atau mau hasil konsisten tanpa antrean — dengan biaya per klip yang jelas.'],
          ['Higgsfield', 'Kredit Higgsfield (berbayar)', 'Jalur bawaan Bang Story; model paling banyak, harga per akun.']
        ]}
      />
      <P>
        Ketiga jalur A/B/C bisa dipakai bergantian per adegan: satu adegan bisa memakai NexaBot, adegan lain memakai Flow. Pilih per adegan
        di Inspector, atau per proyek di langkah Ide cerita.
      </P>
    </div>
  )
}
