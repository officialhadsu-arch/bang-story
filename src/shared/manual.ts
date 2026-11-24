import { getImageModel, getVideoModel, promptLimit } from './higgsfield'
import { clipPrompt, videoPromptForClip } from './prompts'
import type { AspectRatio, Character, Clip, Project } from './types'

/**
 * The manual / extension path (tier 2, 0.3+): which provider makes a scene's picture or video, and the
 * work-folder harness (numbered prompts + a machine manifest) that lets the user — or an outside
 * agent/extension — generate the media anywhere and bring the files back by scene number.
 *
 * Shared by main and renderer, so both sides agree on scene keys, file matching and prompt text.
 * Nothing here touches the disk or the network.
 */

// Which provider makes this scene's visuals. 'auto' follows the project's chosen model. 'footage' is the imported talking-head recording.
export type VisualProvider = 'auto' | 'higgsfield' | 'flow2api' | 'manual' | 'extension' | 'nexabot' | 'motion' | 'footage' | 'kieai'
export const VISUAL_PROVIDERS: { id: VisualProvider; label: string; hint: string }[] = [
  { id: 'auto', label: 'Otomatis', hint: 'Mengikuti model proyek' },
  { id: 'higgsfield', label: 'Higgsfield', hint: 'Model Higgsfield proyek' },
  { id: 'flow2api', label: 'Google Flow', hint: 'Server Flow2API' },
  { id: 'manual', label: 'Manual', hint: 'Salin prompt, generate di mana pun' },
  { id: 'extension', label: 'Ekstensi', hint: 'Generate lewat Flow di browser' },
  { id: 'nexabot', label: 'NexaBot', hint: 'Berbayar per generate (Rp300/video)' },
  { id: 'motion', label: 'Motion', hint: 'Kode HTML+GSAP, render aplikasi' },
  { id: 'footage', label: 'Rekaman', hint: 'Video rekaman yang diimpor' },
  { id: 'kieai', label: 'Kie.ai', hint: 'Berbayar per generate (USD, model premium)' }
]

export function isVisualProvider(v: unknown): v is VisualProvider {
  return v === 'auto' || v === 'higgsfield' || v === 'flow2api' || v === 'manual' || v === 'extension' || v === 'nexabot' || v === 'motion' || v === 'footage' || v === 'kieai'}

/** A scene key is a 2-digit number ('01', '02', …); past 99 it simply grows ('100'). */
export function formatSceneKey(n: number): string {
  return String(Math.max(0, Math.round(n))).padStart(2, '0')
}

/** The scene key for a clip at 0-based position `sort` (the migration backfill). */
export function sceneKeyOf(sort: number): string {
  return formatSceneKey(sort + 1)
}

/** The next free scene key in a project: one past the highest number already in use. */
export function nextSceneKey(existing: string[]): string {
  let max = 0
  for (const k of existing) {
    const n = parseInt(k, 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return formatSceneKey(max + 1)
}

// ---------- work-folder file matching (D2-04) ----------

export type WorkFileKind = 'image' | 'video'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm'])

/**
 * The media kind of a file name from its extension alone, or null when the extension is not a
 * picture/video the app can use. The work-folder panel uses it to tell "no scene number" apart
 * from "unknown file type" for files the scan could not place.
 */
export function kindOfWorkFileExtension(fileName: string): WorkFileKind | null {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = fileName.slice(dot + 1).toLowerCase()
  return IMAGE_EXTS.has(ext) ? 'image' : VIDEO_EXTS.has(ext) ? 'video' : null
}

/**
 * Matches a result file back to its scene: `<sceneKey>[-suffix].<ext>` (e.g. `03.png`, `03-v2.mp4`).
 * A `scene-`/`clip-` prefix is ignored; what counts is the leading number. KenFlow downloads are
 * also recognised: exactly 3 digits + underscore (`000_<prompt>_a.png`) is KenFlow's 0-based prompt
 * index, so the scene is that number + 1 (`000_…` → scene 01, `001_…` → scene 02). Files whose name
 * does not start with a number, or whose extension is not a picture/video the app can use, do not match.
 */
export function matchWorkFile(fileName: string): { sceneKey: string; kind: WorkFileKind; ext: string } | null {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = fileName.slice(dot + 1).toLowerCase()
  const kind = kindOfWorkFileExtension(fileName)
  if (!kind) return null
  const base = fileName.slice(0, dot).replace(/^(scene|clip)[-_ ]?/i, '')
  const kenflow = /^(\d{3})_/.exec(base)
  if (kenflow) return { sceneKey: formatSceneKey(parseInt(kenflow[1], 10) + 1), kind, ext }
  const m = /^(\d+)/.exec(base)
  if (!m) return null
  return { sceneKey: formatSceneKey(parseInt(m[1], 10)), kind, ext }
}

// ---------- numbered prompts + manifest (D2-04, D2-05) ----------

export interface ManualPromptRow {
  sceneKey: string
  clipId: string
  title: string
  /** What this scene needs: a still picture, or an AI video (its first frame still comes from the picture). */
  kind: WorkFileKind
  prompt: string
  videoPrompt: string
  aspect: AspectRatio
  durationSec: number
}

/** The machine-readable manifest written next to prompts.txt in the work folder. */
export interface ManualManifest {
  version: 1
  projectId: string
  projectTitle: string
  generatedAt: string
  clips: ManualPromptRow[]
}

/** What `manual:prepareWorkFolder` writes and returns (the text is what the renderer copies). */
export interface ManualWorkFolder {
  text: string
  manifest: ManualManifest
  workFolder: string
  fileCount: number
}

/** What `manual:kenflowTexts` writes and returns (the texts are what the renderer copies). */
export interface KenflowTexts {
  imageText: string
  videoText: string
  imageCount: number
  videoCount: number
  workFolder: string
}

/**
 * Collapses blank lines inside one prompt into a single newline. `clipPrompt()` joins its parts
 * with blank lines, and KenFlow splits pasted text on blank lines — without this, one scene would
 * arrive in KenFlow as several prompts instead of one.
 */
function tightenPrompt(text: string): string {
  return text.replace(/\n\s*\n+/g, '\n').trim()
}

/**
 * The clean KenFlow texts: one paragraph per scene, in story order, no labels, no file title, one
 * blank line between paragraphs. Characters that have a reference sheet are mentioned as `@Name`
 * on the first line of the paragraph, so Flow/KenFlow sees the mention before the description.
 * The image text covers every scene (a video scene's picture is its first frame); the video text
 * covers video scenes only. The prompts come from the same `buildWorkFolderContent` rows as
 * prompts.txt, so a KenFlow generate and an automatic one start from identical words.
 */
export function buildKenflowTexts(
  project: Project,
  clips: Clip[],
  characters: Character[]
): { imageText: string; videoText: string; imageCount: number; videoCount: number } {
  const { rows } = buildWorkFolderContent(project, clips, characters)
  const byId = new Map(clips.map((c) => [c.id, c]))
  const paragraphs = rows.map((row) => {
    const clip = byId.get(row.clipId)
    const refNames = clip
      ? characters.filter((c) => clip.characterIds.includes(c.id) && c.sheetAssetId).map((c) => c.name)
      : []
    const mention = refNames.length ? `${refNames.map((n) => `@${n}`).join(', ')}\n` : ''
    return `${mention}${tightenPrompt(row.prompt)}`
  })
  const videoParagraphs = rows
    .filter((row) => row.kind === 'video')
    .map((row) => {
      const clip = byId.get(row.clipId)
      const refNames = clip
        ? characters.filter((c) => clip.characterIds.includes(c.id) && c.sheetAssetId).map((c) => c.name)
        : []
      const mention = refNames.length ? `${refNames.map((n) => `@${n}`).join(', ')}\n` : ''
      return `${mention}${tightenPrompt(row.videoPrompt)}`
    })
  return {
    imageText: paragraphs.join('\n\n'),
    videoText: videoParagraphs.join('\n\n'),
    imageCount: paragraphs.length,
    videoCount: videoParagraphs.length
  }
}

/** One file the scan attached to a scene. */
export interface ManualScanAttached {
  file: string
  clipId: string
  sceneKey: string
  kind: WorkFileKind
  assetId: string
}

/** One file the scan could not place on its own; the user picks its scene in the UI. */
export interface ManualScanUnmatched {
  file: string
  kind: WorkFileKind | null
}

/** What `manual:scanWorkFolder` returns. */
export interface ManualScanResult {
  workFolder: string
  attached: ManualScanAttached[]
  unmatched: ManualScanUnmatched[]
}

/** Emitted when the work-folder watcher sees a file arrive or change (a hint to press Pindai). */
export interface ManualWatchEvent {
  projectId: string
  file: string
}

/**
 * One row per scene, in story order. The image prompt is the same `clipPrompt()` the automatic path
 * sends, so a manual generate and an automatic one start from identical words.
 */
export function buildWorkFolderContent(
  project: Project,
  clips: Clip[],
  characters: Character[]
): { rows: ManualPromptRow[]; manifest: ManualManifest; text: string; videoText: string } {
  const imageModel = getImageModel(project.imageModel)
  const videoRef = getVideoModel(project.videoModel).input.mode === 'reference'
  const rows: ManualPromptRow[] = [...clips]
    .sort((a, b) => a.sort - b.sort)
    .map((clip) => {
      const chars = characters.filter((c) => clip.characterIds.includes(c.id))
      const refNames = chars.filter((c) => c.sheetAssetId).map((c) => c.name)
      return {
        sceneKey: clip.sceneKey,
        clipId: clip.id,
        title: clip.title,
        kind: clip.motionType === 'video' ? 'video' : 'image',
        prompt: clipPrompt(project, clip, chars, refNames, promptLimit(imageModel)),
        videoPrompt: videoPromptForClip(clip, videoRef),
        aspect: project.aspectRatio,
        durationSec: Math.round(clip.durationMs / 1000)
      }
    })
  const manifest: ManualManifest = {
    version: 1,
    projectId: project.id,
    projectTitle: project.title,
    generatedAt: new Date().toISOString(),
    clips: rows
  }
  // One list per job, never mixed: the image list (text) is for text-to-image,
  // the video list (videoText) is for image-to-video — e.g. pasted scene by scene
  // into KenFlow. Both come from the same manifest rows, so they can never drift.
  const lines = [`Prompt ${project.title} — ${rows.length} adegan`, '']
  for (const r of rows) {
    lines.push(`Adegan ${r.sceneKey} — ${r.title || 'Tanpa judul'}`)
    lines.push(`Gambar: ${r.prompt}`)
    lines.push('')
  }
  const videoLines = [`Prompt video ${project.title} — ${rows.length} adegan`, '']
  for (const r of rows) {
    videoLines.push(`Adegan ${r.sceneKey} — ${r.title || 'Tanpa judul'}`)
    videoLines.push(`Video: ${r.videoPrompt}`)
    videoLines.push('')
  }
  return { rows, manifest, text: lines.join('\n'), videoText: videoLines.join('\n') }
}
