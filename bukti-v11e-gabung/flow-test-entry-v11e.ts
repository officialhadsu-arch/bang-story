// Direct test of the real Flow2API service + shared helpers against the mock server.
// Run via test-flow2api-service.mjs (esbuild bundle + node). Exits non-zero on any failure.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import * as flow from '/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung/src/main/services/flow2api'
import {
  FLOW_IMAGE_MODELS,
  FLOW_VIDEO_MODELS,
  canonicalFlowId,
  flowImageModelName,
  flowVideoModelName,
  isFlowModelId
} from '/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung/src/shared/flow2api'
import { getImageModel, getVideoModel } from '/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung/src/shared/higgsfield'

const BASE = process.env.MOCK_BASE ?? 'http://127.0.0.1:8123'
const FIX = '/home/hatch/workspace/fase0-0.2a/mock-flow2api-fixtures'
const LOG = '/home/hatch/workspace/fase0-0.2a/mock-flow2api-requests.log'
const png = readFileSync(`${FIX}/test.png`)
const mp4 = readFileSync(`${FIX}/test.mp4`)
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex').slice(0, 16)

/** Last request the mock server logged (the mock records the Authorization header). */
function lastLog(): Record<string, unknown> {
  const lines = readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean)
  return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>
}

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    passed++
    console.log(`PASS ${name}`)
  } else {
    failed++
    console.log(`FAIL ${name} ${extra !== undefined ? JSON.stringify(extra) : ''}`)
  }
}
async function checkThrows(name: string, fn: () => Promise<unknown>, needle: string): Promise<void> {
  try {
    await fn()
    failed++
    console.log(`FAIL ${name} (did not throw)`)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes(needle)) {
      passed++
      console.log(`PASS ${name} -> ${msg.slice(0, 120)}`)
    } else {
      failed++
      console.log(`FAIL ${name} (wrong message: ${msg.slice(0, 200)})`)
    }
  }
}

async function main(): Promise<void> {
  writeFileSync(LOG, '')
  // Catalog + id helpers (pure, no network)
  check('catalog has 3 image + 4 video models', FLOW_IMAGE_MODELS.length === 3 && FLOW_VIDEO_MODELS.length === 4)
  check('isFlowModelId(flow:x)', isFlowModelId('flow:x') === true)
  check('isFlowModelId(kling:x) false', isFlowModelId('kling-x') === false)
  check('isFlowModelId(null) false', isFlowModelId(null) === false)
  check('canonical omni-1.1 -> 1.2', canonicalFlowId('flow:omni-1.1-flash') === 'flow:omni-1.2-flash')
  check('canonical nano-banana-2 -> flash-image', canonicalFlowId('flow:nano-banana-2') === 'flow:gemini-3.1-flash-image')
  check('canonical passthrough', canonicalFlowId('kling-video/v3') === 'kling-video/v3')
  check('image name landscape', flowImageModelName(getImageModel('flow:gemini-3.1-flash-image'), '16:9') === 'gemini-3.1-flash-image-landscape')
  check('image name portrait', flowImageModelName(getImageModel('flow:gemini-3.1-flash-image'), '9:16') === 'gemini-3.1-flash-image-portrait')
  check('veo name 4s', flowVideoModelName(getVideoModel('flow:veo-3.1-fast'), 4, '16:9') === 'veo-3.1-fast-i2v-4s-landscape')
  check('veo name 6s portrait', flowVideoModelName(getVideoModel('flow:veo-3.1-fast'), 6, '9:16') === 'veo-3.1-fast-i2v-6s-portrait')
  check('omni name 8s', flowVideoModelName(getVideoModel('flow:omni-1.2-flash'), 8, '16:9') === 'omni-1.2-flash-8s-landscape')
  check('omni seconds 7 -> 6', flowVideoModelName(getVideoModel('flow:omni-1.2-flash'), 7, '16:9') === 'omni-1.2-flash-6s-landscape')
  check('getImageModel resolves flow model', getImageModel('flow:gemini-3.1-flash-image').name === 'Nano Banana 2.1 (Flash)')
  check('getImageModel unknown flow falls back to first flow model', getImageModel('flow:tidak-ada').id === 'flow:gemini-3.1-flash-image')
  check('getVideoModel resolves flow model', getVideoModel('flow:omni-1.2-flash').name === 'Omni 1.2 Flash')

  // Media extraction (pure)
  check('extract direct url', flow.extractMediaUrlOrData('https://example.com/a.png') === 'https://example.com/a.png')
  check('extract data uri', flow.extractMediaUrlOrData('data:image/png;base64,AAA') === 'data:image/png;base64,AAA')
  check('extract markdown image', flow.extractMediaUrlOrData('hasilnya ![x](https://example.com/b.jpg) oke') === 'https://example.com/b.jpg')
  check('parse plain JSON', flow.parseChatCompletionContent(JSON.stringify({ choices: [{ message: { content: 'https://example.com/c.mp4' } }] })) === 'https://example.com/c.mp4')
  const sseBody =
    'data: {"choices":[{"delta":{"content":"https://exa"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"mple.com/d.png"}}]}\n\n' +
    'data: [DONE]\n'
  check('parse SSE', flow.parseChatCompletionContent(sseBody) === 'https://example.com/d.png')

  // Live against the mock server
  const conn = await flow.testConnection(BASE)
  check('testConnection ok', conn.ok === true, conn)
  const dead = await flow.testConnection('http://127.0.0.1:9')
  check('testConnection dead port fails', dead.ok === false, dead)

  const img = await flow.generateImage({
    baseUrl: BASE,
    model: getImageModel('flow:gemini-3.1-flash-image'),
    prompt: 'Senja di Majapahit',
    aspect: '16:9',
    refs: [{ bytes: png, mime: 'image/png' }]
  })
  check('generateImage returns fixture png bytes', sha(img.bytes) === sha(png), { got: sha(img.bytes), want: sha(png) })
  check('generateImage contentType png', img.contentType === 'image/png', img.contentType)
  check('generateImage remoteUrl null (data uri)', img.remoteUrl === null)

  const vid = await flow.generateVideo({
    baseUrl: BASE,
    model: getVideoModel('flow:veo-3.1-fast'),
    prompt: 'Gajah Mada melangkah maju',
    firstFrame: { bytes: png, mime: 'image/png' },
    seconds: 4,
    aspect: '16:9'
  })
  check('generateVideo returns fixture mp4 bytes', sha(vid.bytes) === sha(mp4), { got: sha(vid.bytes), want: sha(mp4) })
  check('generateVideo contentType mp4', vid.contentType === 'video/mp4', vid.contentType)
  check('generateVideo remoteUrl set', vid.remoteUrl === `${BASE}/files/test.mp4`, vid.remoteUrl)

  // Server API key: sent as Bearer only when set; absent otherwise (back-compat).
  const imgKeyed = await flow.generateImage({
    baseUrl: BASE,
    model: getImageModel('flow:gemini-3.1-flash-image'),
    prompt: 'Senja di Majapahit',
    aspect: '16:9',
    refs: [],
    apiKey: 'TEST-KEY-123'
  })
  check('generateImage with apiKey returns png', sha(imgKeyed.bytes) === sha(png))
  check('generateImage with apiKey sends Bearer', lastLog().authorization === 'Bearer TEST-KEY-123', lastLog())
  const imgPlain = await flow.generateImage({
    baseUrl: BASE,
    model: getImageModel('flow:gemini-3.1-flash-image'),
    prompt: 'Senja di Majapahit',
    aspect: '16:9',
    refs: []
  })
  check('generateImage without apiKey returns png', sha(imgPlain.bytes) === sha(png))
  check('generateImage without apiKey sends no Authorization', lastLog().authorization == null, lastLog())
  const vidKeyed = await flow.generateVideo({
    baseUrl: BASE,
    model: getVideoModel('flow:veo-3.1-fast'),
    prompt: 'Gajah Mada melangkah maju',
    firstFrame: { bytes: png, mime: 'image/png' },
    seconds: 4,
    aspect: '16:9',
    apiKey: 'TEST-KEY-123'
  })
  check('generateVideo with apiKey returns mp4', sha(vidKeyed.bytes) === sha(mp4))
  check('generateVideo with apiKey sends Bearer', lastLog().authorization === 'Bearer TEST-KEY-123', lastLog())

  // testConnection fallback (/health down -> /v1/models) also carries the key.
  const seen: { authorization: string | null } = { authorization: 'UNSET' }
  const fallback = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'down' }))
      return
    }
    if (req.url === '/v1/models') {
      seen.authorization = (req.headers.authorization as string | undefined) ?? null
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ data: [] }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve) => fallback.listen(8124, '127.0.0.1', resolve))
  try {
    const connKeyed = await flow.testConnection('http://127.0.0.1:8124', 'TEST-KEY-123')
    check('testConnection fallback ok with apiKey', connKeyed.ok === true, connKeyed)
    check('testConnection fallback sends Bearer', seen.authorization === 'Bearer TEST-KEY-123', seen)
    const connPlain = await flow.testConnection('http://127.0.0.1:8124')
    check('testConnection fallback ok without apiKey', connPlain.ok === true, connPlain)
    check('testConnection fallback sends no Authorization', seen.authorization === null, seen)
  } finally {
    await new Promise<void>((resolve) => fallback.close(() => resolve()))
  }

  await checkThrows(
    'generateImage reCAPTCHA error is friendly',
    () =>
      flow.generateImage({ baseUrl: BASE, model: getImageModel('flow:gemini-3.1-flash-image'), prompt: 'GAGAL-RECAPTCHA tolong', aspect: '16:9', refs: [] }),
    'reCAPTCHA'
  )
  await checkThrows(
    'generateImage HTTP 401 explains the missing server key',
    () =>
      flow.generateImage({ baseUrl: BASE, model: getImageModel('flow:gemini-3.1-flash-image'), prompt: 'GAGAL-401 tolong', aspect: '16:9', refs: [] }),
    'isi Kunci API server di Pengaturan'
  )
  await checkThrows(
    'generateImage HTTP 401 with a key says the saved key was rejected',
    () =>
      flow.generateImage({ baseUrl: BASE, model: getImageModel('flow:gemini-3.1-flash-image'), prompt: 'GAGAL-401 tolong', aspect: '16:9', refs: [], apiKey: 'SALAH' }),
    'Kunci API server yang tersimpan ditolak'
  )
  try {
    await flow.generateImage({ baseUrl: BASE, model: getImageModel('flow:gemini-3.1-flash-image'), prompt: 'GAGAL-401 tolong', aspect: '16:9', refs: [] })
    failed++
    console.log('FAIL generateImage HTTP 401 message is Indonesian (did not throw)')
  } catch (e) {
    const msg = (e as Error).message
    // Fully Indonesian except the literal English label of the admin panel
    // section ("API Key Settings") the user sees on their own screen.
    check('generateImage HTTP 401 message is fully Indonesian', msg.includes('kunci API server tidak valid') && !msg.includes('API Key 无效'), msg.slice(0, 200))
  }
  await checkThrows(
    'generateImage HTTP 500 with error body quotes the error',
    () =>
      flow.generateImage({ baseUrl: BASE, model: getImageModel('flow:gemini-3.1-flash-image'), prompt: 'GAGAL-500 tolong', aspect: '16:9', refs: [] }),
    'upstream exploded'
  )
  await checkThrows(
    'generateImage HTTP 500 with content body reports the status',
    () =>
      flow.generateImage({ baseUrl: BASE, model: getImageModel('flow:gemini-3.1-flash-image'), prompt: 'GAGAL-500-CONTENT tolong', aspect: '16:9', refs: [] }),
    'HTTP 500'
  )
  await checkThrows(
    'generateImage to dead server is friendly',
    () =>
      flow.generateImage({ baseUrl: 'http://127.0.0.1:9', model: getImageModel('flow:gemini-3.1-flash-image'), prompt: 'x', aspect: '16:9', refs: [] }),
    'Tidak dapat terhubung'
  )

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
