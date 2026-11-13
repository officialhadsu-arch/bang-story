import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

/**
 * In-app kie.ai tutorial (tier 4, 0.3+). Prices are the verified kie.ai/pricing
 * rates (13 Nov 2026, Rp18.200/USD): 1 credit ≈ $0.005. kie.ai is the PREMIUM
 * tier — NexaBot is 5–11x cheaper for overlapping models, so the guide says
 * plainly when NOT to use kie.ai. The exact `model` strings and per-model
 * `input` shapes are labelled assumptions (K4-01) until the first live PC test.
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

export function KieAiGuideSection() {
  return (
    <div className="flex max-w-[760px] flex-col pb-24 pt-8">
      <h1 className="font-display text-[34px] font-bold tracking-[-0.015em]">Panduan Kie.ai</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        Kie.ai adalah jalur berbayar <strong>premium</strong> untuk gambar dan video AI: satu kunci, satu saldo kredit, ratusan model —
        termasuk Veo 3.1, Seedance, Kling, dan Grok yang tidak ada di jalur lain. Jalur ini <strong>bukan</strong> yang termurah: untuk
        model yang sama, NexaBot 5–11× lebih murah. Pakai kie.ai hanya saat kamu butuh model yang memang tidak ada di tempat lain — dan
        baca bagian biaya dulu sebelum menyalakan.
      </p>

      <H2>1. Cara kerja</H2>
      <P>
        KenStory mengirim prompt dan gambar acuan langsung ke API kie.ai (api.kie.ai) memakai kunci API kamu sendiri. Gambar dan video
        dibuat lewat tugas asinkron — KenStory mengirim tugas, lalu mengecek statusnya tiap beberapa detik sampai hasilnya siap dan diunduh.
        Veo 3.1 memakai endpoint sendiri di kie.ai. Tidak ada server perantara di komputer kamu, tidak ada ekstensi browser, dan tidak ada
        login Google yang dipakai.
      </P>
      <Steps
        items={[
          <>
            <strong>Gambar:</strong> prompt → tugas → satu gambar kembali.
          </>,
          <>
            <strong>Video:</strong> prompt + gambar pertama klip → tugas video (Veo 8 detik; model per detik mengikuti panjang klip) →
            KenStory mengecek status sampai selesai, lalu mengunduh hasilnya.
          </>,
          <>
            <strong>Biaya:</strong> dipotong per generate (atau per detik untuk model per detik), langsung dari kredit kie.ai kamu, dalam
            USD. Tidak ada biaya bulanan di KenStory.
          </>
        ]}
      />

      <H2>2. Mendapatkan kunci API</H2>
      <Steps
        items={[
          <>
            Buka <ExtLink href="https://kie.ai">kie.ai</ExtLink> dan buat akun.
          </>,
          <>
            Pengguna baru mendapat kredit gratis untuk uji coba — menurut FAQ beranda kie.ai 80 kredit (≈ $0,40), cukup untuk ±13 gambar
            GPT Image 2.5 atau 1 klip Veo 3.1 Fast. Jumlahnya bisa berbeda: akun yang dicek langsung pada 13 Nov 2026 mendapat 30 kredit
            tanpa riwayat pembayaran.
          </>,
          <>
            Buka <ExtLink href="https://kie.ai/api-key">kie.ai/api-key</ExtLink> dan salin kuncinya, lalu tempel di Pengaturan → Layanan AI
            dan kunci → Kie.ai.
          </>,
          <>
            Tekan <strong>Uji Koneksi</strong> di seksi yang sama. Kalau hasilnya “Terhubung ke kie.ai”, kuncinya benar. Uji ini memeriksa
            saldo dan tidak memakan biaya generate.
          </>,
          <>
            Kalau saldo gratis habis, isi ulang di dashboard kie.ai (kartu, top-up minimum ±$5 ≈ 1.000 kredit — angka ini belum
            terverifikasi langsung karena halaman billing butuh login). Kredit tidak kedaluwarsa.
          </>
        ]}
      />
      <P>
        Kunci tersimpan terenkripsi di perangkat ini (seperti semua kunci lain) dan hanya dikirim ke api.kie.ai. Jangan membagikan kunci ke
        siapa pun — siapa pun yang memegangnya bisa memakai saldomu. Di dashboard kie.ai kamu bisa membatasi kunci per jam/hari dan
        mengaktifkan IP whitelist.
      </P>

      <H2>3. Tarif (terverifikasi dari kie.ai/pricing, 13 Nov 2026)</H2>
      <P>
        Satu kredit ≈ $0,005 (200 kredit = $1). Kurs perbandingan Rp18.200/USD — kie.ai menagih dalam USD, jadi harga Rupiah bergerak
        mengikuti kurs. Tugas yang gagal tidak ditagih.
      </P>
      <Table
        head={['Model di KenStory', 'Kegunaan', 'Harga per generate']}
        rows={[
          ['GPT Image 2.5', 'Gambar 1K', 'Rp546 ($0,03)'],
          ['Nano Banana 2', 'Gambar 1K', 'Rp728 ($0,04)'],
          ['Nano Banana Pro', 'Gambar 1K/2K', 'Rp1.638 ($0,09)'],
          ['Veo 3.1 Lite', 'Video 8 detik, 1080p', 'Rp3.185 ($0,175)'],
          ['Veo 3.1 Fast', 'Video 8 detik, 1080p', 'Rp5.915 ($0,325)'],
          ['Veo 3.1 Quality', 'Video 8 detik, 1080p', 'Rp23.205 ($1,275)'],
          ['Seedance 2.5', 'Video, per detik', 'Rp1.547/dtk ($0,085/dtk)'],
          ['Kling 3.0', 'Video, per detik', 'Rp1.374/dtk ($0,0755/dtk)'],
          ['Grok Imagine', 'Video 720p, per detik', 'Rp410/dtk ($0,0225/dtk)']
        ]}
      />
      <P>
        Contoh biaya satu proyek 30 adegan (video 8 detik): Veo 3.1 Fast Rp177.450, Grok Imagine Rp98.280, Veo 3.1 Quality Rp696.150.
        Bandingkan dengan NexaBot untuk 30 video yang sama: Rp9.000. Karena itu kie.ai hanya dipakai untuk adegan yang memang butuh model
        ini — bukan untuk semua adegan.
      </P>
      <P>
        Yang sengaja tidak ada di katalog: Omni Flash 1.2. NexaBot menawarkannya Rp300 per 8 detik, sementara kie.ai mematok Rp2.912 —
        tidak ada alasan memakai jalur yang 10× lebih mahal untuk model yang sama.
      </P>

      <H2>4. Menyalakan Kie.ai di KenStory</H2>
      <Steps
        items={[
          <>Isi kunci API seperti langkah 2, lalu tekan Uji Koneksi sampai berhasil.</>,
          <>Baca peringatan biaya di Pengaturan → Layanan AI dan kunci → Kie.ai, centang kotak persetujuan, lalu nyalakan sakelarnya.</>,
          <>Pilih model Kie.ai di langkah Ide cerita, bagian Model AI — harganya tampil dalam Rupiah + USD di samping nama model.</>,
          <>Generate seperti biasa. Harga tiap generate tampil sebelum kamu menekan tombolnya.</>
        ]}
      />

      <H2>5. Gerbang persetujuan biaya</H2>
      <P>
        Kie.ai tidak pernah memotong kredit diam-diam. Ada dua gerbang, dan gerbang batch di jalur ini dibuat lebih tegas dari jalur lain
        karena selisih harganya besar:
      </P>
      <Steps
        items={[
          <>
            <strong>Satu klip:</strong> harga tampil di pemilih model dan di kartu Model AI (Rupiah + USD) sebelum generate dimulai.
          </>,
          <>
            <strong>Batch (semua gambar / semua video):</strong> sebelum satu job pun dimulai, muncul ringkasan biaya total dalam Rupiah
            dan USD dan kamu harus menekan tombol konfirmasi. Membatalkan di sini tidak memotong apa pun.
          </>
        ]}
      />
      <P>
        Yang tidak bisa dikembalikan: kredit untuk generate yang sudah selesai. Kalau kamu membatalkan batch di tengah jalan, video dan
        gambar yang sudah jadi tetap terpotong, tapi yang belum dimulai tidak dipotong. Perhatian: kie.ai tidak menyediakan tombol batal di
        server — membatalkan job hanya menghentikan pengecekan di aplikasi; tugas yang sudah terkirim di server bisa terus berjalan (dan
        tertagih). Karena itu, jangan menekan generate untuk batch besar sebelum yakin dengan totalnya.
      </P>

      <H2>6. Batas dan hal yang belum pasti</H2>
      <Steps
        items={[
          <>
            <strong>Media hanya disimpan 14 hari</strong> di kie.ai (log 2 bulan). KenStory mengunduh hasil segera setelah selesai, jadi
            berkas proyek kamu aman — tapi jangan mengandalkan tautan hasil kie.ai berhari-hari kemudian.
          </>,
          <>
            <strong>Durasi model per detik</strong> mengikuti panjang klip (dibuulatkan ke atas per detik). Durasi yang ditagih sama dengan
            durasi yang diminta — ini yang dicek di uji live pertama.
          </>,
          <>
            <strong>Tanpa lembar karakter:</strong> model gambar kie.ai di KenStory saat ini tidak memakai lembar karakter — apakah kie.ai
            menerima gambar referensi, dan lewat field apa, masih menunggu uji live. Tampilan tokoh bisa sedikit berubah antar klip.
          </>,
          <>
            <strong>Batas rate:</strong> 20 generate baru per 10 detik per akun. Request yang ditolak tidak masuk antrean — KenStory
            menjalankan satu generate dalam satu waktu, jadi batas ini praktis tidak tersentuh dari aplikasi.
          </>,
          <>
            <strong>Antrean:</strong> kie.ai menjalankan satu generate dalam satu waktu. Batch 30 video berarti 30 generate berurutan —
            siapkan waktu, dan jangan menutup aplikasi di tengah batch video (tugas video yang sudah disubmit akan dilanjutkan saat aplikasi
            dibuka lagi).
          </>,
          <>
            <strong>Tidak ada suara:</strong> kie.ai hanya membuat gambar dan video di KenStory. Suara narator tetap dari Gemini atau
            ElevenLabs seperti biasa.
          </>,
          <>
            <strong>Ketidakstabilan:</strong> dokumentasi kie.ai sendiri mengakui sesekali tidak stabil, dan ada keluhan pengguna soal
            kredit (belum terverifikasi). Mulai dari batch kecil dulu.
          </>
        ]}
      />

      <H2>7. Yang masih asumsi — dan uji live pertama</H2>
      <P>
        Dokumentasi API kie.ai bersifat publik (docs.kie.ai) — alamat, auth, endpoint, dan envelope galatnya terverifikasi. Yang{' '}
        <strong>belum terverifikasi</strong> adalah string model persis dan bentuk input per model, kosakata status Veo, dan dukungan
        referensi gambar. Karena itu ada satu uji live yang wajib dilakukan di PC sebelum jalur ini dipakai untuk proyek sungguhan:
      </P>
      <Steps
        items={[
          <>Nyalakan Kie.ai dan isi kunci (80 kredit gratis cukup untuk uji ini).</>,
          <>Buat proyek uji 1 adegan, pilih model GPT Image 2.5, generate 1 gambar (Rp546). Periksa gambarnya masuk dan biayanya terpotong sesuai.</>,
          <>Jadikan gambar itu video Veo 3.1 Fast (Rp5.915). Periksa videonya 8 detik dan biayanya terpotong sesuai.</>,
          <>Bandingkan saldo sebelum dan sesudah — kurs saat top-up bisa menggeser harga Rupiah dari katalog.</>,
          <>
            Kalau ada galat, catat pesan persisnya — kemungkinan besar string model atau bentuk inputnya berbeda dari asumsi, dan
            transportnya perlu diperbaiki. Jangan mengulang generate yang gagal berulang kali: setiap percobaan yang lolos ke server bisa
            memotong kredit.
          </>
        ]}
      />

      <H2>8. Pemecahan masalah</H2>
      <Table
        head={['Gejala', 'Artinya', 'Yang dilakukan']}
        rows={[
          ['“Kunci kie.ai tidak valid”', 'Kunci salah atau belum diisi', 'Salin ulang kunci dari kie.ai/api-key; pastikan tidak ada spasi di ujung.'],
          ['“Kredit kie.ai tidak cukup”', 'Saldo habis di tengah generate', 'Isi ulang di kie.ai, lalu generate ulang klip yang gagal. Klip yang sudah jadi tidak perlu diulang.'],
          ['“kie.ai membatasi kecepatan (429)”', 'Rate limit 20 request/10 detik', 'Tunggu sebentar, lalu coba lagi. Request yang ditolak tidak masuk antrean.'],
          ['“Server kie.ai bermasalah”', 'Galat 5xx dari server', 'Tunggu dan coba lagi; tugas yang gagal tidak ditagih.'],
          ['“Endpoint tidak ditemukan (404)”', 'Bentuk API berubah dari asumsi', 'Laporkan ke pengembang — kemungkinan besar transport perlu diperbaiki, jangan dipaksa berulang kali.'],
          ['Video tidak selesai setelah 20 menit', 'Tugas macet di server', 'Batalkan job-nya; periksa saldo di dashboard sebelum generate ulang.'],
          ['Gambar/video tidak muncul padahal job selesai', 'Hasil kosong dari server', 'Periksa berkas proyek; generate ulang klip itu.']
        ]}
      />
      <P>
        Catatan teknis: galat kie.ai datang sebagai HTTP 200 dengan kode di dalam body — KenStory memeriksa kode itu, bukan status HTTP.
        Kalau kamu melihat pesan galat mentah dari server, kode itulah yang penting.
      </P>

      <H2>9. Kie.ai vs jalur lain</H2>
      <Table
        head={['Jalur', 'Biaya', 'Kapan dipakai']}
        rows={[
          ['A. Google Flow (otomatis)', 'Kredit AI Pro (±1.000/bulan)', 'Gratis selama kredit ada; hasil paling bervariasi, antrean server Flow.'],
          ['B. Manual / Ekstensi', 'Gratis (kredit Flow yang sama)', 'Kamu generate sendiri di browser; tanpa otomatisasi, tanpa risiko akun.'],
          ['C. NexaBot (berbayar murah)', 'Rp100–Rp300 per generate', 'Jalur berbayar termurah — selalu cek dulu apakah model yang kamu mau ada di sini.'],
          ['D. Kie.ai (berbayar premium)', 'Rp546–Rp23.205 per generate', 'Hanya untuk model yang tidak ada di jalur lain: Veo 3.1, Seedance, Kling, Grok.'],
          ['Higgsfield', 'Kredit Higgsfield (berbayar)', 'Jalur bawaan Bang Story; model paling banyak, harga per akun.']
        ]}
      />
      <P>
        Keempat jalur A/B/C/D bisa dipakai bergantian per adegan: satu adegan bisa memakai kie.ai, adegan lain memakai NexaBot atau Flow.
        Pilih per adegan di Inspector, atau per proyek di langkah Ide cerita. Aturannya sederhana: <strong>cek NexaBot dulu</strong> — kalau
        modelnya ada di sana, pakai NexaBot.
      </P>
    </div>
  )
}
