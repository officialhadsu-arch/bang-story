import { useEffect, useState } from 'react'
import { Check, Clapperboard, FolderOpen, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { MOTION_EASINGS, type MotionBabakStatus, type RenderBabakResult } from '@shared/motion-contract'
import type { MotionTemplate } from '@shared/motion-templates'
import { Badge, Button, cx } from '../../components/ui'
import { Select } from '../../components/Select'
import { errorText, mmss } from '../../lib/format'
import { useApp } from '../../store/app'
import { useProject } from '../../store/project'

/**
 * Rancangan (Fase 4): step 3 for motion scenes. One card per babak: its
 * beats with keyframes, approve/redo per beat, the per-beat easing override,
 * the whole-babak render, and the project style override. Export stops
 * (gerbang Tahap 1) while any motion beat is unapproved — that is enforced
 * in the exporter, and this page is where the approval happens.
 */
export function RancanganStep() {
  const { project, load } = useProject()
  const { toast } = useApp()
  const [babakIds, setBabakIds] = useState<string[]>([])
  const [statuses, setStatuses] = useState<Record<string, MotionBabakStatus>>({})
  const [templates, setTemplates] = useState<MotionTemplate[]>([])
  const [styleOverride, setStyleOverride] = useState('')
  const [rendering, setRendering] = useState<string | null>(null)
  const [rendered, setRendered] = useState<Record<string, RenderBabakResult>>({})
  const [busy, setBusy] = useState(false)

  const refresh = async (): Promise<void> => {
    if (!project) return
    const ids = await window.api.motion.listBabak(project.id)
    setBabakIds(ids)
    const next: Record<string, MotionBabakStatus> = {}
    for (const id of ids) next[id] = await window.api.motion.getBabak(project.id, id)
    setStatuses(next)
    setTemplates(await window.api.motion.getTemplates())
    setStyleOverride((await window.api.motion.getStyleOverride(project.id)) ?? '')
  }

  useEffect(() => {
    void refresh().catch((e) => toast('error', errorText(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  if (!project) return null

  const run = async (fn: () => Promise<void>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const prepareFolder = async (styleId?: string): Promise<void> => {
    setBusy(true)
    try {
      const r = await window.api.motion.prepareWorkFolder(project.id, styleId)
      await refresh()
      toast(
        'success',
        r.babakIds.length
          ? `Folder motion siap (${r.babakIds.join(', ')}).${r.missing.length ? ` ${r.missing.length} catatan: ${r.missing[0]}` : ''}`
          : 'Belum ada adegan motion di proyek ini.'
      )
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const applyPreset = async (preset: 'penuh' | 'hybrid'): Promise<void> => {
    await run(async () => {
      const changed = await window.api.motion.applyPreset(project.id, preset)
      load(await window.api.projects.get(project.id))
      toast('success', preset === 'penuh' ? `${changed} adegan diubah ke Motion.` : 'Hybrid: pilih adegan kunci satu per satu di Jalur visual.')
    })
  }

  const approve = async (babakId: string, beatId: string, status: 'approved' | 'redo' | 'pending'): Promise<void> => {
    await run(async () => {
      await window.api.motion.approveBeat(project.id, babakId, beatId, status)
      const fresh = await window.api.motion.getBabak(project.id, babakId)
      setStatuses((s) => ({ ...s, [babakId]: fresh }))
    })
  }

  const overrideEasing = async (babakId: string, beatId: string, easing: string | null): Promise<void> => {
    await run(async () => {
      await window.api.motion.overrideEasing(project.id, babakId, beatId, easing)
      const fresh = await window.api.motion.getBabak(project.id, babakId)
      setStatuses((s) => ({ ...s, [babakId]: fresh }))
    })
  }

  const renderBabak = async (babakId: string): Promise<void> => {
    setRendering(babakId)
    try {
      const r = await window.api.motion.renderBabak(project.id, babakId)
      setRendered((m) => ({ ...m, [babakId]: r }))
      toast(
        'success',
        `Babak ${babakId} selesai dirender: ${r.frames} frame, ${r.durationSec.toFixed(1)} dtk${r.mismatches ? `, ${r.mismatches} frame tidak stabil` : ', semua frame stabil'}.`
      )
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setRendering(null)
    }
  }

  const saveStyle = async (): Promise<void> => {
    await run(async () => {
      const affected = await window.api.motion.saveStyleOverride(project.id, styleOverride)
      await refresh()
      toast(
        'success',
        affected.length
          ? `Timpa gaya disimpan. Beat yang sudah disetujui di ${affected.join(', ')} ditandai "redo" — Tahap 2 perlu diulang untuk beat itu.`
          : 'Timpa gaya disimpan.'
      )
    })
  }

  const stageLabel = (stage: number): { label: string; tone: 'draft' | 'warn' | 'ok' } =>
    stage === 2
      ? { label: 'Tahap 2 selesai — siap render', tone: 'ok' }
      : stage === 1
        ? { label: 'Tahap 1 — menunggu persetujuan', tone: 'warn' }
        : { label: 'Belum ada beats.json', tone: 'draft' }

  return (
    <section className="scroll-thin flex min-h-0 flex-col gap-3.5 overflow-y-auto px-6 pb-6 pt-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="shrink-0 font-display text-2xl font-bold">Rancangan</h1>
        <span className="shrink-0 whitespace-nowrap text-sm text-muted">
          {babakIds.length} babak · motion dirender aplikasi dari kode HTML+GSAP
        </span>
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => void applyPreset('penuh')}>
          Motion Grafik penuh
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void applyPreset('hybrid')}>
          Hybrid (adegan kunci saja)
        </Button>
        <Button size="sm" icon={<RefreshCw className="size-4" />} loading={busy} onClick={() => void prepareFolder()}>
          Perbarui Folder Motion
        </Button>
        <Button size="sm" variant="ghost" icon={<FolderOpen className="size-4" />} onClick={() => void window.api.motion.openWorkFolder(project.id)}>
          Buka Folder Motion
        </Button>
      </div>

      <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink-2">
        Agent menulis babak (HTML+GSAP + beats.json) di folder <span className="font-mono text-[13px]">motion-work/</span>, kamu menyetujui tiap
        beat di sini, lalu aplikasi merender MP4-nya — tanpa biaya dari aplikasi (agent memakai langgananmu sendiri).{' '}
        <strong className="text-ink">Ekspor berhenti bila ada beat motion yang belum disetujui.</strong> Pada adegan motion, efek otomatis,
        gerak kamera, dan transisi editor tidak dipakai.
      </p>

      {babakIds.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-3 bg-surface px-4 py-6 text-center text-sm text-ink-2">
          Belum ada babak. Tekan <strong className="text-ink">Perbarui Folder Motion</strong> untuk menyiapkan folder kerja agent, lalu minta
          agent menulis Tahap 1 (beats.json + frame kunci).
        </div>
      )}

      {babakIds.map((babakId) => {
        const st = statuses[babakId]
        const stage = st ? stageLabel(st.stage) : null
        const video = rendered[babakId]
        return (
          <div key={babakId} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-bold">{babakId}</span>
              {stage && <Badge tone={stage.tone}>{stage.label}</Badge>}
              {st && <span className="text-[13px] text-muted">{st.approved} dari {st.total} beat disetujui</span>}
              <div className="flex-1" />
              <Button
                size="sm"
                variant="primary"
                icon={<Play className="size-4" />}
                loading={rendering === babakId}
                disabled={!st || st.stage !== 2}
                title={st?.stage === 2 ? 'Render seluruh babak ke MP4 untuk pratinjau' : 'Tahap 2 harus selesai dulu (act-*.js + style.js + index.html)'}
                onClick={() => void renderBabak(babakId)}
              >
                {rendering === babakId ? 'Merender…' : 'Render babak'}
              </Button>
            </div>
            {st && [...st.errors, ...st.htmlErrors].map((e) => (
              <p key={e} className="text-[13px] leading-relaxed text-bad-ink">Galat: {e}</p>
            ))}
            {st && st.missing.map((m) => (
              <p key={m} className="text-[13px] leading-relaxed text-sun-ink">{m}</p>
            ))}
            {video && (
              <div className="flex flex-col gap-2">
                <video
                  src={`studio://asset/${project.id}/motion-work/out/${babakId}/render/babak.mp4`}
                  controls
                  className="max-h-[320px] w-full rounded-xl bg-paper object-contain"
                />
                <p className="text-xs text-muted">
                  {video.frames} frame · {video.durationSec.toFixed(1)} dtk · {video.width}×{video.height} · {video.format.toUpperCase()} ·{' '}
                  {video.mismatches === 0 ? 'semua frame stabil (double-verify)' : `${video.mismatches} frame tidak stabil — lihat laporan`}
                  {video.ramRendererPeakMb !== null ? ` · puncak RAM renderer ${video.ramRendererPeakMb} MB` : ''}
                </p>
              </div>
            )}
            {st?.beats?.beats.map((beat) => (
              <div key={beat.id} className="flex gap-3 border-t border-dashed border-line pt-3">
                <img
                  src={`studio://asset/${project.id}/motion-work/out/${babakId}/${beat.keyframe}`}
                  alt={`Frame kunci ${beat.id}`}
                  className="h-[72px] w-[128px] shrink-0 rounded-lg border border-line bg-paper object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold">{beat.id}</span>
                    <span className="text-xs text-muted">adegan {beat.sceneKey}</span>
                    <span className="text-xs text-muted">{mmss(beat.startSec * 1000)} – {mmss(beat.endSec * 1000)}</span>
                    <Badge tone={beat.status === 'approved' ? 'ok' : beat.status === 'redo' ? 'bad' : 'draft'}>
                      {beat.status === 'approved' ? 'Disetujui' : beat.status === 'redo' ? 'Minta ulang' : 'Menunggu'}
                    </Badge>
                  </div>
                  <p className="truncate text-[13px]">{beat.narration}</p>
                  <p className="truncate text-xs text-muted">{beat.motionPrompt}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-[220px]">
                      <Select
                        label={`Easing ${beat.id}`}
                        value={beat.easingOverride ?? ''}
                        onChange={(v) => void overrideEasing(babakId, beat.id, v === '' ? null : v)}
                        options={[
                          { value: '', label: `Bawaan (${beat.easing})` },
                          ...MOTION_EASINGS.map((e) => ({ value: e, label: e }))
                        ]}
                      />
                    </div>
                    {beat.status !== 'approved' && (
                      <Button size="sm" icon={<Check className="size-4" />} onClick={() => void approve(babakId, beat.id, 'approved')}>
                        Setujui
                      </Button>
                    )}
                    {beat.status !== 'redo' && (
                      <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => void approve(babakId, beat.id, 'redo')}>
                        Minta ulang
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Pustaka template gaya</span>
          <span className="text-[13px] text-muted">gaya Berat (WebGL) terkunci sampai diukur di Fase 4</span>
        </div>
        <div className="grid gap-2.5 md:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className={cx('flex flex-col gap-1 rounded-xl border px-3.5 py-3', t.heavy ? 'border-line bg-paper opacity-60' : 'border-line bg-paper')}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{t.name}</span>
                {t.heavy && <Badge tone="draft">Terkunci — belum diukur</Badge>}
              </div>
              <p className="text-[13px] leading-relaxed text-ink-2">{t.description}</p>
              <p className="text-xs text-muted">Starter bang-motion: {t.starter}</p>
              {!t.heavy && (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => void prepareFolder(t.id)}>
                    Pakai gaya ini
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
        <span className="font-semibold">Timpa gaya proyek (style.js)</span>
        <p className="text-[13px] leading-relaxed text-ink-2">
          Ubah gaya hanya untuk proyek ini. Menyimpan menandai semua beat yang sudah disetujui jadi “redo” — Tahap 2 perlu diulang untuk
          beat itu. Mengubah pustaka di atas tidak menyentuh proyek yang sudah jadi.
        </p>
        <textarea
          value={styleOverride}
          onChange={(e) => setStyleOverride(e.target.value)}
          rows={6}
          spellCheck={false}
          aria-label="Timpa gaya proyek"
          className="w-full rounded-xl border border-line-2 bg-paper px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-ink"
        />
        <div>
          <Button size="sm" icon={<Clapperboard className="size-4" />} onClick={() => void saveStyle()}>
            Simpan timpa gaya
          </Button>
        </div>
      </div>
    </section>
  )
}
