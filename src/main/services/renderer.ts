/**
 * Renderer kontrak v1 (Fase 4, D-21/D-22): turns a babak page (index.html +
 * beats.json) into video frames, then stitches them with FFmpeg.
 *
 * Main path (i): hidden BrowserWindow + useContentSize — the size comes from
 * the app's configuration, never from OPENER (D-11); the first captured
 * frame is verified against it, and the render STOPS on mismatch instead of
 * quietly producing a wrong-sized video. Every frame: seek → 2× rAF → settle
 * 50 ms → capture twice, advance only when both sha256 hashes match (max 3
 * attempts; a failure is recorded and the last capture used, W7).
 *
 * Comparison paths (spike 4.0 only, never production): (ii) offscreen with
 * the same W7 fix applied, and (iii) Puppeteer (lazy import — not installed
 * in the app until the spike measures its installer delta). F4-10: no
 * automatic fallback between capture paths; a failed path fails loudly.
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import {
  MOTION_CAPTURE_ATTEMPTS,
  MOTION_FPS_DEFAULT,
  MOTION_JPEG_QUALITY,
  MOTION_SETTLE_MS,
  validateBabakHtml,
  type CapturePath,
  type FrameFormat,
  type RenderBabakResult,
  type RenderRangeResult
} from '@shared/motion-contract'
import { runFfmpeg } from './ffmpeg'
import { beatForClip, motionBabakDir, readMotionBabak } from './motion'

export type { CapturePath, FrameFormat, RenderBabakResult, RenderRangeResult }

export interface RenderRangeOptions {
  babakDir: string
  startSec: number
  durationSec: number
  width: number
  height: number
  fps?: number
  format?: FrameFormat
  capturePath?: CapturePath
  /** Frames + the stitched segment are written here. */
  outDir: string
  keepFrames?: boolean
  onProgress?: (done: number, total: number, message: string) => void
  signal?: AbortSignal
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

// ---------- RAM: process-tree method (spike-v2.mjs, new method) ----------
// Only the tree rooted at the given PID is summed — never every
// chrome/electron on the machine (the old method's numbers were polluted).

async function processList(): Promise<{ pid: number; ppid: number; kb: number }[]> {
  if (process.platform === 'win32') {
    const ps = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Csv -NoTypeInformation'
    const out: string = await new Promise((resolve, reject) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, (err, stdout) =>
        err ? reject(err) : resolve(stdout)
      )
    })
    const rows: { pid: number; ppid: number; kb: number }[] = []
    for (const line of out.split(/\r?\n/).slice(1)) {
      const parts = line.split(',').map((x) => x.replace(/"/g, '').trim())
      const pid = parseInt(parts[0], 10)
      const ppid = parseInt(parts[1], 10)
      const ws = parseInt(parts[2], 10)
      if (Number.isFinite(pid) && Number.isFinite(ppid) && Number.isFinite(ws)) rows.push({ pid, ppid, kb: Math.round(ws / 1024) })
    }
    return rows
  }
  const out: string = await new Promise((resolve, reject) => {
    execFile('ps', ['-eo', 'pid,ppid,rss', '--no-headers'], (err, stdout) => (err ? reject(err) : resolve(stdout)))
  })
  const rows: { pid: number; ppid: number; kb: number }[] = []
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)/.exec(line)
    if (m) rows.push({ pid: parseInt(m[1], 10), ppid: parseInt(m[2], 10), kb: parseInt(m[3], 10) })
  }
  return rows
}

/** RSS (MB) of a PID plus all its descendants, or null when it cannot be read. */
export async function measureProcessTreeMb(rootPid: number): Promise<number | null> {
  try {
    const list = await processList()
    const byParent = new Map<number, number[]>()
    const byPid = new Map<number, number>()
    for (const p of list) {
      byPid.set(p.pid, p.kb)
      if (!byParent.has(p.ppid)) byParent.set(p.ppid, [])
      byParent.get(p.ppid)!.push(p.pid)
    }
    let total = 0
    const stack = [rootPid]
    const seen = new Set<number>()
    while (stack.length) {
      const pid = stack.pop()!
      if (seen.has(pid)) continue
      seen.add(pid)
      total += byPid.get(pid) ?? 0
      for (const child of byParent.get(pid) ?? []) stack.push(child)
    }
    return Math.round(total / 1024)
  } catch {
    return null
  }
}

// ---------- frame drivers ----------

interface FrameDriver {
  /** Moves the babak timeline to second t and lets the frame settle. */
  seek(t: number): Promise<void>
  capture(format: FrameFormat): Promise<{ buf: Buffer; width: number; height: number }>
  /** The babak's own DURATION (seconds), read from OPENER. */
  duration(): Promise<number>
  close(): Promise<void>
  rendererPid(): number | null
}

/** A capture's pixel size, read from the image itself (PNG IHDR / JPEG SOF). */
export function imageSize(buf: Buffer, format: FrameFormat): { width: number; height: number } | null {
  if (format === 'png') {
    if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  // JPEG: scan markers for a Start-Of-Frame segment (baseline/progressive).
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null
    const marker = buf[i + 1]
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    const len = buf.readUInt16BE(i + 2)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) }
    }
    i += 2 + len
  }
  return null
}

function electronDriver(win: BrowserWindow): FrameDriver {
  return {
    async seek(t: number): Promise<void> {
      await win.webContents.executeJavaScript(
        `(async () => { const o = window.OPENER; await o.seek(${t.toFixed(4)}); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return true })()`,
        true
      )
      await sleep(MOTION_SETTLE_MS)
    },
    async capture(format: FrameFormat): Promise<{ buf: Buffer; width: number; height: number }> {
      const img = await win.webContents.capturePage()
      const size = img.getSize()
      return { buf: format === 'jpeg' ? img.toJPEG(MOTION_JPEG_QUALITY) : img.toPNG(), width: size.width, height: size.height }
    },
    async duration(): Promise<number> {
      const d = (await win.webContents.executeJavaScript(
        `(() => { const o = window.OPENER; return typeof o.DURATION === 'number' ? o.DURATION : null })()`,
        true
      )) as number | null
      if (d === null || !Number.isFinite(d) || d <= 0) throw new Error('OPENER.DURATION tidak ditemukan atau tidak valid di index.html.')
      return d
    },
    async close(): Promise<void> {
      win.destroy()
    },
    rendererPid(): number | null {
      try {
        return win.webContents.getOSProcessId()
      } catch {
        return null
      }
    }
  }
}

// Puppeteer is NOT a dependency of the app: its installer delta is measured by
// spike 4.0 before anyone decides to ship it. The driver below is typed
// structurally, so the build works with or without the package installed.
interface PuppeteerPageLike {
  setViewport(v: { width: number; height: number }): Promise<void>
  goto(url: string, opts: { waitUntil: string; timeout: number }): Promise<unknown>
  // Page-context code is passed as a string (like the Electron driver's
  // executeJavaScript strings): `window` does not exist in main-process types.
  waitForFunction(fn: string | (() => boolean), opts: { timeout: number }): Promise<unknown>
  evaluate(fn: string | ((...args: never[]) => unknown), ...args: unknown[]): Promise<unknown>
  screenshot(opts: { type: string; quality?: number }): Promise<Uint8Array>
}

interface PuppeteerBrowserLike {
  process(): { pid?: number } | null
  newPage(): Promise<PuppeteerPageLike>
  close(): Promise<void>
}

async function puppeteerDriver(babakDir: string, width: number, height: number): Promise<FrameDriver> {
  let browser: PuppeteerBrowserLike
  try {
    // @ts-ignore - puppeteer is an optional, lazily-loaded dependency (not installed yet)
    const mod = (await import('puppeteer')) as unknown as { launch: (opts: Record<string, unknown>) => Promise<PuppeteerBrowserLike> }
    browser = await mod.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu-sandbox', '--hide-scrollbars'] })
  } catch {
    throw new Error(
      'Puppeteer belum terpasang di aplikasi ini (jalur cadangan D-22). Spike 4.0 mengukur dulu delta ukuran installer sebelum diputuskan.'
    )
  }
  const page = await browser.newPage()
  await page.setViewport({ width, height })
  await page.goto(`file://${join(babakDir, 'index.html')}`, { waitUntil: 'load', timeout: 30000 })
  const ready = await page
    .waitForFunction(`window.OPENER && window.OPENER.ready === true`, { timeout: 30000 })
    .catch(() => null)
  if (!ready) throw new Error('Babak tidak siap dalam 30 detik (OPENER.ready tidak pernah true).')
  const pid = browser.process()?.pid ?? null
  return {
    async seek(t: number): Promise<void> {
      await page.evaluate(`(tt) => { const o = window.OPENER; return o.seek(tt) }`, t)
      await page.evaluate(`() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`)
      await sleep(MOTION_SETTLE_MS)
    },
    async capture(format: FrameFormat): Promise<{ buf: Buffer; width: number; height: number }> {
      const buf = Buffer.from(await page.screenshot({ type: format, quality: format === 'jpeg' ? MOTION_JPEG_QUALITY : undefined }))
      const size = imageSize(buf, format) ?? { width: 0, height: 0 }
      return { buf, width: size.width, height: size.height }
    },
    async duration(): Promise<number> {
      const d = (await page.evaluate(`() => { const o = window.OPENER; return typeof o.DURATION === 'number' ? o.DURATION : null }`)) as number | null
      if (d === null || !Number.isFinite(d) || d <= 0) throw new Error('OPENER.DURATION tidak ditemukan atau tidak valid di index.html.')
      return d
    },
    async close(): Promise<void> {
      await browser.close()
    },
    rendererPid(): number | null {
      return pid
    }
  }
}

/** Waits until the babak page reports OPENER.ready (Electron driver). */
async function waitElectronReady(win: BrowserWindow, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const ready = await win.webContents
      .executeJavaScript(`(() => { const o = window.OPENER; if (!o) return 'no-opener'; if (o.ready !== true) return 'not-ready'; if (o.clipsReady && !o.clipsReady()) return 'clips-not-ready'; return 'ready' })()`, true)
      .catch(() => 'error')
    if (ready === 'ready') return
    if (Date.now() > deadline) {
      throw new Error(
        `Babak tidak siap dalam 30 detik (${String(ready)}) — periksa index.html: OPENER.ready harus true, dan CDN (mis. GSAP) butuh internet saat load.`
      )
    }
    await sleep(100)
  }
}

// ---------- range render ----------

/**
 * Renders [startSec, startSec+durationSec] of a babak page to a silent MP4
 * segment. The timeline never seeks past the babak's own DURATION: the last
 * frame is held (same picture as FFmpeg's tpad clone on the video path).
 */
/** Renders run one at a time: a hidden window is the heaviest thing in the
 * app, and two at once would double the RAM peak on a 4 GB laptop. */
let renderQueue: Promise<unknown> = Promise.resolve()

export function renderBabakRange(opts: RenderRangeOptions): Promise<RenderRangeResult> {
  const run = renderQueue.then(() => renderBabakRangeInner(opts))
  renderQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function renderBabakRangeInner(opts: RenderRangeOptions): Promise<RenderRangeResult> {
  const t0 = Date.now()
  const fps = opts.fps ?? MOTION_FPS_DEFAULT
  const format = opts.format ?? 'png'
  const capturePath = opts.capturePath ?? 'hidden'
  const htmlPath = join(opts.babakDir, 'index.html')
  if (!existsSync(htmlPath)) throw new Error(`Babak belum punya index.html: ${opts.babakDir}`)
  const htmlErrors = validateBabakHtml(readFileSync(htmlPath, 'utf8')).errors
  if (htmlErrors.length) throw new Error(`HTML babak tidak valid: ${htmlErrors.join('; ')}`)
  const frames = Math.max(1, Math.round(opts.durationSec * fps))
  const ext = format === 'jpeg' ? 'jpg' : 'png'
  const framesDir = join(opts.outDir, 'frames')
  mkdirSync(framesDir, { recursive: true })

  let driver: FrameDriver | null = null
  let win: BrowserWindow | null = null
  let durationSec = opts.durationSec
  let ramRendererPeak: number | null = null
  let ramBaseline: number | null = null
  let ramAppPeak: number | null = null
  let sampler: ReturnType<typeof setInterval> | null = null
  try {
    // Baseline first: the delta measures what the render path itself costs.
    ramBaseline = await measureProcessTreeMb(process.pid)
    if (capturePath === 'puppeteer') {
      driver = await puppeteerDriver(opts.babakDir, opts.width, opts.height)
    } else {
      win = new BrowserWindow({
        show: false,
        width: opts.width,
        height: opts.height,
        useContentSize: true,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          offscreen: capturePath === 'offscreen',
          backgroundThrottling: false
        }
      })
      await win.loadFile(htmlPath)
      await waitElectronReady(win)
      driver = electronDriver(win)
    }
    const babakDuration = await driver.duration()
    if (opts.startSec + opts.durationSec > babakDuration + 0.01) {
      // The segment asks past the babak's end: hold the last frame instead of failing.
      durationSec = Math.max(1 / fps, babakDuration - opts.startSec)
    }
    const rendererPid = driver.rendererPid()
    sampler = setInterval(() => {
      void (async () => {
        if (rendererPid !== null) {
          const m = await measureProcessTreeMb(rendererPid)
          if (m !== null) ramRendererPeak = ramRendererPeak === null ? m : Math.max(ramRendererPeak, m)
        }
        const a = await measureProcessTreeMb(process.pid)
        if (a !== null) ramAppPeak = ramAppPeak === null ? a : Math.max(ramAppPeak, a)
      })()
    }, 500)

    const hashes: string[] = []
    let mismatches = 0
    let retries = 0
    let firstSize: { width: number; height: number } | null = null
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new Error('Dibatalkan')
      const t = Math.min(opts.startSec + i / fps, opts.startSec + durationSec - 1 / fps)
      let buf: Buffer | null = null
      let size: { width: number; height: number } | null = null
      for (let attempt = 0; attempt < MOTION_CAPTURE_ATTEMPTS; attempt++) {
        await driver.seek(t)
        const a = await driver.capture(format)
        const b = await driver.capture(format)
        if (sha256(a.buf) === sha256(b.buf)) {
          buf = a.buf
          size = { width: a.width, height: a.height }
          break
        }
        retries++
        if (attempt === MOTION_CAPTURE_ATTEMPTS - 1) {
          mismatches++
          buf = b.buf
          size = { width: b.width, height: b.height }
        }
      }
      if (!buf || !size) throw new Error(`Frame ${i + 1} gagal ditangkap.`)
      if (i === 0) {
        firstSize = size
        // D-11: the first frame's size must equal the configured size, or the render stops.
        if (size.width !== opts.width || size.height !== opts.height) {
          throw new Error(
            `Ukuran frame pertama ${size.width}×${size.height} bukan ${opts.width}×${opts.height} (kontrak D-11) — render berhenti, bukan menghasilkan video berukuran salah.`
          )
        }
      }
      const name = `frame-${String(i + 1).padStart(6, '0')}.${ext}`
      writeFileSync(join(framesDir, name), buf)
      hashes.push(sha256(buf))
      opts.onProgress?.(i + 1, frames, `Merender frame ${i + 1} dari ${frames}`)
    }
    const videoPath = join(opts.outDir, 'segment.mp4')
    await runFfmpeg(
      [
        '-framerate',
        String(fps),
        '-i',
        `frames/frame-%06d.${ext}`,
        '-frames:v',
        String(frames),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '17',
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(fps),
        'segment.mp4'
      ],
      opts.outDir,
      opts.signal ?? new AbortController().signal,
      durationSec
    )
    if (!opts.keepFrames) rmSync(framesDir, { recursive: true, force: true })
    const ramAppDelta = ramAppPeak !== null && ramBaseline !== null ? Math.max(0, ramAppPeak - ramBaseline) : null
    return {
      videoPath,
      frames,
      // The video is exactly the requested length: the tail past the babak's
      // end holds the last frame, so frames/fps is the true duration.
      durationSec: frames / fps,
      width: opts.width,
      height: opts.height,
      format,
      capturePath,
      firstFrameSize: firstSize ?? { width: 0, height: 0 },
      mismatches,
      retries,
      frameHashes: hashes,
      ramRendererPeakMb: ramRendererPeak,
      ramAppDeltaPeakMb: ramAppDelta,
      elapsedMs: Date.now() - t0
    }
  } finally {
    if (sampler) clearInterval(sampler)
    await driver?.close().catch(() => undefined)
    if (win && !win.isDestroyed()) win.destroy()
  }
}

// ---------- whole-babak render (Rancangan preview / spike) ----------

/**
 * Renders a whole babak to motion-work/out/<babakId>/render/babak.mp4.
 * Requires Tahap 2 finished (stage 2): beats + keyframes + act-*.js +
 * style.js + index.html, all valid. This is a preview/verification render,
 * not an export — it does not check beat approval.
 */
export async function renderBabakFull(
  projectId: string,
  babakId: string,
  opts: { format?: FrameFormat; capturePath?: CapturePath; onProgress?: (done: number, total: number, message: string) => void; signal?: AbortSignal } = {}
): Promise<RenderBabakResult> {
  const status = readMotionBabak(projectId, babakId)
  if (status.stage !== 2) {
    throw new Error(`Babak ${babakId} belum selesai Tahap 2: ${[...status.errors, ...status.missing].join('; ') || 'menunggu agent'}`)
  }
  const beats = status.beats!
  const outDir = join(motionBabakDir(projectId, babakId), 'render')
  mkdirSync(outDir, { recursive: true })
  const r = await renderBabakRange({
    babakDir: motionBabakDir(projectId, babakId),
    startSec: 0,
    durationSec: beats.durationSec,
    width: beats.width,
    height: beats.height,
    fps: beats.fps,
    format: opts.format,
    capturePath: opts.capturePath,
    outDir,
    keepFrames: false,
    onProgress: opts.onProgress,
    signal: opts.signal
  })
  const videoPath = join(outDir, 'babak.mp4')
  renameSync(r.videoPath, videoPath)
  return { ...r, videoPath, babakId, durationSecTotal: beats.durationSec }
}

// ---------- one export segment (the exporter's motion branch) ----------

/**
 * Renders one motion scene's export segment. The Tahap 1 gate lives here:
 * the scene's beat must exist and be approved, or the export stops with a
 * clear message instead of rendering an unapproved scene.
 */
export async function renderMotionSegment(
  projectId: string,
  clipId: string,
  lenSec: number,
  outDir: string,
  opts: { fps: number; width: number; height: number; format?: FrameFormat; onProgress?: (done: number, total: number, message: string) => void; signal?: AbortSignal } = {
    fps: MOTION_FPS_DEFAULT,
    width: 1280,
    height: 720
  }
): Promise<RenderRangeResult> {
  const found = beatForClip(projectId, clipId)
  if (!found) {
    throw new Error('Adegan motion ini belum punya beat di beats.json — siapkan folder kerja motion dan minta agent menulis Tahap 1.')
  }
  const { babakId, beat } = found
  if (beat.status !== 'approved') {
    throw new Error(
      `Beat ${beat.id} (adegan ${beat.sceneKey}) belum disetujui di Rancangan — ekspor berhenti (gerbang Tahap 1). Setujui beat itu dulu, atau tandai "redo" untuk ditulis ulang agent.`
    )
  }
  const status = readMotionBabak(projectId, babakId)
  const beats = status.beats
  if (!beats) throw new Error(`Babak ${babakId} belum punya beats.json yang valid.`)
  mkdirSync(outDir, { recursive: true })
  return renderBabakRange({
    babakDir: motionBabakDir(projectId, babakId),
    startSec: beat.startSec,
    durationSec: Math.min(lenSec, Math.max(1 / beats.fps, beats.durationSec - beat.startSec)),
    width: beats.width,
    height: beats.height,
    fps: beats.fps,
    format: opts.format,
    outDir,
    keepFrames: false,
    onProgress: opts.onProgress,
    signal: opts.signal
  })
}
