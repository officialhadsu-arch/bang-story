/**
 * Pustaka template gaya motion (F4-08, dua tingkat).
 *
 * Tingkat aplikasi: daftar bawaan di bawah — nama starter bang-motion dan
 * brief gaya ringkas (ditulis sendiri, bukan salinan berkas bang-motion).
 * Tingkat proyek: timpa di motion-work/style/ (style.js proyek); mengubah
 * timpa menandai beat terkait "perlu Tahap 2 ulang" (status "redo").
 *
 * Gaya Berat (WebGL) mati bawaan sampai diukur di Fase 4 (D-17) — template
 * berat tidak bisa dipilih sebelum spike 4.0 mengukurnya.
 */

export interface MotionTemplate {
  id: string
  name: string
  /** bang-motion starter yang dipakai agen sebagai titik awal. */
  starter: string
  /** Gaya Berat butuh WebGL/partikel; tidak bisa dipilih sebelum diukur (D-17). */
  heavy: boolean
  description: string
  brief: {
    palette: string
    motion: string
    techniques: string
  }
}

export const MOTION_TEMPLATES: MotionTemplate[] = [
  {
    id: 'kartun-panggung',
    name: 'Kartun Panggung',
    starter: 'starter-explainer-panggung',
    heavy: false,
    description: 'Kartun datar di atas panggung: satu panggung per adegan, kamera hanya bergerak di dalam panggung, rig sendi sederhana.',
    brief: {
      palette: 'Warna datar cerah di atas latar panggung netral; satu warna aksen per panggung.',
      motion: 'Cut dan geser 96 px antar panggung; tiap panggung hidup penuh (≥10 benda beraksi), bukan gambar diam yang di-fade.',
      techniques: 'Rig sendi karakter, kamera di dalam panggung, latar bertekstur halus.'
    }
  },
  {
    id: 'jurnalisme',
    name: 'Jurnalisme Visual',
    starter: 'starter-explainer-jurnalisme',
    heavy: false,
    description: 'Gaya berita visual: dokumen, stempel, blok tanggal, dan grafik yang disusuri kamera.',
    brief: {
      palette: 'Putih kertas, hitam tinta, satu warna aksen (merah/biru) untuk sorotan data.',
      motion: 'Kamera menyusuri dunia kolase; dokumen dan grafik masuk bertahap per frasa.',
      techniques: 'Push-through antar dokumen, sapuan cahaya per segmen, teks hantu bergeser.'
    }
  },
  {
    id: 'katalog',
    name: 'Katalog',
    starter: 'starter-explainer-katalog',
    heavy: false,
    description: 'Gaya katalog produk: benda diam disusun rapi, kamera menyusuri rak dan kartu.',
    brief: {
      palette: 'Latar terang bersih, benda dengan bayangan lembut, label kecil yang rapi.',
      motion: 'Kamera menyusuri aset diam; tiap adegan 3–5 elemen yang masuk bertahap.',
      techniques: 'Grid bernapas, bentuk besar berputar lambat, transisi whip ke sudut lain.'
    }
  },
  {
    id: 'sketsa',
    name: 'Sketsa',
    starter: 'starter-explainer-sketsa',
    heavy: false,
    description: 'Gaya sketsa tangan: garis kasar, arsir, dan kertas bertekstur.',
    brief: {
      palette: 'Kertas krem, tinta hitam, satu warna cat air sebagai aksen.',
      motion: 'Garis tergambar mengikuti narasi; kamera bernapas di latar bertekstur.',
      techniques: 'Grain hidup, garis yang tergambar, sapuan cahaya lembut.'
    }
  },
  {
    id: 'aksi-kontinu',
    name: 'Aksi Kontinu',
    starter: 'starter-explainer',
    heavy: false,
    description: 'Satu dunia yang mengalir: satu subjek dengan aksi kontinu, kamera mengikuti tanpa putus.',
    brief: {
      palette: 'Satu dunia warna yang konsisten dari awal sampai akhir.',
      motion: 'Adegan berganti karena dunia/kamera bergerak (whip, push-through), bukan karena section di-fade.',
      techniques: 'Kamera bergerak, latar berpindah, partikel naik, gradien berpindah.'
    }
  },
  {
    id: 'webgl-partikel',
    name: 'WebGL / Partikel',
    starter: '(kustom — agent menulis sendiri)',
    heavy: true,
    description: 'Gaya Berat: partikel dan efek WebGL/Three.js. Mati bawaan sampai diukur di Fase 4 (D-17).',
    brief: {
      palette: 'Ditentukan di style brief proyek.',
      motion: 'Partikel dan shader WebGL; wajib lolos uji RAM Fase 4 sebelum dipakai.',
      techniques: 'WebGL/Three.js; ukur dulu, pakai kemudian.'
    }
  }
]

export function getMotionTemplate(id: string): MotionTemplate | null {
  return MOTION_TEMPLATES.find((t) => t.id === id) ?? null
}

/** Templates the user can pick today (heavy styles stay locked until measured). */
export function availableMotionTemplates(): MotionTemplate[] {
  return MOTION_TEMPLATES.filter((t) => !t.heavy)
}
