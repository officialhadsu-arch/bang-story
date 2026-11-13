import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname } from 'node:path'
import { estimateWordTimings } from '@shared/captions'
import { isFlowModelId } from '@shared/flow2api'
import { isKieModelId, kieaiCredits, kieaiUsd } from '@shared/kieai'
import { type VisualProvider } from '@shared/manual'
import { isNexaModelId, nexaCredits } from '@shared/nexabot'
import { clipPrompt, videoPromptForClip } from '@shared/prompts'
import { stripVoiceTags } from '@shared/speech'
import { getImageModel, getVideoModel, fitDuration, imageBody, maxRefs, promptLimit, videoBody, type HfModel } from '@shared/higgsfield'
import { getStyle } from '@shared/styles'
import type { AspectRatio, Asset, Character, Clip, CreditEstimate, Job, Project, WordTiming } from '@shared/types'
import { getDb } from './db'
import { emit } from './events'
import { runJob, type TaskCtx } from './jobs'
import { assetAbsPath } from './paths'
import {
  activeJobFor,
  charactersOf,
  clipsOf,
  getAsset,
  getCharacter,
  getClip,
  getJob,
  getProject,
  insertAsset,
  insertJob,
  patchClip,
  setCharacterSheet,
  touchProject,
  unfinishedJobs,
  updateAssetMeta,
  updateJob
} from './repo'
import { dropCache, getSettings, readCache, writeCache } from './settings'
import { getSecret } from './secrets'
import { probeDurationMs, probeSize } from './services/audio'
import * as eleven from './services/elevenlabs'
import * as flow from './services/flow2api'
import type { FlowImageRef, FlowMedia } from './services/flow2api'
import * as gemini from './services/gemini'
import * as hf from './services/higgsfield'
import { downloadTo, sleep } from './services/http'
import * as kie from './services/kieai'
import type { KieMedia } from './services/kieai'
import { completeManualJobs } from './services/manual'
import * as nexa from './services/nexabot'
import type { NexaMedia } from './services/nexabot'

const DAY = 24 * 60 * 60 * 1000

function extFromType(contentType: string, url: string, fallback: string): string {
  if (/png/.test(contentType)) return '.png'
  if (/jpe?g/.test(contentType)) return '.jpg'
  if (/webp/.test(contentType)) return '.webp'
  if (/mp4/.test(contentType)) return '.mp4'
  const m = /\.(png|jpe?g|webp|mp4|mov)(\?|$)/i.exec(url)
  return m ? `.${m[1].toLowerCase()}` : fallback
}

function saveFile(projectId: string, folder: string, ext: string, bytes: Buffer): string {
  const rel = `${folder}/${randomUUID()}${ext}`
  const abs = assetAbsPath(projectId, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, bytes)
  return rel
}

/** A URL Higgsfield can fetch for a stored asset: its own recent result URL, or a fresh upload. */
async function publicUrlFor(asset: Asset, signal: AbortSignal): Promise<string> {
  if (asset.remoteUrl && asset.provider === 'higgsfield' && Date.now() - asset.createdAt < 6 * DAY) return asset.remoteUrl
  const up = asset.meta.uploadedUrl as string | undefined
  const at = asset.meta.uploadedAt as number | undefined
  if (up && at && Date.now() - at < 0.5 * DAY) return up
  const url = await hf.uploadFile(assetAbsPath(asset.projectId, asset.localPath), signal)
  updateAssetMeta(asset.id, { ...asset.meta, uploadedUrl: url, uploadedAt: Date.now() })
  return url
}

function imageProgress(ctx: TaskCtx, what: string) {
  return (status: hf.HfStatus, elapsed: number): void => {
    if (status === 'queued') ctx.progress(0.12, 'Mengantre di Higgsfield')
    else ctx.progress(0.15 + 0.75 * (1 - Math.exp(-elapsed / 45_000)), what)
  }
}

// ---------- prompts ----------

function sheetPrompt(project: Project, c: Character): string {
  const style = getStyle(project.styleId)
  return [
    style.prompt,
    `Character reference sheet for "${c.name}": ${c.description}. The character is ${style.characterHint}.`,
    'Show the SAME character three times side by side: front view, three-quarter view and side view, full body, neutral standing pose, evenly spaced, on a plain light neutral background (this overrides any background instruction above). Consistent proportions, costume and colors in all three views.'
  ].join('\n\n')
}

// ---------- waiting for character sheets ----------

async function waitForSheets(characterIds: string[], signal: AbortSignal): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < 15 * 60 * 1000) {
    const pending = characterIds.some((id) => activeJobFor({ characterId: id }, 'sheet'))
    if (!pending) return
    await sleep(2000, signal)
  }
}

async function referenceUrls(model: HfModel, chars: Character[], signal: AbortSignal): Promise<{ urls: string[]; names: string[] }> {
  const limit = maxRefs(model)
  if (limit === 0) return { urls: [], names: [] }
  await waitForSheets(
    chars.map((c) => c.id),
    signal
  )
  const urls: string[] = []
  const names: string[] = []
  for (const c of chars) {
    const fresh = getCharacter(c.id)
    const sheet = getAsset(fresh.sheetAssetId)
    if (!sheet || urls.length >= limit) continue
    urls.push(await publicUrlFor(sheet, signal))
    names.push(fresh.name)
  }
  return { urls, names }
}

// ---------- Flow2API (Google Flow through a self-hosted server) ----------

/** Flow2API takes image bytes, not a public URL, so reference sheets are read from disk. The MIME comes from the file, not a hardcoded value. */
function mimeFromExt(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.png':
    default:
      return 'image/png'
  }
}

async function referenceImages(model: HfModel, chars: Character[], signal: AbortSignal): Promise<{ images: FlowImageRef[]; names: string[] }> {
  const limit = maxRefs(model)
  if (limit === 0) return { images: [], names: [] }
  await waitForSheets(chars.map((c) => c.id), signal)
  const images: FlowImageRef[] = []
  const names: string[] = []
  for (const c of chars) {
    const fresh = getCharacter(c.id)
    const sheet = getAsset(fresh.sheetAssetId)
    if (!sheet || images.length >= limit) continue
    const abs = assetAbsPath(sheet.projectId, sheet.localPath)
    images.push({ bytes: readFileSync(abs), mime: mimeFromExt(abs) })
    names.push(fresh.name)
  }
  return { images, names }
}

/** Flow2API stays off until the user reads the D-16 account-risk warning and turns it on in Settings. */
function requireFlowEnabled(): string {
  const settings = getSettings()
  if (!settings.flow2apiEnabled)
    throw new Error('Flow2API belum dinyalakan. Nyalakan di Pengaturan › Layanan AI dan kunci › Google Flow, lalu baca Panduan Flow2API.')
  return settings.flow2apiBaseUrl
}

/** Saves a Flow2API result and attaches it to the clip or character, mirroring finishHiggsfield's tail. */
async function finishFlow(ctx: TaskCtx, job: Job, target: 'clip-image' | 'sheet' | 'clip-video', model: HfModel, prompt: string, out: FlowMedia): Promise<string> {
  const isVideo = target === 'clip-video'
  ctx.progress(0.93, 'Menyimpan hasil')
  const rel = saveFile(job.projectId, isVideo ? 'videos' : 'images', extFromType(out.contentType, out.remoteUrl ?? '', isVideo ? '.mp4' : '.png'), out.bytes)
  const abs = assetAbsPath(job.projectId, rel)
  const size = await probeSize(abs)
  const durationMs = isVideo ? await probeDurationMs(abs).catch(() => null) : null
  const asset = insertAsset({
    projectId: job.projectId,
    clipId: job.clipId,
    characterId: job.characterId,
    kind: isVideo ? 'video' : 'image',
    provider: 'flow2api',
    model: model.id,
    prompt,
    remoteId: null,
    remoteUrl: out.remoteUrl,
    localPath: rel,
    durationMs,
    width: size?.width ?? null,
    height: size?.height ?? null
  })
  emit.asset(asset)
  if (target === 'sheet' && job.characterId) {
    setCharacterSheet(job.characterId, asset.id)
    emit.character({ characterId: job.characterId, patch: { sheetAssetId: asset.id } })
  } else if (target === 'clip-image' && job.clipId) {
    patchClip(job.clipId, { imageAssetId: asset.id })
    emit.clip({ clipId: job.clipId, patch: { imageAssetId: asset.id } })
    const project = getProject(job.projectId)
    const first = clipsOf(job.projectId)[0]
    if (!project.coverAssetId || first?.id === job.clipId) touchProject(job.projectId, { coverAssetId: asset.id })
  } else if (target === 'clip-video' && job.clipId) {
    const patch = { videoAssetId: asset.id, motionType: 'video' as const, mediaInMs: 0 }
    patchClip(job.clipId, patch)
    emit.clip({ clipId: job.clipId, patch })
  }
  touchProject(job.projectId)
  return asset.id
}

function startFlow(
  job: Job,
  build: (ctx: TaskCtx) => Promise<{ target: 'clip-image' | 'sheet' | 'clip-video'; model: HfModel; prompt: string; run: (ctx: TaskCtx) => Promise<FlowMedia> }>
): Job {
  emit.job(job)
  return runJob(job, 'flow2api', async (ctx) => {
    ctx.progress(0.04, 'Menyiapkan prompt')
    const { target, model, prompt, run } = await build(ctx)
    ctx.progress(0.08, 'Mengirim ke Flow2API')
    updateJobPayload(job.id, { target, model: model.id, prompt })
    const out = await run(ctx)
    return finishFlow(ctx, job, target, model, prompt, out)
  })
}

// ---------- NexaBot (pay-as-you-go REST API, tier 3) ----------

function toDataUri(bytes: Buffer, mime: string): string {
  return `data:${mime};base64,${bytes.toString('base64')}`
}

/**
 * NexaBot stays off until the user reads the cost warning and turns it on in Settings.
 * A NexaBot model without a key fails hard here (D3-03) — it never falls back to another
 * provider, so a paid generate can never start by accident. The key is BYOK, encrypted
 * like every other key (D-07).
 */
function requireNexa(): { baseUrl: string; apiKey: string } {
  const settings = getSettings()
  if (!settings.nexabotEnabled)
    throw new Error('NexaBot belum dinyalakan. Nyalakan di Pengaturan › Layanan AI dan kunci › NexaBot, lalu baca Panduan NexaBot.')
  const apiKey = getSecret('nexabot')
  if (!apiKey) throw new Error('Isi kunci NexaBot di Pengaturan › NexaBot sebelum generate. Kunci hanya tersimpan di perangkat ini.')
  return { baseUrl: settings.nexabotBaseUrl, apiKey }
}

/** Saves a NexaBot result and attaches it to the clip or character, mirroring finishFlow's tail. */
async function finishNexa(
  ctx: TaskCtx,
  job: Job,
  target: 'clip-image' | 'sheet' | 'clip-video',
  model: HfModel,
  prompt: string,
  out: NexaMedia,
  remoteId: string | null
): Promise<string> {
  const isVideo = target === 'clip-video'
  ctx.progress(0.93, 'Menyimpan hasil')
  const rel = saveFile(job.projectId, isVideo ? 'videos' : 'images', extFromType(out.contentType, out.remoteUrl ?? '', isVideo ? '.mp4' : '.png'), out.bytes)
  const abs = assetAbsPath(job.projectId, rel)
  const size = await probeSize(abs)
  const durationMs = isVideo ? await probeDurationMs(abs).catch(() => null) : null
  const asset = insertAsset({
    projectId: job.projectId,
    clipId: job.clipId,
    characterId: job.characterId,
    kind: isVideo ? 'video' : 'image',
    provider: 'nexabot',
    model: model.id,
    prompt,
    remoteId,
    remoteUrl: out.remoteUrl,
    localPath: rel,
    durationMs,
    width: size?.width ?? null,
    height: size?.height ?? null
  })
  emit.asset(asset)
  if (target === 'sheet' && job.characterId) {
    setCharacterSheet(job.characterId, asset.id)
    emit.character({ characterId: job.characterId, patch: { sheetAssetId: asset.id } })
  } else if (target === 'clip-image' && job.clipId) {
    patchClip(job.clipId, { imageAssetId: asset.id })
    emit.clip({ clipId: job.clipId, patch: { imageAssetId: asset.id } })
    const project = getProject(job.projectId)
    const first = clipsOf(job.projectId)[0]
    if (!project.coverAssetId || first?.id === job.clipId) touchProject(job.projectId, { coverAssetId: asset.id })
  } else if (target === 'clip-video' && job.clipId) {
    const patch = { videoAssetId: asset.id, motionType: 'video' as const, mediaInMs: 0 }
    patchClip(job.clipId, patch)
    emit.clip({ clipId: job.clipId, patch })
  }
  touchProject(job.projectId)
  return asset.id
}

function startNexa(
  job: Job,
  build: (ctx: TaskCtx) => Promise<{
    target: 'clip-image' | 'sheet' | 'clip-video'
    model: HfModel
    prompt: string
    run: (ctx: TaskCtx) => Promise<{ media: NexaMedia; remoteId: string | null }>
  }>
): Job {
  emit.job(job)
  return runJob(job, 'nexabot', async (ctx) => {
    ctx.progress(0.04, 'Menyiapkan prompt')
    const { target, model, prompt, run } = await build(ctx)
    ctx.progress(0.08, 'Mengirim ke NexaBot')
    updateJobPayload(job.id, { target, model: model.id, prompt })
    const { media, remoteId } = await run(ctx)
    return finishNexa(ctx, job, target, model, prompt, media, remoteId)
  })
}

// ---------- kie.ai (pay-as-you-go REST API in USD, premium models, tier 4) ----------

/**
 * kie.ai stays off until the user reads the cost warning and turns it on in Settings.
 * A kie.ai model without a key fails hard here (K4-03) — it never falls back to another
 * provider, so a paid generate can never start by accident. The key is BYOK, encrypted
 * like every other key (D-07). kie.ai bills in USD and charges per generate (or per
 * second for per-second models); the batch cost gate in the Storyboard shows the total
 * before anything starts (K4-05).
 */
function requireKie(): { baseUrl: string; apiKey: string } {
  const settings = getSettings()
  if (!settings.kieaiEnabled)
    throw new Error('kie.ai belum dinyalakan. Nyalakan di Pengaturan › Layanan AI dan kunci › Kie.ai, lalu baca Panduan Kie.ai.')
  const apiKey = getSecret('kieai')
  if (!apiKey) throw new Error('Isi kunci kie.ai di Pengaturan › Kie.ai sebelum generate. Kunci hanya tersimpan di perangkat ini.')
  return { baseUrl: settings.kieaiBaseUrl, apiKey }
}

/** Saves a kie.ai result and attaches it to the clip or character, mirroring finishNexa's tail. */
async function finishKie(
  ctx: TaskCtx,
  job: Job,
  target: 'clip-image' | 'sheet' | 'clip-video',
  model: HfModel,
  prompt: string,
  out: KieMedia,
  remoteId: string | null
): Promise<string> {
  const isVideo = target === 'clip-video'
  ctx.progress(0.93, 'Menyimpan hasil')
  const rel = saveFile(job.projectId, isVideo ? 'videos' : 'images', extFromType(out.contentType, out.remoteUrl ?? '', isVideo ? '.mp4' : '.png'), out.bytes)
  const abs = assetAbsPath(job.projectId, rel)
  const size = await probeSize(abs)
  const durationMs = isVideo ? await probeDurationMs(abs).catch(() => null) : null
  const asset = insertAsset({
    projectId: job.projectId,
    clipId: job.clipId,
    characterId: job.characterId,
    kind: isVideo ? 'video' : 'image',
    provider: 'kieai',
    model: model.id,
    prompt,
    remoteId,
    remoteUrl: out.remoteUrl,
    localPath: rel,
    durationMs,
    width: size?.width ?? null,
    height: size?.height ?? null
  })
  emit.asset(asset)
  if (target === 'sheet' && job.characterId) {
    setCharacterSheet(job.characterId, asset.id)
    emit.character({ characterId: job.characterId, patch: { sheetAssetId: asset.id } })
  } else if (target === 'clip-image' && job.clipId) {
    patchClip(job.clipId, { imageAssetId: asset.id })
    emit.clip({ clipId: job.clipId, patch: { imageAssetId: asset.id } })
    const project = getProject(job.projectId)
    const first = clipsOf(job.projectId)[0]
    if (!project.coverAssetId || first?.id === job.clipId) touchProject(job.projectId, { coverAssetId: asset.id })
  } else if (target === 'clip-video' && job.clipId) {
    const patch = { videoAssetId: asset.id, motionType: 'video' as const, mediaInMs: 0 }
    patchClip(job.clipId, patch)
    emit.clip({ clipId: job.clipId, patch })
  }
  touchProject(job.projectId)
  return asset.id
}

function startKie(
  job: Job,
  build: (ctx: TaskCtx) => Promise<{
    target: 'clip-image' | 'sheet' | 'clip-video'
    model: HfModel
    prompt: string
    run: (ctx: TaskCtx) => Promise<{ media: KieMedia; remoteId: string | null }>
  }>
): Job {
  emit.job(job)
  return runJob(job, 'kieai', async (ctx) => {
    ctx.progress(0.04, 'Menyiapkan prompt')
    const { target, model, prompt, run } = await build(ctx)
    ctx.progress(0.08, 'Mengirim ke kie.ai')
    updateJobPayload(job.id, { target, model: model.id, prompt })
    const { media, remoteId } = await run(ctx)
    return finishKie(ctx, job, target, model, prompt, media, remoteId)
  })
}

// ---------- finishing a Higgsfield request (also used to resume after a restart) ----------

interface HfPayload {
  target: 'clip-image' | 'sheet' | 'clip-video'
  model: string
  prompt: string
}

async function finishHiggsfield(ctx: TaskCtx, job: Job, requestId: string, payload: HfPayload): Promise<string> {
  const isVideo = payload.target === 'clip-video'
  const result = await hf.waitForResult(
    requestId,
    imageProgress(ctx, isVideo ? 'Membuat video' : payload.target === 'sheet' ? 'Membuat lembar karakter' : 'Membuat gambar'),
    ctx.signal,
    isVideo ? 30 * 60 * 1000 : 15 * 60 * 1000
  )
  const url = isVideo ? result.video?.url : result.images?.[0]?.url
  if (!url) throw new Error('Higgsfield selesai tanpa file hasil')
  ctx.progress(0.93, 'Mengunduh hasil')
  const { bytes, contentType } = await downloadTo(url, ctx.signal)
  const rel = saveFile(job.projectId, isVideo ? 'videos' : 'images', extFromType(contentType, url, isVideo ? '.mp4' : '.png'), bytes)
  const abs = assetAbsPath(job.projectId, rel)
  const size = await probeSize(abs)
  const durationMs = isVideo ? await probeDurationMs(abs).catch(() => null) : null
  const asset = insertAsset({
    projectId: job.projectId,
    clipId: job.clipId,
    characterId: job.characterId,
    kind: isVideo ? 'video' : 'image',
    provider: 'higgsfield',
    model: payload.model,
    prompt: payload.prompt,
    remoteId: requestId,
    remoteUrl: url,
    localPath: rel,
    durationMs,
    width: size?.width ?? null,
    height: size?.height ?? null
  })
  emit.asset(asset)
  if (payload.target === 'sheet' && job.characterId) {
    setCharacterSheet(job.characterId, asset.id)
    emit.character({ characterId: job.characterId, patch: { sheetAssetId: asset.id } })
  } else if (payload.target === 'clip-image' && job.clipId) {
    patchClip(job.clipId, { imageAssetId: asset.id })
    emit.clip({ clipId: job.clipId, patch: { imageAssetId: asset.id } })
    const project = getProject(job.projectId)
    const first = clipsOf(job.projectId)[0]
    if (!project.coverAssetId || first?.id === job.clipId) touchProject(job.projectId, { coverAssetId: asset.id })
  } else if (payload.target === 'clip-video' && job.clipId) {
    const patch = { videoAssetId: asset.id, motionType: 'video' as const, mediaInMs: 0 }
    patchClip(job.clipId, patch)
    emit.clip({ clipId: job.clipId, patch })
  }
  touchProject(job.projectId)
  return asset.id
}

function startHiggsfield(job: Job, build: (ctx: TaskCtx) => Promise<{ endpoint: string; body: Record<string, unknown>; payload: HfPayload }>): Job {
  emit.job(job)
  return runJob(job, 'higgsfield', async (ctx) => {
    ctx.progress(0.04, 'Menyiapkan prompt')
    const { endpoint, body, payload } = await build(ctx)
    ctx.progress(0.08, 'Mengirim ke Higgsfield')
    const requestId = await hf.submit(endpoint, body, ctx.signal)
    ctx.setRemote(requestId)
    updateJobPayload(job.id, payload)
    return finishHiggsfield(ctx, job, requestId, payload)
  })
}

function updateJobPayload(jobId: string, payload: HfPayload): void {
  getDb().prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify(payload), jobId)
}

// ---------- manual / extension routing (tier 2, D2-02, D2-03) ----------

/**
 * Which provider makes this scene's picture/video, decided BEFORE any model is called. 'auto'
 * follows the project's model; an explicit provider wins over the model; anything else fails
 * hard (B5) instead of silently falling back to a provider the user did not pick.
 */
function resolveVisualProvider(clip: Clip, project: Project, kind: 'image' | 'video'): 'higgsfield' | 'flow2api' | 'manual' | 'extension' | 'nexabot' | 'kieai' {
  const p = clip.visualProvider ?? 'auto'
  if (p === 'manual' || p === 'extension' || p === 'higgsfield' || p === 'flow2api' || p === 'nexabot' || p === 'kieai') return p
  if (p === 'auto') {
    const modelId = kind === 'image' ? project.imageModel : project.videoModel
    if (isFlowModelId(modelId)) return 'flow2api'
    if (isNexaModelId(modelId)) return 'nexabot'
    if (isKieModelId(modelId)) return 'kieai'
    return 'higgsfield'
  }
  // Unreachable for clips read through toClip (it sanitises to 'auto'), but a stored value the
  // app does not know must fail here rather than silently pick a provider.
  throw new Error(`Jalur visual tidak dikenal: ${String(p)}`)
}

/**
 * A manual job waits in 'queued' with no running task: the user generates the media outside the
 * app and brings the file back to the work folder. Importing the matching file marks it done;
 * Cancel marks it canceled; a restart leaves it waiting (see resumeJobs).
 */
export function startManualJob(clipId: string, kind: 'image' | 'video'): Job {
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  const chars = charactersOf(project.id).filter((c) => clip.characterIds.includes(c.id))
  const prompt =
    kind === 'image'
      ? clipPrompt(project, clip, chars, chars.filter((c) => c.sheetAssetId).map((c) => c.name), promptLimit(getImageModel(project.imageModel)))
      : videoPromptForClip(clip, getVideoModel(project.videoModel).input.mode === 'reference')
  const job = insertJob({ projectId: clip.projectId, clipId, kind, provider: 'manual', payload: { sceneKey: clip.sceneKey, prompt } })
  emit.job(job)
  return job
}

// ---------- public entry points ----------

export function generateClipImage(clipId: string): Job {
  const existing = activeJobFor({ clipId }, 'image')
  if (existing) return existing
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  const provider = resolveVisualProvider(clip, project, 'image')
  if (provider === 'manual' || provider === 'extension') return startManualJob(clipId, 'image')
  if (provider === 'flow2api') {
    const job = insertJob({ projectId: clip.projectId, clipId, kind: 'image', provider: 'flow2api' })
    return startFlow(job, async (ctx) => {
      const baseUrl = requireFlowEnabled()
      const fresh = getClip(clipId)
      const project = getProject(fresh.projectId)
      const model = getImageModel(project.imageModel)
      const chars = charactersOf(project.id).filter((c) => fresh.characterIds.includes(c.id))
      const refs = await referenceImages(model, chars, ctx.signal)
      const prompt = clipPrompt(project, fresh, chars, refs.names, promptLimit(model))
      return {
        target: 'clip-image' as const,
        model,
        prompt,
        run: (c: TaskCtx) => flow.generateImage({ baseUrl, model, prompt, aspect: project.aspectRatio, refs: refs.images, signal: c.signal })
      }
    })
  }
  if (provider === 'nexabot') {
    const job = insertJob({ projectId: clip.projectId, clipId, kind: 'image', provider: 'nexabot' })
    return startNexa(job, async (ctx) => {
      const { baseUrl, apiKey } = requireNexa()
      const fresh = getClip(clipId)
      const project = getProject(fresh.projectId)
      const model = getImageModel(project.imageModel)
      const chars = charactersOf(project.id).filter((c) => fresh.characterIds.includes(c.id))
      const refs = await referenceImages(model, chars, ctx.signal)
      const prompt = clipPrompt(project, fresh, chars, refs.names, promptLimit(model))
      return {
        target: 'clip-image' as const,
        model,
        prompt,
        run: (c: TaskCtx) =>
          nexa
            .submitImage({ baseUrl, apiKey, prompt, refs: refs.images.map((r) => toDataUri(r.bytes, r.mime)), signal: c.signal }, model.id)
            .then((media) => ({ media, remoteId: null }))
      }
    })
  }
  if (provider === 'kieai') {
    const job = insertJob({ projectId: clip.projectId, clipId, kind: 'image', provider: 'kieai' })
    return startKie(job, async (ctx) => {
      const { baseUrl, apiKey } = requireKie()
      const fresh = getClip(clipId)
      const project = getProject(fresh.projectId)
      const model = getImageModel(project.imageModel)
      const chars = charactersOf(project.id).filter((c) => fresh.characterIds.includes(c.id))
      const refs = await referenceImages(model, chars, ctx.signal)
      const prompt = clipPrompt(project, fresh, chars, refs.names, promptLimit(model))
      return {
        target: 'clip-image' as const,
        model,
        prompt,
        run: (c: TaskCtx) =>
          kie
            .submitImage(
              { baseUrl, apiKey, prompt, aspectRatio: project.aspectRatio, refs: refs.images.map((r) => toDataUri(r.bytes, r.mime)), signal: c.signal },
              model.id
            )
            .then(({ media, taskId }) => ({ media, remoteId: taskId }))
      }
    })
  }
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'image', provider: 'higgsfield' })
  return startHiggsfield(job, async (ctx) => {
    const fresh = getClip(clipId)
    const project = getProject(fresh.projectId)
    const model = getImageModel(project.imageModel)
    const chars = charactersOf(project.id).filter((c) => fresh.characterIds.includes(c.id))
    const refs = await referenceUrls(model, chars, ctx.signal)
    const prompt = clipPrompt(project, fresh, chars, refs.names, promptLimit(model))
    return {
      endpoint: model.id,
      body: imageBody(model, prompt, project.aspectRatio, refs.urls),
      payload: { target: 'clip-image', model: model.id, prompt }
    }
  })
}

export function generateCharacterSheet(characterId: string): Job {
  const existing = activeJobFor({ characterId }, 'sheet')
  if (existing) return existing
  const c = getCharacter(characterId)
  if (isFlowModelId(getProject(c.projectId).imageModel)) {
    const job = insertJob({ projectId: c.projectId, characterId, kind: 'sheet', provider: 'flow2api' })
    return startFlow(job, async () => {
      const baseUrl = requireFlowEnabled()
      const project = getProject(c.projectId)
      const model = getImageModel(project.imageModel)
      const prompt = sheetPrompt(project, getCharacter(characterId))
      return {
        target: 'sheet' as const,
        model,
        prompt,
        run: (ctx: TaskCtx) => flow.generateImage({ baseUrl, model, prompt, aspect: '16:9', refs: [], signal: ctx.signal })
      }
    })
  }
  if (isNexaModelId(getProject(c.projectId).imageModel)) {
    const job = insertJob({ projectId: c.projectId, characterId, kind: 'sheet', provider: 'nexabot' })
    return startNexa(job, async () => {
      const { baseUrl, apiKey } = requireNexa()
      const project = getProject(c.projectId)
      const model = getImageModel(project.imageModel)
      const prompt = sheetPrompt(project, getCharacter(characterId))
      return {
        target: 'sheet' as const,
        model,
        prompt,
        run: (ctx: TaskCtx) =>
          nexa.submitImage({ baseUrl, apiKey, prompt, refs: [], signal: ctx.signal }, model.id).then((media) => ({ media, remoteId: null }))
      }
    })
  }
  if (isKieModelId(getProject(c.projectId).imageModel)) {
    const job = insertJob({ projectId: c.projectId, characterId, kind: 'sheet', provider: 'kieai' })
    return startKie(job, async () => {
      const { baseUrl, apiKey } = requireKie()
      const project = getProject(c.projectId)
      const model = getImageModel(project.imageModel)
      const prompt = sheetPrompt(project, getCharacter(characterId))
      return {
        target: 'sheet' as const,
        model,
        prompt,
        run: (ctx: TaskCtx) =>
          kie
            .submitImage({ baseUrl, apiKey, prompt, aspectRatio: '16:9', refs: [], signal: ctx.signal }, model.id)
            .then(({ media, taskId }) => ({ media, remoteId: taskId }))
      }
    })
  }
  const job = insertJob({ projectId: c.projectId, characterId, kind: 'sheet', provider: 'higgsfield' })
  return startHiggsfield(job, async () => {
    const project = getProject(c.projectId)
    const model = getImageModel(project.imageModel)
    const prompt = sheetPrompt(project, getCharacter(characterId))
    return {
      endpoint: model.id,
      body: imageBody(model, prompt, '16:9', []),
      payload: { target: 'sheet', model: model.id, prompt }
    }
  })
}

export function generateClipVideo(clipId: string): Job {
  const existing = activeJobFor({ clipId }, 'video')
  if (existing) return existing
  const clip = getClip(clipId)
  if (!clip.imageAssetId) throw new Error('Buat gambar klip ini dulu sebelum membuat video AI.')
  const project = getProject(clip.projectId)
  const provider = resolveVisualProvider(clip, project, 'video')
  if (provider === 'manual' || provider === 'extension') return startManualJob(clipId, 'video')
  if (provider === 'flow2api') {
    const job = insertJob({ projectId: clip.projectId, clipId, kind: 'video', provider: 'flow2api' })
    return startFlow(job, async (ctx) => {
      const baseUrl = requireFlowEnabled()
      const fresh = getClip(clipId)
      const image = getAsset(fresh.imageAssetId)
      if (!image) throw new Error('Gambar klip tidak ditemukan')
      const project = getProject(fresh.projectId)
      const model = getVideoModel(project.videoModel)
      ctx.progress(0.05, 'Menyiapkan gambar awal')
      const abs = assetAbsPath(image.projectId, image.localPath)
      const firstFrame: FlowImageRef = { bytes: readFileSync(abs), mime: mimeFromExt(abs) }
      const prompt = videoPromptForClip(fresh, model.input.mode === 'reference')
      return {
        target: 'clip-video' as const,
        model,
        prompt,
        run: (c: TaskCtx) =>
          flow.generateVideo({ baseUrl, model, prompt, firstFrame, seconds: fresh.durationMs / 1000, aspect: project.aspectRatio, signal: c.signal })
      }
    })
  }
  if (provider === 'nexabot') {
    const job = insertJob({ projectId: clip.projectId, clipId, kind: 'video', provider: 'nexabot' })
    return startNexa(job, async (ctx) => {
      const { baseUrl, apiKey } = requireNexa()
      const fresh = getClip(clipId)
      const image = getAsset(fresh.imageAssetId)
      if (!image) throw new Error('Gambar klip tidak ditemukan')
      const project = getProject(fresh.projectId)
      const model = getVideoModel(project.videoModel)
      ctx.progress(0.05, 'Menyiapkan gambar awal')
      const abs = assetAbsPath(image.projectId, image.localPath)
      const firstFrame: FlowImageRef = { bytes: readFileSync(abs), mime: mimeFromExt(abs) }
      const prompt = videoPromptForClip(fresh, model.input.mode === 'reference')
      return {
        target: 'clip-video' as const,
        model,
        prompt,
        run: async (c: TaskCtx) => {
          const remoteId = await nexa.submitVideo(
            { baseUrl, apiKey, prompt, refs: [toDataUri(firstFrame.bytes, firstFrame.mime)], seconds: fitDuration(model, fresh.durationMs / 1000) ?? 15, signal: c.signal },
            model.id
          )
          c.setRemote(remoteId)
          const media = await nexa.waitForVideo(
            { baseUrl, apiKey, id: remoteId, signal: c.signal },
            (s) =>
              c.progress(
                s === 'completed' ? 0.9 : 0.5,
                s === 'queued' ? 'Mengantre di NexaBot' : s === 'processing' ? 'NexaBot sedang membuat video' : 'Mengunduh hasil'
              )
          )
          return { media, remoteId }
        }
      }
    })
  }
  if (provider === 'kieai') {
    const job = insertJob({ projectId: clip.projectId, clipId, kind: 'video', provider: 'kieai' })
    return startKie(job, async (ctx) => {
      const { baseUrl, apiKey } = requireKie()
      const fresh = getClip(clipId)
      const image = getAsset(fresh.imageAssetId)
      if (!image) throw new Error('Gambar klip tidak ditemukan')
      const project = getProject(fresh.projectId)
      const model = getVideoModel(project.videoModel)
      ctx.progress(0.05, 'Menyiapkan gambar awal')
      const abs = assetAbsPath(image.projectId, image.localPath)
      const firstFrame: FlowImageRef = { bytes: readFileSync(abs), mime: mimeFromExt(abs) }
      const prompt = videoPromptForClip(fresh, model.input.mode === 'reference')
      return {
        target: 'clip-video' as const,
        model,
        prompt,
        run: async (c: TaskCtx) => {
          // Whole seconds, rounded up: Veo is fixed 8 s, per-second models bill per started second.
          const seconds = Math.ceil(fitDuration(model, fresh.durationMs / 1000) ?? fresh.durationMs / 1000)
          const remoteId = await kie.submitVideo(
            { baseUrl, apiKey, prompt, aspectRatio: project.aspectRatio, refs: [toDataUri(firstFrame.bytes, firstFrame.mime)], seconds, signal: c.signal },
            model.id
          )
          c.setRemote(remoteId)
          const media = await kie.waitForVideo(
            { baseUrl, apiKey, id: remoteId, signal: c.signal },
            model.id,
            (s) =>
              c.progress(
                s === 'success' ? 0.9 : 0.5,
                s === 'waiting' || s === 'queuing' ? 'Mengantre di kie.ai' : s === 'generating' ? 'kie.ai sedang membuat video' : 'Mengunduh hasil'
              )
          )
          return { media, remoteId }
        }
      }
    })
  }
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'video', provider: 'higgsfield' })
  return startHiggsfield(job, async (ctx) => {
    const fresh = getClip(clipId)
    const image = getAsset(fresh.imageAssetId)
    if (!image) throw new Error('Gambar klip tidak ditemukan')
    const project = getProject(fresh.projectId)
    const model = getVideoModel(project.videoModel)
    ctx.progress(0.05, 'Menyiapkan gambar awal')
    const url = await publicUrlFor(image, ctx.signal)
    const prompt = videoPromptForClip(fresh, model.input.mode === 'reference')
    return {
      endpoint: model.id,
      body: videoBody(model, prompt, url, fresh.durationMs / 1000, project.aspectRatio, project.videoResolution),
      payload: { target: 'clip-video', model: model.id, prompt }
    }
  })
}

export function generateClipTts(clipId: string): Job {
  const existing = activeJobFor({ clipId }, 'tts')
  if (existing) return existing
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'tts', provider: project.ttsProvider })
  emit.job(job)
  return runJob(job, 'tts', async (ctx) => {
    const fresh = getClip(clipId)
    const p = getProject(fresh.projectId)
    const text = fresh.narration.trim()
    if (!text) throw new Error('Naskah klip ini masih kosong')
    ctx.progress(0.2, 'Membuat suara')
    let rel: string
    let words: WordTiming[] | undefined
    let estimated = false
    const voice = p.ttsVoice || (p.ttsProvider === 'gemini' ? 'Charon' : '')
    if (p.ttsProvider === 'elevenlabs') {
      if (!voice) throw new Error('Pilih suara ElevenLabs dulu di langkah Ide cerita.')
      const out = await eleven.speak(text, voice, p.language, ctx.signal)
      rel = saveFile(p.id, 'audio', '.mp3', out.audio)
      words = out.words
    } else {
      const wav = await gemini.speak(text, voice, p.language, ctx.signal)
      rel = saveFile(p.id, 'audio', '.wav', wav)
    }
    ctx.progress(0.85, 'Mengukur durasi')
    const audioMs = await probeDurationMs(assetAbsPath(p.id, rel))
    if (!words?.length) {
      words = estimateWordTimings(stripVoiceTags(text), audioMs / 1000)
      estimated = true
    }
    const asset = insertAsset({
      projectId: p.id,
      clipId,
      kind: 'audio',
      provider: p.ttsProvider,
      model: p.ttsProvider === 'gemini' ? getSettings().geminiTtsModel : getSettings().elevenModel,
      prompt: text,
      localPath: rel,
      durationMs: audioMs,
      meta: { words, estimatedTimings: estimated, voice }
    })
    emit.asset(asset)
    const durationMs = Math.max(1500, audioMs + 400)
    const patch = { audioAssetId: asset.id, durationMs, voiceInMs: 0, voiceOutMs: null, voiceStartMs: 0 }
    patchClip(clipId, patch)
    emit.clip({ clipId, patch })
    touchProject(p.id)
    return asset.id
  })
}

export function generateMissingImages(projectId: string): Job[] {
  const jobs: Job[] = []
  const project = getProject(projectId)
  const model = getImageModel(project.imageModel)
  if (maxRefs(model) > 0) {
    const needed = new Set(clipsOf(projectId).flatMap((c) => c.characterIds))
    for (const c of charactersOf(projectId)) {
      if (needed.has(c.id) && !c.sheetAssetId) jobs.push(generateCharacterSheet(c.id))
    }
  }
  for (const clip of clipsOf(projectId)) {
    if (!clip.imageAssetId) jobs.push(generateClipImage(clip.id))
  }
  return jobs
}

/** Turns every clip that has an image but no AI video yet into a video. */
export function generateMissingVideos(projectId: string): Job[] {
  const clips = clipsOf(projectId)
  if (clips.some((c) => !c.imageAssetId)) throw new Error('Buat gambar semua klip dulu sebelum menjadikannya video.')
  return clips.filter((c) => !c.videoAssetId).map((c) => generateClipVideo(c.id))
}

export function generateMissingTts(projectId: string): Job[] {
  return clipsOf(projectId)
    .filter((c) => !c.audioAssetId && c.narration.trim())
    .map((c) => generateClipTts(c.id))
}

/** After a restart, keep polling Higgsfield requests that were already submitted; fail the rest. Manual jobs are skipped: they keep waiting for the user to bring the file back. A submitted NexaBot video is also resumed by polling its remote id; a NexaBot image has no remote id to resume, so it fails like the rest. A submitted kie.ai task (image, sheet, or video) carries its taskId, so all three resume by polling it. */
export function resumeJobs(): void {
  for (const row of unfinishedJobs()) {
    if (row.provider === 'manual') continue
    const payload = JSON.parse(row.payload_json || '{}') as Partial<HfPayload>
    if (row.provider === 'higgsfield' && row.remote_id && payload.target) {
      const job = getJob(row.id)!
      runJob(job, 'higgsfield', (ctx) => finishHiggsfield(ctx, job, row.remote_id, payload as HfPayload))
    } else if (row.provider === 'nexabot' && row.remote_id && payload.target === 'clip-video') {
      const job = getJob(row.id)!
      let creds: { baseUrl: string; apiKey: string }
      try {
        creds = requireNexa()
      } catch (e) {
        // The key may have been removed since the submit; fail the job instead of crashing startup.
        emit.job(updateJob(row.id, { status: 'failed', error: (e as Error).message, message: null }))
        continue
      }
      const remoteId = row.remote_id
      runJob(job, 'nexabot', async (ctx) => {
        const media = await nexa.waitForVideo({ baseUrl: creds.baseUrl, apiKey: creds.apiKey, id: remoteId, signal: ctx.signal })
        return finishNexa(ctx, job, 'clip-video', getVideoModel(payload.model ?? ''), payload.prompt ?? '', media, remoteId)
      })
    } else if (row.provider === 'kieai' && row.remote_id && payload.target) {
      const job = getJob(row.id)!
      let creds: { baseUrl: string; apiKey: string }
      try {
        creds = requireKie()
      } catch (e) {
        // The key may have been removed since the submit; fail the job instead of crashing startup.
        emit.job(updateJob(row.id, { status: 'failed', error: (e as Error).message, message: null }))
        continue
      }
      const remoteId = row.remote_id
      const target = payload.target as 'clip-image' | 'sheet' | 'clip-video'
      const modelId = payload.model ?? ''
      runJob(job, 'kieai', async (ctx) => {
        const media = await kie.waitForTask({ baseUrl: creds.baseUrl, apiKey: creds.apiKey, id: remoteId, signal: ctx.signal }, modelId)
        const model = target === 'clip-video' ? getVideoModel(modelId) : getImageModel(modelId)
        return finishKie(ctx, job, target, model, payload.prompt ?? '', media, remoteId)
      })
    } else {
      emit.job(updateJob(row.id, { status: 'failed', error: 'Terhenti karena aplikasi ditutup. Coba lagi.', message: null }))
    }
  }
}

export async function setActiveAsset(clipId: string, assetId: string): Promise<void> {
  const asset = getAsset(assetId)
  if (!asset || asset.clipId !== clipId) throw new Error('Aset tidak cocok dengan klip ini')
  const patch: Partial<Clip> =
    asset.kind === 'image'
      ? { imageAssetId: asset.id }
      : asset.kind === 'video'
        ? { videoAssetId: asset.id, mediaInMs: 0 }
        : asset.kind === 'audio'
          ? { audioAssetId: asset.id, durationMs: Math.max(1500, (asset.durationMs ?? 0) + 400), voiceInMs: 0, voiceOutMs: null, voiceStartMs: 0 }
          : {}
  patchClip(clipId, patch)
  emit.clip({ clipId, patch })
  // Picking a picture or video by hand also finishes a manual job that was waiting for it.
  if (asset.kind === 'image' || asset.kind === 'video') completeManualJobs(asset.projectId, clipId, asset.kind, asset.id)
}

/** Estimates that failed recently (no key, or a model the account cannot use), so pickers do not keep asking. */
const failedEstimates = new Map<string, number>()

/**
 * Credits for one image, or one clip video of about `seconds`. The model pickers ask for every model,
 * so answers are kept for a day and failures for ten minutes. Flow2API models return null: the server
 * has no credit-estimate endpoint, and the cost is the user's own Google Flow credit, not a per-model price.
 * NexaBot models return their fixed catalog price (Rp300/video) without a server call — the price is
 * in NexaBot credits, and the pickers convert it to Rupiah. kie.ai models return their fixed catalog
 * price too, but in USD: `credits` is kie.ai credits and `usd` is the real USD price (not null, unlike
 * NexaBot) — per-second models multiply their rate by the clip length. Manual/extension scenes return null for
 * the same reason: no server, no per-model price.
 */
export async function estimateCredits(
  kind: 'image' | 'video',
  modelId: string,
  aspect: AspectRatio,
  seconds = 5,
  resolution?: string | null,
  visualProvider?: VisualProvider
): Promise<CreditEstimate | null> {
  if (visualProvider === 'manual' || visualProvider === 'extension') return null
  if (isFlowModelId(modelId)) return null
  if (isNexaModelId(modelId)) {
    const credits = nexaCredits(modelId)
    return credits === null ? null : { credits, usd: null }
  }
  if (isKieModelId(modelId)) {
    const durationMs = kind === 'video' ? seconds * 1000 : undefined
    const credits = kieaiCredits(modelId, durationMs)
    return credits === null ? null : { credits, usd: kieaiUsd(modelId, durationMs) }
  }
  const model = kind === 'image' ? getImageModel(modelId) : getVideoModel(modelId)
  const body =
    kind === 'image'
      ? imageBody(model, 'estimate', aspect, [])
      : videoBody(model, 'estimate', 'https://example.com/frame.png', seconds, aspect, resolution)
  const key = `estimate:${model.id}:${JSON.stringify(body)}`
  const hit = readCache<CreditEstimate>(key)
  if (hit && Date.now() - hit.updatedAt < DAY) return hit.value
  const failedAt = failedEstimates.get(key)
  if (failedAt && Date.now() - failedAt < 10 * 60 * 1000) return null
  const value = await hf.estimate(model.id, body)
  if (value) writeCache(key, value)
  else failedEstimates.set(key, Date.now())
  return value
}

/** Prices can differ per account, so a new Higgsfield key starts from fresh estimates. */
export function forgetEstimates(): void {
  failedEstimates.clear()
  dropCache('estimate:')
}
