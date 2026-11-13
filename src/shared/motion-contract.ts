/**
 * Kontrak D-21 — renderer motion v1 (Fase 4).
 *
 * Satu babak (index.html + style.js + act-*.js + beats.json) adalah unit
 * penulisan; satu adegan adalah unit render/persetujuan (rentang [t0,t1]
 * dari timeline babak). Agen menulis babak; aplikasi merender MP4.
 * Validator di sini menolak beats.json/HTML yang melanggar kontrak, bukan
 * memperbaikinya diam-diam (gagal-tertutup, D-11).
 */

// ---------- hasil layanan motion (dipakai IPC + UI) ----------

export type CapturePath = 'hidden' | 'offscreen' | 'puppeteer'
export type FrameFormat = 'png' | 'jpeg'

export interface MotionWorkFolderResult {
  folder: string
  babakIds: string[]
  /** Things the agent still needs (e.g. narration not recorded yet). */
  missing: string[]
  created: string[]
}

export type MotionStage = 0 | 1 | 2

export interface MotionBabakStatus {
  babakId: string
  stage: MotionStage
  /** Stage 1 = beats.json + keyframes present; stage 2 = act-*.js + style.js present. */
  beats: BeatsJson | null
  errors: string[]
  missing: string[]
  htmlErrors: string[]
  approved: number
  total: number
}

export interface RenderRangeResult {
  videoPath: string
  frames: number
  durationSec: number
  width: number
  height: number
  format: FrameFormat
  capturePath: CapturePath
  firstFrameSize: { width: number; height: number }
  /** Frames whose two captures disagreed even after all attempts (W7). */
  mismatches: number
  retries: number
  frameHashes: string[]
  /** Peak RSS of the renderer's process tree, or null when unmeasurable. */
  ramRendererPeakMb: number | null
  /** Peak growth of the whole app process tree vs before the render. */
  ramAppDeltaPeakMb: number | null
  elapsedMs: number
}

export interface RenderBabakResult extends RenderRangeResult {
  babakId: string
  durationSecTotal: number
}

// ---------- beats.json (skema v1, §3.2) ----------

export interface BeatWord {
  w: string
  start: number
  end: number
}

export type BeatStatus = 'pending' | 'approved' | 'redo'

export interface Beat {
  id: string
  sceneKey: string
  startSec: number
  endSec: number
  narration: string
  words: BeatWord[]
  keyframe: string
  easing: string
  easingOverride: string | null
  motionPrompt: string
  status: BeatStatus
}

export interface CaptionZone {
  enabled: boolean
  bottomPct: number
}

export interface BeatsJson {
  version: 1
  babakId: string
  fps: number
  width: number
  height: number
  durationSec: number
  styleId: string
  captionZone: CaptionZone
  beats: Beat[]
}

// ---------- konstanta kontrak ----------

/** Frame rate bawaan renderer (§3.5). */
export const MOTION_FPS_DEFAULT = 30
/** Pita bawah frame yang dicadangkan untuk caption bila menyala (B6, §3.4). */
export const MOTION_CAPTION_ZONE_PCT = 12
/** Jeda settle sesudah seek, sebelum tangkap (W7). */
export const MOTION_SETTLE_MS = 50
/** Percobaan tangkap per frame: maju bila dua hash sha256 sama (W7). */
export const MOTION_CAPTURE_ATTEMPTS = 3
/** Format intermediate bawaan; diputus spike 4.0 (PNG vs JPEG q90). */
export const MOTION_FRAME_FORMAT_DEFAULT: 'png' | 'jpeg' = 'png'
export const MOTION_JPEG_QUALITY = 90

/** Easing GSAP yang diterima validator (ejaan di luar daftar ini ditolak). */
export const MOTION_EASINGS = [
  'none',
  'power1.in',
  'power1.out',
  'power1.inOut',
  'power2.in',
  'power2.out',
  'power2.inOut',
  'power3.in',
  'power3.out',
  'power3.inOut',
  'power4.in',
  'power4.out',
  'power4.inOut',
  'sine.in',
  'sine.out',
  'sine.inOut',
  'expo.in',
  'expo.out',
  'expo.inOut',
  'circ.in',
  'circ.out',
  'circ.inOut',
  'back.in',
  'back.out',
  'back.inOut',
  'elastic.in',
  'elastic.out',
  'elastic.inOut',
  'bounce.in',
  'bounce.out',
  'bounce.inOut'
] as const

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

export interface BeatsValidation {
  ok: boolean
  errors: string[]
  beats: BeatsJson | null
}

/**
 * Validates a parsed beats.json value. Timing comes from word times (data),
 * never from the agent's guess — so overlaps, out-of-range beats and words
 * without times are rejected here, before any render starts.
 */
export function validateBeatsJson(data: unknown): BeatsValidation {
  const errors: string[] = []
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['beats.json bukan objek'], beats: null }
  const d = data as Record<string, unknown>
  if (d.version !== 1) errors.push(`version harus 1, dapat ${String(d.version)}`)
  if (!isStr(d.babakId) || !d.babakId.trim()) errors.push('babakId kosong')
  if (!isNum(d.fps) || d.fps <= 0) errors.push('fps harus angka > 0')
  if (!isNum(d.width) || d.width <= 0) errors.push('width harus angka > 0')
  if (!isNum(d.height) || d.height <= 0) errors.push('height harus angka > 0')
  if (!isNum(d.durationSec) || d.durationSec <= 0) errors.push('durationSec harus angka > 0')
  if (!isStr(d.styleId) || !d.styleId.trim()) errors.push('styleId kosong')
  const cz = d.captionZone as Record<string, unknown> | undefined
  if (!cz || typeof cz.enabled !== 'boolean' || !isNum(cz.bottomPct) || cz.bottomPct < 0 || cz.bottomPct > 50) {
    errors.push('captionZone harus { enabled: boolean, bottomPct: 0–50 }')
  }
  if (!Array.isArray(d.beats) || d.beats.length === 0) {
    errors.push('beats kosong — babak harus punya minimal satu beat')
    return { ok: false, errors, beats: null }
  }
  const duration = isNum(d.durationSec) ? d.durationSec : Number.POSITIVE_INFINITY
  const seen = new Set<string>()
  const ranges: { id: string; start: number; end: number }[] = []
  d.beats.forEach((raw, i) => {
    const at = `beat ke-${i + 1}`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`${at}: bukan objek`)
      return
    }
    const b = raw as Record<string, unknown>
    if (!isStr(b.id) || !b.id.trim()) errors.push(`${at}: id kosong`)
    else if (seen.has(b.id)) errors.push(`${at}: id duplikat "${b.id}"`)
    else seen.add(b.id)
    if (!isStr(b.sceneKey) || !b.sceneKey.trim()) errors.push(`${at}: sceneKey kosong`)
    if (!isNum(b.startSec) || !isNum(b.endSec)) {
      errors.push(`${at}: startSec/endSec harus angka`)
      return
    }
    // Locals: narrowing on b.startSec does not survive the closures below.
    const startSec = b.startSec
    const endSec = b.endSec
    if (startSec < 0) errors.push(`${at}: startSec negatif`)
    if (endSec <= startSec) errors.push(`${at}: endSec harus > startSec`)
    if (endSec > duration) errors.push(`${at}: endSec ${endSec} di luar durasi babak ${duration}`)
    ranges.push({ id: isStr(b.id) ? b.id : at, start: startSec, end: endSec })
    if (!isStr(b.narration)) errors.push(`${at}: narration harus teks`)
    if (!Array.isArray(b.words) || b.words.length === 0) {
      errors.push(`${at}: words kosong — waktu beat harus berasal dari waktu kata`)
    } else {
      b.words.forEach((w, j) => {
        const ww = w as Record<string, unknown>
        if (!ww || !isStr(ww.w) || !isNum(ww.start) || !isNum(ww.end) || ww.end <= ww.start) {
          errors.push(`${at}: kata ke-${j + 1} tanpa waktu yang valid`)
        } else if (ww.start < startSec - 0.001 || ww.end > endSec + 0.001) {
          errors.push(`${at}: kata "${ww.w}" di luar rentang beat`)
        }
      })
    }
    if (!isStr(b.keyframe) || !b.keyframe.trim()) errors.push(`${at}: keyframe hilang`)
    if (!isStr(b.easing) || !(MOTION_EASINGS as readonly string[]).includes(b.easing)) {
      errors.push(`${at}: easing "${String(b.easing)}" tidak dikenal`)
    }
    if (b.easingOverride !== null && (!isStr(b.easingOverride) || !(MOTION_EASINGS as readonly string[]).includes(b.easingOverride))) {
      errors.push(`${at}: easingOverride "${String(b.easingOverride)}" tidak dikenal`)
    }
    if (!isStr(b.motionPrompt)) errors.push(`${at}: motionPrompt harus teks`)
    if (b.status !== 'pending' && b.status !== 'approved' && b.status !== 'redo') {
      errors.push(`${at}: status harus pending | approved | redo`)
    }
  })
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end - 0.001) {
      errors.push(`beat "${sorted[i].id}" tumpang tindih dengan "${sorted[i - 1].id}"`)
    }
  }
  return { ok: errors.length === 0, errors, beats: errors.length === 0 ? (data as BeatsJson) : null }
}

/** The beat that carries this scene, by the shared scene key. */
export function beatForScene(beats: BeatsJson, sceneKey: string): Beat | null {
  return beats.beats.find((b) => b.sceneKey === sceneKey) ?? null
}

// ---------- permukaan kendali HTML babak (OPENER, §3.3) ----------

/**
 * The control surface a babak page exposes to the renderer. The renderer
 * never receives a GSAP object back from executeJavaScript — only primitives
 * (returning `tl` once hung a render for 132 s on a cyclic object).
 */
export interface Opener {
  ready: boolean
  DURATION: number
  /** True when every clip/media the babak needs is ready. */
  clipsReady?: () => boolean
}

/** Determinism rules a babak page must follow (checked by the HTML validator). */
export const MOTION_DETERMINISM_RULES: string[] = [
  'Semua visual adalah fungsi murni dari waktu timeline (tl.time()) — tanpa Date.now(), Math.random() tanpa seed, atau timer di jalur animasi.',
  'Tidak ada network fetch sesudah halaman dimuat; font dan aset harus file lokal di assets/.',
  'Timeline tidak boleh mengulang selamanya (repeat: -1 dilarang).',
  'Elemen berwaktu memakai class "clip" + data-start + data-duration, tampil pada [start, start+duration).',
  'Jangan tween display/visibility/autoAlpha pada .clip; animasikan anaknya. Jangan pakai CSS transform pada elemen yang dianimasikan GSAP.',
  'Jangan play()/pause()/seek media di dalam HTML — media diatur renderer.',
  'Jangan kembalikan objek GSAP dari executeJavaScript; selalu bungkus IIFE yang mengembalikan primitif.'
]

export interface BabakHtmlValidation {
  ok: boolean
  errors: string[]
}

/**
 * Static checks on a babak page's HTML: the OPENER surface must be present,
 * and the mechanical determinism traps must be absent. This cannot prove a
 * page is deterministic — it only catches the known failure shapes.
 */
export function validateBabakHtml(html: string): BabakHtmlValidation {
  const errors: string[] = []
  if (!/window\.OPENER\s*=/.test(html)) errors.push('window.OPENER tidak ditemukan')
  if (!/ready\s*:/.test(html)) errors.push('OPENER.ready tidak ditemukan')
  if (!/DURATION\s*:/.test(html)) errors.push('OPENER.DURATION tidak ditemukan')
  if (!/seek\s*:/.test(html) && !/seek\s*\(/.test(html)) errors.push('OPENER.seek tidak ditemukan')
  if (!/clipsReady/.test(html)) errors.push('OPENER.clipsReady tidak ditemukan')
  // The contract type is clipsReady?: () => boolean (motion-contract.ts): a
  // boolean `clipsReady: true` passes the presence check but throws at render
  // time (waitElectronReady calls it), so reject it here with a clear message.
  if (/clipsReady/.test(html) && !/clipsReady\s*:\s*(function|\([^)]*\)\s*=>)/.test(html)) {
    errors.push('OPENER.clipsReady harus fungsi () => boolean, bukan boolean (contoh: clipsReady: () => true)')
  }
  if (/Date\.now\s*\(/.test(html)) errors.push('Date.now() dilarang di jalur animasi (determinisme)')
  if (/Math\.random\s*\(/.test(html)) errors.push('Math.random() tanpa seed dilarang (determinisme)')
  if (/setTimeout\s*\(|setInterval\s*\(/.test(html)) errors.push('setTimeout/setInterval dilarang di jalur animasi (determinisme)')
  if (/repeat\s*:\s*-1/.test(html)) errors.push('repeat: -1 dilarang (timeline tidak boleh mengulang selamanya)')
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html)) errors.push('font CDN tidak dijamin — font harus file lokal di assets/fonts/')
  if (/<script[^>]+src\s*=\s*["'](?!https?:\/\/)[^"']+["']/.test(html)) {
    errors.push('<script src> lokal diblokir CORS saat file:// — JS harus inline')
  }
  if (/(src|href)\s*=\s*["']\/[^"']+["']/.test(html)) errors.push('path aset absolut ("/...") dilarang — pakai path relatif assets/...')
  return { ok: errors.length === 0, errors }
}
