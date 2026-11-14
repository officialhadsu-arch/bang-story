import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Film, Image as ImageIcon, Move, Users } from 'lucide-react'
import { isFlowModelId } from '@shared/flow2api'
import { effectiveResolution, fitDuration, getImageModel, getVideoModel, hfModelOptions, maxRefs, resolutionOptions } from '@shared/higgsfield'
import { isKieModelId, kieaiCredits, kieaiUsd, kiePriceIdr } from '@shared/kieai'
import { idrLabel, isNexaModelId, nexaCredits, nexaPriceIdr } from '@shared/nexabot'
import type { CreditEstimate, ModelOption, Project } from '@shared/types'
import { ModelLogo } from '../../components/ModelLogo'
import { ModelPicker } from '../../components/ModelPicker'
import { Segmented, Spinner } from '../../components/ui'
import { creditLabel, usdLabel } from '../../lib/format'
import { useEstimate, useEstimates } from '../../lib/useEstimate'

const IMAGE_OPTIONS = hfModelOptions('image')
const VIDEO_OPTIONS = hfModelOptions('video')
const IMAGE_IDS = IMAGE_OPTIONS.map((o) => o.id)
const VIDEO_IDS = VIDEO_OPTIONS.map((o) => o.id)

/** Adds each model's estimated credits to its picker row once a Higgsfield key is known to exist. NexaBot prices come from the fixed catalog instead, so they show even without any key. kie.ai prices also come from the fixed catalog (USD + Rupiah at the catalog rate); per-second video models use `seconds` (the clip length) for their price. */
function withCosts(
  options: ModelOption[],
  costs: Record<string, CreditEstimate | null>,
  unit: (id: string) => string,
  on: boolean,
  seconds?: number
): ModelOption[] {
  return options.map((o) => {
    const nexaPrice = nexaCredits(o.id)
    if (nexaPrice !== null) return { ...o, credits: nexaPrice, usd: null, creditUnit: unit(o.id), creditCurrency: 'Rp' as const }
    const kieCredits = kieaiCredits(o.id, seconds != null ? seconds * 1000 : undefined)
    if (kieCredits !== null)
      return { ...o, credits: kieCredits, usd: kieaiUsd(o.id, seconds != null ? seconds * 1000 : undefined), creditUnit: unit(o.id) }
    if (!on) return o
    return {
      ...o,
      credits: o.id in costs ? (costs[o.id]?.credits ?? null) : undefined,
      usd: costs[o.id]?.usd ?? null,
      creditUnit: unit(o.id)
    }
  })
}

function Cost({
  value,
  hasKey,
  children
}: {
  value: CreditEstimate | null | undefined
  hasKey: boolean | null
  children: (credits: number) => ReactNode
}) {
  if (hasKey === false) return <span className="text-muted">Perkiraan kredit muncul setelah kunci Higgsfield diisi di Pengaturan.</span>
  if (value === undefined)
    return (
      <span className="flex items-center gap-1.5 text-muted">
        <Spinner className="size-3" />
        Menghitung kredit…
      </span>
    )
  if (value === null) return <span className="text-muted">Perkiraan kredit belum tersedia.</span>
  return <span>{children(value.credits)}</span>
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line-2 bg-surface p-3">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        {icon}
        {title}
      </span>
      {children}
    </div>
  )
}

/** Which Higgsfield models draw and animate this project's clips. */
export function ModelSection({
  project,
  clipCount,
  perClip,
  onChange
}: {
  project: Project
  clipCount: number
  perClip: number
  onChange: (patch: { imageModel?: string; videoModel?: string; videoResolution?: string | null }) => void
}) {
  const image = getImageModel(project.imageModel)
  const video = getVideoModel(project.videoModel)
  const imageIsFlow = isFlowModelId(image.id)
  const videoIsFlow = isFlowModelId(video.id)
  const imageIsNexa = isNexaModelId(image.id)
  const videoIsNexa = isNexaModelId(video.id)
  const imageNexaPrice = imageIsNexa ? nexaPriceIdr(image.id) : null
  const videoNexaPrice = videoIsNexa ? nexaPriceIdr(video.id) : null
  const imageIsKie = isKieModelId(image.id)
  const videoIsKie = isKieModelId(video.id)
  const imageKiePrice = imageIsKie ? kiePriceIdr(image.id) : null
  const imageKieUsd = imageIsKie ? kieaiUsd(image.id) : null
  const seconds = fitDuration(video, perClip) ?? perClip
  const videoKiePrice = videoIsKie ? kiePriceIdr(video.id, seconds * 1000) : null
  const videoKieUsd = videoIsKie ? kieaiUsd(video.id, seconds * 1000) : null
  // A per-second model's 1-second price differs from its clip price; a fixed-price model's does not.
  const videoKieRateIdr = videoIsKie ? kiePriceIdr(video.id, 1000) : null
  const videoKieRateUsd = videoIsKie ? kieaiUsd(video.id, 1000) : null
  const videoKiePerSecond = videoKieRateIdr != null && videoKiePrice != null && videoKieRateIdr !== videoKiePrice
  const imageCost = useEstimate('image', image.id, project.aspectRatio)
  const resolutions = resolutionOptions(video)
  const resolution = effectiveResolution(video, project.videoResolution)
  const videoCost = useEstimate('video', video.id, project.aspectRatio, perClip, resolution)
  const [hasKey, setHasKey] = useState<boolean | null>(null)

  useEffect(() => {
    void window.api.settings.keys().then((keys) => setHasKey(!!keys.find((k) => k.provider === 'higgsfield')?.configured))
  }, [])

  const imageCosts = useEstimates('image', IMAGE_IDS, project.aspectRatio, undefined, hasKey === true)
  const videoCosts = useEstimates('video', VIDEO_IDS, project.aspectRatio, perClip, hasKey === true)
  const imageModels = useMemo(() => withCosts(IMAGE_OPTIONS, imageCosts, () => '', hasKey === true), [imageCosts, hasKey])
  const videoModels = useMemo(
    // A model without fixed durations bills the clip's own length, not "null dtk".
    () => withCosts(VIDEO_OPTIONS, videoCosts, (id) => `${fitDuration(getVideoModel(id), perClip) ?? perClip} dtk`, hasKey === true, perClip),
    [videoCosts, perClip, hasKey]
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">Model AI</span>
        <span className="text-[13px] text-muted">
          {IMAGE_OPTIONS.length} model gambar dan {VIDEO_OPTIONS.length} model video dari Higgsfield, Google Flow, NexaBot, dan Kie.ai
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card icon={<ImageIcon className="size-4" />} title="Gambar klip">
          <ModelPicker
            value={image.id}
            models={imageModels}
            footerNote={hasKey ? 'Higgsfield: perkiraan kredit untuk akunmu · NexaBot: harga tetap dalam Rupiah · Kie.ai: harga katalog dalam USD' : undefined}
            renderIcon={(m) => <ModelLogo family={m.family} />}
            detail="description"
            tagFilters={['Rekomendasi', 'Referensi', 'GPT Image', 'Soul', 'Recraft', '4K', 'Google Flow', 'NexaBot', 'Kie.ai']}
            menuClassName="w-[430px]"
            onChange={(id) => onChange({ imageModel: id })}
          />
          <p className="text-[12.5px] leading-snug text-ink-2">
            {imageIsFlow ? (
              'Tanpa estimasi — kredit Google Flow dari langganan AI Pro kamu.'
            ) : imageIsNexa && imageNexaPrice != null ? (
              <>
                ≈ {idrLabel(imageNexaPrice)} per gambar · {clipCount} gambar ≈{' '}
                <b className="font-semibold text-ink">{idrLabel(imageNexaPrice * clipCount)}</b> (NexaBot, harga tetap)
              </>
            ) : imageIsKie && imageKiePrice != null && imageKieUsd != null ? (
              <>
                ≈ {idrLabel(imageKiePrice)} (≈ {usdLabel(imageKieUsd)}) per gambar · {clipCount} gambar ≈{' '}
                <b className="font-semibold text-ink">{idrLabel(imageKiePrice * clipCount)}</b> (Kie.ai, harga katalog — cek NexaBot dulu,
                biasanya lebih murah)
              </>
            ) : (
              <Cost value={imageCost} hasKey={hasKey}>
                {(c) => (
                  <>
                    ≈ {creditLabel(c)} kredit per gambar · {clipCount} gambar ≈ <b className="font-semibold text-ink">{creditLabel(c * clipCount)} kredit</b>
                  </>
                )}
              </Cost>
            )}
          </p>
          <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-muted">
            <Users className="mt-px size-3.5 shrink-0" />
            {maxRefs(image)
              ? 'Pakai lembar karakter, jadi wajah dan kostum tokoh tetap sama di tiap klip.'
              : 'Tanpa lembar karakter, jadi tampilan tokoh bisa sedikit berubah antar klip.'}
          </p>
        </Card>
        <Card icon={<Film className="size-4" />} title="Video AI">
          <ModelPicker
            value={video.id}
            models={videoModels}
            footerNote={hasKey ? `Higgsfield: perkiraan kredit untuk akunmu · NexaBot: harga tetap dalam Rupiah · Kie.ai: harga katalog dalam USD` : undefined}
            renderIcon={(m) => <ModelLogo family={m.family} />}
            detail="description"
            tagFilters={['Rekomendasi', 'Kling', 'Seedance', 'Wan', 'Referensi', '4K', 'Google Flow', 'NexaBot', 'Kie.ai']}
            align="right"
            menuClassName="w-[430px]"
            onChange={(id) => onChange({ videoModel: id })}
          />
          {resolutions.length > 1 ? (
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 text-[12.5px] font-medium text-ink-2">Resolusi</span>
              <Segmented
                size="sm"
                value={resolution ?? resolutions[0]}
                onChange={(v) => onChange({ videoResolution: v })}
                options={resolutions.map((r) => ({ id: r, label: r.toUpperCase() === '4K' || r.toUpperCase() === '2K' ? r.toUpperCase() : r }))}
                className="min-w-0 flex-1"
              />
            </div>
          ) : (
            resolution && <p className="text-[12.5px] text-ink-2">Resolusi {resolution} (satu-satunya pilihan model ini)</p>
          )}
          <p className="text-[12.5px] leading-snug text-ink-2">
            {videoIsFlow ? (
              'Tanpa estimasi — kredit Google Flow dari langganan AI Pro kamu.'
            ) : videoIsNexa && videoNexaPrice != null ? (
              <>
                ≈ {idrLabel(videoNexaPrice)} per video {seconds} detik{resolution ? `, ${resolution}` : ''} (NexaBot, harga tetap)
              </>
            ) : videoIsKie && videoKiePrice != null && videoKieUsd != null ? (
              <>
                ≈ {idrLabel(videoKiePrice)} (≈ {usdLabel(videoKieUsd)}) per video {seconds} detik{resolution ? `, ${resolution}` : ''}
                {videoKiePerSecond && videoKieRateIdr != null && videoKieRateUsd != null && (
                  <>
                    {' '}· {idrLabel(videoKieRateIdr)} (≈ {usdLabel(videoKieRateUsd)})/dtk
                  </>
                )}{' '}
                (Kie.ai, harga katalog)
              </>
            ) : (
              <Cost value={videoCost} hasKey={hasKey}>
                {(c) => (
                  <>
                    ≈ {creditLabel(c)} kredit per video {seconds} detik{resolution ? `, ${resolution}` : ''}
                  </>
                )}
              </Cost>
            )}
          </p>
          <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-muted">
            <Move className="mt-px size-3.5 shrink-0" />
            Hanya untuk klip yang kamu jadikan Video AI. Gerak kamera tetap gratis.
          </p>
        </Card>
      </div>
    </div>
  )
}
