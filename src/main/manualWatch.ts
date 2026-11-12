import { mkdirSync, watch, type FSWatcher } from 'node:fs'
import { emit } from './events'
import { manualWorkFolder } from './paths'

/**
 * Watches one project's work folder for arriving result files (D2-06). Non-recursive, debounced
 * 500 ms, and only a probe: it tells the renderer "something landed, press Pindai" — the Pindai
 * button is the path that is tested, so a watcher failure on any platform changes nothing.
 */

const watchers = new Map<string, FSWatcher>()

export function startManualWatch(projectId: string): void {
  if (watchers.has(projectId)) return
  const dir = manualWorkFolder(projectId)
  mkdirSync(dir, { recursive: true })
  let timer: ReturnType<typeof setTimeout> | null = null
  let watcher: FSWatcher
  try {
    watcher = watch(dir, { persistent: false }, (_event, file) => {
      if (!file) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => emit.manual({ projectId, file: String(file) }), 500)
    })
  } catch {
    return
  }
  watcher.on('error', () => stopManualWatch(projectId))
  watchers.set(projectId, watcher)
}

export function stopManualWatch(projectId: string): void {
  watchers.get(projectId)?.close()
  watchers.delete(projectId)
}
