import { estimateNarrationMs } from './script'

/**
 * Imported script text, one scene per `##` heading. The parser is pure (no
 * Electron, no database) so the preview in the dialog and the write in the
 * main process can never disagree: both call parseScriptImport on the same
 * text. A scene is valid when its story or its narration has any text.
 */
export interface ImportedScene {
  /** "Adegan N" when the heading carries no title of its own. */
  title: string
  story: string
  narration: string
}

export interface ScriptImportResult {
  /** Project title from a single-`#` line, or null when the text has none. */
  title: string | null
  /** Valid scenes, in order. */
  scenes: ImportedScene[]
  /** 1-based numbers of the scenes that were empty and left out. */
  skipped: number[]
  /** Scenes found, including the skipped ones. */
  totalScenes: number
}

/** Total narration length of the imported scenes, for the preview and the project duration. */
export function importDurationMs(scenes: ImportedScene[]): number {
  return scenes.reduce((n, s) => n + estimateNarrationMs(s.narration), 0)
}

const LABEL_RE = /^(alur|narasi)\s*:\s*(.*)$/i
const NUMBER_RE = /^\d+\s*[.)]\s*/
const TITLE_RE = /^#\s+(.*)$/

/**
 * Reads the documented import format:
 *
 *   # Video Title (optional, one line, one `#`)
 *   ## 1. First Scene Title
 *   Alur: What happens in this scene.
 *   Narasi: The voice-over line for this scene.
 *
 * Rules: a `##` line starts a new scene (a leading `1.` / `1)` number is
 * dropped; `## Title` without a number works too); an `Alur:` / `Narasi:`
 * line (case-insensitive, space after the colon optional) starts that field
 * and following lines join it; a scene with no labels at all keeps its whole
 * text as narration; a scene whose story and narration are both empty is
 * skipped and reported by its number.
 */
export function parseScriptImport(text: string): ScriptImportResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let title: string | null = null
  const scenes: ImportedScene[] = []
  const skipped: number[] = []
  let totalScenes = 0

  // The scene being read, if any. `field` is the field continuation lines
  // join; it starts as 'narration' so a label-less scene lands in narration.
  let current: { title: string; story: string; narration: string; field: 'story' | 'narration' } | null = null

  const finishScene = (): void => {
    if (!current) return
    totalScenes += 1
    const story = current.story.replace(/\s+/g, ' ').trim()
    const narration = current.narration.replace(/\s+/g, ' ').trim()
    if (!story && !narration) {
      skipped.push(totalScenes)
    } else {
      scenes.push({ title: current.title || `Adegan ${totalScenes}`, story, narration })
    }
    current = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('##')) {
      finishScene()
      const heading = line.replace(/^#+\s*/, '')
      current = { title: heading.replace(NUMBER_RE, '').trim(), story: '', narration: '', field: 'narration' }
      continue
    }
    // A single-`#` title only counts before the first scene; later it is
    // ordinary text, so a `#` inside a narration cannot steal the title.
    if (!current && title === null) {
      const m = TITLE_RE.exec(line)
      if (m && m[1].trim()) {
        title = m[1].trim()
        continue
      }
    }
    if (!current) continue
    const label = LABEL_RE.exec(line)
    if (label) {
      current.field = label[1].toLowerCase() === 'alur' ? 'story' : 'narration'
      const rest = label[2].trim()
      if (rest) current[current.field] += `${current[current.field] ? '\n' : ''}${rest}`
      continue
    }
    current[current.field] += `${current[current.field] ? '\n' : ''}${line}`
  }
  finishScene()
  return { title, scenes, skipped, totalScenes }
}

/** What the main process reports back after an import, so the dialog can summarise it. */
export interface ScriptImportSummary {
  /** Project title after the import (the `#` title when the text had one). */
  title: string
  /** Valid scenes written. */
  imported: number
  /** 1-based numbers of the empty scenes that were left out. */
  skipped: number[]
  /** Project target length after the import, in seconds. */
  durationSec: number
}

/** The example shown in the dialog and the docs, so the two never drift apart. */
export const SCRIPT_IMPORT_EXAMPLE = `# Kisah Sumpah Palapa
## 1. Senja di Majapahit
Alur: Senja turun di ibu kota Majapahit dan istana bersiap untuk upacara penting.
Narasi: Tahun 1336. Senja turun di ibu kota Majapahit, dan istana bersiap untuk upacara penting.
## 2. Sumpah Palapa
Alur: Gajah Mada melangkah maju dan mengucapkan sumpahnya di depan para menteri.
Narasi: Aku tidak akan menikmati palapa, sebelum Nusantara bersatu.`
