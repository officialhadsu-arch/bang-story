import { useState } from 'react'
import type { BulkImportPreview } from '@shared/bulk-import'
import type { WorkFileKind } from '@shared/manual'
import { Button, Modal } from '../../components/ui'

/**
 * The bulk-import preview: what the folder holds, in install order, and which scene each file
 * will land on. Excess files are marked as not installed, so nothing about the plan is a
 * surprise when the user presses Pasang.
 */
export function BulkImportDialog({
  preview,
  kind,
  onClose,
  onPasang
}: {
  preview: BulkImportPreview
  kind: WorkFileKind
  onClose: () => void
  onPasang: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const label = kind === 'image' ? 'gambar' : 'video'
  return (
    <Modal
      open
      onClose={onClose}
      title={`Impor ${label} massal`}
      subtitle="Berkas dipasang berurutan ke adegan yang belum punya visual. Adegan yang sudah punya visual dilewati."
      width={640}
    >
      <p className="truncate font-mono text-xs text-muted" title={preview.folder}>
        {preview.folder}
      </p>
      {preview.entries.length === 0 ? (
        <p className="text-sm text-ink-2">
          {kind === 'image'
            ? 'Tidak ada berkas gambar di folder ini. Pakai file PNG, JPG, atau WebP.'
            : 'Tidak ada berkas video di folder ini. Pakai file MP4, MOV, atau WebM.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {preview.entries.map((e) => (
            <li key={e.file} className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{e.file}</span>
              <span className="shrink-0 text-ink-2">
                Adegan {e.sceneKey} — {e.title || 'Tanpa judul'}
              </span>
            </li>
          ))}
          {preview.excessFiles.map((f) => (
            <li key={f} className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{f}</span>
              <span className="shrink-0">tidak terpasang</span>
            </li>
          ))}
        </ul>
      )}
      {preview.emptyLeft > 0 && preview.entries.length > 0 && (
        <p className="text-sm text-muted">
          {preview.emptyLeft} adegan masih kosong setelah impor ini.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button
          variant="primary"
          disabled={preview.entries.length === 0 || busy}
          loading={busy}
          onClick={() => {
            setBusy(true)
            void onPasang().finally(() => setBusy(false))
          }}
        >
          Pasang {preview.entries.length} berkas
        </Button>
      </div>
    </Modal>
  )
}
