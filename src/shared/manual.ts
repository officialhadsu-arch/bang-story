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

/** Which provider makes this scene's visuals. 'auto' follows the project's chosen model. */
export type VisualProvider = 'auto' | 'higgsfield' | 'flow2api' | 'manual' | 'extension' | 'nexabot' | 'kieai'

export const VISUAL_PROVIDERS: { id: VisualProvider; label: string; hint: string }[] = [
  { id: 'auto', label: 'Otomatis', hint: 'Mengikuti model proyek' },
  { id: 'higgsfield', label: 'Higgsfield', hint: 'Model Higgsfield proyek' },
  { id: 'flow2api', label: 'Google Flow', hint: 'Server Flow2API' },
  { id: 'manual', label: 'Manual', hint: 'Salin prompt, generate di mana pun' },
  { id: 'extension', label: 'Ekstensi', hint: 'Generate lewat Flow di browser' },
  { id: 'nexabot', label: 'NexaBot', hint: 'Berbayar per generate (Rp300/video)' },
  { id: 'kieai', label: 'Kie.ai', hint: 'Berbayar per generate (USD, model premium)' }
]

export function isVisualProvider(v: unknown): v is VisualProvider {
  return v === 'auto' || v === 'higgsfield' || v === 'flow2api' || v === 'manual' || v === 'extension' || v === 'nexabot' || v === 'kieai'
}

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
 * A `scene-`/`clip-` prefix is ignored; what counts is the leading number. Files whose name does not
 * start with a number, or whose extension is not a picture/video the app can use, do not match.
 */
export function matchWorkFile(fileName: string): { sceneKey: string; kind: WorkFileKind; ext: string } | null {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = fileName.slice(dot + 1).toLowerCase()
  const kind = kindOfWorkFileExtension(fileName)
  if (!kind) return null
  const base = fileName.slice(0, dot).replace(/^(scene|clip)[-_ ]?/i, '')
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
): { rows: ManualPromptRow[]; manifest: ManualManifest; text: string } {
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
  const lines = [`Prompt ${project.title} — ${rows.length} adegan`, '']
  for (const r of rows) {
    lines.push(`Adegan ${r.sceneKey} — ${r.title || 'Tanpa judul'}`)
    lines.push(`Gambar: ${r.prompt}`)
    if (r.kind === 'video') lines.push(`Video: ${r.videoPrompt}`)
    lines.push('')
  }
  return { rows, manifest, text: lines.join('\n') }
}
