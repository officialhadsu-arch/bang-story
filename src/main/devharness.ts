import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { app, type BrowserWindow } from 'electron'
import ffmpegStatic from 'ffmpeg-static'
import { estimateWordTimings } from '@shared/captions'
import { anchorPoint } from '@shared/overlays'
import { startExport } from './exporter'
import { setActiveAsset } from './generation'
import { assetAbsPath, binPath, manualWorkFolder, motionWorkFolder } from './paths'
import { probeDurationMs, probeSize } from './services/audio'
import { approveMotionBeat, motionBabakDir, prepareMotionWorkFolder, readMotionBabak, syncMotionBeatIds } from './services/motion'
import { renderBabakRange, type RenderRangeResult } from './services/renderer'
import { setSettings } from './settings'
import { createProject, getBundle, insertAsset, listProjects, patchClip, replaceStory, saveSnapshot, touchProject } from './repo'
import { recordCheck, setTestKey } from './secrets'
import type { ApiProvider } from '@shared/types'

/**
 * Real speech for the demo clips (Windows' built-in English voice) with estimated caption timings, so
 * Whisper caption syncing can be tested without a TTS key.
 */
async function addDemoSpeech(projectId: string): Promise<void> {
  const lines = [
    'In the year thirteen thirty six, the sun set over the capital of Majapahit.',
    'Before Queen Tribhuwana, Gajah Mada was named the prime minister.',
    'He swore he would not rest until the whole archipelago was united.',
    'The ministers laughed at him, but history proved him right.'
  ]
  const b = getBundle(projectId)
  for (const [i, c] of b.clips.entries()) {
    const text = lines[i % lines.length]
    const rel = `audio/speech-${i}.wav`
    const abs = assetAbsPath(projectId, rel)
    mkdirSync(dirname(abs), { recursive: true })
    const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${abs.replace(/'/g, "''")}'); $s.Speak('${text}'); $s.Dispose()`
    // stdin must be closed, or PowerShell waits on it and blocks the main process.
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    const ms = await probeDurationMs(abs)
    const asset = insertAsset({
      projectId,
      clipId: c.id,
      kind: 'audio',
      provider: 'demo',
      prompt: text,
      localPath: rel,
      durationMs: ms,
      meta: { words: estimateWordTimings(text, ms / 1000), estimatedTimings: true }
    })
    patchClip(c.id, { audioAssetId: asset.id, durationMs: ms + 400 })
  }
  const fresh = getBundle(projectId)
  saveSnapshot({ project: fresh.project, characters: fresh.characters, clips: fresh.clips.map((c, i) => ({ ...c, narration: lines[i % lines.length] })) })
}

/** A flat test logo and a two-line caption, to check overlay placement in the preview and in the export. */
function addDemoOverlays(projectId: string): void {
  const rel = 'overlays/demo-logo.png'
  const abs = assetAbsPath(projectId, rel)
  mkdirSync(dirname(abs), { recursive: true })
  execFileSync(binPath(ffmpegStatic!), ['-y', '-f', 'lavfi', '-i', 'color=c=0xE4572E:s=360x120', '-frames:v', '1', abs], { windowsHide: true })
  const logo = insertAsset({ projectId, kind: 'overlay', provider: 'demo', prompt: 'logo-demo.png', localPath: rel, width: 360, height: 120 })
  const b = getBundle(projectId)
  saveSnapshot({
    project: {
      ...b.project,
      editor: {
        ...b.project.editor,
        overlays: [
          { id: 'ov-logo', kind: 'image', assetId: logo.id, anchor: 9, ...anchorPoint(9, 16 / 9), width: 0.16, opacity: 0.85, start: 0, end: null },
          {
            id: 'ov-text',
            kind: 'text',
            text: 'KenStory',
            anchor: 5,
            x: 0.5,
            y: 0.42,
            size: 0.065,
            color: '#FFFFFF',
            style: 'box',
            bold: true,
            start: 0.5,
            end: 12
          }
        ]
      }
    },
    characters: b.characters,
    clips: b.clips
  })
}

/** Moving test videos on every clip (the first with a strong zoom on top), to test camera over AI video. */
function addDemoVideos(projectId: string): void {
  const ff = binPath(ffmpegStatic!)
  for (const [i, c] of getBundle(projectId).clips.entries()) {
    const rel = `videos/demo-${i}.mp4`
    const abs = assetAbsPath(projectId, rel)
    mkdirSync(dirname(abs), { recursive: true })
    execFileSync(ff, ['-y', '-f', 'lavfi', '-i', `testsrc2=s=1280x720:r=24:d=6`, '-vf', `hue=h=${i * 50}`, '-pix_fmt', 'yuv420p', abs], { windowsHide: true })
    const v = insertAsset({ projectId, clipId: c.id, kind: 'video', provider: 'demo', localPath: rel, durationMs: 6000, width: 1280, height: 720 })
    patchClip(c.id, { videoAssetId: v.id, motionType: 'video', ...(i === 0 ? { videoCamera: 'zoomin', videoStrength: 'kuat' } : {}) })
  }
}

/** Builds a small project from synthetic media so storyboard, editor and export can be tested without API keys. */
function seedDemo(): string {
  const ff = binPath(ffmpegStatic!)
  const p = createProject({ synopsis: 'Demo: Gajah Mada dan Sumpah Palapa', durationSec: 30, styleId: 'stickman', language: 'id' })
  const lines = [
    { t: 'Senja di Majapahit', n: 'Tahun 1336. Senja turun di ibu kota Majapahit, dan istana bersiap untuk upacara penting.', cam: 'zoomin' },
    { t: 'Gajah Mada maju', n: 'Di tengah balairung, patih yang baru dilantik melangkah maju. Namanya Gajah Mada.', cam: 'panright' },
    { t: 'Sumpah Palapa', n: 'Aku tidak akan menikmati palapa, sebelum Nusantara bersatu.', cam: 'kenburns' },
    { t: 'Para menteri tertawa', n: 'Seisi ruangan tertawa, tapi sejarah membuktikan dia benar.', cam: 'shake' }
  ] as const
  replaceStory(
    p.id,
    'Demo Sumpah Palapa',
    [{ name: 'Gajah Mada', description: 'stickman patih with golden warrior headdress and red sash' }],
    lines.map((l) => ({
      title: l.t,
      story: l.t,
      narration: l.n,
      visualPrompt: l.t,
      durationMs: 5000,
      motionType: 'camera',
      cameraPreset: l.cam,
      motionStrength: 'sedang',
      videoPrompt: '',
      transition: 'fade',
      characterNames: ['Gajah Mada']
    }))
  )
  const b = getBundle(p.id)
  b.clips.forEach((clip, i) => {
    const img = `images/demo-${i}.png`
    const wav = `audio/demo-${i}.wav`
    mkdirSync(dirname(assetAbsPath(p.id, img)), { recursive: true })
    mkdirSync(dirname(assetAbsPath(p.id, wav)), { recursive: true })
    execFileSync(ff, ['-y', '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080', '-vf', `hue=h=${i * 70}`, '-frames:v', '1', assetAbsPath(p.id, img)], { windowsHide: true })
    const sec = 3.2 + i * 0.4
    execFileSync(ff, ['-y', '-f', 'lavfi', '-i', `sine=frequency=${220 + i * 60}:duration=${sec}`, '-ar', '24000', '-ac', '1', assetAbsPath(p.id, wav)], {
      windowsHide: true
    })
    const image = insertAsset({ projectId: p.id, clipId: clip.id, kind: 'image', provider: 'demo', localPath: img, width: 1920, height: 1080 })
    const audio = insertAsset({
      projectId: p.id,
      clipId: clip.id,
      kind: 'audio',
      provider: 'demo',
      prompt: clip.narration,
      localPath: wav,
      durationMs: Math.round(sec * 1000),
      meta: { words: estimateWordTimings(clip.narration, sec), estimatedTimings: true }
    })
    patchClip(clip.id, { imageAssetId: image.id, audioAssetId: audio.id, durationMs: Math.round(sec * 1000) + 400 })
    if (i === 0) touchProject(p.id, { coverAssetId: image.id })
  })
  const music = 'music/demo.wav'
  mkdirSync(dirname(assetAbsPath(p.id, music)), { recursive: true })
  execFileSync(ff, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=110:duration=30', '-ar', '44100', assetAbsPath(p.id, music)], { windowsHide: true })
  const m = insertAsset({ projectId: p.id, kind: 'music', provider: 'demo', prompt: 'demo-musik.wav', localPath: music, durationMs: 30000 })
  const fresh = getBundle(p.id)
  saveSnapshot({
    project: { ...fresh.project, step: 4, status: 'editing', editor: { ...fresh.project.editor, musicAssetId: m.id } },
    characters: fresh.characters,
    clips: fresh.clips
  })
  return p.id
}

/**
 * Fase 4 fixture: turns the first two demo clips into motion scenes and writes
 * a complete babak-1 into motion-work/out/babak-1/ exactly as an agent would
 * after Tahap 1 + Tahap 2 — beats.json (status pending, so the Tahap 1 gate can
 * be tested), two keyframes, style.js, act-1.js/act-2.js, and a self-contained
 * index.html (all JS inline, no CDN, no timers — the OPENER contract only).
 * Word times come from the demo clips' own narration timings, shifted into
 * babak time, so beats.json is valid by construction.
 */
function addMotionFixture(projectId: string, log?: string): void {
  const mark = (s: string): void => {
    console.log(`[motion-fixture] ${s}`)
    if (log) appendFileSync(log, `[motion-fixture] ${s}\n`)
  }
  setSettings({ motionEnabled: true })
  const b0 = getBundle(projectId)
  const clips = b0.clips.slice(0, 2)
  if (clips.length < 2) throw new Error('fixture motion butuh minimal 2 klip demo')
  for (const c of clips) patchClip(c.id, { visualProvider: 'motion' })
  prepareMotionWorkFolder(projectId)
  const b = getBundle(projectId)
  const [m0, m1] = [b.clips[0], b.clips[1]]
  const d0 = m0.durationMs / 1000
  const d1 = m1.durationMs / 1000
  const total = d0 + d1
  const wordsFor = (clip: (typeof b.clips)[number], shift: number): { w: string; start: number; end: number }[] => {
    const audio = b.assets.find((a) => a.id === clip.audioAssetId)
    const raw = audio?.meta?.words ?? estimateWordTimings(clip.narration, clip.durationMs / 1000)
    return raw.map((w) => ({ w: w.text, start: +(w.start + shift).toFixed(3), end: +(w.end + shift).toFixed(3) }))
  }
  const beats = [
    {
      id: 'beat-1',
      sceneKey: m0.sceneKey,
      startSec: 0,
      endSec: +d0.toFixed(3),
      narration: m0.narration,
      words: wordsFor(m0, 0),
      keyframe: 'keyframes/beat-1.png',
      easing: 'power2.out',
      easingOverride: null,
      motionPrompt: 'Panggung biru: judul adegan muncul dari bawah.',
      status: 'pending'
    },
    {
      id: 'beat-2',
      sceneKey: m1.sceneKey,
      startSec: +d0.toFixed(3),
      endSec: +total.toFixed(3),
      narration: m1.narration,
      words: wordsFor(m1, d0),
      keyframe: 'keyframes/beat-2.png',
      easing: 'power2.out',
      easingOverride: null,
      motionPrompt: 'Panggung hijau: judul adegan muncul dari bawah.',
      status: 'pending'
    }
  ]
  const dir = motionBabakDir(projectId, 'babak-1')
  mkdirSync(join(dir, 'keyframes'), { recursive: true })
  const ff = binPath(ffmpegStatic!)
  execFileSync(ff, ['-y', '-f', 'lavfi', '-i', 'color=c=0x2E86AB:s=1280x720', '-frames:v', '1', join(dir, 'keyframes', 'beat-1.png')], { windowsHide: true })
  execFileSync(ff, ['-y', '-f', 'lavfi', '-i', 'color=c=0x3A9B6E:s=1280x720', '-frames:v', '1', join(dir, 'keyframes', 'beat-2.png')], { windowsHide: true })
  writeFileSync(
    join(dir, 'beats.json'),
    JSON.stringify(
      { version: 1, babakId: 'babak-1', fps: 30, width: 1280, height: 720, durationSec: +total.toFixed(3), styleId: 'kartun-panggung', captionZone: { enabled: false, bottomPct: 12 }, beats },
      null,
      2
    ),
    'utf8'
  )
  writeFileSync(join(dir, 'style.js'), '// Fixture style: two flat stage colours, one accent per stage.\nexport const STYLE = { stage1: "#2E86AB", stage2: "#3A9B6E", accent: "#F2C14E" };\n', 'utf8')
  writeFileSync(join(dir, 'act-1.js'), '// Fixture act 1 (source): blue stage, title rises from below.\n// The renderable copy of this act is inlined in index.html (file:// CORS blocks local <script src>).\nexport const ACT_1 = { color: "#2E86AB", label: "ADEGAN 01" };\n', 'utf8')
  writeFileSync(join(dir, 'act-2.js'), '// Fixture act 2 (source): green stage, title rises from below.\n// The renderable copy of this act is inlined in index.html (file:// CORS blocks local <script src>).\nexport const ACT_2 = { color: "#3A9B6E", label: "ADEGAN 02" };\n', 'utf8')
  // All JS inline: file:// + CORS blocks local <script src>, and the fixture
  // must not depend on a CDN. seek(t) is a pure function of t (deterministic).
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:1280px;height:720px;overflow:hidden} #stage{width:1280px;height:720px;display:flex;align-items:center;justify-content:center;background:#2E86AB} #label{font-family:sans-serif;font-size:96px;font-weight:700;color:#fff}</style></head><body><div id="stage"><div id="label">ADEGAN 01</div></div><script>
var D0 = ${d0.toFixed(3)};
window.OPENER = {
  ready: true,
  DURATION: ${total.toFixed(3)},
  clipsReady: function () { return true; },
  tl: null,
  seek: function (t) {
    var s = t < D0 ? 1 : 2;
    var stage = document.getElementById('stage');
    var label = document.getElementById('label');
    stage.style.background = s === 1 ? '#2E86AB' : '#3A9B6E';
    label.textContent = 'ADEGAN 0' + s + ' — ' + t.toFixed(2) + ' dtk';
    return Promise.resolve();
  }
};
</script></body></html>\n`,
    'utf8'
  )
  syncMotionBeatIds(projectId, 'babak-1')
  const status = readMotionBabak(projectId, 'babak-1')
  mark(`babak-1 stage=${status.stage} beats=${status.total} approved=${status.approved} errors=${JSON.stringify(status.errors)} missing=${JSON.stringify(status.missing)}`)
  if (status.stage !== 2) throw new Error(`fixture babak tidak mencapai stage 2: ${[...status.errors, ...status.missing].join('; ')}`)
}

/** Harness-only: approve every beat of babak-1 (the Tahap 1 gate, via the service). */
function approveMotionBabak(projectId: string, log?: string): void {
  const status = readMotionBabak(projectId, 'babak-1')
  if (!status.beats) throw new Error('tidak ada beats.json untuk disetujui')
  for (const beat of status.beats.beats) approveMotionBeat(projectId, 'babak-1', beat.id, 'approved')
  const after = readMotionBabak(projectId, 'babak-1')
  const line = `[motion-approve] babak-1 approved=${after.approved}/${after.total}`
  console.log(line)
  if (log) appendFileSync(log, `${line}\n`)
}

/**
 * Spike 4.0 (harness-only, VM part): determinism S1d + size + RAM per capture
 * path on the fixture babak, logged as [spike] lines for the run script to
 * grep. Full renders use the first 2 s (60 frames) — enough for S1d frames
 * 20–39 — so the spike stays tractable. Puppeteer is expected to fail here
 * (not installed); that failure is logged, not hidden. Each render is wrapped
 * so one failure is logged instead of aborting the rest; the 9:16 render runs
 * LAST because a 1080x1920 hidden window (taller than the 1920x1080 Xvfb
 * screen) killed the app process twice in a row at that step — if it dies
 * again, the other measurements are already on disk.
 */
async function runMotionSpike(projectId: string, log?: string): Promise<void> {
  const mark = (s: string): void => {
    console.log(`[spike] ${s}`)
    if (log) appendFileSync(log, `[spike] ${s}\n`)
  }
  const dir = motionBabakDir(projectId, 'babak-1')
  const spikeDir = join(motionWorkFolder(projectId), 'spike')
  const fmt = (r: RenderRangeResult): string =>
    `frames=${r.frames} first=${r.firstFrameSize.width}x${r.firstFrameSize.height} mismatches=${r.mismatches} retries=${r.retries} ramRenderer=${r.ramRendererPeakMb ?? 'null'}MB ramDelta=${r.ramAppDeltaPeakMb ?? 'null'}MB ${r.elapsedMs}ms`
  const videoBytes = (r: RenderRangeResult): number => (existsSync(r.videoPath) ? statSync(r.videoPath).size : -1)
  const base = { babakDir: dir, fps: 30, format: 'png' as const, width: 1280, height: 720 } as const

  // (1) hidden + useContentSize, 1280x720: full 60 frames vs range 20-39 (S1d).
  try {
    const hiddenFull = await renderBabakRange({ ...base, outDir: join(spikeDir, 'hidden-full'), startSec: 0, durationSec: 2, capturePath: 'hidden' })
    const hiddenRange = await renderBabakRange({ ...base, outDir: join(spikeDir, 'hidden-range'), startSec: 20 / 30, durationSec: 20 / 30, capturePath: 'hidden' })
    const s1dHidden = hiddenFull.frameHashes.slice(20, 40).join(',') === hiddenRange.frameHashes.join(',')
    mark(`S1d hidden 1280x720: ${s1dHidden ? 'LULUS' : 'GAGAL'} (20/20 hash sama = ${s1dHidden}) full ${fmt(hiddenFull)} range ${fmt(hiddenRange)}`)
    // (5) PNG vs JPEG q90 intermediates: same 2 s, compare time + video size.
    const jpg = await renderBabakRange({ ...base, outDir: join(spikeDir, 'hidden-jpeg'), startSec: 0, durationSec: 2, format: 'jpeg', capturePath: 'hidden' })
    mark(`intermediate jpeg q90 vs png: jpeg ${jpg.elapsedMs}ms video=${videoBytes(jpg)}B | png ${hiddenFull.elapsedMs}ms video=${videoBytes(hiddenFull)}B (2 dtk @30fps)`)
  } catch (e) {
    mark(`hidden renders GAGAL: ${(e as Error).message}`)
  }

  // (2) offscreen + the same fix, as the spike comparison only.
  try {
    const offFull = await renderBabakRange({ ...base, outDir: join(spikeDir, 'offscreen-full'), startSec: 0, durationSec: 2, capturePath: 'offscreen' })
    const offRange = await renderBabakRange({ ...base, outDir: join(spikeDir, 'offscreen-range'), startSec: 20 / 30, durationSec: 20 / 30, capturePath: 'offscreen' })
    const s1dOff = offFull.frameHashes.slice(20, 40).join(',') === offRange.frameHashes.join(',')
    mark(`S1d offscreen 1280x720: ${s1dOff ? 'LULUS' : 'GAGAL'} full ${fmt(offFull)} range ${fmt(offRange)}`)
  } catch (e) {
    mark(`offscreen renders GAGAL: ${(e as Error).message}`)
  }

  // (4) Puppeteer: not installed in the app — the driver must fail with a clear message.
  try {
    await renderBabakRange({ ...base, outDir: join(spikeDir, 'puppeteer'), startSec: 0, durationSec: 1, capturePath: 'puppeteer' })
    mark('puppeteer: BERHASIL (tidak diharapkan — puppeteer ternyata terpasang)')
  } catch (e) {
    mark(`puppeteer: GAGAL (diharapkan bila belum terpasang): ${(e as Error).message}`)
  }

  // (3) 9:16 size check (D-11) LAST: first frame must be exactly 1080x1920.
  // Short (0.5 s, 15 frames) — only the first frame's size is judged here.
  try {
    const vert = await renderBabakRange({ babakDir: dir, outDir: join(spikeDir, 'hidden-9x16'), startSec: 0, durationSec: 0.5, width: 1080, height: 1920, fps: 30, format: 'png', capturePath: 'hidden' })
    mark(`ukuran 9:16 hidden: ${vert.firstFrameSize.width}x${vert.firstFrameSize.height} (harus 1080x1920) ${fmt(vert)}`)
  } catch (e) {
    mark(`ukuran 9:16 hidden GAGAL: ${(e as Error).message}`)
  }
  mark('spike selesai')
}

/**
 * Focused follow-up to spike 4.0: can the OFFSCREEN path render 9:16 where
 * the hidden window cannot? (A 1080x1920 hidden window is clamped to the
 * 1920x1080 screen height — first frame 1080x1080 — so D-11 stops it. An
 * offscreen window is never composited, so it may escape the clamp.)
 */
async function runMotionSpikeVert(projectId: string, log?: string): Promise<void> {
  const mark = (s: string): void => {
    console.log(`[spike] ${s}`)
    if (log) appendFileSync(log, `[spike] ${s}\n`)
  }
  const dir = motionBabakDir(projectId, 'babak-1')
  const spikeDir = join(motionWorkFolder(projectId), 'spike')
  try {
    const vert = await renderBabakRange({ babakDir: dir, outDir: join(spikeDir, 'offscreen-9x16'), startSec: 0, durationSec: 0.5, width: 1080, height: 1920, fps: 30, format: 'png', capturePath: 'offscreen' })
    mark(`ukuran 9:16 offscreen: ${vert.firstFrameSize.width}x${vert.firstFrameSize.height} (harus 1080x1920) frames=${vert.frames} mismatches=${vert.mismatches} ramRenderer=${vert.ramRendererPeakMb ?? 'null'}MB ${vert.elapsedMs}ms`)
  } catch (e) {
    mark(`ukuran 9:16 offscreen GAGAL: ${(e as Error).message}`)
  }
  mark('spike-vert selesai')
}

/**
 * For harness runs: keep painting and timers going while the test window sits behind other windows, so
 * screenshots show the current state. Must run before the app is ready.
 */
export function prepareHarness(): void {
  if (app.isPackaged || !process.env.STUDIO_CAPTURE_PLAN) return
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-background-timer-throttling')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
}

/**
 * Development-only test harness. Set STUDIO_CAPTURE_PLAN to a JSON file of steps
 * ([{ "js": "...", "wait": 800, "shot": "C:/tmp/home.png" }, ...], optionally with "quit": true
 * on the last step) to drive the UI and capture screenshots. STUDIO_LOG collects renderer console output.
 * Never active in a packaged build.
 */
export function attachDevHarness(win: BrowserWindow): void {
  if (app.isPackaged) return
  const log = process.env.STUDIO_LOG
  if (log) {
    win.webContents.on('console-message', (e) => {
      appendFileSync(log, `[${e.level}] ${e.message}\n`)
    })
    win.webContents.on('render-process-gone', (_e, d) => appendFileSync(log, `[gone] ${d.reason}\n`))
  }
  const planPath = process.env.STUDIO_CAPTURE_PLAN
  if (!planPath) return
  let plan: {
    main?: 'seed' | 'export' | 'key' | 'overlays' | 'speech' | 'videos' | 'importClipImages' | 'manualFixture' | 'motionFixture' | 'motionApprove' | 'motionSpike' | 'motionSpikeVert'
    exportTo?: string
    /** For main "export": an existing project instead of the seeded demo. */
    projectId?: string
    /** For main "importClipImages": the project to fill, found by title. */
    projectTitle?: string
    /** For main "importClipImages": local image files, one per clip without a picture. */
    images?: string[]
    /** For main "key": hold a fake key for this provider in memory only
     * (setTestKey, never on disk) and mark its last check as passed or failed. */
    provider?: ApiProvider
    ok?: boolean
    js?: string
    /** Real mouse input: press on the element (or its edge handle), move by dx pixels, release. */
    drag?: { selector: string; at?: 'left' | 'right' | 'center'; dx: number; dy?: number; fy?: number }
    /** Real mouse click on an element, or at a point inside it (fraction of its width). */
    click?: { selector: string; fx?: number; pointJs?: string }
    /** A real key press, e.g. "s" or "Delete". */
    key?: string
    wait?: number
    shot?: string
    quit?: boolean
  }[]
  try {
    plan = JSON.parse(readFileSync(planPath, 'utf8').replace(/^﻿/, ''))
  } catch (e) {
    console.error('[harness] plan tidak valid:', (e as Error).message)
    return
  }
  let demoId: string | null = null
  win.webContents.once('did-finish-load', async () => {
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
    await sleep(2000)
    for (const step of plan) {
      try {
        if (step.main === 'seed') demoId = seedDemo()
        if (step.main === 'overlays' && demoId) addDemoOverlays(demoId)
        if (step.main === 'videos' && demoId) addDemoVideos(demoId)
        if (step.main === 'speech' && demoId) await addDemoSpeech(demoId)
        if (step.main === 'importClipImages' && step.projectTitle && step.images) {
          // Test-only twin of the pickClipImage IPC handler: same insertAsset
          // (kind 'image', clipId set) + setActiveAsset, but the file comes
          // from the plan instead of a native file dialog, which the harness
          // cannot click. The dialog and the button are covered by screenshot
          // and code inspection instead.
          const target = listProjects().find((p) => p.title === step.projectTitle)
          if (!target) throw new Error(`proyek tidak ditemukan: ${step.projectTitle}`)
          for (const src of step.images) {
            const b = getBundle(target.id)
            const clip = b.clips.find((c) => !c.imageAssetId)
            if (!clip) break
            const rel = `images/${randomUUID()}${extname(src).toLowerCase()}`
            const abs = assetAbsPath(target.id, rel)
            mkdirSync(dirname(abs), { recursive: true })
            copyFileSync(src, abs)
            const size = await probeSize(abs).catch(() => null)
            if (!size) throw new Error(`gambar tidak bisa dibaca: ${src}`)
            const asset = insertAsset({
              projectId: target.id,
              clipId: clip.id,
              kind: 'image',
              provider: 'local',
              prompt: basename(src),
              localPath: rel,
              width: size.width,
              height: size.height
            })
            await setActiveAsset(clip.id, asset.id)
          }
        }
        if (step.main === 'manualFixture' && demoId) {
          // Test-only: result files in the demo project's work folder, as if the user (or an
          // outside agent) had generated them there — a still for scene 02, a short video for
          // scene 03 (with a scene- prefix), and one file with no scene number, which must
          // land in the "belum terpasang" list instead of attaching anywhere.
          const dir = manualWorkFolder(demoId)
          mkdirSync(dir, { recursive: true })
          const ff = binPath(ffmpegStatic!)
          execFileSync(ff, ['-y', '-f', 'lavfi', '-i', 'color=c=0x2E86AB:s=1280x720', '-frames:v', '1', join(dir, '02.png')], { windowsHide: true })
          execFileSync(ff, ['-y', '-f', 'lavfi', '-i', 'testsrc2=s=1280x720:r=24:d=2', '-pix_fmt', 'yuv420p', join(dir, 'scene-03.mp4')], {
            windowsHide: true
          })
          execFileSync(ff, ['-y', '-f', 'lavfi', '-i', 'color=c=0xE4572E:s=640x360', '-frames:v', '1', join(dir, 'hasil-tanpa-nomor.png')], {
            windowsHide: true
          })
        }
        if (step.main === 'motionFixture' && demoId) addMotionFixture(demoId, log)
        if (step.main === 'motionApprove' && demoId) approveMotionBabak(demoId, log)
        if (step.main === 'motionSpike' && demoId) await runMotionSpike(demoId, log)
        if (step.main === 'motionSpikeVert' && demoId) await runMotionSpikeVert(demoId, log)
        if (step.main === 'key' && step.provider) {
          // Test-only key, kept in memory by setTestKey: it never touches
          // disk, so this step works where setSecret() must refuse (D-07).
          setTestKey(step.provider, 'dev-harness-fake-key')
          recordCheck(step.provider, step.ok !== false, step.ok === false ? 'Kunci ditolak (uji)' : 'Terhubung (uji)')
        }
        if (step.main === 'export' && (step.projectId ?? demoId)) {
          startExport((step.projectId ?? demoId)!, {
            fileName: 'demo-export',
            resolution: 1080,
            fps: 30,
            burnCaptions: true,
            writeSrt: true,
            normalizeAudio: true,
            duckMusic: true,
            folder: step.exportTo ?? app.getPath('temp')
          })
        }
        if (step.js) await win.webContents.executeJavaScript(step.js, true)
        if (step.drag || step.click) {
          const target = step.drag ?? step.click!
          const rect = (await win.webContents.executeJavaScript(
            `(() => { const el = document.querySelector(${JSON.stringify(target.selector)}); if (!el) return null; el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })()`,
            true
          )) as { x: number; y: number; w: number; h: number } | null
          if (!rect) throw new Error(`element tidak ada: ${target.selector}`)
          const at = step.drag?.at ?? 'center'
          const fx = step.click?.fx ?? (at === 'left' ? 0 : at === 'right' ? 1 : 0.5)
          let x0 = Math.round(rect.x + Math.min(rect.w - 2, Math.max(2, rect.w * fx + (at === 'left' ? 3 : at === 'right' ? -3 : 0))))
          let y0 = Math.round(rect.y + rect.h * (step.drag?.fy ?? 0.5))
          if (step.click?.pointJs) {
            const pt = (await win.webContents.executeJavaScript(step.click.pointJs, true)) as { x: number; y: number }
            x0 = Math.round(pt.x)
            y0 = Math.round(pt.y)
          }
          const send = (type: 'mouseDown' | 'mouseUp' | 'mouseMove', x: number, y: number): void =>
            win.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 })
          send('mouseMove', x0, y0)
          send('mouseDown', x0, y0)
          if (step.drag) {
            const steps = 12
            for (let i = 1; i <= steps; i++) {
              await sleep(16)
              send('mouseMove', x0 + Math.round((step.drag.dx * i) / steps), y0 + Math.round(((step.drag.dy ?? 0) * i) / steps))
            }
          }
          await sleep(30)
          send('mouseUp', x0 + (step.drag?.dx ?? 0), y0 + (step.drag?.dy ?? 0))
        }
        if (step.key) {
          win.webContents.sendInputEvent({ type: 'keyDown', keyCode: step.key })
          win.webContents.sendInputEvent({ type: 'char', keyCode: step.key })
          win.webContents.sendInputEvent({ type: 'keyUp', keyCode: step.key })
        }
      } catch (e) {
        if (log) appendFileSync(log, `[harness] step failed: ${(e as Error).message}\n`)
      }
      await sleep(step.wait ?? 800)
      if (step.shot) {
        try {
          const img = await win.webContents.capturePage()
          writeFileSync(step.shot, img.toPNG())
        } catch (e) {
          if (log) appendFileSync(log, `[harness] screenshot failed: ${(e as Error).message}\n`)
        }
      }
      if (step.quit) app.quit()
    }
  })
}
