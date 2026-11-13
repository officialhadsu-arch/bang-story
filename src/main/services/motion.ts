/**
 * Motion harness (Fase 4, D-21): the project's motion-work/ folder — the
 * agent's workspace. The app writes the brief (script, word times, style),
 * the agent writes the babak (beats.json + keyframes + act-*.js + style.js),
 * the app validates and renders. No API key is involved on either side: the
 * agent runs on the user's own subscription, outside the app.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateBabakHtml, validateBeatsJson, type Beat, type BeatsJson, type MotionBabakStatus, type MotionStage, type MotionWorkFolderResult } from '@shared/motion-contract'
import { MOTION_TEMPLATES, availableMotionTemplates, getMotionTemplate, type MotionTemplate } from '@shared/motion-templates'
import { estimateWordTimings } from '@shared/captions'
import { getBundle, getClip, patchClip } from '../repo'
import { motionWorkFolder } from '../paths'

export const MOTION_BABAK_SIZE = 8

export function motionBabakDir(projectId: string, babakId: string): string {
  return join(motionWorkFolder(projectId), 'out', babakId)
}

export function motionBeatsPath(projectId: string, babakId: string): string {
  return join(motionBabakDir(projectId, babakId), 'beats.json')
}

export function motionHtmlPath(projectId: string, babakId: string): string {
  return join(motionBabakDir(projectId, babakId), 'index.html')
}

/** Babak folders already present under motion-work/out/. */
export function motionBabaksOf(projectId: string): string[] {
  const out = join(motionWorkFolder(projectId), 'out')
  if (!existsSync(out)) return []
  return readdirSync(out, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

/** Group motion scenes into babak folders of at most MOTION_BABAK_SIZE scenes. */
export function motionBabakIdFor(index: number): string {
  return `babak-${Math.floor(index / MOTION_BABAK_SIZE) + 1}`
}

const CLAUDE_MD = `# Instruksi kerja agent — Motion KenStory (Fase 4, kontrak D-21)

Kamu menulis babak motion (HTML + GSAP) untuk proyek KenStory. Aplikasi merender MP4-nya; kamu TIDAK merender.

## Dua tahap (gerbang Tahap 1 benar-benar berhenti)

**Tahap 1 — Rancangan.** Tulis \`out/<babakId>/beats.json\` (ikuti skema di bawah) dan frame kunci
\`out/<babakId>/keyframes/<beatId>.png\` untuk tiap beat. Berhenti. Pengguna menyetujui/menolak tiap beat
di halaman Rancangan; beat yang ditolak (status "redo") kamu tulis ulang.

**Tahap 2 — Babak.** Sesudah semua beat disetujui, tulis \`out/<babakId>/index.html\` (satu berkas,
CSS/JS inline), \`style.js\` (gaya bersama babak), dan \`act-*.js\` (satu timeline GSAP per babak, dijeda).
Jalankan \`node tools/validate-beats.mjs <babakId>\` sebelum menyerahkan.

## Kontrak beats.json (v1)

\`\`\`jsonc
{
  "version": 1, "babakId": "babak-1", "fps": 30, "width": 1280, "height": 720,
  "durationSec": 24.5, "styleId": "kartun-panggung-03",
  "captionZone": { "enabled": false, "bottomPct": 12 },
  "beats": [
    { "id": "b01", "sceneKey": "03", "startSec": 2.10, "endSec": 5.40,
      "narration": "Kalimat narasi adegan ini.",
      "words": [ { "w": "Kalimat", "start": 2.10, "end": 2.55 } ],
      "keyframe": "keyframes/b01.png", "easing": "power2.out", "easingOverride": null,
      "motionPrompt": "Raka mengangkat lengan; kamera push pelan.", "status": "approved" }
  ]
}
\`\`\`

Aturan: \`startSec\`/\`endSec\` tiap beat WAJIB dari waktu kata di \`input/waktu-kata-*.json\` (data Whisper +
penyelarasan) — jangan menebak durasi. Beat tidak boleh tumpang tindih atau keluar durasi babak. Kata tanpa
waktu ditolak validator. \`easing\` dari prompt motion + berkas gaya; \`easingOverride\` hanya diisi pengguna
di Rancangan.

## Kontrak HTML babak (OPENER)

\`\`\`js
window.OPENER = {
  ready: true,                    // true bila halaman + font + aset siap
  DURATION: 24.5,                 // detik, harus == beats.json durationSec
  tl: <GSAP timeline, dijeda>,    // satu timeline per babak
  seek: async (t) => {},          // pindah ke detik t
  seekFrame: async (t) => {},
  clipsReady: () => true          // semua klip/media siap
};
\`\`\`

Determinisme (pelanggaran = ditolak, bukan diperbaiki diam-diam): semua visual fungsi murni dari
\`tl.time()\` — tanpa \`Date.now()\`, \`Math.random()\` tanpa seed, timer di jalur animasi, atau fetch
sesudah load; tanpa \`repeat: -1\`; elemen berwaktu \`class="clip" + data-start + data-duration\`;
jangan tween display/visibility/autoAlpha pada \`.clip\`; jangan pakai CSS transform pada elemen yang
dianimasikan GSAP; jangan play()/pause()/seek media di HTML; font WAJIB file lokal di \`assets/fonts/\`
(CDN tidak dijamin); aset path relatif \`assets/...\`; JS inline (module lokal <script src> diblokir
CORS saat file://).

## Hukum penulisan (bang-motion)

Ikuti skill bang-motion: bukan PPT — adegan berganti karena dunia/kamera bergerak, bukan section
di-fade; satu benang merah visual; maksimum dua tingkat teks per adegan; tiap adegan 3–5 elemen yang
masuk bertahap per frasa. Mulai dari starter gayanya (lihat \`input/gaya.md\`). Caption BUKAN urusanmu:
aplikasi yang menggambarnya (default mati di adegan motion); jangan menaruh teks kunci di pita bawah
12% frame bila caption menyala (lihat \`captionZone\` di beats.json).
`

const FOLME_MD = `# folme.md — instruksi global (milik pengguna, bisa diedit)

Tulis instruksi global untuk agent motion di sini — misalnya gaya yang selalu dipakai, hal yang
dilarang, atau cara agent harus bertanya sebelum menulis. Berkas ini tidak pernah ditimpa aplikasi;
edit manual kamu aman.

Contoh:
- Selalu pakai gaya "Kartun Panggung" kecuali diminta lain.
- Jangan pernah memakai warna merah untuk teks.
- Bila ragu soal durasi, tanya dulu sebelum menulis beats.json.
`

function styleSkeleton(template: MotionTemplate): string {
  return `// style.js — gaya bersama babak (timpa proyek; ubah berkas ini menandai beat terkait "perlu Tahap 2 ulang").
// Template: ${template.name} (starter bang-motion: ${template.starter})
// Palet: ${template.brief.palette}
// Bahasa gerak: ${template.brief.motion}
// Teknik: ${template.brief.techniques}
export const STYLE = {
  id: '${template.id}',
  palette: {},
  motion: {}
}
`
}

const VALIDATE_BEATS_MJS = `// Validator beats.json untuk agent (cerminan src/shared/motion-contract.ts di aplikasi).
// Pakai: node tools/validate-beats.mjs <babakId>
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const babakId = process.argv[2]
if (!babakId) { console.error('Pakai: node tools/validate-beats.mjs <babakId>'); process.exit(2) }
const dir = join(process.cwd(), '..', 'out', babakId)
const errors = []
const read = (p) => { try { return JSON.parse(readFileSync(join(dir, p), 'utf8')) } catch (e) { errors.push(p + ': ' + e.message); return null } }
const b = read('beats.json')
if (b) {
  if (b.version !== 1) errors.push('version harus 1')
  if (!Array.isArray(b.beats) || !b.beats.length) errors.push('beats kosong')
  else {
    const sorted = [...b.beats].sort((x, y) => x.startSec - y.startSec)
    for (let i = 1; i < sorted.length; i++) if (sorted[i].startSec < sorted[i - 1].endSec - 0.001) errors.push('beat "' + sorted[i].id + '" tumpang tindih')
    for (const beat of b.beats) {
      if (beat.endSec > b.durationSec) errors.push('beat "' + beat.id + '" di luar durasi babak')
      if (!Array.isArray(beat.words) || !beat.words.length) errors.push('beat "' + beat.id + '": words kosong')
      if (beat.keyframe && !existsSync(join(dir, beat.keyframe))) errors.push('beat "' + beat.id + '": keyframe hilang: ' + beat.keyframe)
      if (!['pending', 'approved', 'redo'].includes(beat.status)) errors.push('beat "' + beat.id + '": status tidak dikenal')
    }
  }
}
if (errors.length) { console.error('TIDAK VALID:\\n- ' + errors.join('\\n- ')); process.exit(1) }
console.log('beats.json ' + babakId + ' valid.')
`

/**
 * Creates (or refreshes) the motion-work/ folder: agent instructions, the
 * user's global instructions (never overwritten), per-scene input files
 * (script, word times, narration audio paths, style brief), the style
 * skeleton and the agent-side validator. Motion scenes are grouped into
 * babak folders (max 8 scenes each) and each clip is linked to its babak
 * and beat id. Narration must already be recorded; scenes without a voice
 * are listed in `missing` instead of failing the whole folder.
 */
export function prepareMotionWorkFolder(projectId: string, styleId?: string): MotionWorkFolderResult {
  const root = motionWorkFolder(projectId)
  const created: string[] = []
  const missing: string[] = []
  const ensure = (dir: string): void => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
      created.push(dir)
    }
  }
  ensure(root)
  ensure(join(root, 'input'))
  ensure(join(root, 'style'))
  ensure(join(root, 'tools'))
  ensure(join(root, 'out'))
  const writeIfNew = (path: string, content: string): void => {
    if (!existsSync(path)) {
      writeFileSync(path, content, 'utf8')
      created.push(path)
    }
  }
  writeIfNew(join(root, 'CLAUDE.md'), CLAUDE_MD)
  writeIfNew(join(root, 'AGENTS.md'), CLAUDE_MD)
  writeIfNew(join(root, 'folme.md'), FOLME_MD)
  writeIfNew(join(root, 'tools', 'validate-beats.mjs'), VALIDATE_BEATS_MJS)
  writeFileSync(
    join(root, 'tools', 'README.md'),
    '# tools/\n\n- `validate-beats.mjs <babakId>` — periksa beats.json sebelum diserahkan (cerminan validator aplikasi).\n- `snap.mjs` — alat verifikasi frame bang-motion; jalankan dari skill bang-motion bila terpasang, bukan dari sini.\n',
    'utf8'
  )

  const bundle = getBundle(projectId)
  const template = getMotionTemplate(styleId ?? '') ?? availableMotionTemplates()[0]!
  writeIfNew(join(root, 'style', 'style.js'), styleSkeleton(template))
  const styleBrief = [
    `# Gaya: ${template.name}`,
    '',
    `Starter bang-motion: ${template.starter}`,
    '',
    `Palet: ${template.brief.palette}`,
    '',
    `Bahasa gerak: ${template.brief.motion}`,
    '',
    `Teknik: ${template.brief.techniques}`,
    ''
  ].join('\n')
  writeFileSync(join(root, 'input', 'gaya.md'), styleBrief, 'utf8')

  const motionClips = bundle.clips.filter((c) => c.visualProvider === 'motion')
  const babakIds: string[] = []
  motionClips.forEach((clip, i) => {
    const babakId = motionBabakIdFor(i)
    const beatId = `b${String((i % MOTION_BABAK_SIZE) + 1).padStart(2, '0')}`
    if (!babakIds.includes(babakId)) babakIds.push(babakId)
    ensure(join(root, 'out', babakId, 'keyframes'))
    const audio = clip.audioAssetId ? bundle.assets.find((a) => a.id === clip.audioAssetId) : undefined
    const words = audio?.meta.words?.length
      ? audio.meta.words
      : estimateWordTimings(clip.narration, clip.durationMs / 1000)
    writeFileSync(
      join(root, 'input', `naskah-${clip.sceneKey}.txt`),
      [`Adegan ${clip.sceneKey} — ${clip.title}`, '', `Narasi: ${clip.narration}`, '', `Cerita: ${clip.story}`, '', `Prompt visual: ${clip.visualPrompt}`, ''].join('\n'),
      'utf8'
    )
    writeFileSync(join(root, 'input', `waktu-kata-${clip.sceneKey}.json`), JSON.stringify(words, null, 2), 'utf8')
    if (audio) {
      writeFileSync(join(root, 'input', `audio-${clip.sceneKey}.txt`), `Audio narasi adegan ${clip.sceneKey}: ${audio.localPath} (${audio.durationMs ?? '?'} ms)\n`, 'utf8')
    } else {
      missing.push(`Adegan ${clip.sceneKey}: narasi belum direkam — rekam dulu, lalu Perbarui Folder Kerja.`)
    }
    if (clip.motionBabakId !== babakId || clip.motionBeatId !== beatId) {
      patchClip(clip.id, { motionBabakId: babakId, motionBeatId: beatId })
    }
  })
  return { folder: root, babakIds, missing, created }
}

// ---------- beats.json ----------

/** Reads and validates one babak's beats.json (plus its HTML, when present). */
export function readMotionBabak(projectId: string, babakId: string): MotionBabakStatus {
  const dir = motionBabakDir(projectId, babakId)
  const errors: string[] = []
  const missing: string[] = []
  let beats: BeatsJson | null = null
  const beatsPath = join(dir, 'beats.json')
  if (!existsSync(beatsPath)) {
    missing.push('beats.json belum ditulis agent (Tahap 1).')
  } else {
    try {
      const parsed: unknown = JSON.parse(readFileSync(beatsPath, 'utf8'))
      const v = validateBeatsJson(parsed)
      errors.push(...v.errors)
      beats = v.beats
    } catch (e) {
      errors.push(`beats.json tidak bisa dibaca: ${(e as Error).message}`)
    }
  }
  let htmlErrors: string[] = []
  const htmlPath = join(dir, 'index.html')
  if (existsSync(htmlPath)) {
    htmlErrors = validateBabakHtml(readFileSync(htmlPath, 'utf8')).errors
  }
  const keyframesMissing =
    beats?.beats.filter((b) => !existsSync(join(dir, b.keyframe))).map((b) => b.id) ?? []
  if (keyframesMissing.length) missing.push(`Keyframe hilang: ${keyframesMissing.join(', ')}`)
  const actFiles = existsSync(dir) ? readdirSync(dir).filter((f) => /^act-.*\.js$/.test(f)) : []
  const hasStyle = existsSync(join(dir, 'style.js'))
  let stage: MotionStage = 0
  if (beats && errors.length === 0 && keyframesMissing.length === 0) stage = 1
  if (stage === 1 && actFiles.length > 0 && hasStyle && existsSync(htmlPath) && htmlErrors.length === 0) stage = 2
  if (stage === 0 && beats) missing.push('beats.json belum valid — lihat daftar galat.')
  if (stage === 1) {
    if (actFiles.length === 0) missing.push('act-*.js belum ditulis agent (Tahap 2).')
    if (!hasStyle) missing.push('style.js belum ditulis agent (Tahap 2).')
    if (!existsSync(htmlPath)) missing.push('index.html belum ditulis agent (Tahap 2).')
  }
  return {
    babakId,
    stage,
    beats,
    errors,
    missing,
    htmlErrors,
    approved: beats?.beats.filter((b) => b.status === 'approved').length ?? 0,
    total: beats?.beats.length ?? 0
  }
}

function updateBeats(projectId: string, babakId: string, fn: (b: BeatsJson) => void): BeatsJson {
  const status = readMotionBabak(projectId, babakId)
  if (!status.beats) throw new Error(`Babak ${babakId} belum punya beats.json yang valid: ${[...status.errors, ...status.missing].join('; ')}`)
  fn(status.beats)
  const v = validateBeatsJson(status.beats)
  if (!v.ok) throw new Error(`beats.json menjadi tidak valid: ${v.errors.join('; ')}`)
  writeFileSync(motionBeatsPath(projectId, babakId), JSON.stringify(status.beats, null, 2), 'utf8')
  return status.beats
}

/** Sets one beat's approval status (the Tahap 1 gate: nothing renders until approved). */
export function approveMotionBeat(projectId: string, babakId: string, beatId: string, status: 'approved' | 'redo' | 'pending'): BeatsJson {
  return updateBeats(projectId, babakId, (b) => {
    const beat = b.beats.find((x) => x.id === beatId)
    if (!beat) throw new Error(`Beat ${beatId} tidak ada di babak ${babakId}`)
    beat.status = status
  })
}

/** The user's per-beat easing override (Rancangan page), applied before Tahap 2. */
export function overrideMotionEasing(projectId: string, babakId: string, beatId: string, easing: string | null): BeatsJson {
  return updateBeats(projectId, babakId, (b) => {
    const beat = b.beats.find((x) => x.id === beatId)
    if (!beat) throw new Error(`Beat ${beatId} tidak ada di babak ${babakId}`)
    beat.easingOverride = easing
  })
}

/**
 * After reading a babak's beats, link each beat to its scene by sceneKey:
 * the clip's motionBeatId follows the beats.json, not the other way round.
 */
export function syncMotionBeatIds(projectId: string, babakId: string): void {
  const status = readMotionBabak(projectId, babakId)
  if (!status.beats) return
  const bundle = getBundle(projectId)
  for (const beat of status.beats.beats) {
    const clip = bundle.clips.find((c) => c.sceneKey === beat.sceneKey && c.visualProvider === 'motion')
    if (clip && clip.motionBeatId !== beat.id) patchClip(clip.id, { motionBeatId: beat.id, motionBabakId: babakId })
  }
}

// ---------- templates + project style override (F4-08) ----------

/** The application-level template library (heavy styles stay locked until measured). */
export function motionTemplates(): MotionTemplate[] {
  return MOTION_TEMPLATES
}

/**
 * Saves the project's style override (motion-work/style/style.js) and marks
 * every approved beat in every babak "redo": the override changes what Tahap 2
 * must produce, so an earlier approval no longer stands.
 */
export function saveProjectStyleOverride(projectId: string, styleJs: string): string[] {
  const root = motionWorkFolder(projectId)
  mkdirSync(join(root, 'style'), { recursive: true })
  writeFileSync(join(root, 'style', 'style.js'), styleJs, 'utf8')
  const affected: string[] = []
  for (const babakId of motionBabaksOf(projectId)) {
    const status = readMotionBabak(projectId, babakId)
    if (!status.beats) continue
    const hasApproved = status.beats.beats.some((b) => b.status === 'approved')
    if (!hasApproved) continue
    updateBeats(projectId, babakId, (b) => {
      for (const beat of b.beats) if (beat.status === 'approved') beat.status = 'redo'
    })
    affected.push(babakId)
  }
  return affected
}

/** Reads the project's style override, if the user wrote one. */
export function readProjectStyleOverride(projectId: string): string | null {
  const p = join(motionWorkFolder(projectId), 'style', 'style.js')
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** The beat a scene needs for export: found by sceneKey, never by guessing. */
export function beatForClip(projectId: string, clipId: string): { babakId: string; beat: Beat } | null {
  const clip = getClip(clipId)
  if (!clip.motionBabakId) return null
  const status = readMotionBabak(projectId, clip.motionBabakId)
  if (!status.beats) return null
  const beat = status.beats.beats.find((b) => b.sceneKey === clip.sceneKey) ?? null
  return beat ? { babakId: clip.motionBabakId, beat } : null
}
