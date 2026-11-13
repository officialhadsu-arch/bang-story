import { app } from 'electron'
import { KIE_API_MODEL, KIE_DEFAULT_BASE_URL, KIE_IMAGE_MODELS, KIE_TIMEOUTS, getKieImageModel, getKieVideoModel, isKieVeoModelId } from '../../shared/kieai'
import { ApiError, downloadTo, sleep } from './http'

/**
 * kie.ai transport (tier 4, 0.3+): a premium pay-as-you-go REST API for
 * images and video. The API key is passed in by the caller (generation.ts /
 * ipc.ts) and never stored here — the key is read from the encrypted secret
 * store at the call site (D-07, envelope `KS1:`).
 *
 * ── VERIFIED API SHAPE (docs.kie.ai, 13 Nov 2026) ───────────────────────
 *   base URL .......... https://api.kie.ai
 *   auth .............. Authorization: Bearer <key> on every call
 *   combined jobs ..... POST /api/v1/jobs/createTask {model, input, callBackUrl?} → {code: 200, data: {taskId}}
 *                       GET  /api/v1/jobs/recordInfo?taskId=… → {code: 200, data: {status, resultJson}}
 *                       status: waiting → queuing → generating → success | fail;
 *                       resultJson is a STRING holding {resultUrls: [...]} at success.
 *   Veo ............... POST /api/v1/veo/generate → {code: 200, data: {taskId}}
 *                       GET  /api/v1/veo/record-info?taskId=… → {code: 200, data: {successFlag, response}}
 *   credit probe ...... GET /api/v1/chat/credit (cheapest authenticated call, no generate cost)
 *   errors ............ HTTP 200 + `code` in the body — ALWAYS check `code`, never the HTTP status
 *                       alone. 401 invalid key · 402/403 insufficient credit · 429 rate limit
 *                       (a rejected request is NOT queued — retry with backoff) · 5xx server.
 *                       The endpoint + envelope were confirmed live 13 Nov 2026 by another lane
 *                       (TTS createTask + recordInfo, same family, no paid call from this tier).
 *   rate limit ........ 20 new generate requests per 10 s per account
 *   retention ......... media 14 days — results MUST be downloaded promptly
 * ── LABELLED ASSUMPTIONS (K4-01) ─────────────────────────────────────────
 *   model strings ..... KIE_API_MODEL in `src/shared/kieai.ts` (best-guess slugs)
 *   input shapes ...... `prompt` + `aspect_ratio` (+ `image_urls` for a first frame,
 *                       `duration` in seconds for per-second video models); Veo takes
 *                       `prompt` + `model` + `imageUrls` + `aspectRatio` + `duration`
 *   Veo status ........ successFlag 1 = success, 2 = failed, anything else = still running
 *   idempotency ....... no key is sent: createTask shows no idempotency support in the docs,
 *                       so a lost response followed by a manual retry may charge twice
 *   cancel ............ no cancel endpoint is documented — cancelling only stops the local
 *                       poll; the server task may keep running (and charging)
 * The first live PC test corrects this module without touching the catalog, wiring or UI.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface KieMedia {
  bytes: Buffer
  contentType: string
  remoteUrl: string | null
}

export interface KieSubmitOptions {
  baseUrl?: string
  apiKey: string
  prompt: string
  aspectRatio?: string
  /** Reference images as data URIs. Video uses the first as its first frame; images ignore them in tier 4. */
  refs?: string[]
  seconds?: number
  signal?: AbortSignal
}

export interface KieStatusOptions {
  baseUrl?: string
  apiKey: string
  id: string
  signal?: AbortSignal
}

export type KieTaskStatus = 'waiting' | 'queuing' | 'generating' | 'success' | 'fail'

/** In dev, STUDIO_KIE_BASE points at a local mock server; the packaged app always uses the real API. */
function kieBase(base?: string): string {
  const env = !app.isPackaged && process.env.STUDIO_KIE_BASE ? process.env.STUDIO_KIE_BASE : undefined
  return (base || env || KIE_DEFAULT_BASE_URL).replace(/\/+$/, '')
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
    return new ApiError('Server kie.ai tidak merespons dalam batas waktu.', 0, true)
  }
  return new ApiError(`Tidak dapat terhubung ke kie.ai: ${e.message}`, 0, true)
}

function friendlyError(status: number, detail: string): ApiError {
  const d = detail?.trim()
  if (status === 401) return new ApiError('Kunci kie.ai tidak valid atau belum diisi. Periksa kunci di Pengaturan → Kie.ai.', 401)
  if (status === 402 || status === 403)
    return new ApiError('Kredit kie.ai tidak cukup. Isi ulang di kie.ai, lalu coba lagi.', status, false)
  if (status === 429)
    return new ApiError('kie.ai membatasi kecepatan (429). Request yang ditolak tidak masuk antrean — tunggu sebentar, lalu coba lagi.', 429, true)
  if (status >= 500) return new ApiError('Server kie.ai bermasalah. Coba lagi beberapa saat lagi.', status, true)
  if (status === 404) return new ApiError('Endpoint kie.ai tidak ditemukan (404) — bentuk API mungkin berubah; laporkan ke pengembang.', 404)
  return new ApiError(d ? `kie.ai menolak permintaan (kode ${status}): ${d}` : `kie.ai menolak permintaan (kode ${status}).`, status)
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

/**
 * One kie.ai call. Errors arrive as HTTP 200 + `code` in the body, so the
 * body is always parsed first and `code` checked before the HTTP status.
 */
async function kie<T>(path: string, options: { baseUrl?: string; apiKey: string; init?: RequestInit; timeoutMs?: number }): Promise<T> {
  const { signal, cleanup } = combinedSignal(options.init?.signal ?? undefined, options.timeoutMs ?? KIE_TIMEOUTS.test)
  try {
    const res = await fetch(`${kieBase(options.baseUrl)}${path}`, {
      ...options.init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
        ...(options.init?.headers ?? {})
      },
      signal
    })
    const text = await res.text().catch(() => '')
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    if (isRecord(body) && typeof body.code === 'number' && body.code !== 200) {
      throw friendlyError(body.code, typeof body.msg === 'string' ? body.msg : '')
    }
    if (!res.ok) throw friendlyError(res.status, text.slice(0, 300))
    return body as T
  } catch (e) {
    throw connectError(e, options.apiKey)
  } finally {
    cleanup()
  }
}

/** The assumed `model` string for this catalog id (K4-01). */
function apiModel(modelId: string): string {
  return KIE_API_MODEL[modelId] ?? modelId
}

function taskIdOf(body: unknown): string {
  if (!isRecord(body) || !isRecord(body.data) || typeof body.data.taskId !== 'string' || !body.data.taskId) {
    throw new Error('kie.ai mengembalikan tugas tanpa taskId.')
  }
  return body.data.taskId
}

/** Submit a task and return its id. Images and non-Veo video use the combined jobs API; Veo uses its own endpoints. */
export async function submitTask(opts: KieSubmitOptions, modelId: string): Promise<string> {
  if (isKieVeoModelId(modelId)) {
    const firstFrame = opts.refs?.[0]
    if (!firstFrame) throw new Error('Model video kie.ai membutuhkan gambar pertama.')
    const body = await kie<unknown>('/api/v1/veo/generate', {
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      timeoutMs: KIE_TIMEOUTS.video,
      init: {
        method: 'POST',
        body: JSON.stringify({
          prompt: opts.prompt,
          model: apiModel(modelId),
          imageUrls: [firstFrame],
          aspectRatio: opts.aspectRatio ?? '16:9',
          duration: opts.seconds ?? 8
        }),
        signal: opts.signal
      }
    })
    return taskIdOf(body)
  }
  const isImage = KIE_IMAGE_MODELS.some((m) => m.id === modelId)
  const input: Record<string, unknown> = { prompt: opts.prompt, aspect_ratio: opts.aspectRatio ?? '16:9' }
  if (!isImage) {
    const firstFrame = opts.refs?.[0]
    if (!firstFrame) throw new Error('Model video kie.ai membutuhkan gambar pertama.')
    input.image_urls = [firstFrame]
    input.duration = opts.seconds ?? 8
  } else if (opts.refs?.length) {
    input.image_urls = opts.refs
  }
  const body = await kie<unknown>('/api/v1/jobs/createTask', {
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    timeoutMs: isImage ? KIE_TIMEOUTS.image : KIE_TIMEOUTS.video,
    init: {
      method: 'POST',
      body: JSON.stringify({ model: apiModel(modelId), input }),
      signal: opts.signal
    }
  })
  return taskIdOf(body)
}

export interface KieTaskState {
  status: KieTaskStatus
  resultUrls: string[]
  error: string | null
}

/** Poll one task. Veo answers with `successFlag`; the combined API answers with `status` + `resultJson`. */
export async function getTaskStatus(opts: KieStatusOptions, modelId: string): Promise<KieTaskState> {
  if (isKieVeoModelId(modelId)) {
    const body = await kie<{ data?: { successFlag?: number; response?: { resultUrls?: string[] }; resultUrls?: string[]; error?: string } }>(
      `/api/v1/veo/record-info?taskId=${encodeURIComponent(opts.id)}`,
      { baseUrl: opts.baseUrl, apiKey: opts.apiKey, timeoutMs: KIE_TIMEOUTS.test, init: { signal: opts.signal } }
    )
    const data = body?.data ?? {}
    // Assumed vocabulary (K4-01): 1 = success, 2 = failed, anything else = still running.
    const flag = typeof data.successFlag === 'number' ? data.successFlag : 0
    if (flag === 1) {
      const urls = data.response?.resultUrls ?? data.resultUrls ?? []
      return { status: 'success', resultUrls: urls, error: null }
    }
    if (flag === 2) {
      return { status: 'fail', resultUrls: [], error: typeof data.error === 'string' ? data.error : 'Generate video kie.ai gagal.' }
    }
    return { status: 'generating', resultUrls: [], error: null }
  }
  const body = await kie<{ data?: { status?: string; resultJson?: string; failMsg?: string } }>(
    `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(opts.id)}`,
    { baseUrl: opts.baseUrl, apiKey: opts.apiKey, timeoutMs: KIE_TIMEOUTS.test, init: { signal: opts.signal } }
  )
  const data = body?.data ?? {}
  const status = (typeof data.status === 'string' ? data.status.toLowerCase() : '') as KieTaskStatus
  if (status !== 'waiting' && status !== 'queuing' && status !== 'generating' && status !== 'success' && status !== 'fail') {
    throw new Error(`Status tugas kie.ai tidak dikenal: ${String(data.status ?? '')}`)
  }
  if (status === 'success') {
    let urls: string[] = []
    if (typeof data.resultJson === 'string' && data.resultJson) {
      try {
        const parsed = JSON.parse(data.resultJson) as { resultUrls?: unknown }
        if (Array.isArray(parsed?.resultUrls)) urls = parsed.resultUrls.filter((u): u is string => typeof u === 'string')
      } catch {
        // A resultJson that is not JSON is a broken success response.
      }
    }
    return { status, resultUrls: urls, error: null }
  }
  if (status === 'fail') {
    return { status, resultUrls: [], error: typeof data.failMsg === 'string' && data.failMsg ? data.failMsg : 'Generate kie.ai gagal.' }
  }
  return { status, resultUrls: [], error: null }
}

/** Poll until the task succeeds (downloading the first result) or fails. Backoff 2 s → max 10 s, timeout 20 minutes (K4-07). */
export async function waitForTask(
  opts: KieStatusOptions,
  modelId: string,
  onTick?: (status: string) => void,
  timeoutMs = 20 * 60 * 1000
): Promise<KieMedia> {
  const start = Date.now()
  let delay = 2000
  for (;;) {
    const state = await getTaskStatus(opts, modelId)
    onTick?.(state.status)
    if (state.status === 'success') {
      const url = state.resultUrls[0]
      if (!url) throw new Error('kie.ai selesai tanpa file hasil.')
      try {
        const { bytes, contentType } = await downloadTo(url, opts.signal)
        return { bytes, contentType, remoteUrl: url }
      } catch (e) {
        throw guard(e, opts.apiKey)
      }
    }
    if (state.status === 'fail') {
      throw new Error(state.error ? `Generate kie.ai gagal: ${state.error}` : 'Generate kie.ai gagal.')
    }
    if (Date.now() - start > timeoutMs) throw new Error('Generate kie.ai melebihi batas waktu 20 menit.')
    await sleep(delay, opts.signal)
    delay = Math.min(delay * 1.5, 10_000)
  }
}

/** Image: submit, then poll until the picture arrives. Returns the task id too, so a restart can resume the poll. */
export async function submitImage(opts: KieSubmitOptions, modelId: string): Promise<{ media: KieMedia; taskId: string }> {
  getKieImageModel(modelId)
  const taskId = await submitTask(opts, modelId)
  const media = await waitForTask({ baseUrl: opts.baseUrl, apiKey: opts.apiKey, id: taskId, signal: opts.signal }, modelId)
  return { media, taskId }
}

/** Video: submit only — the caller polls with waitForVideo so the remote id can be stored first. */
export async function submitVideo(opts: KieSubmitOptions, modelId: string): Promise<string> {
  getKieVideoModel(modelId)
  return submitTask(opts, modelId)
}

export async function waitForVideo(
  opts: KieStatusOptions,
  modelId: string,
  onTick?: (status: string) => void,
  timeoutMs = 20 * 60 * 1000
): Promise<KieMedia> {
  return waitForTask(opts, modelId, onTick, timeoutMs)
}

export interface KieConnection {
  ok: boolean
  message: string
  credit?: number | null
}

/**
 * Cheapest authenticated probe (K4-06): GET /api/v1/chat/credit.
 * Without a key it only answers whether the server is reachable.
 */
export async function testCredentials(baseUrl?: string, apiKey?: string): Promise<KieConnection> {
  try {
    const body = await kie<{ data?: { credit?: number } }>(`/api/v1/chat/credit`, {
      baseUrl,
      apiKey: apiKey ?? '',
      timeoutMs: KIE_TIMEOUTS.test
    })
    const credit = typeof body?.data?.credit === 'number' ? body.data.credit : null
    return { ok: true, message: 'Terhubung ke kie.ai.', credit }
  } catch (e) {
    const err = e instanceof ApiError ? e : new Error(String(e))
    // 401 means the key itself is wrong; any other status (402/403 credit, 429, 5xx) is reported with the
    // same friendly message the generate path shows, so testCredentials never contradicts friendlyError.
    if (err instanceof ApiError && err.status === 401) {
      return { ok: false, message: 'Server kie.ai terjangkau, tapi kunci belum diisi atau tidak valid. Isi kunci di Pengaturan → Kie.ai.' }
    }
    return { ok: false, message: err.message }
  }
}

/** The connection test in Settings uses the same credit probe (there is no cheaper kie.ai endpoint). */
export async function testConnection(baseUrl?: string, apiKey?: string): Promise<KieConnection> {
  return testCredentials(baseUrl, apiKey)
}
