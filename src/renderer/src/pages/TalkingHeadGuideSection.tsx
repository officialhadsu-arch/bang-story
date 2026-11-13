import type { ReactNode } from 'react'

/**
 * In-app Talking Head tutorial (Fase 5, 0.5). The narration-first flow: import a recording of a
 * person speaking, transcribe it once with local Whisper, cut the pauses and filler words, group it
 * into scenes, and export. No face tracking, no diarization, no B-roll, no TTS in this mode.
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

export function TalkingHeadGuideSection() {
  return (
    <div className="flex max-w-[900px] flex-col gap-3.5 px-14 pb-24 pt-8">
      <div>
        <h1 className="font-display text-[34px] font-bold tracking-[-0.015em]">Panduan Talking Head</h1>
        <p className="mt-2 max-w-[700px] text-[15px] text-ink-2">
          Mode Talking Head mengubah rekaman orang berbicara menjadi video adegan-per-adegan: transkrip dibuat dari rekaman, jeda dan kata
          pengisi dipotong, lalu adegan disusun dan diekspor. Naskah mengikuti rekaman — bukan sebaliknya.
        </p>
      </div>

      <H2>1 · Cara kerja singkat</H2>
      <Steps
        items={[
          <>
            <strong className="text-ink">Pilih mode di langkah Ide.</strong> Saat membuat proyek baru, pilih <strong className="text-ink">Talking Head</strong>. Mode
            adalah atribut lahir proyek: setelah adegan ada, mode tidak bisa diganti — ganti mode berarti buat proyek baru.
          </>,
          <>
            <strong className="text-ink">Impor rekaman (langkah Transkrip).</strong> Pilih satu file video orang berbicara (MP4, MOV, atau WebM). Audionya
            diekstrak sekali jadi WAV 16 kHz mono — semua suara adegan berasal dari ekstraksi ini, bukan dari trek audio file video.
          </>,
          <>
            <strong className="text-ink">Buat transkrip.</strong> Whisper lokal (model Small, diunduh sekali di Pengaturan, bagian Caption akurat) mengenali kata per
            kata beserta waktunya. Tanpa kunci API, tanpa biaya. Transkrip dibuat sekali; kalau rekaman diganti, transkrip harus dibuat ulang.
          </>,
          <>
            <strong className="text-ink">Tandai yang dipotong.</strong> Jeda di atas 0,5 detik dan kata pengisi (<Code>eh, ehm, hmm, anu, apa, ya, kan, gitu, nah</Code>)
            otomatis ditandai. Klik kata mana pun untuk menandai Buang / Biarkan. Kata yang dicoret tidak masuk adegan dan tidak masuk caption.
          </>,
          <>
            <strong className="text-ink">Susun adegan.</strong> AI mengelompokkan transkrip jadi adegan 30–60 detik (judul bisa diubah). Kalau AI tidak tersedia — tidak ada
            kunci LLM — adegan disusun otomatis dari jeda panjang. Tidak ada jalan buntu. Susunan adegan tidak disimpan — setelah memuat ulang,
            klik Susun adegan lagi; selama transkrip dan tanda buang tidak berubah, hasilnya sama.
          </>,
          <>
            <strong className="text-ink">Buat adegan, periksa, ekspor.</strong> Tombol <strong className="text-ink">Buat adegan</strong> memotong tiap adegan dari rekaman
            (satu file video + satu file audio per adegan, potongan dihapus dari keduanya). Di langkah Adegan, atur komposisi dan zoom tiap adegan,
            lalu lanjut ke Editor dan ekspor seperti biasa.
          </>
        ]}
      />

      <H2>2 · Aturan potong</H2>
      <Table
        head={['Yang dipotong', 'Aturan', 'Bisa diubah?']}
        rows={[
          ['Jeda antar kata', 'Lebih dari 0,5 detik', 'Tidak — ambang tetap di versi ini'],
          ['Kata pengisi', 'Daftar bawaan 9 kata (eh, ehm, hmm, anu, apa, ya, kan, gitu, nah)', 'Ya — ubah daftarnya, lalu Terapkan'],
          ['Kata apa pun', 'Klik kata di transkrip', 'Ya — klik lagi untuk mengembalikan']
        ]}
      />
      <P>
        Menerapkan daftar kata pengisi yang baru mengatur ulang tanda Buang/Biarkan ke hasil otomatis — tanda manual yang sudah dibuat akan hilang.
        Potongan diterapkan saat adegan dibuat; mengubah tanda sesudah adegan dibuat tidak mengubah adegan lama — buat ulang adegannya.
      </P>

      <H2>3 · Komposisi dan zoom</H2>
      <P>
        Tiap adegan punya komposisi: <strong className="text-ink">Penuh</strong> (seluruh frame), <strong className="text-ink">Close-up tengah / kiri / kanan</strong>{' '}
        (memperbesar 60% bagian frame itu). Zoom otomatis hanya zoom-in halus di tengah frame, memakai mesin kamera yang sama dengan mode lain.
        Yang tampil di pratinjau itulah yang keluar di ekspor — rumusnya sama di kedua sisi.
      </P>

      <H2>4 · Batas versi ini (v1)</H2>
      <Table
        head={['Tidak ada di v1', 'Artinya']}
        rows={[
          ['Pelacakan wajah', 'Close-up tidak mengikuti wajah — hanya memperbesar bagian frame yang dipilih'],
          ['Diarization', 'Dianggap satu pembicara; tidak ada pemisah pembicara'],
          ['B-roll otomatis', 'Tidak ada gambar/video sisipan otomatis'],
          ['Tulis-ulang naskah AI', 'Transkrip verbatim — hanya dipotong, tidak ditulis ulang'],
          ['TTS di mode ini', 'Suara adegan selalu dari rekaman; tidak ada suara narator'],
          ['Terjemah subtitle', 'Caption hanya dalam bahasa rekaman']
        ]}
      />

      <H2>5 · Caption</H2>
      <P>
        Caption karaoke dibuat dari kata-kata transkrip beserta waktunya (bukan perkiraan), jadi kata yang tampil mengikuti suara rekaman. Caption
        bisa dibakar ke video atau ditulis sebagai file .srt di dialog Ekspor, sama seperti mode lain. Gaya caption diatur di Editor.
      </P>

      <H2>6 · Biaya</H2>
      <P>
        Transkrip (Whisper lokal), potong, susun adegan otomatis, dan ekspor semuanya <strong className="text-ink">gratis (Rp0)</strong> — tidak ada
        panggilan berbayar. Satu-satunya yang memakai kunci adalah susun adegan dengan AI (LLM yang sudah diatur di Pengaturan); tanpa kunci itu,
        susun adegan otomatis yang dipakai, tanpa biaya dan tanpa galat.
      </P>

      <H2>7 · Pemecahan masalah</H2>
      <Table
        head={['Gejala', 'Penyebab dan jalan keluar']}
        rows={[
          ['Pilihan Talking Head tidak muncul di langkah Ide', 'Mode masih dimatikan. Nyalakan di Pengaturan → Layanan AI dan kunci → Talking Head.'],
          ['Tombol Buat transkrip tidak bisa diklik', 'Model Whisper belum diunduh. Unduh dulu di Pengaturan, bagian Caption akurat.'],
          ['Transkrip gagal: "tidak mengenali kata apa pun"', 'Whisper tidak mendengar kata di audio rekaman. Periksa audionya — rekaman tanpa suara atau suara terlalu pelan.'],
          ['Susun adegan selalu "otomatis (AI tidak tersedia)"', 'Tidak ada kunci LLM yang diatur. Itu bukan galat — fallback deterministik tetap menyusun adegan. Untuk susun AI, atur kunci LLM di Pengaturan.'],
          ['Adegan kosong / tidak ada adegan yang dibuat', 'Transkrip tidak punya kata terpakai (semuanya terpotong?). Biarkan sebagian kata, lalu susun dan buat ulang.'],
          ['Suara adegan tidak sama dengan gambarnya', 'Video dan audio adegan dipotong dari daftar potong yang sama, jadi mestinya sinkron. Kalau tetap tidak sinkron, laporkan beserta nama proyek dan nomor adegannya.'],
          ['Impor rekaman ditolak', 'Pakai file video MP4, MOV, atau WebM. File audio saja (MP3/WAV) tidak bisa — mode ini butuh rekaman video.']
        ]}
      />
    </div>
  )
}
