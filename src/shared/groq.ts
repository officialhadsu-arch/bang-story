import type { TranscriptProvider } from './types'

/**
 * Groq Speech-to-Text (0.6): cloud transcription for Talking Head, the free
 * large-v3-class alternative to the local Whisper Small model.
 *
 * ── VERIFIED API SHAPE (console.groq.com/docs/speech-to-text, 14 Nov 2026) ──
 *   endpoint ........ POST {base}/audio/transcriptions (OpenAI-compatible)
 *   auth ............ Authorization: Bearer <key> (the same stored Groq key
 *                     the LLM uses — no second key, G6-04)
 *   model ........... whisper-large-v3 (full Large V3, $0.111/audio hour,
 *                     WER 10.3%) — the literal "large v3" Bos asked for.
 *                     whisper-large-v3-turbo ($0.04/hour, WER 12%) is the
 *                     cheaper/faster variant, recorded but NOT used (G6-02).
 *   request ......... multipart: file (WAV 16 kHz mono — Groq downsamples
 *                     to that itself, so the extracted audio fits as-is),
 *                     model, language (ISO-639-1), response_format=
 *                     verbose_json, temperature=0,
 *                     timestamp_granularities[]=word. No prompt (same
 *                     reason as the local path: a prompt can make Whisper
 *                     loop on a phrase).
 *   response ........ verbose_json: { text, words: [{word, start, end}],
 *                     segments?, duration? } — word times come straight
 *                     from Groq, no DTW step (G6-05).
 *   limits .......... 25 MB per file on the free tier (100 MB dev tier);
 *                     minimum billed length 10 s; no streaming, no
 *                     diarization.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const GROQ_DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'

/** The literal "large v3" model Bos asked for (G6-02). */
export const GROQ_TRANSCRIPT_MODEL = 'whisper-large-v3'

/** The cheaper/faster pruned variant — recorded, not used (G6-02). */
export const GROQ_TRANSCRIPT_MODEL_TURBO = 'whisper-large-v3-turbo'

/** Free-tier upload cap (docs.groq.com); the extracted WAV is ~1.9 MB per minute. */
export const GROQ_TRANSCRIPT_MAX_MB = 25

/** Marks caption timings that came from Groq, so timings from older methods can be synced again. */
export const GROQ_TIMING = 'groq-whisper-large-v3'

export const TRANSCRIPT_PROVIDERS: { id: TranscriptProvider; label: string; hint: string }[] = [
  { id: 'local', label: 'Lokal — Whisper Small', hint: 'Di komputer ini · gratis · tanpa kunci' },
  { id: 'groq', label: 'Groq — Whisper Large V3', hint: 'Cloud · gratis (tier gratis) · perlu kunci Groq' }
]

export function isTranscriptProvider(v: unknown): v is TranscriptProvider {
  return v === 'local' || v === 'groq'
}
