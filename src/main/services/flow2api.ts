import type { AspectRatio, KeyTestResult } from '@shared/types'
import { FLOW_TIMEOUTS, flowImageModelName, flowVideoModelName } from '@shared/flow2api'
import { fitDuration, type HfModel } from '@shared/higgsfield'

/**
 * Client for a self-hosted Flow2API server (TheSmallHanCat/flow2api, MIT): an
 * OpenAI-compatible `POST /v1/chat/completions` endpoint that drives Google Flow
 * (Nano Banana image models, Veo/Omni video) with the user's own Google account.
 *
 * Pattern only, rewritten in TypeScript from De-Story's `flow2api.rs` (public
 * repository without a LICENSE — no code copied). Tier 1 supports servers that
 * need no Bearer key (the usual localhost setup); a server that requires one
 * is out of scope for now.
 */

export function sanitizeUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, '')
  return trimmed === '' ? 'http://localhost:8000' : trimmed
}

interface Timed {
  signal: AbortSignal
  clear: () => void
  isTimeout: () => boolean
}

/** One signal that fires on the caller's abort or after `ms`; distinguishes the two. */
function combinedSignal(parent: AbortSignal | undefined, ms: number): Timed {
  const ctrl = new AbortController()
  let expired = false
  const timer = setTimeout(() => {
    expired = true
    ctrl.abort()
  }, ms)
  const onAbort = (): void => {
    clearTimeout(timer)
    ctrl.abort()
  }
  parent?.addEventListener('abort', onAbort, { once: true })
  return {
    signal: ctrl.signal,
    clear: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onAbort)
    },
    isTimeout: () => expired
  }
}

/** Re-reads a failed fetch as a timeout (ours) or a user cancel (theirs), never both. */
async function guard<T>(p: Promise<T>, parent: AbortSignal | undefined, t: Timed, timeoutMessage: string): Promise<T> {
  try {
    return await p
  } catch (e) {
    if (parent?.aborted) throw e
    if (t.isTimeout()) throw new Error(timeoutMessage)
    throw e
  }
}

function connectError(base: string, e: unknown): Error {
  if ((e as Error)?.name === 'AbortError') throw e as Error
  return new Error(`Tidak dapat terhubung ke server Flow2API di ${base}. Pastikan servernya jalan, lalu coba lagi.`)
}

export async function testConnection(baseUrl: string): Promise<KeyTestResult> {
  const base = sanitizeUrl(baseUrl)
  const t = combinedSignal(undefined, FLOW_TIMEOUTS.test)
  try {
    let health: Response | null = null
    try {
      health = await fetch(`${base}/health`, { signal: t.signal })
    } catch {
      if (t.isTimeout()) return { ok: false, message: 'Server Flow2API tidak merespons dalam 8 detik.' }
      // Network error: fall through and try /v1/models before giving up.
    }
    if (health?.ok) return { ok: true, message: `Terhubung ke Flow2API di ${base}` }
    let models: Response | null = null
    try {
      models = await fetch(`${base}/v1/models`, { signal: t.signal })
    } catch {
      if (t.isTimeout()) return { ok: false, message: 'Server Flow2API tidak merespons dalam 8 detik.' }
    }
    if (models?.ok) return { ok: true, message: `Terhubung ke Flow2API (${base})` }
    if (models) return { ok: false, message: `Server Flow2API mengembalikan status HTTP ${models.status}` }
    return { ok: false, message: `Tidak dapat terhubung ke server Flow2API di ${base}` }
  } finally {
    t.clear()
  }
}

/** The reason carried by a plain JSON error body, if it has one. FastAPI answers with `{"detail": "..."}`; chat-style errors use `error.message` or a plain `error` string. */
function bodyErrorReason(body: string): string | null {
  try {
    const parsed = JSON.parse(body.trim()) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    if (typeof record.detail === 'string' && record.detail.trim() !== '') return record.detail
    const err = record.error
    if (typeof err === 'string' && err.trim() !== '') return err
    if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).message === 'string')
      return (err as Record<string, unknown>).message as string
    return null
  } catch {
    return null
  }
}
/** The error text carried by one parsed chunk, if it has any. Flow2API reports an upstream failure as a normal chunk on a 200 stream, so this is the only place the real reason can be found. */
function chunkError(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null
  const err = (v as Record<string, unknown>).error
  if (!err) return null
  if (typeof err === 'object' && typeof (err as Record<string, unknown>).message === 'string')
    return (err as Record<string, unknown>).message as string
  if (typeof err === 'string') return err
  return JSON.stringify(err)
}

/** A short, readable excerpt for messages that would otherwise quote a whole stream at the user. */
function snippet(text: string): string {
  const clean: string[] = []
  for (const line of text.split('\n')) {
    const l = line.trim().replace(/^data:/, '').trim()
    if (l === '' || l === '[DONE]') continue
    clean.push(l)
  }
  const joined = clean.join(' ')
  const chars = [...joined]
  return chars.length > 240 ? `${chars.slice(0, 240).join('')}…` : joined
}

/** Flow2API must obtain a reCAPTCHA token from its selected provider. Keep the message focused on that failure without guessing its cause. */
function friendlyFlowError(raw: string): string {
  if (raw.toLowerCase().includes('recaptcha'))
    return (
      'Pembuatan media gagal: server Flow2API melaporkan masalah reCAPTCHA. ' +
      'Penyebabnya belum diketahui; periksa log Flow2API untuk rincian metode captcha yang dipilih. ' +
      `Pesan dari server: ${raw}`
    )
  return `Flow2API gagal membuat media: ${raw}`
}

export function extractMediaUrlOrData(text: string): string | null {
  const trimmed = text.trim()
  const clean = (s: string): string => s.replace(/["')>]+$/, '')
  // 0. Direct data URI
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:video/')) return clean(trimmed)
  // 1. Direct URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return clean(trimmed.split(/\s+/)[0])
  // 2. Direct relative path
  if (/^\/?(files|static|output|v1)\//.test(trimmed)) return clean(trimmed.split(/\s+/)[0])
  // 3. Markdown image/video: ![...](...) or [...](...)
  const md = /!\[.*?\]\((https?:\/\/[^\s)]+|data:[^\s)]+|\/[^\s)]+)\)/.exec(text)
  if (md) return md[1]
  // 4. HTML video/img src
  const html = /<(?:video|img)[^>]+src=["'](.*?)["']/.exec(text)
  if (html) return html[1]
  // 5. Embedded data URI anywhere in the text
  const at = Math.min(
    ...[text.indexOf('data:image/'), text.indexOf('data:video/')].filter((i) => i >= 0)
  )
  if (at !== Infinity) {
    const rest = text.slice(at)
    const end = rest.search(/[)"'<>\]\}]|\s/)
    return rest.slice(0, end === -1 ? undefined : end)
  }
  // 6. Markdown link
  const link = /\[.*?\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/.exec(text)
  if (link) return link[1]
  // 7. Standalone URL
  const url = /https?:\/\/[^\s<>'")]+/.exec(text)
  if (url) return url[0]
  // 8. Relative path pattern
  const path = /(?:files|static|output|v1)\/[^\s<>'")]+/.exec(text)
  if (path) return path[0].startsWith('/') ? path[0] : `/${path[0]}`
  return null
}

/**
 * Reads a chat-completions body the way the server sends it: an SSE stream first,
 * plain JSON second, a bare media URL or data URI third. Errors arrive as ordinary
 * chunks on a 200 stream, so the reader — not the HTTP status — finds the reason.
 * The raw stream is never returned to the user.
 */
export function parseChatCompletionContent(body: string): string {
  const trimmed = body.trim()
  if (trimmed === '') throw new Error('Respons dari Flow2API kosong')

  // 1. SSE stream (lines starting with `data:`)
  let sseContent = ''
  let sseReasoning = ''
  let sseError: string | null = null
  let isSse = false
  for (const line of trimmed.split('\n')) {
    const l = line.trim()
    if (!l.startsWith('data:')) continue
    isSse = true
    const data = l.slice('data:'.length).trim()
    if (data === '[DONE]' || data === '') continue
    try {
      const v = JSON.parse(data) as unknown
      const err = chunkError(v)
      if (err) {
        sseError = err
        continue
      }
      const choices = (v as Record<string, unknown>).choices
      if (Array.isArray(choices)) {
        for (const choice of choices) {
          const c = choice as Record<string, unknown>
          const delta = c.delta as Record<string, unknown> | undefined
          if (delta) {
            if (typeof delta.content === 'string') sseContent += delta.content
            if (typeof delta.reasoning_content === 'string') sseReasoning += delta.reasoning_content
          }
          const msg = c.message as Record<string, unknown> | undefined
          if (msg && typeof msg.content === 'string') sseContent += msg.content
        }
      }
    } catch {
      // Not JSON: ignore the line, the rest of the stream still counts.
    }
  }
  if (isSse && sseContent.trim() !== '') return sseContent
  if (sseError) throw new Error(friendlyFlowError(sseError))

  // 2. Plain JSON
  try {
    const parsed = JSON.parse(trimmed) as unknown
    const err = chunkError(parsed)
    if (err) throw new Error(friendlyFlowError(err))
    const choices = (parsed as Record<string, unknown>).choices
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown>
      const msg = first.message as Record<string, unknown> | undefined
      if (msg) {
        const content = msg.content
        if (typeof content === 'string') return content
        if (Array.isArray(content)) {
          const combined = content
            .map((item) => {
              const it = item as Record<string, unknown>
              return typeof it.text === 'string' ? it.text : ''
            })
            .join('\n')
            .trim()
          if (combined !== '') return combined
        }
      }
      const delta = first.delta as Record<string, unknown> | undefined
      if (delta && typeof delta.content === 'string') return delta.content
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Flow2API gagal')) throw e
    // Not JSON: fall through to the media check below.
  }

  // 3. Fallback: the body itself is a media URL or data URI.
  if (extractMediaUrlOrData(trimmed) !== null) return trimmed

  // No result and no stated error. The stream's own running commentary is the only
  // clue, and it is far more useful than the raw bytes.
  if (sseReasoning.trim() !== '')
    throw new Error(`Flow2API tidak mengirim hasil dan tidak menyebut alasan. Keterangan dari server: ${snippet(sseReasoning)}`)
  throw new Error(`Tidak dapat mengekstrak konten dari respons Flow2API: ${snippet(trimmed)}`)
}

export interface FlowMedia {
  bytes: Buffer
  contentType: string
  /** The result URL when the server answered with one (null when it answered with data). */
  remoteUrl: string | null
}

function decodeDataUri(target: string): FlowMedia {
  const comma = target.indexOf(',')
  if (comma < 0) throw new Error('Data URI tidak valid (tanpa koma)')
  const mime = target.slice(0, comma).replace(/^data:/, '').split(';')[0] || 'application/octet-stream'
  const clean = target
    .slice(comma + 1)
    .split('')
    .filter((c) => !/\s/.test(c))
    .join('')
  return { bytes: Buffer.from(clean, 'base64'), contentType: mime, remoteUrl: null }
}

async function fetchOrDecodeBytes(base: string, target: string, signal: AbortSignal | undefined): Promise<FlowMedia> {
  if (target.startsWith('data:')) return decodeDataUri(target)
  const fullUrl = target.startsWith('http://') || target.startsWith('https://') ? target : `${base}/${target.replace(/^\/+/, '')}`
  const t = combinedSignal(signal, FLOW_TIMEOUTS.download)
  try {
    let res: Response
    try {
      res = await guard(fetch(fullUrl, { signal: t.signal }), signal, t, 'Mengunduh hasil dari Flow2API terlalu lama.')
    } catch (e) {
      if (signal?.aborted || t.isTimeout()) throw e
      throw connectError(base, e)
    }
    if (!res.ok) throw new Error(`Gagal mengunduh media (HTTP ${res.status}) dari ${fullUrl}`)
    const bytes = Buffer.from(await guard(res.arrayBuffer(), signal, t, 'Mengunduh hasil dari Flow2API terlalu lama.'))
    return { bytes, contentType: res.headers.get('content-type') ?? '', remoteUrl: fullUrl }
  } finally {
    t.clear()
  }
}

interface ChatRequest {
  baseUrl: string
  model: string
  content: unknown
  timeoutMs: number
  signal?: AbortSignal
  what: string
}

async function chatCompletions(req: ChatRequest): Promise<string> {
  const base = sanitizeUrl(req.baseUrl)
  const t = combinedSignal(req.signal, req.timeoutMs)
  const timeoutMessage = `Server Flow2API terlalu lama merespons saat ${req.what}. Coba lagi nanti.`
  try {
    let res: Response
    try {
      res = await guard(
        fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify({ model: req.model, messages: [{ role: 'user', content: req.content }], stream: true }),
          signal: t.signal
        }),
        req.signal,
        t,
        timeoutMessage
      )
    } catch (e) {
      if (req.signal?.aborted || t.isTimeout()) throw e
      throw connectError(base, e)
    }
    const bodyText = await guard(res.text(), req.signal, t, timeoutMessage)
    if (!res.ok) {
      const reason = bodyErrorReason(bodyText)
      if (reason) {
        if (res.status === 401) {
          // The server's wording for "no token configured" (observed Nov 2026) is
          // Mandarin; translate the one known string so the message stays Indonesian.
          const reasonText = reason === 'API Key 无效' ? 'kunci API server tidak valid' : reason
          throw new Error(
            `Server Flow2API menolak permintaan (HTTP 401): ${reasonText}. Periksa login Google di halaman admin server — token mungkin belum ditambahkan atau sudah kedaluwarsa.`
          )
        }
        throw new Error(friendlyFlowError(reason))
      }
      const content = parseChatCompletionContent(bodyText)
      throw new Error(`Flow2API mengembalikan galat (HTTP ${res.status}): ${snippet(content)}`)
    }
    return parseChatCompletionContent(bodyText)
  } finally {
    t.clear()
  }
}

export interface FlowImageRef {
  bytes: Buffer
  mime: string
}

/** Generates one image. References are sent as data URIs; the server needs no public URL. */
export async function generateImage(opts: {
  baseUrl: string
  model: HfModel
  prompt: string
  aspect: AspectRatio
  refs: FlowImageRef[]
  signal?: AbortSignal
}): Promise<FlowMedia> {
  const base = sanitizeUrl(opts.baseUrl)
  const targetModel = flowImageModelName(opts.model, opts.aspect)
  const content =
    opts.refs.length === 0
      ? opts.prompt
      : [
          { type: 'text', text: opts.prompt },
          ...opts.refs.map((r) => ({ type: 'image_url', image_url: { url: `data:${r.mime};base64,${r.bytes.toString('base64')}` } }))
        ]
  const contentStr = await chatCompletions({ baseUrl: base, model: targetModel, content, timeoutMs: FLOW_TIMEOUTS.image, signal: opts.signal, what: 'membuat gambar' })
  const target = extractMediaUrlOrData(contentStr)
  if (!target) throw new Error(`Tidak dapat menemukan URL atau data gambar di respons Flow2API: ${snippet(contentStr)}`)
  const media = await fetchOrDecodeBytes(base, target, opts.signal)
  return { ...media, contentType: media.contentType || 'image/png' }
}

/** Generates one video from a first frame. Narration and music come from the editor, so the prompt asks for a silent clip. */
export async function generateVideo(opts: {
  baseUrl: string
  model: HfModel
  prompt: string
  firstFrame: FlowImageRef
  seconds: number
  aspect: AspectRatio
  signal?: AbortSignal
}): Promise<FlowMedia> {
  const base = sanitizeUrl(opts.baseUrl)
  const sec = fitDuration(opts.model, opts.seconds) ?? 4
  const targetModel = flowVideoModelName(opts.model, sec, opts.aspect)
  const content = [
    { type: 'text', text: `${opts.prompt.trim()} Silent clip: no background music, no soundtrack, no singing or humming.` },
    { type: 'image_url', image_url: { url: `data:${opts.firstFrame.mime};base64,${opts.firstFrame.bytes.toString('base64')}` } }
  ]
  const contentStr = await chatCompletions({ baseUrl: base, model: targetModel, content, timeoutMs: FLOW_TIMEOUTS.video, signal: opts.signal, what: 'membuat video' })
  const target = extractMediaUrlOrData(contentStr)
  if (!target) throw new Error(`Tidak dapat menemukan URL atau data video di respons Flow2API: ${snippet(contentStr)}`)
  const media = await fetchOrDecodeBytes(base, target, opts.signal)
  return { ...media, contentType: media.contentType || 'video/mp4' }
}
