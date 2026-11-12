import type { AspectRatio } from './types'
import type { HfModel } from './higgsfield'

/**
 * Google Flow models served through a self-hosted Flow2API server (tier 1, 0.3+).
 * The catalog mirrors De-Story's `flow2api.rs` (pattern only, rewritten here), checked
 * against the flow2api server's own model table (Nov 2026): Veo image-to-video is 4/6 s,
 * Omni 1.2 Flash is the current default (1.1 retires 2026-12-05), Nano Banana 2.1 is the
 * default image model. Resolution is the server default in tier 1; the server's 2K/4K
 * variants are post-generation upscales, not separate request parameters.
 */

export const FLOW_DEFAULT_BASE_URL = 'http://localhost:8000'

/** Timeouts from De-Story's client: image 300 s, video 600 s, result download 180 s, probe 8 s. */
export const FLOW_TIMEOUTS = { image: 300_000, video: 600_000, download: 180_000, test: 8_000 } as const

export const FLOW_IMAGE_MODELS: HfModel[] = [
  {
    id: 'flow:gemini-3.1-flash-image',
    name: 'Nano Banana 2.1 (Flash)',
    family: 'Google Flow',
    kind: 'image',
    input: { field: 'image', mode: 'reference', max: 3 },
    required: ['prompt'],
    props: {
      prompt: { type: 'string', maxLength: 4000 },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:3', '3:4'], default: '16:9' }
    },
    durations: null,
    tags: ['Google Flow', 'Referensi', 'Cepat']
  },
  {
    id: 'flow:gemini-3.1-flash-lite-image',
    name: 'Nano Banana 2 Lite',
    family: 'Google Flow',
    kind: 'image',
    input: { field: 'image', mode: 'reference', max: 1 },
    required: ['prompt'],
    props: {
      prompt: { type: 'string', maxLength: 4000 },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], default: '16:9' }
    },
    durations: null,
    tags: ['Google Flow', 'Ringan', 'Cepat']
  },
  {
    id: 'flow:gemini-3.0-pro-image',
    name: 'Banana Pro',
    family: 'Google Flow',
    kind: 'image',
    input: { field: 'image', mode: 'reference', max: 2 },
    required: ['prompt'],
    props: {
      prompt: { type: 'string', maxLength: 4000 },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], default: '16:9' }
    },
    durations: null,
    tags: ['Google Flow', 'Pro', 'Artistik']
  }
]

export const FLOW_VIDEO_MODELS: HfModel[] = [
  {
    id: 'flow:veo-3.1-fast',
    name: 'Veo 3.1 Fast',
    family: 'Google Flow',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    durations: { values: [4, 6] },
    tags: ['Google Flow', 'Veo', 'Cepat']
  },
  {
    id: 'flow:veo-3.1-quality',
    name: 'Veo 3.1 Quality',
    family: 'Google Flow',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    durations: { values: [4, 6] },
    tags: ['Google Flow', 'Veo', 'Kualitas']
  },
  {
    id: 'flow:veo-3.1-lite',
    name: 'Veo 3.1 Lite',
    family: 'Google Flow',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2000 } },
    durations: { values: [4, 6] },
    tags: ['Google Flow', 'Veo', 'Ringan']
  },
  {
    id: 'flow:omni-1.2-flash',
    name: 'Omni 1.2 Flash',
    family: 'Google Flow',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    durations: { values: [4, 6, 8, 10] },
    tags: ['Google Flow', 'Omni', 'Dinamis']
  }
]

export function isFlowModelId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('flow:')
}

/**
 * Maps an old `flow:` id onto the name the server serves now, so saved projects keep
 * resolving. Unrelated ids pass through untouched. Omni 1.1 Flash retires upstream on
 * 2026-12-05, so it maps forward to 1.2.
 */
export function canonicalFlowId(id: string): string {
  const rest = id.startsWith('flow:') ? id.slice('flow:'.length) : null
  if (rest === null) return id
  const mapped =
    rest === 'nano-banana-2'
      ? 'gemini-3.1-flash-image'
      : rest === 'nano-banana-2-lite'
        ? 'gemini-3.1-flash-lite-image'
        : rest === 'nano-banana-pro'
          ? 'gemini-3.0-pro-image'
          : rest === 'omni-flash' || rest === 'omni-1.1-flash'
            ? 'omni-1.2-flash'
            : rest
  return `flow:${mapped}`
}

/** KenStory projects are landscape or portrait only, so the suffix has two cases. */
export function flowAspectSuffix(aspect: AspectRatio): string {
  return aspect === '9:16' ? '-portrait' : '-landscape'
}

/** The image model name the server serves: base id + aspect suffix (unless already present). */
export function flowImageModelName(model: HfModel, aspect: AspectRatio): string {
  const raw = model.id.slice('flow:'.length)
  const suffix = flowAspectSuffix(aspect)
  return raw.endsWith(suffix) || raw.includes('-landscape') || raw.includes('-portrait') || raw.includes('-square') || raw.includes('-four-three') || raw.includes('-three-four')
    ? raw
    : `${raw}${suffix}`
}

/**
 * The video model name the server serves. Veo takes the `-i2v-{sec}s-{aspect}` infix
 * (4/6 s only); Omni takes a plain `-{sec}s-{aspect}` suffix (4/6/8/10 s).
 */
export function flowVideoModelName(model: HfModel, seconds: number, aspect: AspectRatio): string {
  const raw = model.id.slice('flow:'.length)
  const orientation = aspect === '9:16' ? 'portrait' : 'landscape'
  if (raw.startsWith('veo-')) {
    const sec = seconds <= 5 ? 4 : 6
    return raw.includes('-i2v-') ? raw : `${raw}-i2v-${sec}s-${orientation}`
  }
  const sec = seconds <= 5 ? 4 : seconds <= 7 ? 6 : seconds <= 9 ? 8 : 10
  return `${raw}-${sec}s-${orientation}`
}
