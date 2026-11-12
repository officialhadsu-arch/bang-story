import type { HfModel } from './higgsfield'

/**
 * NexaBot models (nexabot.id, tier 3, 0.3+): a cheap pay-as-you-go REST API
 * (1 credit = Rp1.000, verified from the nexabot.id homepage, 12 Nov 2026).
 *
 * The prices below are the verified homepage rates — video Rp200–300, Omni
 * Flash 1.2 Rp300 — NOT the Rp400/video figure the v2.1 concept recorded
 * (that figure no longer applies; the tutorial must say Rp300).
 *
 * The API itself is undocumented in public: endpoint paths, auth scheme,
 * request/response shapes, rate limits and error codes are LABELLED
 * ASSUMPTIONS in `src/main/services/nexabot.ts` (D3-01). Only the catalog
 * lives here, so a live-test correction touches the transport, not this file.
 */

export const NEXA_DEFAULT_BASE_URL = 'https://api.nexabot.id'

/** Timeouts mirror the Flow2API client: image 300 s, video 600 s, result download 180 s, probe 8 s. */
export const NEXA_TIMEOUTS = { image: 300_000, video: 600_000, download: 180_000, test: 8_000 } as const

/** One NexaBot credit in Rupiah (homepage: 1 kredit = Rp1.000). */
export const NEXA_CREDIT_IDR = 1000

export const NEXA_IMAGE_MODELS: HfModel[] = [
  {
    id: 'nexabot:nano-banana-pro',
    name: 'Nano Banana Pro',
    family: 'NexaBot',
    kind: 'image',
    input: { field: 'image', mode: 'reference', max: 3 },
    required: ['prompt'],
    props: {
      prompt: { type: 'string', maxLength: 4000 },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:3', '3:4'], default: '16:9' }
    },
    durations: null,
    tags: ['NexaBot', 'Referensi', 'Pro']
  },
  {
    id: 'nexabot:gpt-image-2.5',
    name: 'GPT Image 2.5',
    family: 'NexaBot',
    kind: 'image',
    input: { field: 'image', mode: 'reference', max: 1 },
    required: ['prompt'],
    props: {
      prompt: { type: 'string', maxLength: 4000 },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], default: '16:9' }
    },
    durations: null,
    tags: ['NexaBot', 'Referensi']
  }
]

export const NEXA_VIDEO_MODELS: HfModel[] = [
  {
    id: 'nexabot:omni-flash-1.2',
    name: 'Omni Flash 1.2',
    family: 'NexaBot',
    kind: 'video',
    input: { field: 'image', mode: 'first-frame', max: 1 },
    required: ['prompt', 'image'],
    props: { prompt: { type: 'string', maxLength: 2500 } },
    // Homepage says the web tool makes up to 10 s; the live references that use
    // the API (PAWARNA, tokogame.ai.id) make 15 s per generate. The live test
    // decides which is right; the duration lives only in the catalog (D3-02).
    durations: { values: [15] },
    tags: ['NexaBot', 'Omni', 'Cepat']
  }
]

/** NexaBot credits per generate, from the verified homepage rates. */
export const NEXA_CREDITS: Record<string, number> = {
  'nexabot:nano-banana-pro': 0.15,
  'nexabot:gpt-image-2.5': 0.1,
  'nexabot:omni-flash-1.2': 0.3
}

export function isNexaModelId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('nexabot:')
}

export function getNexaImageModel(id: string | null | undefined): HfModel {
  return NEXA_IMAGE_MODELS.find((m) => m.id === id) ?? NEXA_IMAGE_MODELS[0]
}

export function getNexaVideoModel(id: string | null | undefined): HfModel {
  return NEXA_VIDEO_MODELS.find((m) => m.id === id) ?? NEXA_VIDEO_MODELS[0]
}

/** NexaBot credits for one generate with this model, or null for a model that is not NexaBot. */
export function nexaCredits(modelId: string): number | null {
  return NEXA_CREDITS[modelId] ?? null
}

/** Fixed Rupiah price for one generate with this model (1 credit = Rp1.000), or null when not a NexaBot model. */
export function nexaPriceIdr(modelId: string): number | null {
  const credits = nexaCredits(modelId)
  return credits === null ? null : Math.round(credits * NEXA_CREDIT_IDR)
}

/** Rupiah, formatted the Indonesian way (Rp300, Rp1.500). */
export function idrLabel(n: number): string {
  return `Rp${Math.round(n).toLocaleString('id-ID')}`
}
