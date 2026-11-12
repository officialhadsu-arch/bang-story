import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { NEXA_DEFAULT_BASE_URL, NEXA_TIMEOUTS, getNexaImageModel, getNexaVideoModel } from '../../shared/nexabot'
import { ApiError, downloadTo, readError, sleep } from './http'

/**
 * NexaBot transport (tier 3, 0.3+): a cheap pay-as-you-go REST API for
 * images and video. The API key is passed in by the caller (generation.ts /
 * ipc.ts) and never stored here — the key is read from the encrypted secret
 * store at the call site (D-07, envelope `KS1:`).
 *
 * ── ASSUMED API SHAPE (D3-01) ──────────────────────────────────────────
 * No official NexaBot API documentation was found in public (12 Nov 2026).
 * Every assumption lives in this one module, labelled, so the first live PC
 * test can correct the transport without touching the catalog, wiring or UI.
 *   base URL .......... https://api.nexabot.id
 *   auth .............. Authorization: Bearer <key> on every call
 *   images ............ POST /v1/images/generations {model, prompt, aspect_ratio, images: [data URI]} → {data: [{url | b64_json}]}
 *   videos ............ POST /v1/videos/generations {model, prompt, image: data URI, duration} → {id, status}
 *   video status ...... GET /v1/videos/{id} → {status: queued|processing|completed|failed, video: {url}, error?: {message}}
 *   cancel ............ POST /v1/videos/{id}/cancel (best effort)
 *   probe ............. GET /v1/models (cheapest authenticated call)
 *   error codes ....... 401 invalid key · 402/403 insufficient credit · 429 rate limit · 5xx server
 * The two live references (PAWARNA, tokogame.ai.id) confirm only the prices
 * and the 15 s video length, not the wire shape.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface NexaMedia {
  bytes: Buffer
  contentType: string
  remoteUrl: string | null
}

export interface NexaSubmitOptions {
  baseUrl?: string
  apiKey: string
  prompt: string
  aspectRatio?: string
  /** Reference images as data URIs. Images use all of them; video uses the first as its first frame. */
  refs?: string[]
  seconds?: number
  signal?: AbortSignal
}

export interface NexaStatusOptions {
  baseUrl?: string
  apiKey: string
  id: string
  signal?: AbortSignal
}

export type NexaVideoStatus = 'queued' | 'processing' | 'completed' | 'failed'

/** In dev, STUDIO_NEXA_BASE points at a local mock server; the packaged app always uses the real API. */
function nexaBase(base?: string): string {
  const env = !app.isPackaged && process.env.STUDIO_NEXA_BASE ? process.env.STUDIO_NEXA_BASE : undefined
  return (base || env || NEXA_DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function combinedSignal(base?: AbortSignal, timeoutMs?: number): { signal: AbortSignal; cleanup: () => void } {
  if (!timeoutMs) return { signal: base ?? new AbortController().signal, cleanup: () => {} }
  const c = new AbortController()
  const timer = setTimeout(() => c.abort(new Error('Timeout')), timeoutMs)
  if (base?.aborted) {
    clearTimeout(timer)
    return { signal: base, cleanup: () => {} }
  }
  const onAbort = () => c.abort(base?.reason)
  base?.addEventListener('abort', onAbort, { once: true })
  return {
    signal: c.signal,
    cleanup: () => {
      clearTimeout(timer)
      base?.removeEventListener('abort', onAbort)
    }
  }
}

/** Never leak the API key into an error message or a log line. An empty key has nothing to redact (replaceAll('', …) would mangle the message). */
function guard(err: unknown, apiKey: string): Error {
  const e = err instanceof Error ? err : new Error(String(err))
  if (!apiKey) return e
  const msg = e.message.replaceAll(apiKey, '***')
  if (msg === e.message) return e
  const wrapped = new Error(msg)
  wrapped.name = e.name
  return wrapped
}

function connectError(err: unknown, apiKey: string): Error {
  const e = guard(err, apiKey)
  if (e instanceof ApiError) return e
  if (e.name === 'AbortError' || /timeout/i.test(e.message)) {
    return new ApiError('Server NexaBot tidak merespons dalam batas waktu.', 0, true)
  }
  return new ApiError(`Tidak dapat terhubung ke NexaBot: ${e.message}`, 0, true)
}

function friendlyError(status: number, detail: string): ApiError {
  const d = detail?.trim()
  if (status === 401) return new ApiError('Kunci NexaBot tidak valid atau belum diisi. Periksa kunci di Pengaturan → NexaBot.', 401)
  if (status === 402 || status === 403)
    return new ApiError('Kredit NexaBot tidak cukup. Isi ulang di nexabot.id, lalu coba lagi.', status, false)
  if (status === 429) return new ApiError('NexaBot membatasi kecepatan (429). Tunggu sebentar, lalu coba lagi.', 429, true)
  if (status >= 500) return new ApiError('Server NexaBot bermasalah. Coba lagi beberapa saat lagi.', status, true)
  if (status === 404) return new ApiError('Endpoint NexaBot tidak ditemukan (404) — bentuk API mungkin berubah; laporkan ke pengembang.', 404)
  return new ApiError(d ? `NexaBot menolak permintaan (HTTP ${status}): ${d}` : `NexaBot menolak permintaan (HTTP ${status}).`, status)
}

async function nexa<T>(path: string, options: { baseUrl?: string; apiKey: string; init?: RequestInit; timeoutMs?: number }): Promise<T> {
  const { signal, cleanup } = combinedSignal(options.init?.signal ?? undefined, options.timeoutMs ?? NEXA_TIMEOUTS.test)
  try {
    const res = await fetch(`${nexaBase(options.baseUrl)}${path}`, {
      ...options.init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
        ...(options.init?.headers ?? {})
      },
      signal
    })
    if (!res.ok) throw friendlyError(res.status, await readError(res))
    return (await res.json()) as T
  } catch (e) {
    throw connectError(e, options.apiKey)
  } finally {
    cleanup()
  }
}

async function fetchOrDecode(result: { url?: string; b64_json?: string } | undefined, apiKey: string, signal?: AbortSignal): Promise<NexaMedia> {
  if (result?.b64_json) {
    const bytes = Buffer.from(result.b64_json, 'base64')
    if (!bytes.length) throw new Error('NexaBot mengembalikan hasil kosong.')
    return { bytes, contentType: 'image/png', remoteUrl: result.url ?? null }
  }
  if (result?.url) {
    try {
      const { bytes, contentType } = await downloadTo(result.url, signal)
      return { bytes, contentType, remoteUrl: result.url }
    } catch (e) {
      throw guard(e, apiKey)
    }
  }
  throw new Error('NexaBot mengembalikan hasil tanpa URL atau data gambar.')
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

/** Image: one POST, the result is inline or a URL (assumed OpenAI-images shape). */
export async function submitImage(opts: NexaSubmitOptions, modelId: string): Promise<NexaMedia> {
  const model = getNexaImageModel(modelId)
  const refs = opts.refs ?? []
  // One idempotency key per submit (D3-07): a lost response followed by a manual retry must not charge twice.
  const key = randomUUID()
  const body = await nexa<{ data?: { url?: string; b64_json?: string }[] }>('/v1/images/generations', {
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    timeoutMs: NEXA_TIMEOUTS.image,
    init: {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({ model: model.id, prompt: opts.prompt, aspect_ratio: opts.aspectRatio ?? '16:9', images: refs }),
      signal: opts.signal
    }
  })
  if (!isRecord(body) || !Array.isArray(body.data) || body.data.length === 0) {
    throw new Error('NexaBot mengembalikan hasil gambar tanpa data.')
  }
  return fetchOrDecode(body.data[0], opts.apiKey, opts.signal)
}

export async function submitVideo(opts: NexaSubmitOptions, modelId: string): Promise<string> {
  const model = getNexaVideoModel(modelId)
  const firstFrame = opts.refs?.[0]
  if (!firstFrame) throw new Error('Model video NexaBot membutuhkan gambar pertama.')
  // One idempotency key per submit (D3-07): a lost response followed by a manual retry must not charge twice.
  const key = randomUUID()
  const body = await nexa<{ id?: string; status?: string }>('/v1/videos/generations', {
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    timeoutMs: NEXA_TIMEOUTS.video,
    init: {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({ model: model.id, prompt: opts.prompt, image: firstFrame, duration: opts.seconds ?? 15 }),
      signal: opts.signal
    }
  })
  if (!isRecord(body) || typeof body.id !== 'string' || !body.id) {
    throw new Error('NexaBot mengembalikan tugas video tanpa id.')
  }
  return body.id
}

export async function getVideoStatus(opts: NexaStatusOptions): Promise<{ status: NexaVideoStatus; videoUrl: string | null; error: string | null }> {
  const body = await nexa<{ status?: string; video?: { url?: string }; error?: { message?: string } | string }>(`/v1/videos/${encodeURIComponent(opts.id)}`, {
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    timeoutMs: NEXA_TIMEOUTS.test,
    init: { signal: opts.signal }
  })
  const status = (typeof body.status === 'string' ? body.status.toLowerCase() : '') as NexaVideoStatus
  if (status !== 'queued' && status !== 'processing' && status !== 'completed' && status !== 'failed') {
    throw new Error(`Status video NexaBot tidak dikenal: ${String(body.status ?? '')}`)
  }
  const error = typeof body.error === 'string' ? body.error : (body.error?.message ?? null)
  return { status, videoUrl: body.video?.url ?? null, error }
}

export async function waitForVideo(
  opts: NexaStatusOptions,
  onTick?: (status: string) => void,
  timeoutMs = 20 * 60 * 1000
): Promise<NexaMedia> {
  const start = Date.now()
  let delay = 2000
  for (;;) {
    const status = await getVideoStatus(opts)
    onTick?.(status.status)
    if (status.status === 'completed' && status.videoUrl) {
      const { bytes, contentType } = await downloadTo(status.videoUrl, opts.signal)
      return { bytes, contentType, remoteUrl: status.videoUrl }
    }
    if (status.status === 'failed') {
      throw new Error(status.error ? `Generate video NexaBot gagal: ${status.error}` : 'Generate video NexaBot gagal.')
    }
    if (Date.now() - start > timeoutMs) throw new Error('Generate video NexaBot melebihi batas waktu 20 menit.')
    await sleep(delay, opts.signal)
    delay = Math.min(delay * 1.5, 10_000)
  }
}

/** Best effort: tell NexaBot to stop a video job. Never throws. */
export async function cancelVideo(opts: NexaStatusOptions): Promise<void> {
  try {
    await nexa(`/v1/videos/${encodeURIComponent(opts.id)}/cancel`, {
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      timeoutMs: NEXA_TIMEOUTS.test,
      init: { method: 'POST', signal: opts.signal }
    })
  } catch {
    // best effort
  }
}

export interface NexaConnection {
  ok: boolean
  message: string
  models?: string[]
}

/**
 * Cheapest authenticated probe (D3-06): GET /v1/models.
 * Without a key it only answers whether the server is reachable.
 */
export async function testConnection(baseUrl?: string, apiKey?: string): Promise<NexaConnection> {
  try {
    const body = await nexa<{ data?: { id?: string }[] }>(`/v1/models`, {
      baseUrl,
      apiKey: apiKey ?? '',
      timeoutMs: NEXA_TIMEOUTS.test
    })
    const models = Array.isArray(body?.data) ? body.data.map((m) => m.id).filter((x): x is string => typeof x === 'string') : []
    return { ok: true, message: 'Terhubung ke NexaBot.', models }
  } catch (e) {
    const err = e instanceof ApiError ? e : new Error(String(e))
    // 401 means the key itself is wrong; any other status (402/403 credit, 429, 5xx) is reported with the
    // same friendly message the generate path shows, so testConnection never contradicts friendlyError.
    if (err instanceof ApiError && err.status === 401) {
      return { ok: false, message: 'Server NexaBot terjangkau, tapi kunci belum diisi atau tidak valid. Isi kunci di Pengaturan → NexaBot.' }
    }
    return { ok: false, message: err.message }
  }
}
