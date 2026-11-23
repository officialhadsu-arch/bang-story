import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { buildWorkFolderContent, kindOfWorkFileExtension, matchWorkFile, type ManualScanResult, type ManualWorkFolder, type WorkFileKind } from '@shared/manual'
import {
  planBulkImport,
  sortBulkFiles,
  type BulkImportEmptyClip,
  type BulkImportPreview,
  type BulkImportResult
} from '@shared/bulk-import'
import type { Asset, Clip } from '@shared/types'
import { getDb } from '../db'
import { emit } from '../events'
import { startManualWatch } from '../manualWatch'
import { assetAbsPath, manualWorkFolder } from '../paths'
import { charactersOf, clipsOf, getAsset, getClip, getProject, insertAsset, patchClip, touchProject, updateJob } from '../repo'
import { probeDurationMs, probeSize } from './audio'

/**
 * The manual / extension path (tier 2, 0.3+): a work folder per project where numbered prompts go
 * out and finished files come back in. No browser extension and no WebSocket live here (D2-07) —
 * this side only writes the harness files, matches result files to scenes by number, and stores
 * them like any other clip asset.
 */

function workFolder(projectId: string): string {
  const dir = manualWorkFolder(projectId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Writes `prompts.txt` (numbered prompts, for a human) and `manual.json` (the machine manifest)
 * into the project's work folder, and starts watching that folder for results.
 */
export function prepareWorkFolder(projectId: string): ManualWorkFolder {
  const project = getProject(projectId)
  const { manifest, text } = buildWorkFolderContent(project, clipsOf(projectId), charactersOf(projectId))
  const dir = workFolder(projectId)
  writeFileSync(join(dir, 'prompts.txt'), text, 'utf8')
  writeFileSync(join(dir, 'manual.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  startManualWatch(projectId)
  return { text, manifest, workFolder: dir, fileCount: manifest.clips.length }
}

/** Marks every waiting manual job for this clip and kind as done, with the asset that finished it. */
export function completeManualJobs(projectId: string, clipId: string, kind: WorkFileKind, assetId: string): void {
  const rows = getDb()
    .prepare("SELECT id FROM jobs WHERE project_id = ? AND clip_id = ? AND kind = ? AND provider = 'manual' AND status = 'queued'")
    .all(projectId, clipId, kind) as { id: string }[]
  for (const row of rows) emit.job(updateJob(row.id, { status: 'done', progress: 1, resultAssetId: assetId, message: null }))
}

/** Copies a result file into the project's media folders and links it to its clip, like other paths. */
async function attachWorkFile(projectId: string, absPath: string, fileName: string, clip: Clip, kind: WorkFileKind): Promise<Asset> {
  const folder = kind === 'video' ? 'videos' : 'images'
  const rel = `${folder}/${randomUUID()}${extname(fileName).toLowerCase()}`
  const abs = assetAbsPath(projectId, rel)
  mkdirSync(dirname(abs), { recursive: true })
  copyFileSync(absPath, abs)
  const size = await probeSize(abs).catch(() => null)
  if (!size) throw new Error(`Berkas tidak bisa dibaca: ${fileName}. Pakai PNG, JPG, WebP, MP4, MOV, atau WebM.`)
  const durationMs = kind === 'video' ? await probeDurationMs(abs).catch(() => null) : null
  const asset = insertAsset({
    projectId,
    clipId: clip.id,
    kind,
    // The provider follows the scene: an extension scene's file came through the browser, the rest by hand.
    provider: clip.visualProvider === 'extension' ? 'extension' : 'manual',
    prompt: fileName,
    localPath: rel,
    durationMs,
    width: size.width,
    height: size.height
  })
  emit.asset(asset)
  const patch: Partial<Clip> =
    kind === 'image' ? { imageAssetId: asset.id } : { videoAssetId: asset.id, motionType: 'video', mediaInMs: 0 }
  patchClip(clip.id, patch)
  emit.clip({ clipId: clip.id, patch })
  if (kind === 'image') {
    const project = getProject(projectId)
    const first = clipsOf(projectId)[0]
    if (!project.coverAssetId || first?.id === clip.id) touchProject(projectId, { coverAssetId: asset.id })
  }
  completeManualJobs(projectId, clip.id, kind, asset.id)
  touchProject(projectId)
  return asset
}

/**
 * Attaches one file from the work folder to the scene the user picked. The file must already be in
 * the work folder (put there by a generate, a download, or a copy); the name is a bare file name,
 * never a path, so nothing outside the work folder can be pulled in this way.
 */
export async function importManualFile(projectId: string, fileName: string, clipId: string, kind: WorkFileKind): Promise<Asset> {
  if (basename(fileName) !== fileName || !fileName) throw new Error('Nama berkas tidak valid.')
  const abs = join(workFolder(projectId), fileName)
  if (!existsSync(abs)) throw new Error(`Berkas tidak ditemukan di folder kerja: ${fileName}`)
  const match = matchWorkFile(fileName)
  if (match && match.kind !== kind) throw new Error(`Berkas ${fileName} adalah ${match.kind === 'image' ? 'gambar' : 'video'}, bukan ${kind === 'image' ? 'gambar' : 'video'}.`)
  const clip = getClip(clipId)
  if (clip.projectId !== projectId) throw new Error('Klip tidak cocok dengan proyek ini')
  return attachWorkFile(projectId, abs, fileName, clip, kind)
}

/**
 * Attaches one file from ANY folder (e.g. the folder a generator wrote to) to one scene.
 * A thin wrapper around attachWorkFile, so the copy/probe/register steps live in one place;
 * the bulk import and the single-file paths share them instead of duplicating them.
 */
export async function importExternalFile(projectId: string, absPath: string, fileName: string, clipId: string, kind: WorkFileKind): Promise<Asset> {
  if (!existsSync(absPath)) throw new Error(`Berkas tidak ditemukan: ${fileName}`)
  const clip = getClip(clipId)
  if (clip.projectId !== projectId) throw new Error('Klip tidak cocok dengan proyek ini')
  return attachWorkFile(projectId, absPath, fileName, clip, kind)
}

/** The project's clips, in storyboard order, as the bulk planner's "empty scenes" input. */
function emptyClipsOf(projectId: string): BulkImportEmptyClip[] {
  return [...clipsOf(projectId)]
    .sort((a, b) => a.sort - b.sort)
    .map((c) => ({ clipId: c.id, sceneKey: c.sceneKey, title: c.title, hasImage: !!c.imageAssetId, hasVideo: !!c.videoAssetId }))
}

/** The bare file names inside a folder (subfolders ignored), for the bulk planner. */
function folderFileNames(folder: string): string[] {
  if (!existsSync(folder)) throw new Error('Folder tidak ditemukan.')
  return readdirSync(folder, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
}

/**
 * Plans a bulk import from a folder without installing anything: the preview dialog shows
 * exactly this, and applyBulkImport plans again from the same folder before installing.
 */
export function previewBulkImportFolder(projectId: string, folder: string, kind: WorkFileKind): BulkImportPreview {
  getProject(projectId)
  const sorted = sortBulkFiles(folderFileNames(folder), kind)
  const { entries, excessFiles, emptyLeft } = planBulkImport(sorted, emptyClipsOf(projectId), kind)
  return { folder, entries, excessFiles, emptyLeft }
}

/**
 * Installs a folder's files in order onto the scenes that still need this kind of visual.
 * The folder is read again here (never trusted from the renderer), and the plan is rebuilt,
 * so a file added or removed between preview and install is handled by the fresh state.
 * A file that cannot be read is skipped and reported; the rest still install. Scenes that
 * already have a visual are never overwritten. Nothing changes when the folder holds no
 * usable file of this kind.
 */
export async function applyBulkImport(projectId: string, folder: string, kind: WorkFileKind): Promise<BulkImportResult> {
  getProject(projectId)
  const names = folderFileNames(folder)
  const sorted = sortBulkFiles(names, kind)
  if (sorted.length === 0) {
    throw new Error(
      kind === 'image'
        ? 'Tidak ada berkas gambar di folder ini. Pakai file PNG, JPG, atau WebP.'
        : 'Tidak ada berkas video di folder ini. Pakai file MP4, MOV, atau WebM.'
    )
  }
  const { entries, excessFiles } = planBulkImport(sorted, emptyClipsOf(projectId), kind)
  const installed: BulkImportResult['installed'] = []
  const skipped: BulkImportResult['skipped'] = []
  // Files the app cannot use at all (not a picture/video) are reported, not silently dropped.
  for (const file of names) {
    if (kindOfWorkFileExtension(file) === null) skipped.push({ file, reason: 'format tidak didukung' })
  }
  for (const entry of entries) {
    try {
      await importExternalFile(projectId, join(folder, entry.file), entry.file, entry.clipId, kind)
      installed.push({ file: entry.file, clipId: entry.clipId, sceneKey: entry.sceneKey })
    } catch {
      // attachWorkFile throws when the file cannot be probed (corrupt or unreadable);
      // one bad file must not stop the rest of the folder.
      skipped.push({ file: entry.file, reason: 'tidak bisa dibaca' })
    }
  }
  // Counted fresh after the install: a file that failed to read leaves its scene empty,
  // so the planned count would under-report it.
  const emptyLeft = emptyClipsOf(projectId).filter((c) => (kind === 'image' ? !c.hasImage : !c.hasVideo)).length
  return { installed, skipped, excess: excessFiles, emptyLeft }
}

/**
 * Pairs every result file in the work folder with its scene by number. A file that is already the
 * clip's active asset is left alone, so scanning twice never duplicates anything; files with no
 * matching scene come back as `unmatched` for the user to place by hand.
 */
export async function scanWorkFolder(projectId: string): Promise<ManualScanResult> {
  const dir = workFolder(projectId)
  startManualWatch(projectId)
  const clips = clipsOf(projectId)
  const attached: ManualScanResult['attached'] = []
  const unmatched: ManualScanResult['unmatched'] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const file = entry.name
    if (file === 'prompts.txt' || file === 'manual.json') continue
    const match = matchWorkFile(file)
    const clip = match ? clips.find((c) => c.sceneKey === match.sceneKey) : undefined
    if (!match || !clip) {
      unmatched.push({ file, kind: match?.kind ?? null })
      continue
    }
    const currentId = match.kind === 'image' ? clip.imageAssetId : clip.videoAssetId
    const current = getAsset(currentId)
    if (current?.prompt === file) continue
    const asset = await attachWorkFile(projectId, join(dir, file), file, clip, match.kind)
    attached.push({ file, clipId: clip.id, sceneKey: clip.sceneKey, kind: match.kind, assetId: asset.id })
  }
  return { workFolder: dir, attached, unmatched }
}
