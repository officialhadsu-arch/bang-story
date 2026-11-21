import { spokenWords, tagPauseSec } from './speech'
import type { Clip } from './types'

/** Silence kept after each narration line, so scenes do not feel rushed. */
export const VOICE_PAD_MS = 400

/**
 * Scene length before a voice exists: about 2.6 spoken words per second plus a breath. Once the narration
 * is voiced, the clip follows the real audio length instead.
 */
export function estimateNarrationMs(narration: string): number {
  const words = spokenWords(narration).length
  return Math.round(Math.min(15, Math.max(3, words / 2.6 + 0.6 + tagPauseSec(narration))) * 1000)
}

/** Spoken words only; vocal tags such as <short pause> do not count. */
export function wordCount(text: string): number {
  return spokenWords(text).length
}

/** Sentence-final punctuation: a period, exclamation, question mark, or ellipsis. */
const END_PUNCT = /[.?!…]$/

/**
 * A scene whose narration looks cut off mid-sentence — the shape a truncated LLM reply leaves behind.
 * "Lanjutkan naskah" drops such a last scene before continuing, instead of building on a broken line.
 * Empty narration, fewer than 10 spoken words, or no sentence-final punctuation (after trailing spaces
 * and trailing vocal tags are stripped) all count as doubtful.
 */
export function isDoubtfulScene(narration: string): boolean {
  if (!narration.trim()) return true
  if (wordCount(narration) < 10) return true
  // Strip trailing whitespace and any vocal tags sitting at the end, then look at the last real character.
  const trimmed = narration.replace(/\s+$/, '').replace(/(?:\s*<[^<>]{1,40}>)+\s*$/, '')
  return !END_PUNCT.test(trimmed)
}

/** The text a scene's visual plan is written from: its story, or its narration when it has no story. */
export function visualSourceOf(clip: Pick<Clip, 'story' | 'narration'>): string {
  return (clip.story.trim() || clip.narration.trim()).replace(/\s+/g, ' ')
}

/** A scene needs a (new) visual plan when it has none, or when its story changed after the plan was written. */
export function needsVisual(clip: Pick<Clip, 'story' | 'narration' | 'visualPrompt' | 'visualSource'>): boolean {
  if (!clip.visualPrompt.trim()) return true
  return clip.visualSource != null && clip.visualSource !== visualSourceOf(clip)
}
