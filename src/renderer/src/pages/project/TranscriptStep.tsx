import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Clapperboard, FileText, Scissors, Sparkles, Upload, Wand2 } from 'lucide-react'
import { DEFAULT_FILLERS, PAUSE_CUT_SEC, computeCuts, findFootage, summarizeTranscript, type ArrangeResult } from '@shared/talkinghead'
import type { WhisperStatus } from '@shared/types'
import { Badge, Button, cx, inputCls } from '../../components/ui'
import { errorText, mmss } from '../../lib/format'
import { useApp } from '../../store/app'
import { isRunning, jobFor, useProject } from '../../store/project'

/** Step 2 for talking-head projects (F5-02, Bab 11.4): import the recording, transcribe it once, mark the cuts, and group it into scenes. */
export function TranscriptStep() {
  const { project, assets, clips, updateProject, flush, load, addAsset, upsertJob } = useProject()
  const { toast, go } = useApp()
  const jobs = useProject((s) => s.jobs)
  const [whisper, setWhisper] = useState<WhisperStatus | null>(null)
  const [busy, setBusy] = useState<'import' | 'arrange' | 'build' | null>(null)
  const [scenes, setScenes] = useState<ArrangeResult | null>(null)
  const [fillerText, setFillerText] = useState('')

  const footage = useMemo(() => findFootage(Object.values(assets)), [assets])
  const audio = footage.audio
  const words = audio?.meta.words ?? []
  const dropped = useMemo(() => new Set(audio?.meta.droppedWordIndexes ?? []), [audio])
  const fillers = audio?.meta.fillerWords ?? DEFAULT_FILLERS
  const cuts = useMemo(() => computeCuts(words, { fillers, dropped: [...dropped] }), [words, fillers, dropped])
  const summary = useMemo(() => summarizeTranscript(words, cuts), [words, cuts])
  const transcribeJob = jobFor(jobs, 'transcribe', {})
  const transcribing = isRunning(transcribeJob)

  useEffect(() => {
    void window.api.whisper.status().then(setWhisper)
  }, [])

  useEffect(() => {
    setFillerText(fillers.join(', '))
  }, [audio?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // A new transcript resets the scene preview; arranging again is cheap.
  useEffect(() => {
    setScenes(null)
  }, [audio?.id, words.length])

  if (!project) return null

  const openSettings = async (): Promise<void> => {
    await flush()
    go({ name: 'settings', back: { name: 'project', id: project.id } })
  }

  const run = async (kind: 'import' | 'arrange' | 'build', fn: () => Promise<void>): Promise<void> => {
    setBusy(kind)
    try {
      await flush()
      await fn()
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const doImport = (): Promise<void> =>
    run('import', async () => {
      const r = await window.api.talkinghead.importFootage(project.id)
      if (!r) return
      addAsset(r.video)
      addAsset(r.audio)
      toast('success', 'Rekaman diimpor. Audionya diekstrak — sekarang buat transkripnya.')
    })

  const doTranscribe = async (): Promise<void> => {
    try {
      await flush()
      const job = await window.api.talkinghead.transcribe(project.id)
      upsertJob(job)
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const toggleWord = async (i: number): Promise<void> => {
    if (!audio) return
    const next = new Set(dropped)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    try {
      addAsset(await window.api.talkinghead.setDroppedWords(audio.id, [...next]))
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const applyFillers = async (): Promise<void> => {
    if (!audio) return
    try {
      addAsset(await window.api.talkinghead.setFillers(audio.id, fillerText.split(',').map((f) => f.trim())))
      toast('success', 'Daftar kata pengisi diterapkan. Tanda potong otomatis diatur ulang.')
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const doArrange = (): Promise<void> =>
    run('arrange', async () => {
      const res = await window.api.talkinghead.arrange(project.id)
      setScenes(res)
      toast('success', `${res.scenes.length} adegan disusun ${res.source === 'llm' ? 'oleh AI' : 'otomatis (AI tidak tersedia)'}. Periksa dulu sebelum dibuat.`)
    })

  const doBuild = (): Promise<void> =>
    run('build', async () => {
      if (!scenes) return
      const bundle = await window.api.talkinghead.buildScenes(project.id, scenes.scenes)
      load(bundle)
      toast('success', `${bundle.clips.length} adegan dibuat dari rekaman. Periksa komposisinya di langkah Adegan.`)
    })

  const setSceneTitle = (k: number, title: string): void => {
    if (!scenes) return
    setScenes({ ...scenes, scenes: scenes.scenes.map((s, i) => (i === k ? { ...s, title } : s)) })
  }

  const whisperReady = whisper?.state === 'ready'
  const wordFlow: { key: string; kind: 'word' | 'pause'; i?: number; gapSec?: number }[] = []
  words.forEach((w, i) => {
    if (i > 0) {
      const gap = w.start - words[i - 1].end
      if (gap > PAUSE_CUT_SEC) wordFlow.push({ key: `p${i}`, kind: 'pause', gapSec: gap })
    }
    wordFlow.push({ key: `w${i}`, kind: 'word', i })
  })

  return (
    <div className="relative h-full">
      <div className="scroll-thin h-full overflow-y-auto pb-28">
        <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_480px] gap-10 px-14 pt-8">
          <div className="flex min-w-0 flex-col gap-[22px]">
            <div>
              <p className="text-[13px] font-semibold text-accent">Langkah 2 dari 4</p>
              <h1 className="mt-1.5 font-display text-[40px] font-bold leading-tight tracking-[-0.02em]">Transkrip rekaman</h1>
              <p className="mt-2 text-[15px] text-ink-2">
                Impor rekaman orang berbicara, kenali kata-katanya sekali dengan Whisper, buang jeda dan kata pengisi, lalu susun jadi adegan.
              </p>
            </div>

            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <h2 className="flex items-center gap-2 font-display text-[20px] font-bold">
                <Upload className="size-5" /> 1 · Rekaman
              </h2>
              {footage.video ? (
                <p className="text-[14px] leading-relaxed text-ink-2">
                  <strong className="text-ink">{footage.video.prompt}</strong> · {mmss(footage.video.durationMs ?? 0)} ·{' '}
                  {footage.video.width}×{footage.video.height}. Impor ulang mengganti rekaman (adegan lama jadi basi, seperti visual yang berubah).
                </p>
              ) : (
                <p className="text-[14px] leading-relaxed text-ink-2">Belum ada rekaman. Pilih satu file video ceramah atau orang berbicara (MP4, MOV, atau WebM).</p>
              )}
              <div>
                <Button variant={footage.video ? 'secondary' : 'accent'} loading={busy === 'import'} icon={<Clapperboard className="size-4" />} onClick={() => void doImport()}>
                  {footage.video ? 'Ganti rekaman' : 'Impor rekaman'}
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <h2 className="flex items-center gap-2 font-display text-[20px] font-bold">
                <FileText className="size-5" /> 2 · Transkrip
              </h2>
              {!footage.audio ? (
                <p className="text-[14px] text-ink-2">Impor rekaman dulu — audionya diekstrak otomatis saat impor.</p>
              ) : words.length === 0 ? (
                <>
                  <p className="text-[14px] leading-relaxed text-ink-2">
                    Audio rekaman siap ({mmss(footage.audio.durationMs ?? 0)}). Whisper lokal mengenali kata per kata beserta waktunya — tanpa
                    kunci API, tanpa biaya.
                  </p>
                  {!whisperReady && (
                    <p className="text-[13px] leading-relaxed text-sun-ink">
                      Model Whisper belum diunduh ({whisper?.state ?? '…'}). Unduh dulu di Pengaturan, bagian Caption akurat.
                      <button type="button" onClick={() => void openSettings()} className="ml-1 font-semibold text-accent-dark hover:underline">
                        Buka Pengaturan
                      </button>
                    </p>
                  )}
                  <div>
                    <Button variant="accent" loading={transcribing} disabled={!whisperReady} icon={<Sparkles className="size-4" />} onClick={() => void doTranscribe()}>
                      {transcribing ? 'Mengenali kata…' : 'Buat transkrip'}
                    </Button>
                  </div>
                  {transcribeJob && !transcribing && transcribeJob.status === 'failed' && (
                    <p className="text-[13px] text-bad-ink">{transcribeJob.error}</p>
                  )}
                  {transcribing && (
                    <p className="text-[13px] text-ink-2">
                      {transcribeJob?.message ?? 'Mengenali kata…'} {Math.round((transcribeJob?.progress ?? 0) * 100)}%
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="ok">{summary.words} kata</Badge>
                    <Badge tone="info">{summary.keptWords} kata terpakai</Badge>
                    <Badge tone="warn">
                      {summary.cutCount} potongan · {summary.cutSec.toFixed(1)} dtk dibuang
                    </Badge>
                    <Badge tone="draft">
                      {summary.keptSec.toFixed(1)} dtk terpakai dari {summary.totalSec.toFixed(1)} dtk
                    </Badge>
                  </div>
                  <p className="text-[13px] leading-relaxed text-ink-2">
                    Klik kata untuk menandai <strong className="text-ink">Buang</strong> / <strong className="text-ink">Biarkan</strong>. Kata yang
                    dicoret tidak masuk adegan dan tidak masuk caption. Jeda di atas {PAUSE_CUT_SEC} detik ditandai ⋯ dan ikut terpotong.
                  </p>
                  <div className="max-h-[320px] overflow-y-auto rounded-xl border border-line bg-paper p-3 leading-loose">
                    {wordFlow.map((f) =>
                      f.kind === 'pause' ? (
                        <span
                          key={f.key}
                          title={`Jeda ${f.gapSec?.toFixed(1)} detik — terpotong`}
                          className="mx-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-amber-800"
                        >
                          ⋯ {f.gapSec?.toFixed(1)} dtk
                        </span>
                      ) : (
                        <button
                          key={f.key}
                          type="button"
                          title={`${words[f.i!].text} · ${words[f.i!].start.toFixed(2)}–${words[f.i!].end.toFixed(2)} dtk — klik untuk ${dropped.has(f.i!) ? 'mengembalikan' : 'membuang'}`}
                          onClick={() => void toggleWord(f.i!)}
                          className={cx(
                            'rounded px-0.5 text-[15px]',
                            dropped.has(f.i!) ? 'bg-amber-100 text-amber-800 line-through decoration-2' : 'hover:bg-sand'
                          )}
                        >
                          {words[f.i!].text}
                        </button>
                      )
                    )}
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-ink-2">Kata pengisi yang otomatis dibuang (pisahkan dengan koma)</span>
                    <span className="flex gap-2">
                      <input value={fillerText} onChange={(e) => setFillerText(e.target.value)} className={inputCls} spellCheck={false} />
                      <Button onClick={() => void applyFillers()}>Terapkan</Button>
                    </span>
                    <span className="text-xs text-muted">Menerapkan daftar baru mengatur ulang tanda Buang/Biarkan ke hasil otomatis.</span>
                  </label>
                  <div>
                    <Button variant="ghost" icon={<Sparkles className="size-4" />} onClick={() => void doTranscribe()}>
                      Buat ulang transkrip
                    </Button>
                  </div>
                </>
              )}
            </section>

            {words.length > 0 && (
              <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                <h2 className="flex items-center gap-2 font-display text-[20px] font-bold">
                  <Wand2 className="size-5" /> 3 · Susun adegan
                </h2>
                <p className="text-[14px] leading-relaxed text-ink-2">
                  AI mengelompokkan transkrip jadi adegan 30–60 detik (judul bisa diubah). Kalau AI tidak tersedia, adegan disusun otomatis
                  dari jeda panjang — tidak ada jalan buntu.
                </p>
                <div>
                  <Button variant="accent" loading={busy === 'arrange'} icon={<Scissors className="size-4" />} onClick={() => void doArrange()}>
                    Susun adegan dengan AI
                  </Button>
                </div>
                {scenes && (
                  <>
                    <p className="text-[13px] text-ink-2">
                      {scenes.scenes.length} adegan · disusun {scenes.source === 'llm' ? 'oleh AI' : 'otomatis (AI tidak tersedia)'}
                    </p>
                    <div className="flex flex-col gap-2">
                      {scenes.scenes.map((s, k) => (
                        <div key={k} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-2.5">
                          <span className="rounded-md bg-ink px-[7px] py-0.5 font-mono text-xs text-paper">{String(k + 1).padStart(2, '0')}</span>
                          <input
                            value={s.title}
                            aria-label={`Judul adegan ${k + 1}`}
                            onChange={(e) => setSceneTitle(k, e.target.value)}
                            className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-[15px] font-semibold outline-none hover:bg-sand focus:bg-sand"
                          />
                          <span className="shrink-0 font-mono text-xs text-muted">
                            {mmss(s.startSec * 1000)}–{mmss(s.endSec * 1000)} · {s.keptSec.toFixed(0)} dtk
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-3.5 self-start rounded-[18px] border border-line bg-surface p-5">
            <h2 className="font-display text-[22px] font-bold">Pratinjau rekaman</h2>
            {footage.video ? (
              <>
                <video src={footage.video.url} controls playsInline className="aspect-video w-full rounded-xl bg-black object-contain" />
                <p className="-mt-1.5 text-[13px] leading-relaxed text-ink-2">
                  {footage.video.prompt} · {mmss(footage.video.durationMs ?? 0)}
                </p>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-2">Pratinjau muncul setelah rekaman diimpor.</p>
            )}
            <div className="flex flex-col gap-1.5 border-t border-dashed border-line pt-3.5 text-[13px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Yang tidak dilakukan versi ini</span>
              <span>· Tanpa pelacakan wajah — zoom otomatis hanya zoom-in halus di tengah frame.</span>
              <span>· Tanpa diarization (satu pembicara), tanpa B-roll otomatis.</span>
              <span>· Transkrip verbatim — hanya dipotong, tidak ditulis ulang AI.</span>
              <span>· Tanpa TTS dan tanpa terjemah subtitle di mode ini.</span>
            </div>
          </aside>
        </div>
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex h-[84px] items-center gap-4 border-t border-line bg-surface px-14">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {words.length ? `${summary.keptWords} kata terpakai · ${summary.keptSec.toFixed(0)} dtk` : 'Belum ada transkrip'}
          </span>
          <span className="text-[13px] text-muted">
            {scenes ? `${scenes.scenes.length} adegan siap dibuat` : 'Susun adegan dulu sebelum membuat adegan.'}
          </span>
        </div>
        <div className="flex-1" />
        {clips.length > 0 && (
          <Button size="lg" onClick={() => updateProject({ step: 3 })}>
            Lihat adegan
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          className="h-[50px]"
          loading={busy === 'build'}
          disabled={!scenes || scenes.scenes.length === 0}
          icon={<ArrowRight className="size-[18px]" />}
          onClick={() => void doBuild()}
        >
          Buat adegan
        </Button>
      </footer>
    </div>
  )
}
