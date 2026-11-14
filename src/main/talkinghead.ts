import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'
import { WHISPER_TIMING } from '@shared/captions'
import { GROQ_TIMING } from '@shared/groq'
import {
  DEFAULT_FILLERS,
  arrangeDeterministic,
  autoDroppedIndexes,
  computeCuts,
  findFootage,
  keptRuns,
  normalizeSceneDefs,
  sceneKeptRanges,
  sceneWordsRebased,
  summarizeTranscript,
  type ArrangeResult,
  type SceneDef
} from '@shared/talkinghead'
import type { Asset, Job, KeyTestResult, ProjectBundle, WordTiming } from '@shared/types'
import type { Heard } from './align'
import { emit } from './events'
import { runJob } from './jobs'
import { assetAbsPath, binPath, dataDir } from './paths'
import {
  activeProjectJob,
  getAsset,
  getBundle,
  getProject,
  insertAsset,
  insertJob,
  replaceTalkingHeadClips,
  updateAssetMeta,
  type TalkingHeadClipRow
} from './repo'
import { probeDurationMs, probeSize } from './services/audio'
import { generateJson } from './services/llm'
import { testGroqConnection, transcribeWithGroq } from './services/groq-transcribe'
import { getSecret } from './secrets'
import { getSettings } from './settings'
import { recognize } from './whisper'

/**
 * Talking Head (Fase 5, narasi-dulu): import the raw recording, transcribe it once, cut the pauses and
 * filler words, group it into scenes, and cut each scene's video and audio out of the recording.
 *
 * The video file's own audio track is never used in the export (keputusan-teknis.md): the recording's
 * audio is extracted once at import (F5-07), and every scene gets its own audio file cut from that
 * extraction, with word times rebased onto the scene. Video and audio come from the same cut list, so
 * they stay in sync (F5-08).
 */

function ffmpeg(args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = execFile(binPath(ffmpegStatic!), ['-hide_banner', '-nostats', ...args], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (err, _out, stderr) => {
      if (signal?.aborted) return reject(new Error('Dibatalkan'))
      if (err) return reject(new Error(`FFmpeg gagal: ${String(stderr).split('\n').slice(-4).join(' ').trim()}`))
      resolve(String(stderr))
    })
    signal?.addEventListener('abort', () => p.kill('SIGKILL'), { once: true })
  })
}

/** The project's raw recording and its extracted audio, if any (latest import wins). */
export function getFootage(projectId: string): { video: Asset | null; audio: Asset | null } {
  return findFootage(getBundle(projectId).assets)
}

/**
 * Copies a recording into the project and extracts its audio once (WAV 16 kHz mono, the format Whisper
 * reads). The transcript and every scene's voice come from this extraction.
 */
export async function importFootage(projectId: string, srcPath: string): Promise<{ video: Asset; audio: Asset }> {
  const project = getProject(projectId)
  if (project.mode !== 'talking-head') throw new Error('Impor rekaman hanya untuk proyek Talking Head.')
  if (!existsSync(srcPath)) throw new Error('Berkas rekaman tidak ditemukan.')
  const ext = extname(srcPath).toLowerCase()
  if (!['.mp4', '.mov', '.webm'].includes(ext)) throw new Error('Pakai file video MP4, MOV, atau WebM.')
  const rel = `footage/${randomUUID()}${ext}`
  const abs = assetAbsPath(projectId, rel)
  mkdirSync(dirname(abs), { recursive: true })
  copyFileSync(srcPath, abs)
  const size = await probeSize(abs).catch(() => null)
  if (!size) throw new Error('Video tidak bisa dibaca. Pakai file MP4, MOV, atau WebM.')
  const durationMs = await probeDurationMs(abs).catch(() => null)
  const video = insertAsset({
    projectId,
    kind: 'video',
    provider: 'local',
    prompt: basename(srcPath),
    localPath: rel,
    durationMs,
    width: size.width,
    height: size.height,
    meta: { role: 'footage' }
  })
  const audioRel = `audio/footage-${randomUUID()}.wav`
  const audioAbs = assetAbsPath(projectId, audioRel)
  mkdirSync(dirname(audioAbs), { recursive: true })
  await ffmpeg(['-y', '-i', abs, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', audioAbs])
  const audioMs = await probeDurationMs(audioAbs).catch(() => durationMs)
  const audio = insertAsset({
    projectId,
    kind: 'audio',
    provider: 'local',
    prompt: 'Audio rekaman',
    localPath: audioRel,
    durationMs: audioMs,
    meta: { role: 'footage-audio', footageAssetId: video.id, fillerWords: [...DEFAULT_FILLERS] }
  })
  emit.asset(video)
  emit.asset(audio)
  return { video, audio }
}

/**
 * Recognises the recording once — with the local Whisper model by default, or with Groq's cloud
 * Whisper Large V3 when the user picked it (G6-01). The engine is the user's explicit choice: a
 * failing engine fails the job with a clear message, never a silent fallback (G6-06). Filler words
 * are auto-marked to cut; the user can restore any of them.
 */
export function transcribeFootage(projectId: string): Job {
  const running = activeProjectJob(projectId, 'transcribe')
  if (running) return running
  const project = getProject(projectId)
  if (project.mode !== 'talking-head') throw new Error('Transkrip hanya untuk proyek Talking Head.')
  const { audio } = getFootage(projectId)
  if (!audio) throw new Error('Impor rekaman dulu sebelum membuat transkrip.')
  const provider = getSettings().transcriptProvider
  const job = insertJob({ projectId, kind: 'transcribe', provider: provider === 'groq' ? 'groq' : 'whisper' })
  emit.job(job)
  return runJob(job, 'whisper', async (ctx) => {
    const tmp = join(dataDir(), 'tmp', `transcribe-${ctx.jobId}`)
    mkdirSync(tmp, { recursive: true })
    try {
      const p = getProject(projectId)
      const asset = getAsset(audio.id)!
      // Groq returns word times directly (no DTW step); the local path times words with DTW.
      let heard: Heard[]
      let timedBy = WHISPER_TIMING
      if (provider === 'groq') {
        const key = getSecret('groq')
        if (!key) throw new Error('Kunci Groq belum diisi. Isi kunci Groq di Pengaturan › Kunci API dan model.')
        ctx.progress(0.1, 'Mengirim audio ke Groq…')
        heard = await transcribeWithGroq({ apiKey: key, audioPath: assetAbsPath(projectId, asset.localPath), language: p.language, signal: ctx.signal })
        timedBy = GROQ_TIMING
      } else {
        ctx.progress(0.1, 'Mengenali kata-kata rekaman dengan Whisper…')
        heard = await recognize(assetAbsPath(projectId, asset.localPath), p.language, tmp, ctx.signal)
      }
      const words: WordTiming[] = heard.map((w) => ({ text: w.text, start: w.start, end: w.end }))
      if (!words.length) throw new Error('Whisper tidak mengenali kata apa pun di rekaman ini. Periksa audionya.')
      const fillers = asset.meta.fillerWords ?? DEFAULT_FILLERS
      const dropped = autoDroppedIndexes(words, fillers)
      updateAssetMeta(asset.id, { ...asset.meta, words, droppedWordIndexes: dropped, estimatedTimings: false, timedBy })
      emit.asset(getAsset(asset.id)!)
      const summary = summarizeTranscript(words, computeCuts(words, { fillers, dropped }))
      return {
        message: `${summary.words} kata dikenali · ${summary.keptWords} kata terpakai · ${summary.cutCount} potongan · ${summary.keptSec.toFixed(0)} dtk terpakai dari ${summary.totalSec.toFixed(0)} dtk`
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
}

/** Proves the stored Groq key works for transcription (no audio sent, no cost). */
export async function testGroq(): Promise<KeyTestResult> {
  const key = getSecret('groq')
  if (!key) return { ok: false, message: 'Kunci Groq belum diisi. Isi kunci Groq di Pengaturan › Kunci API dan model.' }
  return testGroqConnection({ apiKey: key })
}

/** Marks transcript words to cut (or restores them): the effective cut list for arranging and building. */
export function setDroppedWords(assetId: string, dropped: number[]): Asset {
  const asset = getAsset(assetId)
  if (!asset || asset.kind !== 'audio') throw new Error('Audio transkrip tidak ditemukan')
  const words = asset.meta.words ?? []
  const clean = [...new Set(dropped)].filter((i) => Number.isInteger(i) && i >= 0 && i < words.length).sort((a, b) => a - b)
  updateAssetMeta(asset.id, { ...asset.meta, droppedWordIndexes: clean })
  const fresh = getAsset(asset.id)!
  emit.asset(fresh)
  return fresh
}

/** Replaces the filler-word list and re-marks the auto-cut words (manual Buang/Biarkan marks reset). */
export function setFillers(assetId: string, fillers: string[]): Asset {
  const asset = getAsset(assetId)
  if (!asset || asset.kind !== 'audio') throw new Error('Audio transkrip tidak ditemukan')
  const clean = [...new Set(fillers.map((f) => f.trim().toLowerCase()).filter(Boolean))]
  const words = asset.meta.words ?? []
  updateAssetMeta(asset.id, { ...asset.meta, fillerWords: clean, droppedWordIndexes: autoDroppedIndexes(words, clean) })
  const fresh = getAsset(asset.id)!
  emit.asset(fresh)
  return fresh
}

// ---------- arrange scenes ----------

const SCENE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'Short scene title in the transcript language.' },
          startWord: { type: 'integer', description: 'Index of the first word of the scene (0-based, see the numbered transcript).' },
          endWord: { type: 'integer', description: 'Index of the last word of the scene (0-based, inclusive).' }
        },
        required: ['title', 'startWord', 'endWord']
      }
    }
  },
  required: ['scenes']
}

/**
 * Groups the transcript into scenes with the LLM (strict JSON, word-index boundaries), or with the
 * deterministic long-pause grouping when the LLM is unavailable — the fallback always produces scenes.
 */
export async function arrangeScenes(projectId: string): Promise<ArrangeResult> {
  const project = getProject(projectId)
  if (project.mode !== 'talking-head') throw new Error('Susun adegan hanya untuk proyek Talking Head.')
  const { audio } = getFootage(projectId)
  const words = audio?.meta.words ?? []
  if (!words.length) throw new Error('Buat transkrip dulu sebelum menyusun adegan.')
  const fillers = audio!.meta.fillerWords ?? DEFAULT_FILLERS
  const dropped = audio!.meta.droppedWordIndexes ?? []
  const cuts = computeCuts(words, { fillers, dropped })
  const summary = summarizeTranscript(words, cuts)
  const runs = keptRuns(words, cuts)
  try {
    const numbered = runs
      .map((r) => `Kata ${r.startWord}–${r.endWord} (${r.keptSec.toFixed(1)} dtk): ${words.slice(r.startWord, r.endWord + 1).map((w) => w.text).join(' ')}`)
      .join('\n')
    const system = [
      'You group a spoken transcript into video scenes.',
      'Each scene holds 30 to 60 seconds of kept speech. Prefer scene boundaries at the start or end of a numbered stretch.',
      'Give each scene a short title in the transcript language (max 8 words).',
      'Return startWord/endWord as word indexes from the numbered transcript below. Cover every kept word exactly once, in order.'
    ].join(' ')
    const plan = await generateJson<{ scenes?: { title?: unknown; startWord?: unknown; endWord?: unknown }[] }>({
      system,
      prompt: `Transcript (numbered stretches; [potong] stretches between them are cut and never appear):\n${numbered}`,
      schema: SCENE_SCHEMA,
      name: 'talkinghead-scenes'
    })
    const normalized = normalizeSceneDefs(plan.scenes ?? [], words, cuts)
    if (normalized) return { scenes: normalized, source: 'llm', summary }
    console.warn('[talkinghead] susun adegan AI tidak menghasilkan adegan yang valid, pakai fallback.')
  } catch (e) {
    console.warn('[talkinghead] susun adegan AI gagal, pakai fallback:', (e as Error).message)
  }
  return { scenes: arrangeDeterministic(words, cuts), source: 'fallback', summary }
}

// ---------- build scenes ----------

/** Cuts the kept stretches of one scene out of the recording into a single video file. */
async function renderSceneVideo(src: string, ranges: { start: number; end: number }[], out: string, tmp: string): Promise<void> {
  const parts: string[] = []
  for (const r of ranges) {
    const part = join(tmp, `v-${randomUUID()}.mp4`)
    await ffmpeg(['-y', '-ss', r.start.toFixed(3), '-to', r.end.toFixed(3), '-i', src, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', part])
    parts.push(part)
  }
  if (parts.length === 1) {
    // One stretch: the single encode is the scene file already.
    renameSync(parts[0], out)
    return
  }
  const list = join(tmp, `v-list-${randomUUID()}.txt`)
  writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out])
}

/** Same stretches as audio (WAV 16 kHz mono, the format the captions and the export read). */
async function renderSceneAudio(src: string, ranges: { start: number; end: number }[], out: string, tmp: string): Promise<void> {
  const parts: string[] = []
  for (const r of ranges) {
    const part = join(tmp, `a-${randomUUID()}.wav`)
    await ffmpeg(['-y', '-ss', r.start.toFixed(3), '-to', r.end.toFixed(3), '-i', src, '-vn', '-c:a', 'pcm_s16le', '-ar', '24000', '-ac', '1', part])
    parts.push(part)
  }
  if (parts.length === 1) {
    renameSync(parts[0], out)
    return
  }
  const list = join(tmp, `a-list-${randomUUID()}.txt`)
  writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out])
}

/**
 * Cuts every scene out of the recording (one video file + one audio file per scene, cut intervals
 * removed from both) and replaces the project's clips with them. The scene's words are rebased onto
 * its own timeline, so karaoke captions sit on the right words. Old scenes stay in the asset history.
 */
export async function buildScenes(projectId: string, scenes: SceneDef[]): Promise<ProjectBundle> {
  const project = getProject(projectId)
  if (project.mode !== 'talking-head') throw new Error('Buat adegan hanya untuk proyek Talking Head.')
  const { video, audio } = getFootage(projectId)
  const words = audio?.meta.words ?? []
  if (!video || !words.length) throw new Error('Impor rekaman dan buat transkrip dulu.')
  if (!scenes.length) throw new Error('Susun adegan dulu sebelum membuat adegan.')
  const cuts = computeCuts(words, { fillers: audio!.meta.fillerWords ?? DEFAULT_FILLERS, dropped: audio!.meta.droppedWordIndexes ?? [] })
  const footageAbs = assetAbsPath(projectId, video.localPath)
  const tmp = join(dataDir(), 'tmp', `talkinghead-${randomUUID()}`)
  mkdirSync(tmp, { recursive: true })
  try {
    const rows: TalkingHeadClipRow[] = []
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const ranges = sceneKeptRanges(scene, words, cuts)
      if (!ranges.length) continue
      const videoRel = `videos/th-${randomUUID()}.mp4`
      const videoAbs = assetAbsPath(projectId, videoRel)
      mkdirSync(dirname(videoAbs), { recursive: true })
      await renderSceneVideo(footageAbs, ranges, videoAbs, tmp)
      const videoMs = await probeDurationMs(videoAbs)
      const audioRel = `audio/th-${randomUUID()}.wav`
      const audioAbs = assetAbsPath(projectId, audioRel)
      mkdirSync(dirname(audioAbs), { recursive: true })
      await renderSceneAudio(footageAbs, ranges, audioAbs, tmp)
      const audioMs = await probeDurationMs(audioAbs).catch(() => videoMs)
      const sceneWords = sceneWordsRebased(scene, words, cuts)
      const vAsset = insertAsset({
        projectId,
        kind: 'video',
        provider: 'local',
        prompt: `Adegan ${i + 1} (${scene.title})`,
        localPath: videoRel,
        durationMs: videoMs,
        width: video.width,
        height: video.height,
        meta: { role: 'scene-video', footageAssetId: video.id }
      })
      const aAsset = insertAsset({
        projectId,
        kind: 'audio',
        provider: 'local',
        prompt: scene.narration,
        localPath: audioRel,
        durationMs: audioMs,
        meta: { words: sceneWords, estimatedTimings: false, timedBy: WHISPER_TIMING, role: 'scene-audio', footageAssetId: video.id }
      })
      rows.push({
        title: scene.title,
        narration: scene.narration,
        durationMs: videoMs,
        videoAssetId: vAsset.id,
        audioAssetId: aAsset.id,
        videoCamera: 'zoomin',
        videoStrength: 'halus',
        composition: 'penuh'
      })
    }
    if (!rows.length) throw new Error('Tidak ada adegan yang bisa dibuat dari transkrip ini.')
    replaceTalkingHeadClips(projectId, project.title, rows)
    return getBundle(projectId)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
