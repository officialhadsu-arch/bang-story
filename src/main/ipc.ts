import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import type {
  ApiProvider,
  AppSettings,
  AspectRatio,
  ExportOptions,
  KeyTestResult,
  ModelSource,
  NewProjectInput,
  ProjectSnapshot,
  TtsProvider,
  VoiceOption,
  WordTiming
} from '@shared/types'
import type { VisualProvider, WorkFileKind } from '@shared/manual'
import type { SceneDef } from '@shared/talkinghead'
import { startExport } from './exporter'
import {
  applyMotionPreset,
  cancelSequentialImages,
  estimateCredits,
  forgetEstimates,
  generateCharacterSheet,
  generateClipImage,
  generateClipTts,
  generateClipVideo,
  generateMissingImages,
  generateMissingVideos,
  generateMissingTts,
  sequentialStatus,
  setActiveAsset,
  startSequentialImages
} from './generation'
import { cancelJob } from './jobs'
import { generateNarration, syncCaptions } from './narration'
import { cancelDownload, downloadModel, openModelFolder, removeModel, whisperStatus } from './whisper'
import { assetAbsPath, manualWorkFolder, motionWorkFolder } from './paths'
import { detachVoice, splitClip } from './editing'
import { emit } from './events'
import {
  createProject,
  duplicateProject,
  getAsset,
  getBundle,
  getCharacter,
  getProject,
  insertAsset,
  listProjects,
  removeProject,
  saveSnapshot,
  setCharacterSheet,
  touchProject,
  updateAssetMeta
} from './repo'
import { clearSecret, getSecret, keyStatuses, recordCheck, revealSecret, setSecret } from './secrets'
import { dropCache, getSettings, setSettings } from './settings'
import { probeDurationMs, probeSize } from './services/audio'
import * as eleven from './services/elevenlabs'
import * as flow from './services/flow2api'
import * as gemini from './services/gemini'
import * as hf from './services/higgsfield'
import * as kie from './services/kieai'
import * as llm from './services/llm'
import * as nexa from './services/nexabot'
import { applyBulkImport, importManualFile, prepareVideoWorkFolder, prepareWorkFolder, previewBulkImportFolder, scanWorkFolder } from './services/manual'
import {
  approveMotionBeat,
  motionBabaksOf,
  motionTemplates,
  overrideMotionEasing,
  prepareMotionWorkFolder,
  readMotionBabak,
  readProjectStyleOverride,
  saveProjectStyleOverride,
  syncMotionBeatIds
} from './services/motion'
import { renderBabakFull } from './services/renderer'
import { generateScript, cancelScriptGeneration, continueScript, generateVisuals, generateMusicPrompt, importScript } from './story'
import { arrangeScenes, buildScenes, getFootage, importFootage, setDroppedWords, setFillers, testGroq, transcribeFootage } from './talkinghead'


type Handler = (...args: any[]) => unknown

function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      // Only the message crosses the IPC boundary; keep it readable for the user.
      throw new Error((e as Error)?.message ?? String(e))
    }
  })
}

async function testProvider(provider: ApiProvider, key?: string): Promise<KeyTestResult> {
  if (provider === 'higgsfield') return hf.testCredentials(key)
  if (provider === 'elevenlabs') return eleven.testKey(key)
  if (provider === 'nexabot') return nexa.testConnection(getSettings().nexabotBaseUrl, key ?? getSecret('nexabot') ?? undefined)
  if (provider === 'kieai') return kie.testCredentials(getSettings().kieaiBaseUrl, key ?? getSecret('kieai') ?? undefined)
  if (provider === 'flow2api') return flow.testConnection(getSettings().flow2apiBaseUrl, key ?? getSecret('flow2api') ?? undefined)
  return llm.testLlm(provider, key)
}

function defaultExportFolder(): string {
  return getSettings().exportFolder ?? join(app.getPath('videos'), 'KenStory')
}

// Plain-Indonesian messages for every 'assets:pickSheet' failure: what
// happened + what to do next. Technical errors (Node/SQLite codes) are
// classified here so the user never sees a raw message; the original error
// is written to the log at the throw site instead.
function friendlyPickSheetError(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === 'Pemeran tidak ditemukan' || e.message === 'Pemeran tidak ada di proyek ini') return e.message
    if (
      e.message === 'Format gambar ini tidak didukung. Pilih gambar PNG, JPG, atau WebP.' ||
      e.message.startsWith('Gambar ini tidak bisa dibaca.')
    )
      return e.message
    const code = (e as NodeJS.ErrnoException).code ?? ''
    if (code.startsWith('SQLITE'))
      return 'Lembar tidak bisa disimpan ke proyek. Coba lagi; kalau masih gagal, tutup KenStory lalu buka lagi.'
    if (code === 'ENOENT' || code === 'EACCES' || code === 'EPERM')
      return 'Gambar tidak bisa disalin ke proyek. Pastikan berkasnya masih ada dan folder proyek bisa ditulis, lalu coba lagi.'
  }
  return 'Lembar tidak bisa diunggah. Coba lagi dengan gambar lain; kalau masih gagal, tutup KenStory lalu buka lagi.'
}

export function registerIpc(): void {
  handle('projects:list', () => listProjects())
  handle('projects:create', (input: NewProjectInput) => getBundle(createProject(input).id))
  handle('projects:get', (id: string) => getBundle(id))
  handle('projects:save', (snap: ProjectSnapshot) => ({ updatedAt: saveSnapshot(snap) }))
  handle('projects:remove', (id: string) => removeProject(id))
  handle('projects:duplicate', (id: string) => duplicateProject(id))

  handle('story:script', (projectId: string) => generateScript(projectId))
  handle('story:continueScript', (projectId: string) => continueScript(projectId))
  handle('story:cancelScript', (projectId: string) => cancelScriptGeneration(projectId))
  handle('story:importScript', (projectId: string, text: string) => importScript(projectId, text))
  // The user's own script file: the dialog reads the text and previews it
  // before anything is written, so the native dialog only picks the file.
  handle('story:pickScriptFile', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih berkas naskah',
      filters: [{ name: 'Teks', extensions: ['txt', 'md'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    const text = readFileSync(res.filePaths[0], 'utf8')
    if (text.length > 200_000) throw new Error('Berkas naskah terlalu besar. Pakai berkas di bawah 200 ribu karakter.')
    return { fileName: basename(res.filePaths[0]), text }
  })
  handle('story:musicPrompt', (projectId: string) => generateMusicPrompt(projectId))
  handle('story:visuals', (projectId: string, mode: 'missing' | 'all') => generateVisuals(projectId, mode === 'all' ? 'all' : 'missing'))

  handle('generate:clipImage', (clipId: string) => generateClipImage(clipId))
  handle('generate:clipVideo', (clipId: string) => generateClipVideo(clipId))
  handle('generate:clipTts', (clipId: string) => generateClipTts(clipId))
  handle('generate:characterSheet', (characterId: string) => generateCharacterSheet(characterId))
  handle('generate:missingImages', (projectId: string) => generateMissingImages(projectId))
  handle('generate:sequentialImages', (projectId: string) => startSequentialImages(projectId))
  handle('generate:cancelSequential', (projectId: string) => cancelSequentialImages(projectId))
  handle('generate:sequentialStatus', (projectId: string) => sequentialStatus(projectId))
  handle('generate:missingVideos', (projectId: string) => generateMissingVideos(projectId))
  handle('generate:missingTts', (projectId: string) => generateMissingTts(projectId))
  handle('generate:narration', (projectId: string, mode: 'missing' | 'all') => generateNarration(projectId, mode === 'all' ? 'all' : 'missing'))
  handle('generate:syncCaptions', (projectId: string, mode?: 'stale' | 'all') => syncCaptions(projectId, mode === 'all' ? 'all' : 'stale'))

  handle('whisper:status', () => whisperStatus())
  // The download runs in the background and reports through whisper events.
  handle('whisper:download', () => {
    void downloadModel().catch(() => {})
  })
  handle('whisper:cancel', () => cancelDownload())
  handle('whisper:remove', () => removeModel())
  handle('whisper:openFolder', () => openModelFolder())
  handle('generate:cancel', (jobId: string) => cancelJob(jobId))
  handle(
    'generate:estimate',
    (kind: 'image' | 'video', modelId: string, aspect: AspectRatio, seconds?: number, resolution?: string | null, visualProvider?: VisualProvider) =>
      estimateCredits(kind, modelId, aspect, seconds, resolution, visualProvider)
  )

  // Tier 2 (0.3+): the manual / extension work folder.
  handle('manual:prepareWorkFolder', (projectId: string) => prepareWorkFolder(projectId))
  handle('manual:prepareVideoWorkFolder', (projectId: string) => prepareVideoWorkFolder(projectId))
  handle('manual:scanWorkFolder', (projectId: string) => scanWorkFolder(projectId))
  handle('manual:importFile', (projectId: string, fileName: string, clipId: string, kind: WorkFileKind) => importManualFile(projectId, fileName, clipId, kind))
  handle('manual:openWorkFolder', async (projectId: string) => {
    getProject(projectId)
    const err = await shell.openPath(manualWorkFolder(projectId))
    if (err) throw new Error(`Folder kerja tidak bisa dibuka: ${err}`)
  })

  // Fase 4 (0.4): motion — the agent's work folder + the babak renderer.
  handle('motion:prepareWorkFolder', (projectId: string, styleId?: string) => prepareMotionWorkFolder(projectId, styleId))
  handle('motion:listBabak', (projectId: string) => motionBabaksOf(projectId))
  handle('motion:getBabak', (projectId: string, babakId: string) => {
    syncMotionBeatIds(projectId, babakId)
    return readMotionBabak(projectId, babakId)
  })
  handle('motion:approveBeat', (projectId: string, babakId: string, beatId: string, status: 'approved' | 'redo' | 'pending') =>
    approveMotionBeat(projectId, babakId, beatId, status)
  )
  handle('motion:overrideEasing', (projectId: string, babakId: string, beatId: string, easing: string | null) =>
    overrideMotionEasing(projectId, babakId, beatId, easing)
  )
  handle('motion:renderBabak', (projectId: string, babakId: string) => renderBabakFull(projectId, babakId))
  handle('motion:getTemplates', () => motionTemplates())
  handle('motion:applyPreset', (projectId: string, preset: 'penuh' | 'hybrid') => applyMotionPreset(projectId, preset))
  handle('motion:getStyleOverride', (projectId: string) => readProjectStyleOverride(projectId))
  handle('motion:saveStyleOverride', (projectId: string, styleJs: string) => saveProjectStyleOverride(projectId, styleJs))
  handle('motion:openWorkFolder', async (projectId: string) => {
    getProject(projectId)
    const err = await shell.openPath(motionWorkFolder(projectId))
    if (err) throw new Error(`Folder kerja motion tidak bisa dibuka: ${err}`)
  })
  // Fase 5 (0.5): Talking Head — narration-first mode (import recording, transcribe, arrange, build).
  handle('talkinghead:importFootage', async (projectId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih rekaman video',
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    return importFootage(projectId, res.filePaths[0])
  })
  handle('talkinghead:getFootage', (projectId: string) => getFootage(projectId))
  handle('talkinghead:transcribe', (projectId: string) => transcribeFootage(projectId))
  handle('talkinghead:testGroq', () => testGroq())
  handle('talkinghead:setDroppedWords', (assetId: string, dropped: number[]) => setDroppedWords(assetId, dropped))
  handle('talkinghead:setFillers', (assetId: string, fillers: string[]) => setFillers(assetId, fillers))
  handle('talkinghead:arrange', (projectId: string) => arrangeScenes(projectId))
  handle('talkinghead:buildScenes', (projectId: string, scenes: SceneDef[]) => buildScenes(projectId, scenes))

  handle('assets:setActive', (clipId: string, assetId: string) => setActiveAsset(clipId, assetId))
  handle('clips:split', (clipId: string, atMs: number) => splitClip(clipId, Number(atMs)))
  handle('clips:detachVoice', (clipId: string) => detachVoice(clipId))
  // Caption text fixed by hand in the editor; the words keep their times.
  handle('assets:setWords', (assetId: string, words: WordTiming[]) => {
    const a = getAsset(assetId)
    if (!a || a.kind !== 'audio') throw new Error('Suara klip tidak ditemukan')
    const clean = (Array.isArray(words) ? words : [])
      .filter((w) => w && typeof w.text === 'string' && w.text.trim() && Number.isFinite(w.start) && Number.isFinite(w.end))
      .map((w) => ({ text: w.text.trim(), start: Math.max(0, w.start), end: Math.max(w.start, w.end) }))
    updateAssetMeta(a.id, { ...a.meta, words: clean, editedWords: true })
    const fresh = getAsset(a.id)!
    emit.asset(fresh)
    return fresh
  })
  handle('assets:pickMusic', async (projectId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih musik latar',
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    getProject(projectId)
    const src = res.filePaths[0]
    const rel = `music/${randomUUID()}${extname(src).toLowerCase()}`
    const abs = assetAbsPath(projectId, rel)
    mkdirSync(dirname(abs), { recursive: true })
    copyFileSync(src, abs)
    const durationMs = await probeDurationMs(abs).catch(() => null)
    return insertAsset({
      projectId,
      kind: 'music',
      provider: 'local',
      prompt: src.split(/[\\/]/).pop() ?? 'musik',
      localPath: rel,
      durationMs
    })
  })

  handle('assets:pickImage', async (projectId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih gambar logo atau watermark',
      filters: [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    getProject(projectId)
    const src = res.filePaths[0]
    const rel = `overlays/${randomUUID()}${extname(src).toLowerCase()}`
    const abs = assetAbsPath(projectId, rel)
    mkdirSync(dirname(abs), { recursive: true })
    copyFileSync(src, abs)
    const size = await probeSize(abs).catch(() => null)
    if (!size) throw new Error('Gambar tidak bisa dibaca. Pakai file PNG, JPG, atau WebP.')
    return insertAsset({
      projectId,
      kind: 'overlay',
      provider: 'local',
      prompt: basename(src),
      localPath: rel,
      width: size.width,
      height: size.height
    })
  })

  // W6(b): a local image file for a clip that has no picture yet. Unlike
  // pickImage (overlay, no clip), the asset is stored as a clip image and
  // linked to the clip at once, so the export can use it. setActiveAsset
  // refuses assets whose clipId does not match, so the clipId is set here.
  handle('assets:pickClipImage', async (projectId: string, clipId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih gambar untuk klip',
      filters: [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    getProject(projectId)
    const src = res.filePaths[0]
    const rel = `images/${randomUUID()}${extname(src).toLowerCase()}`
    const abs = assetAbsPath(projectId, rel)
    mkdirSync(dirname(abs), { recursive: true })
    copyFileSync(src, abs)
    const size = await probeSize(abs).catch(() => null)
    if (!size) throw new Error('Gambar tidak bisa dibaca. Pakai file PNG, JPG, atau WebP.')
    const asset = insertAsset({
      projectId,
      clipId,
      kind: 'image',
      provider: 'local',
      prompt: basename(src),
      localPath: rel,
      width: size.width,
      height: size.height
    })
    await setActiveAsset(clipId, asset.id)
    return asset
  })

  // Tier 2 (0.3+): the video twin of pickClipImage — a local video file for a clip, stored as the
  // clip's video and linked at once. setActiveAsset also finishes a manual job waiting for it.
  handle('assets:pickClipVideo', async (projectId: string, clipId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih video untuk klip',
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    getProject(projectId)
    const src = res.filePaths[0]
    const rel = `videos/${randomUUID()}${extname(src).toLowerCase()}`
    const abs = assetAbsPath(projectId, rel)
    mkdirSync(dirname(abs), { recursive: true })
    copyFileSync(src, abs)
    const size = await probeSize(abs).catch(() => null)
    if (!size) throw new Error('Video tidak bisa dibaca. Pakai file MP4, MOV, atau WebM.')
    const asset = insertAsset({
      projectId,
      clipId,
      kind: 'video',
      provider: 'local',
      prompt: basename(src),
      localPath: rel,
      durationMs: await probeDurationMs(abs).catch(() => null),
      width: size.width,
      height: size.height
    })
    await setActiveAsset(clipId, asset.id)
    return asset
  })

  // 0.3 (unggah lembar): a local image file for a character sheet, stored like a
  // generated sheet and linked to the character at once. Follows pickClipImage's
  // shape (dialog filter, copy to images/, probeSize fail-closed, insertAsset)
  // and the GA sheet registration (provider 'manual', setCharacterSheet).
  // The file's generating model is unknown, so model stays null — GA recorded
  // 'nano-banana' only because those sheets were Nano Banana generations.
  // The probe runs before any database write; a file that fails it is deleted
  // again, so a bad upload leaves nothing behind.
  // Every failure throws a plain-Indonesian message (what happened + what to
  // do next); the technical error is only written to the log, never shown.
  handle('assets:pickSheet', async (projectId: string, characterId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih lembar karakter',
      filters: [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    try {
      const c = getCharacter(characterId)
      if (c.projectId !== projectId) throw new Error('Pemeran tidak ada di proyek ini')
      const src = res.filePaths[0]
      const ext = extname(src).toLowerCase()
      if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.webp') {
        throw new Error('Format gambar ini tidak didukung. Pilih gambar PNG, JPG, atau WebP.')
      }
      const rel = `images/${randomUUID()}${ext}`
      const abs = assetAbsPath(projectId, rel)
      mkdirSync(dirname(abs), { recursive: true })
      copyFileSync(src, abs)
      const size = await probeSize(abs).catch(() => null)
      if (!size) {
        unlinkSync(abs)
        throw new Error('Gambar ini tidak bisa dibaca. Mungkin berkasnya rusak, coba gambar lain atau simpan ulang sebagai PNG atau JPG.')
      }
      const asset = insertAsset({
        projectId,
        characterId,
        kind: 'image',
        provider: 'manual',
        prompt: basename(src),
        localPath: rel,
        width: size.width,
        height: size.height
      })
      setCharacterSheet(characterId, asset.id)
      emit.asset(asset)
      emit.character({ characterId, patch: { sheetAssetId: asset.id } })
      touchProject(projectId)
      return asset
    } catch (e) {
      console.error('[pickSheet] gagal mengunggah lembar karakter', e)
      throw new Error(friendlyPickSheetError(e))
    }
  })
  // Tier 1 (0.3): bulk import — a folder of generated results, installed in order onto the
  // scenes that still need a picture or a video. openDirectory is supported on every Electron
  // platform, so no openFile+multiSelections fallback is needed.
  handle('assets:previewBulkImport', async (projectId: string, kind: WorkFileKind) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: kind === 'image' ? 'Pilih folder hasil gambar' : 'Pilih folder hasil video',
      properties: ['openDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    return previewBulkImportFolder(projectId, res.filePaths[0], kind)
  })
  handle('assets:applyBulkImport', (projectId: string, folder: string, kind: WorkFileKind) => applyBulkImport(projectId, folder, kind))
  handle('settings:get', () => getSettings())
  handle('settings:set', (patch: Partial<AppSettings>) => setSettings(patch))
  handle('settings:keys', () => keyStatuses())
  handle('settings:setKey', async (provider: ApiProvider, key: string) => {
    const clean = key.trim()
    if (!clean) throw new Error('Kunci masih kosong')
    setSecret(provider, clean)
    dropCache(`models:${provider}`)
    if (provider === 'gemini') dropCache('models:gemini-tts')
    if (provider === 'higgsfield') forgetEstimates()
    const result = await testProvider(provider, clean)
    recordCheck(provider, result.ok, result.message)
    return result
  })
  handle('settings:setCustom', async (baseUrl: string, key: string) => {
    const url = baseUrl.trim().replace(/\/+$/, '')
    if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error('Alamat endpoint harus diawali http:// atau https://')
    setSettings({ customBaseUrl: url })
    if (key.trim()) setSecret('custom', key.trim())
    dropCache('models:custom')
    const result = await llm.testLlm('custom', key.trim() || undefined, url)
    recordCheck('custom', result.ok, result.message)
    return result
  })
  handle('settings:clearKey', (provider: ApiProvider) => {
    clearSecret(provider)
    dropCache(`models:${provider}`)
    if (provider === 'higgsfield') forgetEstimates()
    if (provider === 'custom') setSettings({ customBaseUrl: '' })
  })
  handle('models:list', (source: ModelSource, refresh?: boolean) => llm.listModels(source, !!refresh))
  handle('settings:testKey', async (provider: ApiProvider) => {
    const result = await testProvider(provider).catch((e): KeyTestResult => ({ ok: false, message: (e as Error).message }))
    recordCheck(provider, result.ok, result.message)
    return result
  })
  handle('settings:revealKey', (provider: ApiProvider) => revealSecret(provider))
  handle('settings:voices', async (provider: TtsProvider): Promise<VoiceOption[]> => {
    if (provider === 'gemini') return gemini.listVoices()
    return eleven.listVoices()
  })
  handle('flow2api:testConnection', (baseUrl: string) => flow.testConnection(baseUrl, getSecret('flow2api') ?? undefined))
  handle('nexabot:testConnection', (baseUrl: string) => nexa.testConnection(baseUrl, getSecret('nexabot') ?? undefined))
  handle('kieai:testConnection', (baseUrl: string) => kie.testConnection(baseUrl, getSecret('kieai') ?? undefined))

  handle('export:start', (projectId: string, opts: ExportOptions) => startExport(projectId, opts))
  handle('export:defaultFolder', () => defaultExportFolder())
  handle('export:pickFolder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih folder ekspor',
      defaultPath: defaultExportFolder(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    setSettings({ exportFolder: res.filePaths[0] })
    return res.filePaths[0]
  })
  handle('export:reveal', (path: string) => shell.showItemInFolder(path))

  handle('app:version', () => app.getVersion())
  handle('app:copyText', (text: string) => clipboard.writeText(String(text)))
  handle('app:openExternal', (url: string) => {
    if (/^https:\/\//i.test(url)) return shell.openExternal(url)
    return undefined
  })
}
