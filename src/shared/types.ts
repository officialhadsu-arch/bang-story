import type { VisualProvider } from './manual'

export type ProjectStatus = 'draft' | 'script' | 'storyboard' | 'editing' | 'exported'
export type AspectRatio = '16:9' | '9:16'
export type TtsProvider = 'gemini' | 'elevenlabs'
export type LlmProvider = 'gemini' | 'openrouter' | 'groq' | 'custom'
export type ApiProvider = 'higgsfield' | 'gemini' | 'elevenlabs' | 'openrouter' | 'groq' | 'custom' | 'nexabot' | 'kieai'
/** Where a live model list comes from: an LLM provider, or a TTS catalog. */
export type ModelSource = LlmProvider | 'gemini-tts' | 'elevenlabs'
export type MotionType = 'camera' | 'video'
export type CameraPresetId = 'zoomin' | 'zoomout' | 'panleft' | 'panright' | 'kenburns' | 'shake' | 'static'
export type MotionStrength = 'halus' | 'sedang' | 'kuat'
export type TransitionId = 'cut' | 'fade' | 'slideleft' | 'zoomin'
export type CaptionStyleId = 'karaoke' | 'tebal' | 'minimal' | 'subtitle' | 'none'
export type CaptionPosition = 'atas' | 'tengah' | 'bawah'
export type CaptionSize = 'kecil' | 'sedang' | 'besar'
/** 1 idea, 2 script, 3 storyboard, 4 editor */
export type Step = 1 | 2 | 3 | 4

/** How a project is born (F5-01): an AI-written story with generated visuals, or a raw recording understood first. Locked after creation; changing it means a new project. */
export type ProjectMode = 'gambar-video' | 'talking-head'

/** Framing of one talking-head scene (F5-09): the whole frame, or a close-up (60% crop) in the middle, left or right. No face tracking in v1. */
export type CompositionId = 'penuh' | 'tengah' | 'kiri' | 'kanan'

export interface EditorSettings {
  captionStyle: CaptionStyleId
  captionPosition: CaptionPosition
  captionSize: CaptionSize
  /** Caption size as a multiple of the style's size (0.5–1.8); overrides captionSize when set. */
  captionScale?: number
  /** Custom look on top of the chosen caption style; unset fields keep the style's own. */
  captionFont?: string
  captionColor?: string
  captionHighlight?: string
  /** Box behind the caption: a color and opacity, or null for no box. */
  captionBg?: { color: string; opacity: number } | null
  musicAssetId: string | null
  musicVolumeDb: number
  duckMusic: boolean
  /** Logos, watermarks and text placed over the video. */
  overlays: Overlay[]
  /** Volume change for all narration, in dB. */
  voiceVolumeDb?: number
  /** Background music on the timeline: from `musicStartMs` to `musicEndMs` (null: the end), `musicInMs` into the song. */
  musicStartMs?: number
  musicEndMs?: number | null
  musicInMs?: number
  /** Last prompt written for making background music in an outside AI (Suno, Udio, …). */
  musicPrompt?: MusicPrompt | null
}

export interface MusicPrompt {
  /** Suno "Style of Music": comma-separated English tags. */
  style: string
  /** Suno "Exclude styles". */
  exclude: string
  title: string
  /** One paragraph for other music AIs (Udio, ElevenLabs Music, Stable Audio, …). */
  description: string
  /** Why this music fits, in Indonesian, for the user. */
  reason: string
  /** Video length when it was written, in seconds. */
  durationSec: number
}

/**
 * Where an overlay sits: `anchor` is a numpad position on the overlay itself (7 top-left, 5 center,
 * 3 bottom-right, the same numbering as ASS n), and `x`/`y` place that point as a fraction of the frame.
 */
interface OverlayBase {
  id: string
  anchor: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  x: number
  y: number
  /** Seconds on the final timeline; `end` null means until the video ends. */
  start: number
  end: number | null
}

export interface ImageOverlay extends OverlayBase {
  kind: 'image'
  assetId: string
  /** Width as a fraction of the frame width. */
  width: number
  opacity: number
}

export type TextOverlayStyle = 'plain' | 'outline' | 'box'

export interface TextOverlay extends OverlayBase {
  kind: 'text'
  text: string
  /** Font size as a fraction of the frame height. */
  size: number
  color: string
  style: TextOverlayStyle
  bold: boolean
}

export type Overlay = ImageOverlay | TextOverlay

export interface Project {
  id: string
  title: string
  /** Birth mode (F5-01): 'gambar-video' (AI story + generated visuals) or 'talking-head' (raw recording first). */
  mode: ProjectMode
  synopsis: string
  durationSec: number
  language: string
  aspectRatio: AspectRatio
  styleId: string
  ttsProvider: TtsProvider
  ttsVoice: string
  /** Higgsfield endpoint ids; null falls back to the app default. */
  imageModel: string | null
  videoModel: string | null
  /** One of the video model's resolutions, e.g. "720p"; null or unsupported uses the default (1080p when offered). */
  videoResolution: string | null
  status: ProjectStatus
  step: Step
  coverAssetId: string | null
  editor: EditorSettings
  createdAt: number
  updatedAt: number
}

export interface Character {
  id: string
  projectId: string
  name: string
  description: string
  sheetAssetId: string | null
  sort: number
}

export interface Clip {
  id: string
  projectId: string
  sort: number
  /** Stable 2-digit scene number ('01', '02', …); the work-folder harness matches result files to it. */
  sceneKey: string
  /** Which provider makes this scene's picture/video; 'auto' follows the project's model. */
  visualProvider: VisualProvider
  /** Motion (Fase 4): the babak folder this scene belongs to (motion-work/out/<babakId>/), null for other providers. */
  motionBabakId: string | null
  /** Motion (Fase 4): the beat id of this scene inside its babak's beats.json, null for other providers. */
  motionBeatId: string | null
  /**
   * Caption per scene (B6): true = burn captions on this scene, false = off, null = default
   * (off on motion scenes, on elsewhere). Preview and export read the same rule.
   */
  captionOn: boolean | null
  title: string
  /** What happens in the scene, in the script's language (the Naskah step). */
  story: string
  visualPrompt: string
  /** The story text the current visual plan was written from; null before any plan. */
  visualSource: string | null
  narration: string
  durationMs: number
  characterIds: string[]
  motionType: MotionType
  cameraPreset: CameraPresetId
  motionStrength: MotionStrength
  videoPrompt: string
  transition: TransitionId
  /** Camera move drawn over the AI video ('static' keeps the video as it is). */
  videoCamera: CameraPresetId
  videoStrength: MotionStrength
  /** Framing of a talking-head scene (F5-09); 'penuh' for every other clip. */
  composition: CompositionId
  /** Length of the transition into the next clip; null uses the default (0.4 s). */
  transitionMs: number | null
  /** Volume change for this clip's narration, in dB. */
  voiceGainDb: number
  /** Where the clip's video starts, in ms into the video file (trimmed from the left on the timeline). */
  mediaInMs: number
  /** The clip's voice trimmed to `voiceInMs`–`voiceOutMs` of its audio (null: to the end), placed `voiceStartMs` into the clip. */
  voiceInMs: number
  voiceOutMs: number | null
  voiceStartMs: number
  imageAssetId: string | null
  videoAssetId: string | null
  audioAssetId: string | null
}

export type AssetKind = 'image' | 'video' | 'audio' | 'music' | 'overlay' | 'export'

export interface WordTiming {
  text: string
  start: number
  end: number
}

export interface AssetMeta {
  words?: WordTiming[]
  estimatedTimings?: boolean
  voice?: string
  /** Whisper DTW timings ('whisper-dtw') or an estimate; set on narration and footage audio. */
  timedBy?: string
  /** What this asset is for the talking-head flow: 'footage' (raw recording) or 'footage-audio' (its extracted audio). */
  role?: string
  /** The footage video this audio was extracted from (footage-audio only). */
  footageAssetId?: string
  /** Word indexes the user (or the auto-drop) marked to cut out of the talking-head transcript. */
  droppedWordIndexes?: number[]
  /** The filler-word list that auto-marks words to cut (editable on the Transcript step). */
  fillerWords?: string[]
  [key: string]: unknown
}

export interface Asset {
  id: string
  projectId: string
  clipId: string | null
  characterId: string | null
  kind: AssetKind
  provider: string | null
  model: string | null
  prompt: string | null
  remoteId: string | null
  remoteUrl: string | null
  localPath: string
  url: string
  durationMs: number | null
  width: number | null
  height: number | null
  meta: AssetMeta
  createdAt: number
}

/** Which engine transcribes the talking-head recording: the local Whisper Small model, or Groq's cloud Whisper Large V3. */
export type TranscriptProvider = 'local' | 'groq'

/** "narration" voices several scenes in one take and cuts it per scene. "transcribe" recognises the talking-head recording once. */
export type JobKind = 'story' | 'image' | 'sheet' | 'video' | 'tts' | 'narration' | 'align' | 'export' | 'transcribe'
export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled'

export interface Job {
  id: string
  projectId: string
  clipId: string | null
  characterId: string | null
  kind: JobKind
  provider: string
  status: JobStatus
  progress: number
  message: string | null
  error: string | null
  resultAssetId: string | null
  createdAt: number
  updatedAt: number
}

export interface ProjectBundle {
  project: Project
  characters: Character[]
  clips: Clip[]
  assets: Asset[]
  jobs: Job[]
}

export interface ProjectSummary {
  id: string
  title: string
  styleId: string
  status: ProjectStatus
  step: Step
  clipCount: number
  totalMs: number
  coverUrl: string | null
  updatedAt: number
}

/** What the renderer sends on save. Asset links are owned by the main process and never overwritten by a save. */
export interface ProjectSnapshot {
  project: Omit<Project, 'createdAt' | 'updatedAt' | 'coverAssetId'>
  characters: Omit<Character, 'sheetAssetId'>[]
  clips: Omit<Clip, 'imageAssetId' | 'videoAssetId' | 'audioAssetId'>[]
}

export interface NewProjectInput {
  synopsis?: string
  mode?: ProjectMode
  durationSec?: number
  language?: string
  aspectRatio?: AspectRatio
  styleId?: string
  ttsProvider?: TtsProvider
}

export interface KeyStatus {
  provider: ApiProvider
  configured: boolean
  lastOk: boolean | null
  lastMessage: string | null
  checkedAt: number | null
  /** Masked key for display, e.g. "sk-or-v1…9f3c". Null when there is no readable key. */
  preview: string | null
  /** A key is stored but can no longer be decrypted and must be entered again. */
  unreadable: boolean
  /** False when the OS cannot encrypt keys (D-07); the app then refuses to store keys. */
  encryptionAvailable: boolean
}

export interface KeyTestResult {
  ok: boolean
  message: string
}

export interface VoiceOption {
  id: string
  name: string
  description: string
  previewUrl?: string | null
}

export interface AppSettings {
  defaultTtsProvider: TtsProvider
  defaultLanguage: string
  exportFolder: string | null
  /** Which LLM writes stories and narration. */
  llmProvider: LlmProvider
  /** Chosen model per LLM provider, so switching providers keeps each choice. */
  llmModels: Record<LlmProvider, string>
  /** Base URL of an OpenAI-compatible endpoint, e.g. http://localhost:11434/v1 */
  customBaseUrl: string
  geminiTtsModel: string
  elevenModel: string
  /** Higgsfield models for new projects: the last ones picked in the Idea step. */
  imageModel: string
  videoModel: string
  /** Flow2API (Google Flow through a self-hosted server) is off until the user reads the D-16 account-risk warning in Settings and turns it on. */
  flow2apiEnabled: boolean
  /** Base URL of the Flow2API server, e.g. http://localhost:8000 */
  flow2apiBaseUrl: string
  /** NexaBot (pay-as-you-go, Rp300/video) is off until the user reads the cost warning in Settings and turns it on. */
  nexabotEnabled: boolean
  /** Base URL of the NexaBot REST API (an assumption until the live PC test confirms it). */
  nexabotBaseUrl: string
  /**
   * Motion (Fase 4, tier 3): off by default. Only when on can a scene use the
   * 'motion' provider; 'auto' never picks motion on its own (F4-04).
   */
  motionEnabled: boolean
  /** Which motion preset the last apply used: 'penuh' (motion on every scene) or 'hybrid' (only key scenes). */
  motionPreset: 'penuh' | 'hybrid'
  /** Talking Head (narration-first mode) is off until the user turns it on in Settings. */
  talkingHeadEnabled: boolean
  /** Which engine transcribes the talking-head recording: local Whisper Small (default) or Groq cloud Whisper Large V3. */
  transcriptProvider: TranscriptProvider
  /** kie.ai (pay-as-you-go in USD, premium models) is off until the user reads the cost warning in Settings and turns it on. */
  kieaiEnabled: boolean
  /** Base URL of the kie.ai REST API (verified from docs.kie.ai, 13 Nov 2026). */
  kieaiBaseUrl: string
  /** Time captions against the real voice with Whisper after narration is made (when the model is present). */
  whisperAuto: boolean
}

/** What one Higgsfield request would cost, from the API's estimate endpoint. */
export interface CreditEstimate {
  credits: number
  usd: number | null
}

/** The local Whisper model used to time caption words. */
export interface WhisperStatus {
  state: 'missing' | 'downloading' | 'verifying' | 'ready'
  received: number
  total: number
  error: string | null
}

export interface ModelOption {
  id: string
  name: string
  description?: string
  contextLength?: number | null
  /** USD per 1M input / output tokens, when the provider publishes it. */
  priceIn?: number | null
  priceOut?: number | null
  /** Short labels the picker can filter on, e.g. "JSON", "Gratis", "Gambar". */
  tags: string[]
  /** Model family, e.g. "Kling", for a brand mark next to the name. */
  family?: string
  /** Provider credits for one request (Higgsfield credits, NexaBot credits when `creditCurrency` is 'Rp', kie.ai credits otherwise with `usd` set); undefined while unknown, null when it cannot be estimated. */
  credits?: number | null
  usd?: number | null
  /** Currency the `credits` number is priced in. Default is Higgsfield credits ("kr"); 'Rp' is NexaBot credits at Rp1.000 each. */
  creditCurrency?: 'Rp'
  /** What the credits pay for, e.g. "10 dtk". */
  creditUnit?: string
}

export interface ModelList {
  models: ModelOption[]
  fetchedAt: number
}

export interface ExportOptions {
  fileName: string
  resolution: 720 | 1080 | 2160
  fps: 30 | 60
  burnCaptions: boolean
  writeSrt: boolean
  normalizeAudio: boolean
  duckMusic: boolean
  folder: string
}

export interface ClipPatchEvent {
  clipId: string
  patch: Partial<Clip>
}

export interface CharacterPatchEvent {
  characterId: string
  patch: Partial<Character>
}
