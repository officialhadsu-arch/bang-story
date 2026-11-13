import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { needsVisual } from '@shared/script'
import { findFootage } from '@shared/talkinghead'
import type { Step } from '@shared/types'
import { Button, Spinner } from '../../components/ui'
import { errorText } from '../../lib/format'
import { useApp } from '../../store/app'
import { useProject } from '../../store/project'
import { EditorStep } from './EditorStep'
import { ExportDialog } from './ExportDialog'
import { IdeaStep } from './IdeaStep'
import { ProjectHeader } from './ProjectHeader'
import { ScenesStep } from './ScenesStep'
import { ScriptStep } from './ScriptStep'
import { StoryboardStep } from './StoryboardStep'
import { TranscriptStep } from './TranscriptStep'

export function ProjectPage({ id }: { id: string }) {
  const { load, unload, loaded, project, clips, assets } = useProject()
  const { toast, go } = useApp()
  const [exportOpen, setExportOpen] = useState(false)
  // Talking Head keeps its own progress: footage → transcript → scenes (F5-02). The script/visual
  // checks (needsVisual, imageAssetId) do not apply to recording scenes.
  const footage = useMemo(() => findFootage(Object.values(assets)), [assets])
  const isTalkingHead = project?.mode === 'talking-head'

  useEffect(() => {
    let alive = true
    window.api.projects
      .get(id)
      .then((b) => alive && load(b))
      .catch((e) => {
        toast('error', errorText(e))
        go({ name: 'home' })
      })
    return () => {
      alive = false
      void useProject.getState().flush().then(unload)
    }
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void useProject.getState().save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!loaded || !project)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-ink-2">
        <Spinner />
        Membuka proyek…
      </div>
    )

  const done: Step[] = []
  if (isTalkingHead) {
    if (footage.video) done.push(1)
    if (footage.audio?.meta.words?.length) done.push(2)
    if (clips.length && clips.every((c) => c.videoAssetId && c.audioAssetId)) done.push(3)
  } else {
    if (clips.length) done.push(1)
    if (clips.length && !clips.some(needsVisual)) done.push(2)
    if (clips.length && clips.every((c) => c.imageAssetId)) done.push(3)
  }

  return (
    <div className="flex h-full flex-col">
      <ProjectHeader
        doneSteps={done}
        right={
          project.step === 4 ? (
            <Button variant="primary" icon={<Download className="size-[18px]" />} onClick={() => setExportOpen(true)}>
              Ekspor video
            </Button>
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1">
        {project.step === 1 && <IdeaStep />}
        {project.step === 2 && (isTalkingHead ? <TranscriptStep /> : <ScriptStep />)}
        {project.step === 3 && (isTalkingHead ? <ScenesStep /> : <StoryboardStep />)}
        {project.step === 4 && <EditorStep />}
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
