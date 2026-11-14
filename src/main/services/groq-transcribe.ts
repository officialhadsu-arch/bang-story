import { app } from 'electron'
import { readFileSync, statSync } from 'node:fs'
import { GROQ_DEFAULT_BASE_URL, GROQ_TRANSCRIPT_MAX_MB, GROQ_TRANSCRIPT_MODEL } from '../../shared/groq'
import type { KeyTestResult } from '@shared/types'
import type { Heard } from '../align'
import { ApiError } from './http'

/**
 * Groq Speech-to-Text transport (0.6): cloud transcription for Talking Head,
 * the free large-v3-class alternative to the local Whisper Small model. The
 * API key is passed in by the caller (talkinghead.ts) and never stored here —
 * the key is read from the encrypted secret store at the call site (D-07,
 * envelope `KS1:`), the same stored Groq key the LLM uses (G6-04).
 *
 * ── VERIFIED API SHAPE (console.groq.com/docs/speech-to-text, 14 Nov 2026) ──
 *   endpoint ... POST {base}/audio/transcriptions (OpenAI-compatible)
 *   auth ....... Authorization: Bearer <key>
 *   request .... multipart: file (WAV 16 kHz mono — Groq downsamples to that
 *                itself, so the extracted audio fits as-is), model=
 *                whisper-large-v3, language (ISO-639-1), response_format=
 *                verbose_json, temperature=0, timestamp_granularities[]=word.
 *                No prompt (same reason as the local path: a prompt can make
 *                Whisper loop on a phrase).
 *   response ... verbose_json: { text, words: [{word, start, end}], ... } —
 *                word times come straight from Groq, no DTW step (G6-05).
 *   limits ..... 25 MB per file on the free tier (100 MB dev tier); minimum
 *                billed length 10 s; no streaming, no diarization.
 * ─────────────────────────────────────────────────────────────────────────
 */

const TRANSCRIBE_TIMEOUT_MS = 300_000

/** In dev, STUDIO_GROQ_BASE points at a local mock server; the packaged app always uses the real API. */
function groqBase(base?: string): string {
  const env = !app.isPackaged && process.env.STUDIO_GROQ_BASE ? process.env.STUDIO_GROQ_BASE : undefined
  return (base || env || GROQ_DEFAULT_BASE_URL).replace(/\/+$/, '')
}

/** Whisper's language codes differ from ours only for Javanese (same mapping as whisper.ts). */
const groqLanguage = (code: string): string => (code === 'jv' ? 'jw' : code)

/** Never leak the API key into an error message or a log line. */
function guard(err: unknown, apiKey: string): Error {
  const e = err instanceof Error ? err : new Error(String(err))
  if (!apiKey) return e
  const msg = e.message.replaceAll(apiKey, '***')
  if (msg === e.message) return e
  const wrapped = new Error(msg)
  wrapped.name = e.name
  return wrapped
}

function friendlyError(status: number, detail: string): ApiError {
  const d = detail?.trim()
  if (status === 401) return new ApiError('Kunci Groq tidak valid atau belum diisi. Periksa kunci di Pengaturan › Kunci API dan model.', 401)
  if (status === 413) return new ApiError('Berkas audio terlalu besar untuk Groq (batas 25 MB tier gratis). Potong rekaman jadi lebih pendek atau pakai Whisper lokal.', 413)
  if (status === 429)
    return new ApiError('Groq membatasi kecepatan (rate limit tier gratis). Tunggu sebentar, lalu coba lagi.', 429, true)
  if (status >= 500) return new ApiError('Server Groq bermasalah. Coba lagi beberapa saat lagi.', status, true)
  return new ApiError(d ? `Groq menolak permintaan (kode ${status}): ${d}` : `Groq menolak permintaan (kode ${status}).`, status)
}

export interface GroqTranscribeOptions {
  baseUrl?: string
  apiKey: string
  /** The extracted WAV (16 kHz mono) the local path also reads. */
  audioPath: string
  language: string
  signal?: AbortSignal
}

type GroqWord = { word?: unknown; start?: unknown; end?: unknown }

/**
 * Validates a verbose_json transcription body and returns its words, with the
 * same monotonic timing rules the local `recognize` applies (starts only move
 * forward, a word ends at the next word's start at the latest). Pure, so the
 * service test can exercise it without a network.
 */
export function parseGroqVerbose(body: unknown): Heard[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { words?: unknown }).words)) {
    throw new ApiError('Groq mengembalikan transkrip tanpa waktu per kata. Coba lagi atau pakai Whisper lokal.', 0)
  }
  const raw = (body as { words: GroqWord[] }).words
  const words: Heard[] = []
  for (const w of raw) {
    const text = typeof w.word === 'string' ? w.word.trim() : ''
    const start = typeof w.start === 'number' && Number.isFinite(w.start) ? w.start : -1
    const end = typeof w.end === 'number' && Number.isFinite(w.end) ? w.end : -1
    if (!text || start < 0 || end < start) continue
    words.push({ text, start, end })
  }
  if (!words.length) throw new ApiError('Groq tidak mengenali kata apa pun di rekaman ini. Periksa audionya.', 0)
  // Starts only move forward, and a word lasts until the next one starts at the latest.
  words.forEach((w, i) => {
    if (i > 0 && w.start < words[i - 1].start) w.start = words[i - 1].start
    w.end = Math.max(w.end, w.start)
  })
  words.forEach((w, i) => {
    const next = words[i + 1]
    if (next && next.start > w.start) w.end = Math.min(w.end, next.start)
  })
  return words
}

/**
 * Transcribes an audio file with Groq's Whisper Large V3 and returns its words
 * with per-word times. Fails hard with a clear Indonesian message — no silent
 * fallback to the local model (G6-06).
 */
export async function transcribeWithGroq(opts: GroqTranscribeOptions): Promise<Heard[]> {
  const size = statSync(opts.audioPath).size
  const maxBytes = GROQ_TRANSCRIPT_MAX_MB * 1024 * 1024
  if (size > maxBytes) {
    throw new ApiError(
      `Berkas audio ${(size / 1_048_576).toFixed(1)} MB — melebihi batas 25 MB tier gratis Groq. Potong rekaman jadi lebih pendek atau pakai Whisper lokal.`,
      413
    )
  }
  const timeout = AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  const form = new FormData()
  form.append('file', new Blob([readFileSync(opts.audioPath)], { type: 'audio/wav' }), 'audio.wav')
  form.append('model', GROQ_TRANSCRIPT_MODEL)
  form.append('language', groqLanguage(opts.language))
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  form.append('timestamp_granularities[]', 'word')
  let res: Response
  try {
    res = await fetch(`${groqBase(opts.baseUrl)}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: form,
      signal
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      if (opts.signal?.aborted) throw guard(new Error('Dibatalkan'), opts.apiKey)
      throw guard(new ApiError('Groq terlalu lama merespons (batas 5 menit). Coba lagi atau pakai Whisper lokal.', 0, true), opts.apiKey)
    }
    throw guard(new ApiError(`Tidak dapat terhubung ke Groq: ${(e as Error).message}`, 0, true), opts.apiKey)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    let message = ''
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } }
      message = typeof parsed.error?.message === 'string' ? parsed.error.message : ''
    } catch {
      // not JSON — keep the raw text below
    }
    throw guard(friendlyError(res.status, message || detail.slice(0, 300)), opts.apiKey)
  }
  const body: unknown = await res.json().catch(() => null)
  return parseGroqVerbose(body)
}

export interface GroqTestOptions {
  baseUrl?: string
  apiKey: string
  signal?: AbortSignal
}

/** Proves the stored Groq key works (and that whisper-large-v3 is listed) without sending audio or spending anything. */
export async function testGroqConnection(opts: GroqTestOptions): Promise<KeyTestResult> {
  try {
    const timeout = AbortSignal.timeout(30_000)
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
    const res = await fetch(`${groqBase(opts.baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      signal
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw friendlyError(res.status, detail.slice(0, 300))
    }
    const body = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null
    const ids = (body?.data ?? []).map((m) => m.id ?? '')
    if (!ids.includes(GROQ_TRANSCRIPT_MODEL)) {
      return { ok: false, message: `Terhubung ke Groq, tapi model ${GROQ_TRANSCRIPT_MODEL} tidak tercantum — mungkin modelnya sudah tidak tersedia.` }
    }
    return { ok: true, message: `Terhubung · model ${GROQ_TRANSCRIPT_MODEL} tersedia` }
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: guard(e, opts.apiKey).message }
    return { ok: false, message: guard(e, opts.apiKey).message }
  }
}
