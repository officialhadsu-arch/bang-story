import { useMemo, useState } from 'react'
import { FileUp, Upload } from 'lucide-react'
import { estimateNarrationMs, wordCount } from '@shared/script'
import { SCRIPT_IMPORT_EXAMPLE, importDurationMs, parseScriptImport, type ScriptImportSummary } from '@shared/script-import'
import type { ProjectBundle } from '@shared/types'
import { Button, Field, Modal, confirmDialog, cx, inputCls } from '../../components/ui'
import { errorText, mmss } from '../../lib/format'
import { useApp } from '../../store/app'

/**
 * Import the user's own script: paste text or pick a .txt/.md file, preview
 * what the parser reads, then replace the whole script. Nothing is written
 * before the preview, and when the project already has scenes the replace
 * asks first — cancelling leaves the old script untouched.
 */
export function ScriptImportDialog({
  hasScenes,
  onImport,
  onDone,
  onClose
}: {
  hasScenes: boolean
  /** Flushes pending edits, imports, and returns the fresh bundle. */
  onImport: (text: string) => Promise<ScriptImportSummary & { bundle: ProjectBundle }>
  onDone: (res: ScriptImportSummary & { bundle: ProjectBundle }) => void
  onClose: () => void
}) {
  const { toast } = useApp()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const parsed = useMemo(() => parseScriptImport(text), [text])
  const totalMs = useMemo(() => importDurationMs(parsed.scenes), [parsed])
  const typed = text.trim().length > 0

  const pickFile = async (): Promise<void> => {
    try {
      const picked = await window.api.story.pickScriptFile()
      if (!picked) return
      setText(picked.text)
      setFileName(picked.fileName)
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const confirm = async (): Promise<void> => {
    if (!parsed.scenes.length) return
    if (hasScenes) {
      const ok = await confirmDialog({
        title: 'Ganti naskah yang ada?',
        body: `Naskah yang sekarang diganti seluruhnya dengan ${parsed.scenes.length} adegan dari naskah impor ini. Gambar dan suara adegan lama tetap tersimpan di riwayat proyek.`,
        confirm: 'Ganti naskah',
        danger: true
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const res = await onImport(text)
      const skipped = res.skipped.length ? ` Adegan ${res.skipped.join(', ')} kosong, tidak dimasukkan.` : ''
      toast('success', `${res.imported} adegan masuk.${skipped} Durasi proyek jadi ±${mmss(res.durationSec * 1000)}.`)
      onDone(res)
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Impor naskah" subtitle="Tempel naskahmu atau pilih berkas .txt/.md. Pratinjau dulu, baru ganti naskah." width={720}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Upload className="size-4" />} onClick={() => void pickFile()}>
            Pilih berkas .txt/.md
          </Button>
          <Button variant="ghost" icon={<FileUp className="size-4" />} onClick={() => setText(SCRIPT_IMPORT_EXAMPLE)}>
            Pakai contoh
          </Button>
          {fileName && <span className="text-[13px] text-muted">Berkas: {fileName}</span>}
        </div>

        <Field label="Naskah">
          <textarea
            id="import-script-text"
            rows={9}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFileName(null)
            }}
            placeholder="Tempel naskah di sini…"
            className={cx(inputCls, 'resize-y py-2.5 font-mono text-[13px] leading-relaxed')}
          />
        </Field>

        <details className="rounded-xl border border-line-2 bg-paper px-4 py-3 text-[13px]">
          <summary className="cursor-pointer font-semibold">Lihat contoh format</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink-2">{SCRIPT_IMPORT_EXAMPLE}</pre>
          <p className="mt-2 leading-relaxed text-ink-2">
            Tiap adegan diawali <code className="font-mono">## Judul Adegan</code> (nomor di depan judul boleh ada, boleh tidak), lalu{' '}
            <code className="font-mono">Alur:</code> dan <code className="font-mono">Narasi:</code>. Baris <code className="font-mono"># Judul Video</code> di
            atas (satu tanda #) dipakai sebagai judul proyek. Adegan tanpa label <code className="font-mono">Alur:</code>/
            <code className="font-mono">Narasi:</code> dibaca seluruhnya sebagai narasi. Adegan yang alur dan narasinya sama-sama kosong tidak
            dimasukkan.
          </p>
        </details>

        {typed && parsed.scenes.length === 0 && (
          <p className="rounded-xl border border-bad bg-bad-soft px-4 py-3 text-[13px] leading-relaxed text-bad-ink">
            Belum ada adegan yang bisa dibaca. Tulis tiap adegan diawali “## Judul Adegan”, lalu “Alur:” dan “Narasi:”. Naskah lamamu tetap
            utuh.
          </p>
        )}

        {parsed.scenes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full border border-line-2 bg-surface px-3 py-1.5 font-semibold">{parsed.scenes.length} adegan</span>
              <span className="rounded-full border border-line-2 bg-surface px-3 py-1.5">± {mmss(totalMs)} narasi</span>
              {parsed.title && <span className="rounded-full border border-line-2 bg-surface px-3 py-1.5 text-ink-2">Judul proyek jadi “{parsed.title}”</span>}
            </div>
            {parsed.skipped.length > 0 && (
              <p className="text-[13px] leading-relaxed text-accent-dark">
                Adegan {parsed.skipped.join(', ')} kosong, tidak dimasukkan.
              </p>
            )}
            <ol className="scroll-thin max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line-2 bg-paper px-4 py-3">
              {parsed.scenes.map((s, i) => (
                <li key={i} className="flex items-baseline gap-2 text-[13px]">
                  <span className="w-6 shrink-0 font-mono text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.title}</span>
                  <span className="shrink-0 text-muted">
                    {wordCount(s.narration)} kata · ±{Math.round(estimateNarrationMs(s.narration) / 1000)} dtk
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5">
        <Button onClick={onClose}>Batal</Button>
        <Button variant="primary" disabled={!parsed.scenes.length || busy} loading={busy} onClick={() => void confirm()}>
          {hasScenes ? 'Ganti naskah' : 'Impor naskah'}
        </Button>
      </div>
    </Modal>
  )
}
