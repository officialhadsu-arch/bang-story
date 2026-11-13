/**
 * Shared FFmpeg runner (moved out of exporter.ts so the motion renderer can
 * stitch frames with the same abort/progress behaviour).
 */
import { spawn } from 'node:child_process'
import ffmpegStatic from 'ffmpeg-static'
import { binPath } from '../paths'

export function ffmpegPath(): string {
  if (!ffmpegStatic) throw new Error('FFmpeg tidak ditemukan di aplikasi')
  return binPath(ffmpegStatic)
}

/** Runs ffmpeg in `cwd`, reporting progress from its `time=` output against `totalSec`. */
export function runFfmpeg(args: string[], cwd: string, signal: AbortSignal, totalSec?: number, onProgress?: (f: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), ['-hide_banner', '-y', ...args], { cwd, windowsHide: true })
    let tail = ''
    const onAbort = (): void => {
      p.kill('SIGKILL')
    }
    signal.addEventListener('abort', onAbort)
    p.stderr.on('data', (d: Buffer) => {
      const s = d.toString()
      tail = (tail + s).slice(-4000)
      if (totalSec && onProgress) {
        const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s)
        if (m) onProgress(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / totalSec))
      }
    })
    p.on('error', reject)
    p.on('close', (code) => {
      signal.removeEventListener('abort', onAbort)
      if (signal.aborted) return reject(new Error('Dibatalkan'))
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg gagal (kode ${code}): ${tail.split('\n').slice(-6).join(' ').trim()}`))
    })
  })
}
