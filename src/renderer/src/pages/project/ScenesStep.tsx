import { ArrowRight, Clapperboard } from 'lucide-react'
import { CAMERA_PRESETS, MOTION_STRENGTHS } from '@shared/motion'
import { COMPOSITIONS } from '@shared/talkinghead'
import { ClipVisual } from '../../components/ClipVisual'
import { Select } from '../../components/Select'
import { Button, Chip } from '../../components/ui'
import { clipNumber, errorText, mmss } from '../../lib/format'
import { useApp } from '../../store/app'
import { useProject } from '../../store/project'

/** Step 3 for talking-head projects (F5-02, Bab 11.5): check each scene's framing and zoom before the editor. */
export function ScenesStep() {
  const { project, clips, assets, updateClip, updateProject, flush } = useProject()
  const { toast } = useApp()
  if (!project) return null

  const totalMs = clips.reduce((n, c) => n + c.durationMs, 0)
  const openTranscript = async (): Promise<void> => {
    await flush()
    updateProject({ step: 2 })
  }

  return (
    <div className="relative h-full">
      <div className="scroll-thin h-full overflow-y-auto pb-28">
        <div className="mx-auto max-w-[1100px] px-14 pt-8">
          <div>
            <p className="text-[13px] font-semibold text-accent">Langkah 3 dari 4</p>
            <h1 className="mt-1.5 font-display text-[40px] font-bold leading-tight tracking-[-0.02em]">Adegan</h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {clips.length
                ? `${clips.length} adegan dari rekaman · ${mmss(totalMs)}. Periksa komposisi tiap adegan — close-up memperbesar 60% frame, zoom otomatis hanya zoom-in halus di tengah frame (tanpa pelacakan wajah).`
                : 'Belum ada adegan. Susun adegan dulu di langkah Transkrip.'}
            </p>
          </div>

          {clips.length === 0 ? (
            <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6">
              <Clapperboard className="size-8 text-muted" />
              <p className="text-[15px] text-ink-2">Adegan dibuat dari transkrip rekaman: impor rekaman, buat transkrip, susun adegan, lalu buat adegan.</p>
              <Button variant="accent" onClick={() => void openTranscript()}>
                Ke langkah Transkrip
              </Button>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-4">
              {clips.map((clip, index) => {
                const video = clip.videoAssetId ? assets[clip.videoAssetId] : null
                const audio = clip.audioAssetId ? assets[clip.audioAssetId] : null
                const words = audio?.meta.words?.length ?? 0
                return (
                  <article
                    key={clip.id}
                    className="flex gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors focus-within:border-ink-2"
                  >
                    <div className="flex w-9 shrink-0 flex-col items-center gap-1 pt-1.5">
                      <span className="rounded-md bg-ink px-[7px] py-0.5 font-mono text-xs text-paper">{clipNumber(index)}</span>
                    </div>
                    <div className="relative aspect-video w-[220px] shrink-0 overflow-hidden rounded-xl border border-line bg-sand">
                      <ClipVisual clip={clip} video={video} playVideo />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          value={clip.title}
                          onChange={(e) => updateClip(clip.id, { title: e.target.value })}
                          aria-label={`Judul adegan ${index + 1}`}
                          placeholder="Judul adegan"
                          className="-ml-1 min-w-0 flex-1 rounded-md bg-transparent px-1 font-display text-lg font-bold outline-none hover:bg-sand focus:bg-sand"
                        />
                        <span className="shrink-0 font-mono text-xs text-muted">
                          {mmss(clip.durationMs)} · {words} kata
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[14px] leading-relaxed text-ink-2">{clip.narration || 'Tanpa narasi.'}</p>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-ink-2">Komposisi</span>
                        <div className="flex flex-wrap gap-1.5">
                          {COMPOSITIONS.map((c) => (
                            <Chip key={c.id} on={(clip.composition ?? 'penuh') === c.id} onClick={() => updateClip(clip.id, { composition: c.id })} title={c.hint}>
                              {c.label}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div className="grid max-w-[520px] grid-cols-[minmax(0,1fr)_120px] gap-2">
                        <Select
                          label="Zoom otomatis"
                          size="sm"
                          value={clip.videoCamera ?? 'static'}
                          onChange={(v) => updateClip(clip.id, { videoCamera: v })}
                          options={[{ value: 'static' as const, label: 'Diam (tanpa zoom)' }, ...CAMERA_PRESETS.filter((p) => p.id !== 'static').map((p) => ({ value: p.id, label: p.label }))]}
                        />
                        <Select
                          label="Kekuatan zoom"
                          size="sm"
                          value={clip.videoStrength ?? 'halus'}
                          disabled={(clip.videoCamera ?? 'static') === 'static'}
                          onChange={(v) => updateClip(clip.id, { videoStrength: v })}
                          options={MOTION_STRENGTHS.map((m) => ({ value: m.id, label: m.label }))}
                        />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex h-[84px] items-center gap-4 border-t border-line bg-surface px-14">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {clips.length ? `${clips.length} adegan · ${mmss(totalMs)}` : 'Belum ada adegan'}
          </span>
          <span className="text-[13px] text-muted">Komposisi dan zoom bisa diubah lagi di Editor.</span>
        </div>
        <div className="flex-1" />
        <Button size="lg" onClick={() => void openTranscript()}>
          Kembali ke Transkrip
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="h-[50px]"
          disabled={!clips.length}
          icon={<ArrowRight className="size-[18px]" />}
          onClick={() => {
            try {
              updateProject({ step: 4 })
            } catch (e) {
              toast('error', errorText(e))
            }
          }}
        >
          Lanjut ke Editor
        </Button>
      </footer>
    </div>
  )
}
