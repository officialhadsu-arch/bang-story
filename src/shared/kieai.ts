import type { HfModel } from './higgsfield'

/**
 * kie.ai models (kie.ai, tier 4, 0.3+): a premium pay-as-you-go REST API
 * (1 credit ≈ $0.005, verified from kie.ai/pricing, 13 Nov 2026).
 *
 * kie.ai is NOT cheaper than NexaBot for overlapping models — NexaBot is
 * 5–11x cheaper per image/video. kie.ai's value is the breadth of its
 * catalog (Veo 3.1, Seedance, Kling, Wan, Grok), so tier 4 is the premium
 * tier: NexaBot stays the cheapest paid path, kie.ai only for models that
 * exist nowhere else. Omni Flash 1.2 is deliberately NOT in this catalog
 * (NexaBot offers it at Rp300 vs kie.ai's Rp2.912 per 8 s clip).
 *
 * Prices below are the verified kie.ai/pricing rates at Rp18.200/USD
 * (13 Nov 2026 — the rate is for comparison only; kie.ai bills in USD).
 * Failed tasks are not billed (kie.ai/pricing); new users get 80 free
 * credits. Top-up minimum ±$5 and the refund policy are NOT verified from
 * a primary source yet (billing page needs login) — see docs/kieai-pemetaan.md.
 *
 * ── LABELLED ASSUMPTIONS (K4-01) ───────────────────────────────────────
 * The exact `model` strings and per-model `input` shapes are NOT in the
 * public Getting Started docs (each model documents its own page). The
 * strings in KIE_API_MODEL below are best-guess slugs, and the input
 * shapes live in `src/main/services/kieai.ts` — both must be confirmed or
 * corrected by the first live PC test (docs/kieai-pemetaan.md §7). Only
 * the catalog lives here, so a live-test correction touches the transport,
 * not this file.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const KIE_DEFAULT_BASE_URL = 'https://api.kie.ai'

/** Timeouts mirror the NexaBot client: image 300 s, video 600 s, result download 180 s, probe 8 s. */
export const KIE_TIMEOUTS = { image: 300_000, video: 600_000, download: 180_000, test: 8_000 } as const

/** Rupiah per USD at research time (13 Nov 2026) — comparison only, kie.ai bills in USD. */
export const KIE_USD_TO_IDR = 18200

/** One kie.ai credit in USD (kie.ai/pricing: 200 credits = $1). */
export const KIE_CREDIT_USD = 0.005

/** One kie.ai credit in Rupiah at the catalog rate (0.005 × 18.200). */
export const KIE_CREDIT_IDR = 91

/**
 * Assumed kie.ai `model` strings sent to createTask / veo/generate.
 * Best guesses from the `provider/model` pattern kie.ai documents
 * (e.g. `google/gemini-2-5-pro-tts`); NOT verified — live test §7 item 2.
 */
export const KIE_API_MODEL: Record<string, string> = {
  'kieai:gpt-image-2-5': 'openai/gpt-image-2.5',
  'kieai:nano-banana-2': 'google/gemini-3-1-flash-image',
  'kieai:nano-banana-pro': 'google/gemini-3-pro-image',
  'kieai:veo-3-1-lite': 'google/veo-3.1-lite',
  'kieai:veo-3-1-fast': 'google/veo-3.1-fast',
  'kieai:veo-3-1-quality': 'google/veo-3.1-quality',
  'kieai:seedance-2-5': 'bytedance/seedance-2.5',
  'kieai:kling-3-0': 'kling/kling-3.0',
  'kieai:grok-imagine-720p': 'xai/grok-imagine'
}

/**
 * Reference images are NOT sent in tier 4 (maxRefs 0): whether kie.ai
 * accepts data-URI / URL references, and through which field, is an open
 * live-test item (docs/kieai-pemetaan.md §7 item 5). The UI therefore
 * honestly says "tanpa lembar karakter" for kie.ai image models.
 */
export const KIE_IMAGE_MODELS: HfModel[] = [
  {
    id: 'kieai:gpt-image-2-5',
    name: 'GPT Image 2.5',
    family: 'Kie.ai',
    kind: 'image',
    input: { field: null, mode: 'none', max: 0 },
    required: ['prompt'],
    props: {
      prompt: { type: 'string', maxLength: 4000 },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], default: '16:9' }
    },
    durations: null,
    tags: ['Kie.ai', 'GPT Image']
  },
  {
    id: 'kieai:nano-banana-2',
    name: 'Nano Banana 2',
    family: 'Kie.ai',
    kind: 'image',
    input: { field: null, mode: 'none', max: 0 },
    required: ['prompt'],
    props: {
      prompt: { type: 'string', maxLength: 4000 },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], default: '16:9' }
    },
    durations: null,
    tags: ['Kie.ai']
  },
  {
    id: 'kieai:nano-banana-pro',
    name: 'Nano Banana Pro',
    family: 'Kie.ai',
    kind: 'image',
    input: { field: null, mode: 'none', max: 0 },
    required: ['prompt'],
    props: {
      prompt: { type: 'string', maxLength: 4000 },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], default: '16:9' }
    },
    durations: null,
    tags: ['Kie.ai', 'Pro']
  }
]

export const KIE_VIDEO_MODELS: HfModel[] = [
  {
    id: 'kieai:veo-3-1-lite',
    name: 'Veo 3.1 Lite',
    family: 'Kie.ai',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    // Veo 3.1 makes 8 s clips (kie.ai/pricing); the Veo endpoint is separate (K4-01).
    durations: { values: [8] },
    tags: ['Kie.ai', 'Veo', 'Google']
  },
  {
    id: 'kieai:veo-3-1-fast',
    name: 'Veo 3.1 Fast',
    family: 'Kie.ai',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    durations: { values: [8] },
    tags: ['Kie.ai', 'Veo', 'Google']
  },
  {
    id: 'kieai:veo-3-1-quality',
    name: 'Veo 3.1 Quality',
    family: 'Kie.ai',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    durations: { values: [8] },
    tags: ['Kie.ai', 'Veo', 'Google']
  },
  {
    id: 'kieai:seedance-2-5',
    name: 'Seedance 2.5',
    family: 'Kie.ai',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    // Priced per second; the clip's own length is requested (no fixed durations).
    durations: null,
    tags: ['Kie.ai', 'Seedance']
  },
  {
    id: 'kieai:kling-3-0',
    name: 'Kling 3.0',
    family: 'Kie.ai',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    durations: null,
    tags: ['Kie.ai', 'Kling']
  },
  {
    id: 'kieai:grok-imagine-720p',
    name: 'Grok Imagine',
    family: 'Kie.ai',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    durations: null,
    tags: ['Kie.ai', 'Grok']
  }
]

/** USD price per generate: a fixed per-clip price, or a per-second rate. */
export const KIE_PRICES: Record<string, { usd: number; perSecond: boolean }> = {
  'kieai:gpt-image-2-5': { usd: 0.03, perSecond: false },
  'kieai:nano-banana-2': { usd: 0.04, perSecond: false },
  'kieai:nano-banana-pro': { usd: 0.09, perSecond: false },
  'kieai:veo-3-1-lite': { usd: 0.175, perSecond: false },
  'kieai:veo-3-1-fast': { usd: 0.325, perSecond: false },
  'kieai:veo-3-1-quality': { usd: 1.275, perSecond: false },
  'kieai:seedance-2-5': { usd: 0.085, perSecond: true },
  'kieai:kling-3-0': { usd: 0.0755, perSecond: true },
  'kieai:grok-imagine-720p': { usd: 0.0225, perSecond: true }
}

export function isKieModelId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('kieai:')
}

/** Veo 3.1 uses its own endpoints (`/api/v1/veo/*`) instead of the combined jobs API. */
export function isKieVeoModelId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('kieai:veo-')
}

export function getKieImageModel(id: string | null | undefined): HfModel {
  return KIE_IMAGE_MODELS.find((m) => m.id === id) ?? KIE_IMAGE_MODELS[0]
}

export function getKieVideoModel(id: string | null | undefined): HfModel {
  return KIE_VIDEO_MODELS.find((m) => m.id === id) ?? KIE_VIDEO_MODELS[0]
}

/** Whole seconds billed for a per-second model: the clip length, rounded up, at least 1. */
export function kieBillSeconds(durationMs?: number): number {
  return Math.max(1, Math.ceil((durationMs ?? 0) / 1000))
}

/** USD price for one generate with this model, or null for a model that is not kie.ai. */
export function kieaiUsd(modelId: string, durationMs?: number): number | null {
  const price = KIE_PRICES[modelId]
  if (!price) return null
  return price.perSecond ? price.usd * kieBillSeconds(durationMs) : price.usd
}

/** kie.ai credits for one generate with this model (1 credit ≈ $0.005), or null when not kie.ai. */
export function kieaiCredits(modelId: string, durationMs?: number): number | null {
  const usd = kieaiUsd(modelId, durationMs)
  return usd === null ? null : usd / KIE_CREDIT_USD
}

/** Rupiah price for one generate with this model at the catalog rate, or null when not kie.ai. */
export function kiePriceIdr(modelId: string, durationMs?: number): number | null {
  const usd = kieaiUsd(modelId, durationMs)
  return usd === null ? null : Math.round(usd * KIE_USD_TO_IDR)
}
