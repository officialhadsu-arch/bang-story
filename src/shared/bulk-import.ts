import { kindOfWorkFileExtension, type WorkFileKind } from './manual'

/**
 * Bulk import (tier 1, 0.3): take any folder of generated results and attach them in order to the
 * scenes that still need a picture or a video. Unlike the work-folder scan (which matches a scene
 * number in the file name), this path ignores numbers in names entirely — order comes from the
 * file names themselves, so a folder of `01.png, 02.png, 10.png` and a folder of
 * `apel.png, jeruk.png, mangga.png` both land on scenes 1, 2, 3 in that order.
 *
 * Shared by main and renderer, so the preview dialog and the real install can never disagree
 * about the order or the pairing. Nothing here touches the disk or the network.
 */

/** One file paired with the scene it will be installed on. */
export interface BulkImportEntry {
  file: string
  kind: WorkFileKind
  clipId: string
  sceneKey: string
  /** The scene's title, for the preview dialog ("Adegan 02 — Sumpah Palapa"). */
  title: string
}

/** What the preview dialog shows: the folder, the planned pairs, the files that will not fit. */
export interface BulkImportPreview {
  folder: string
  entries: BulkImportEntry[]
  /** Files that fit the kind but have no empty scene left for them. */
  excessFiles: string[]
  /** Scenes that will still have no picture/video after this import. */
  emptyLeft: number
}

/** One file that was installed, or skipped with the reason why. */
export interface BulkImportSkipped {
  file: string
  reason: string
}

/** What `applyBulkImport` returns after installing what it could. */
export interface BulkImportResult {
  installed: { file: string; clipId: string; sceneKey: string }[]
  skipped: BulkImportSkipped[]
  excess: string[]
  emptyLeft: number
}

/** A scene that may still need a picture or a video, in storyboard order. */
export interface BulkImportEmptyClip {
  clipId: string
  sceneKey: string
  title: string
  hasImage: boolean
  hasVideo: boolean
}

/**
 * Splits a name into alternating digit and non-digit chunks, so numbers sort by value
 * ("1, 2, 10" — not "1, 10, 2") while letters sort alphabetically without caring about case.
 */
export function naturalCompare(a: string, b: string): number {
  const chunks = (s: string): string[] => s.match(/\d+|\D+/g) ?? [s]
  const ac = chunks(a)
  const bc = chunks(b)
  for (let i = 0; i < Math.max(ac.length, bc.length); i++) {
    const x = ac[i]
    const y = bc[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) {
      const diff = parseInt(x, 10) - parseInt(y, 10)
      if (diff !== 0) return diff
      // Same value, different spelling ("01" vs "1"): the shorter spelling comes first.
      return x.length - y.length
    }
    const cmp = x.localeCompare(y, undefined, { sensitivity: 'base' })
    if (cmp !== 0) return cmp
  }
  return 0
}

/**
 * Keeps only the files of the requested kind (pictures: PNG/JPG/WebP; videos: MP4/MOV/WebM)
 * and sorts them naturally by file name. The extension set is the same one the work-folder
 * scan uses, so a file that counts here counts there too.
 */
export function sortBulkFiles(fileNames: string[], kind: WorkFileKind): string[] {
  return fileNames.filter((f) => kindOfWorkFileExtension(f) === kind).sort(naturalCompare)
}

/**
 * Pairs the sorted files with the scenes that still need this kind of visual, in storyboard
 * order. Scenes that already have a picture/video are skipped, never overwritten; files with
 * no empty scene left come back as excess instead of silently dropping.
 */
export function planBulkImport(
  sortedFiles: string[],
  emptyClips: BulkImportEmptyClip[],
  kind: WorkFileKind
): { entries: BulkImportEntry[]; excessFiles: string[]; emptyLeft: number } {
  const need = emptyClips.filter((c) => (kind === 'image' ? !c.hasImage : !c.hasVideo))
  const entries: BulkImportEntry[] = []
  for (let i = 0; i < Math.min(sortedFiles.length, need.length); i++) {
    const clip = need[i]
    entries.push({ file: sortedFiles[i], kind, clipId: clip.clipId, sceneKey: clip.sceneKey, title: clip.title })
  }
  return { entries, excessFiles: sortedFiles.slice(need.length), emptyLeft: need.length - entries.length }
}
