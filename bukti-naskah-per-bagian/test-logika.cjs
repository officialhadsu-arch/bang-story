// Uji logika naskah per bagian (node, tanpa Electron): rumus adegan, pembagi bagian,
// durasi custom, dan aturan adegan terakhir yang meragukan. Dijalankan:
//   node bukti-naskah-per-bagian/test-logika.cjs
// setelah logika.cjs dibangun dengan:
//   ./node_modules/.bin/esbuild bukti-naskah-per-bagian/entry-logika.ts --bundle --format=cjs --platform=node --outfile=bukti-naskah-per-bagian/logika.cjs
const m = require('./logika.cjs')
let fail = 0
function check(name, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log('LOLOS ' + name + ' -> ' + g)
  else {
    fail++
    console.log('GAGAL ' + name + ' -> dapat ' + g + ', mau ' + w)
  }
}

// Rumus tetap: preset lama harus sama persis seperti sebelumnya.
check('clipCountFor(30) preset 30 detik', m.clipCountFor(30), 5)
check('clipCountFor(60) preset 1 menit', m.clipCountFor(60), 11)
check('clipCountFor(180) preset 3 menit', m.clipCountFor(180), 33)
check('clipCountFor(300) preset 5 menit', m.clipCountFor(300), 55)
check('clipCountFor(600) preset 10 menit', m.clipCountFor(600), 109)
// Batas 120 pindah dari total menjadi per panggilan.
check('clipCountFor(90) durasi custom', m.clipCountFor(90), 16)
check('clipCountFor(1200) 20 menit', m.clipCountFor(1200), 218)
check('clipCountFor(1800) 30 menit', m.clipCountFor(1800), 327)
check('clipCountFor(15) paling pendek', m.clipCountFor(15), 3)

// Pembagi bagian: 30 adegan per panggilan.
check('SCRIPT_CHUNK_SIZE', m.SCRIPT_CHUNK_SIZE, 30)
check('ranges(16)', m.scriptChunkRanges(16), [{ start: 1, end: 16 }])
check('ranges(218)', m.scriptChunkRanges(218), [
  { start: 1, end: 30 },
  { start: 31, end: 60 },
  { start: 61, end: 90 },
  { start: 91, end: 120 },
  { start: 121, end: 150 },
  { start: 151, end: 180 },
  { start: 181, end: 210 },
  { start: 211, end: 218 }
])
check('ranges(327)', m.scriptChunkRanges(327).length, 11)
check('ranges(327) terakhir', m.scriptChunkRanges(327)[10], { start: 301, end: 327 })
check('ranges(5)', m.scriptChunkRanges(5), [{ start: 1, end: 5 }])

// Durasi custom 15-1800 detik.
check('parse 90', m.parseCustomDuration('90'), { sec: 90 })
check('parse 1800', m.parseCustomDuration('1800'), { sec: 1800 })
check('parse 15', m.parseCustomDuration('15'), { sec: 15 })
check('parse " 90 "', m.parseCustomDuration(' 90 '), { sec: 90 })
check('parse 90.5 dibulatkan', m.parseCustomDuration('90.5'), { sec: 91 })
check('parse 5 ditolak', m.parseCustomDuration('5'), { error: 'Durasi paling pendek 15 detik.' })
check('parse 1801 ditolak', m.parseCustomDuration('1801'), { error: 'Durasi paling panjang 1800 detik (30 menit).' })
check('parse 900 diterima', m.parseCustomDuration('900'), { sec: 900 })
check('parse abc ditolak', m.parseCustomDuration('abc'), { error: 'Tulis durasi dalam angka, misalnya 90.' })
check('parse kosong ditolak', m.parseCustomDuration(''), { error: 'Tulis durasi dalam angka, misalnya 90.' })

// Adegan terakhir yang meragukan: dibuang lalu dilanjutkan.
const ok12 = 'Satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas dua belas.'
check('narasi 12 kata + titik = tidak meragukan', m.isDoubtfulScene(ok12), false)
check('narasi 12 kata + seru = tidak meragukan', m.isDoubtfulScene(ok12.replace('.', '!')), false)
check('narasi 12 kata + tanya = tidak meragukan', m.isDoubtfulScene(ok12.replace('.', '?')), false)
check('narasi 12 kata + elipsis = tidak meragukan', m.isDoubtfulScene(ok12.replace('.', '…')), false)
check('narasi 12 kata tanpa tanda akhir = meragukan', m.isDoubtfulScene(ok12.slice(0, -1)), true)
check('narasi 3 kata = meragukan', m.isDoubtfulScene('tiga kata saja.'), true)
check('narasi 9 kata + titik = meragukan', m.isDoubtfulScene('Satu dua tiga empat lima enam tujuh delapan sembilan.'), true)
check('narasi 10 kata + titik = tidak meragukan', m.isDoubtfulScene('Satu dua tiga empat lima enam tujuh delapan sembilan sepuluh.'), false)
check('narasi kosong = meragukan', m.isDoubtfulScene(''), true)
check('narasi hanya spasi = meragukan', m.isDoubtfulScene('   '), true)
check('tag vokal di ujung diabaikan', m.isDoubtfulScene(ok12 + ' <chuckles>'), false)
check('tag vokal menutupi akhir tanpa titik = meragukan', m.isDoubtfulScene(ok12.slice(0, -1) + ' <chuckles>'), true)
check('tag vokal bukan kata', m.wordCount('Satu dua <short pause> tiga.'), 3)

console.log(fail === 0 ? 'SEMUA LOLOS' : 'GAGAL: ' + fail)
process.exit(fail === 0 ? 0 : 1)
