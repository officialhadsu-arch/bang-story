import type { Asset, CompositionId, WordTiming } from './types'

/**
 * Talking Head (Fase 5, narasi-dulu): the pure rules shared by main and renderer, so the Transcript step,
 * the scene builder and the export all agree on what is cut, what stays, and how a scene is framed.
 * Nothing here touches the disk or the network.
 *
 * Cuts are realised when scenes are built, not by deleting words: a scene covers a range of transcript
 * words, and its video/audio files contain only the kept material inside that range (F5-08 — one cut
 * list, two tracks). A scene may span a cut interval; the interval simply never appears in its files.
 */

/** A pause longer than this between two words is cut (Skenario 4, konsep Bab 12). */
export const PAUSE_CUT_SEC = 0.5

/** Filler words the transcript auto-marks to cut; the user can edit the list and restore any word. */
export const DEFAULT_FILLERS: string[] = ['eh', 'ehm', 'hmm', 'anu', 'apa', 'ya', 'kan', 'gitu', 'nah']

/** A scene holds this much kept speech: at least 30 s, and a new scene starts before 60 s. */
export const SCENE_MIN_SEC = 30
export const SCENE_MAX_SEC = 60

// ---------- composition (F5-09) ----------

export const COMPOSITIONS: { id: CompositionId; label: string; hint: string }[] = [
  { id: 'penuh', label: 'Penuh', hint: 'Seluruh frame rekaman' },
  { id: 'tengah', label: 'Close-up tengah', hint: 'Perbesar 60% bagian tengah' },
  { id: 'kiri', label: 'Close-up kiri', hint: 'Perbesar 60% bagian kiri' },
  { id: 'kanan', label: 'Close-up kanan', hint: 'Perbesar 60% bagian kanan' }
]

export function isComposition(v: unknown): v is CompositionId {
  return v === 'penuh' || v === 'tengah' || v === 'kiri' || v === 'kanan'
}

/**
 * The camera frame a composition is: a close-up is a 60% crop, so the picture is zoomed 1/0.6 and
 * shifted to the side that stays in frame (the same frame `cameraCss` draws in the preview).
 */
export function compositionFrame(comp: CompositionId): { zoom: number; x: number; y: number } {
  if (comp === 'tengah') return { zoom: 1 / 0.6, x: 0, y: 0 }
  if (comp === 'kiri') return { zoom: 1 / 0.6, x: -1, y: 0 }
  if (comp === 'kanan') return { zoom: 1 / 0.6, x: 1, y: 0 }
  return { zoom: 1, x: 0, y: 0 }
}

/**
 * FFmpeg filters for the same crop, applied to a frame of `w`×`h` and scaled back to that size, so the
 * export shows exactly what the preview shows (a 60% crop, centred vertically).
 */
export function compositionCropFilters(comp: CompositionId, w: number, h: number): string[] {
  if (comp === 'penuh') return []
  const cw = Math.max(2, Math.round((w * 0.6) / 2) * 2)
  const ch = Math.max(2, Math.round((h * 0.6) / 2) * 2)
  const x = comp === 'kiri' ? 0 : comp === 'kanan' ? w - cw : Math.round((w - cw) / 2)
  const y = Math.round((h - ch) / 2)
  return [`crop=${cw}:${ch}:${x}:${y}`, `scale=${w}:${h}:flags=lanczos`, 'setsar=1']
}

// ---------- footage assets ----------

/** The project's raw recording and its extracted audio, if any (latest import wins). */
export function findFootage(assets: Asset[]): { video: Asset | null; audio: Asset | null } {
  const videos = assets.filter((a) => a.kind === 'video' && a.meta.role === 'footage').sort((a, b) => b.createdAt - a.createdAt)
  const video = videos[0] ?? null
  const audio =
    assets
      .filter((a) => a.kind === 'audio' && a.meta.role === 'footage-audio' && (!video || a.meta.footageAssetId === video.id))
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  return { video, audio }
}

// ---------- cuts ----------

export interface CutInterval {
  start: number
  end: number
  reason: 'pause' | 'filler'
  /** The filler word this interval removes, if any. */
  wordIndex?: number
}

/** Lowercase, punctuation stripped — so "Eh," and "eh" are the same filler. */
export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Every stretch of the transcript to cut: pauses longer than `pauseSec`, filler words from the list,
 * and words the user marked to drop. Overlapping or touching intervals merge, so one cut list drives
 * both the video and the audio.
 */
export function computeCuts(
  words: WordTiming[],
  opts: { pauseSec?: number; fillers?: string[]; dropped?: number[] } = {}
): CutInterval[] {
  const pauseSec = opts.pauseSec ?? PAUSE_CUT_SEC
  const fillers = new Set((opts.fillers ?? DEFAULT_FILLERS).map(normalizeWord).filter(Boolean))
  const dropped = new Set(opts.dropped ?? [])
  const out: CutInterval[] = []
  for (let i = 0; i + 1 < words.length; i++) {
    const gap = words[i + 1].start - words[i].end
    if (gap > pauseSec) out.push({ start: words[i].end, end: words[i + 1].start, reason: 'pause' })
  }
  words.forEach((w, i) => {
    if (dropped.has(i) || fillers.has(normalizeWord(w.text))) out.push({ start: w.start, end: w.end, reason: 'filler', wordIndex: i })
  })
  out.sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: CutInterval[] = []
  for (const c of out) {
    const last = merged[merged.length - 1]
    if (last && c.start <= last.end) {
      last.end = Math.max(last.end, c.end)
      if (last.reason === 'pause' && c.reason === 'filler') last.reason = 'filler'
      if (c.wordIndex != null) last.wordIndex = c.wordIndex
    } else merged.push({ ...c })
  }
  return merged
}

/** Word indexes the auto-drop would cut: filler words only (pauses cut the gap between words). */
export function autoDroppedIndexes(words: WordTiming[], fillers: string[] = DEFAULT_FILLERS): number[] {
  const set = new Set(fillers.map(normalizeWord).filter(Boolean))
  const out: number[] = []
  words.forEach((w, i) => {
    if (set.has(normalizeWord(w.text))) out.push(i)
  })
  return out
}

export interface KeptRun {
  startWord: number
  endWord: number
  startSec: number
  endSec: number
  keptSec: number
}

/** Maximal runs of kept words: a run ends where a cut interval starts (a pause or a dropped word). */
export function keptRuns(words: WordTiming[], cuts: CutInterval[]): KeptRun[] {
  const inCut = (w: WordTiming): boolean => cuts.some((c) => w.start < c.end && w.end > c.start)
  const runs: KeptRun[] = []
  let cur: KeptRun | null = null
  words.forEach((w, i) => {
    if (inCut(w)) {
      cur = null
      return
    }
    if (!cur) {
      cur = { startWord: i, endWord: i, startSec: w.start, endSec: w.end, keptSec: 0 }
      runs.push(cur)
    }
    cur.endWord = i
    cur.endSec = w.end
    cur.keptSec = cur.endSec - cur.startSec
  })
  return runs
}

export interface TranscriptSummary {
  words: number
  keptWords: number
  totalSec: number
  keptSec: number
  cutSec: number
  cutCount: number
}

export function summarizeTranscript(words: WordTiming[], cuts: CutInterval[]): TranscriptSummary {
  const runs = keptRuns(words, cuts)
  const keptSec = runs.reduce((n, r) => n + r.keptSec, 0)
  const totalSec = words.length ? words[words.length - 1].end - words[0].start : 0
  const keptWords = runs.reduce((n, r) => n + (r.endWord - r.startWord + 1), 0)
  return { words: words.length, keptWords, totalSec, keptSec, cutSec: Math.max(0, totalSec - keptSec), cutCount: cuts.length }
}

// ---------- scenes ----------

export interface SceneDef {
  title: string
  startWord: number
  endWord: number
  narration: string
  /** Original recording time of the first/last kept word. */
  startSec: number
  endSec: number
  keptSec: number
}

function defFromRange(words: WordTiming[], cuts: CutInterval[], startWord: number, endWord: number, title: string): SceneDef | null {
  const runs = keptRuns(words.slice(startWord, endWord + 1), cuts).map((r) => ({
    ...r,
    startWord: r.startWord + startWord,
    endWord: r.endWord + startWord
  }))
  if (!runs.length) return null
  const narration = words
    .slice(startWord, endWord + 1)
    .filter((w) => !cuts.some((c) => w.start < c.end && w.end > c.start))
    .map((w) => w.text)
    .join(' ')
  if (!narration.trim()) return null
  return {
    title,
    startWord: runs[0].startWord,
    endWord: runs[runs.length - 1].endWord,
    narration,
    startSec: runs[0].startSec,
    endSec: runs[runs.length - 1].endSec,
    keptSec: runs.reduce((n, r) => n + r.keptSec, 0)
  }
}

/**
 * Deterministic fallback (F5-05): group whole runs into scenes of 30–60 s of kept speech. A run longer
 * than 60 s is split between words. Always produces scenes — no silent dead end.
 */
export function arrangeDeterministic(words: WordTiming[], cuts: CutInterval[]): SceneDef[] {
  const runs = keptRuns(words, cuts)
  if (!runs.length) return []
  // Split over-long runs between words first, so no scene ever exceeds the cap.
  const pieces: KeptRun[] = []
  for (const r of runs) {
    let from = r.startWord
    while (from <= r.endWord) {
      const fromSec = words[from].start
      let to = from
      while (to + 1 <= r.endWord && words[to + 1].end - fromSec <= SCENE_MAX_SEC) to++
      pieces.push({ startWord: from, endWord: to, startSec: fromSec, endSec: words[to].end, keptSec: words[to].end - fromSec })
      from = to + 1
    }
  }
  const scenes: SceneDef[] = []
  let cur: KeptRun[] = []
  let curSec = 0
  const flush = (): void => {
    if (!cur.length) return
    const def = defFromRange(words, cuts, cur[0].startWord, cur[cur.length - 1].endWord, `Adegan ${scenes.length + 1}`)
    if (def) scenes.push(def)
    cur = []
    curSec = 0
  }
  for (const p of pieces) {
    if (cur.length && curSec >= SCENE_MIN_SEC && curSec + p.keptSec > SCENE_MAX_SEC) flush()
    cur.push(p)
    curSec += p.keptSec
    if (curSec >= SCENE_MAX_SEC) flush()
  }
  flush()
  return scenes
}

/**
 * Validates LLM scene boundaries (F5-05): clamps to the transcript, sorts, trims overlaps, and covers
 * every kept word exactly once (gaps join the previous scene). Returns null when nothing usable came back.
 */
export function normalizeSceneDefs(
  raw: { title?: unknown; startWord?: unknown; endWord?: unknown }[],
  words: WordTiming[],
  cuts: CutInterval[]
): SceneDef[] | null {
  const runs = keptRuns(words, cuts)
  if (!runs.length) return null
  const keptSet = new Set<number>()
  for (const r of runs) for (let i = r.startWord; i <= r.endWord; i++) keptSet.add(i)
  const spans = raw
    .map((s) => ({
      title: typeof s.title === 'string' && s.title.trim() ? s.title.trim().slice(0, 80) : '',
      start: typeof s.startWord === 'number' ? Math.floor(s.startWord) : -1,
      end: typeof s.endWord === 'number' ? Math.floor(s.endWord) : -1
    }))
    .filter((s) => s.start >= 0 && s.end >= s.start && s.start < words.length)
    .map((s) => ({ ...s, end: Math.min(s.end, words.length - 1) }))
    .sort((a, b) => a.start - b.start)
  const clean: { title: string; start: number; end: number }[] = []
  for (const s of spans) {
    const start = clean.length ? Math.max(s.start, clean[clean.length - 1].end + 1) : s.start
    if (start > s.end) continue
    clean.push({ title: s.title, start, end: s.end })
  }
  if (!clean.length) return null
  // Every kept word must belong to exactly one scene: gaps join the scene before them (or the first).
  const covered = new Set<number>()
  for (const s of clean) for (let i = s.start; i <= s.end; i++) if (keptSet.has(i)) covered.add(i)
  const missing = [...keptSet].filter((i) => !covered.has(i)).sort((a, b) => a - b)
  for (const i of missing) {
    const before = clean.filter((s) => s.end < i).pop()
    if (before) before.end = i
    else clean[0].start = Math.min(clean[0].start, i)
  }
  const out: SceneDef[] = []
  clean.forEach((s, k) => {
    const def = defFromRange(words, cuts, s.start, s.end, s.title || `Adegan ${k + 1}`)
    if (def) out.push(def)
  })
  return out.length ? out : null
}

/** The kept stretches inside a scene, in original recording time (a scene may span cut intervals). */
export function sceneKeptRanges(scene: SceneDef, words: WordTiming[], cuts: CutInterval[]): { start: number; end: number }[] {
  return keptRuns(words.slice(scene.startWord, scene.endWord + 1), cuts).map((r) => ({
    start: words[r.startWord + scene.startWord].start,
    end: words[r.endWord + scene.startWord].end
  }))
}

/** A scene's words rebased onto its own concatenated timeline (cut intervals removed). */
export function sceneWordsRebased(scene: SceneDef, words: WordTiming[], cuts: CutInterval[]): WordTiming[] {
  const ranges = sceneKeptRanges(scene, words, cuts)
  const out: WordTiming[] = []
  let offset = 0
  for (const r of ranges) {
    for (let i = scene.startWord; i <= scene.endWord; i++) {
      const w = words[i]
      if (w.start >= r.start && w.end <= r.end) out.push({ text: w.text, start: w.start - r.start + offset, end: w.end - r.start + offset })
    }
    offset += r.end - r.start
  }
  return out
}
