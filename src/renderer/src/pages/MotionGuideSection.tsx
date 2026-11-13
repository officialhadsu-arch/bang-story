import type { ReactNode } from 'react'

/**
 * In-app Motion tutorial (Fase 4, 0.4+). Two stages, like the Fadli harness:
 * Tahap 1 the agent writes beats.json + keyframes and STOPS for approval;
 * Tahap 2 it writes the babak page (index.html + style.js + act-*.js) and
 * the app renders the MP4. Cost from the app is Rp0 — the agent runs on the
 * user's own subscription, outside the app; no agent key is stored here.
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

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-paper">
      {children}
    </pre>
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

export function MotionGuideSection() {
  return (
    <div className="flex max-w-[760px] flex-col pb-24 pt-8">
      <h1 className="font-display text-[34px] font-bold tracking-[-0.015em]">Panduan Motion</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
        Motion adalah jalur visual tingkat 3: adeganmu digambar sebagai kode animasi (HTML + GSAP) oleh agent coding — Claude, Kiro, atau
        Antigravity — lalu aplikasi merendernya jadi MP4. Bukan gambar AI, bukan video AI: ini motion graphic yang ditulis sebagai kode,
        seperti video explainer bang-motion.
      </p>

      <H2>Cara kerjanya (dua tahap + satu gerbang)</H2>
      <Steps
        items={[
          <>
            <strong className="text-ink">Tahap 1 — Rancangan.</strong> Agent menulis <code>beats.json</code> (waktu tiap adegan dari waktu
            kata narasi) dan satu frame kunci per adegan, lalu <strong className="text-ink">berhenti</strong>. Kamu menyetujui atau menolak
            tiap beat di langkah Rancangan.
          </>,
          <>
            <strong className="text-ink">Gerbang persetujuan.</strong> Ekspor berhenti bila ada beat motion yang belum disetujui. Beat yang
            ditolak ditandai “redo” dan ditulis ulang agent.
          </>,
          <>
            <strong className="text-ink">Tahap 2 — Babak.</strong> Sesudah semua beat disetujui, agent menulis halaman babak (
            <code>index.html</code> + <code>style.js</code> + <code>act-*.js</code>). Aplikasi merendernya frame demi frame jadi MP4 — di
            jendela tersembunyi, dengan ukuran dipaksa dari konfigurasi (bukan dari halaman), dan tiap frame ditangkap dua kali untuk
            memastikan hasilnya stabil.
          </>
        ]}
      />

      <H2>Langkah 0 — Nyalakan Motion</H2>
      <Steps
        items={[
          <>
            Di <strong className="text-ink">Pengaturan › Layanan AI dan kunci › Motion</strong>, nyalakan sakelar Motion. Sakelar ini mati
            secara bawaan.
          </>,
          <>
            Pilih preset: <strong className="text-ink">Motion Grafik penuh</strong> mengubah semua adegan jadi motion;{' '}
            <strong className="text-ink">Hybrid</strong> membiarkanmu memilih adegan kunci satu per satu di Jalur visual.
          </>,
          <>
            Rekam suara narasi dulu (langkah Storyboard › Buat suara narasi). Waktu kata dari narasi itulah yang menentukan durasi tiap
            beat — agent tidak boleh menebak durasi.
          </>
        ]}
      />

      <H2>Langkah 1 — Siapkan folder kerja</H2>
      <P>
        Di langkah Rancangan, tekan <strong className="text-ink">Perbarui Folder Motion</strong>. Aplikasi menulis folder{' '}
        <code>motion-work/</code> di dalam folder proyek: instruksi kerja agent (<code>CLAUDE.md</code>/<code>AGENTS.md</code>), instruksi
        globalmu (<code>folme.md</code> — edit sesukamu, tidak pernah ditimpa), naskah dan waktu kata tiap adegan di <code>input/</code>,
        brief gaya di <code>input/gaya.md</code>, dan validator beat di <code>tools/</code>.
      </P>
      <Table
        head={['Folder', 'Isi', 'Siapa yang menulis']}
        rows={[
          ['motion-work/input/', 'Naskah, waktu kata, audio narasi, brief gaya', 'Aplikasi'],
          ['motion-work/style/', 'Timpa gaya proyek (style.js)', 'Kamu'],
          ['motion-work/tools/', 'Validator beats.json', 'Aplikasi'],
          ['motion-work/out/<babak>/', 'beats.json, keyframes/, index.html, style.js, act-*.js', 'Agent'],
          ['motion-work/out/<babak>/render/', 'Hasil render babak (babak.mp4)', 'Aplikasi']
        ]}
      />

      <H2>Langkah 2 — Perintah untuk agent</H2>
      <P>
        Buka folder <code>motion-work/</code> di agent coding pilihanmu (Claude, Kiro, atau Antigravity). Aplikasi harus tetap terbuka
        selama agent bekerja. Contoh perintah pertama:
      </P>
      <Code>{`Baca motion-work/CLAUDE.md dan motion-work/input/gaya.md.
Kerjakan Tahap 1 untuk babak-1: tulis beats.json dan frame kunci
tiap beat. Berhenti sesudah Tahap 1 — jangan lanjut ke Tahap 2
sebelum saya menyetujui beatnya di Rancangan.`}</Code>
      <P>
        Sesudah kamu menyetujui semua beat, perintah keduanya:
      </P>
      <Code>{`Semua beat babak-1 sudah disetujui. Kerjakan Tahap 2:
tulis index.html + style.js + act-*.js, lalu jalankan
node tools/validate-beats.mjs babak-1 sebelum menyerahkan.`}</Code>
      <P>
        Agent yang sama boleh mengerjakan beberapa babak sekaligus, tetapi tiap babak tetap melewati gerbang persetujuannya sendiri. Satu
        babak berisi 3–8 adegan (paling lama ±30 detik); proyek panjang dipecah jadi beberapa babak.
      </P>

      <H2>Gaya dan template</H2>
      <P>
        Enam gaya bawaan tersedia di Rancangan: Kartun Panggung, Jurnalisme Visual, Katalog, Sketsa, Aksi Kontinu, dan WebGL/Partikel.
        Gaya WebGL/Partikel adalah gaya Berat — terkunci sampai diukur di Fase 4, karena butuh RAM lebih besar. Mengubah timpa gaya proyek
        (style.js di Rancangan) menandai semua beat yang sudah disetujui jadi “redo”, karena Tahap 2 harus ditulis ulang mengikuti gaya
        baru. Mengubah pustaka template tidak menyentuh proyek yang sudah jadi.
      </P>

      <H2>Caption di adegan motion</H2>
      <P>
        Caption di adegan motion defaultnya <strong className="text-ink">mati</strong> — halaman motion memakai seluruh frame, dan
        aplikasi tidak pernah membiarkan HTML motion menggambar caption sendiri. Bila kamu menyalakan caption untuk satu adegan (di panel
        adegan, bagian “Caption adegan ini”), pita bawah 12% frame dicadangkan untuk caption dan agent dilarang menaruh teks kunci di
        pita itu. Aturan ini sama di pratinjau dan di ekspor.
      </P>

      <H2>Biaya dan batas</H2>
      <Steps
        items={[
          <>
            <strong className="text-ink">Rp0 tunai dari aplikasi.</strong> Agent memakai langgananmu sendiri (AI Pro, Kiro, atau lainnya).
            KenStory tidak menyimpan kunci agent apa pun dan tidak mengirim apa pun ke agent — agent bekerja di folder di komputermu.
          </>,
          <>
            <strong className="text-ink">Tidak ada gambar/video AI di adegan motion.</strong> Jalur ini tidak memakai Higgsfield, Google
            Flow, NexaBot, atau kunci apa pun di Pengaturan.
          </>,
          <>
            <strong className="text-ink">Gaya Berat mati bawaan.</strong> WebGL/partikel hanya bisa dipakai sesudah diukur di Fase 4.
          </>,
          <>
            <strong className="text-ink">Satu render dalam satu waktu.</strong> Aplikasi merender satu babak dalam satu waktu supaya RAM
            tidak membengkak di laptop 4 GB.
          </>
        ]}
      />

      <H2>Pemecahan masalah</H2>
      <Table
        head={['Gejala', 'Artinya', 'Yang dilakukan']}
        rows={[
          ['beats.json tidak valid', 'Beat tumpang tindih, keluar durasi, kata tanpa waktu, atau keyframe hilang', 'Minta agent memperbaiki dan menjalankan tools/validate-beats.mjs'],
          ['Babak tidak siap dalam 30 detik', 'OPENER.ready tidak pernah true — biasanya CDN (GSAP) tidak terjangkau saat load', 'Periksa koneksi internet saat render, atau minta agent menaruh pustaka secara inline'],
          ['Ukuran frame pertama bukan 1280×720', 'Halaman babak memaksa ukuran sendiri (kontrak D-11)', 'Render berhenti dengan sengaja — minta agent menghapus pengaturan ukuran dari HTML'],
          ['Ukuran frame pertama 1080×1080 (mau 9:16)', 'Layar landscape menjepit jendela potret: tangkapan Electron tidak bisa lebih tinggi dari layar', 'Untuk 9:16 pakai jalur Puppeteer (headless, tanpa layar) — pasang Puppeteer dulu, lalu render ulang; di laptop juga sama selama layarnya landscape'],
          ['Frame tidak stabil', 'Dua tangkapan satu frame berbeda (animasi tidak deterministik)', 'Minta agent menghapus Date.now()/Math.random()/timer dari jalur animasi'],
          ['Ekspor berhenti: beat belum disetujui', 'Gerbang Tahap 1 bekerja', 'Setujui beat di Rancangan, atau tandai “redo” untuk ditulis ulang'],
          ['Tidak ada adegan motion', 'Folder kerja dibuat sebelum ada adegan motion', 'Ubah Jalur visual satu adegan jadi Motion, lalu Perbarui Folder Motion lagi']
        ]}
      />
    </div>
  )
}
