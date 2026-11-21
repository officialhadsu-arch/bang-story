// Sequential image generation ("Generate berurutan", 0.3): one scene at a time,
// a random pause between scenes, limited retries, and a hard stop on account
// risk. The pacing mirrors the KenFlow v3.6.6 queue study (serial 1, random
// 0-20 s pause between prompts from the 2nd prompt on, 1 s cancellable ticks,
// max 2 retries then move on) — but KenFlow drives the Flow web UI, while this
// engine drives KenStory's own image jobs, so the pause is only a rhythm, not
// a guarantee against Google's risk controls.
//
// The engine is deliberately free of Electron, the database and the providers:
// every side effect arrives through `deps`, so the pacing, retry and gate-stop
// rules can be tested in plain Node with fake jobs (see test-sequential-service.mjs).
import type { SequentialProgress, SequentialStatus } from '@shared/types'

/** KenFlow default: a random pause of 0-20 s between prompts. */
export const SEQUENTIAL_DELAY_MIN_MS = 0
export const SEQUENTIAL_DELAY_MAX_MS = 20_000
/** 1 first try + 2 retries, then the scene is marked failed and the run moves on. */
export const SEQUENTIAL_MAX_ATTEMPTS = 3
export const SEQUENTIAL_JOB_POLL_MS = 500
/** The pause sleeps in 1 s ticks so Cancel lands within a second (KenFlow pattern). */
export const SEQUENTIAL_DELAY_TICK_MS = 1000

export interface SequentialScene {
  clipId: string
  sceneKey: string
}

export interface SequentialJobOutcome {
  status: 'done' | 'failed' | 'canceled'
  error: string | null
}

export interface SequentialDeps {
  /** Starts (or reuses) one image job for a scene. May throw: a throw counts as a failed attempt. */
  generateOne(clipId: string): { id: string }
  /** Resolves when the job reaches a terminal state. */
  waitJob(jobId: string): Promise<SequentialJobOutcome>
  /**
   * Sleeps `ms` in 1 s ticks. Calls `onTick` with the whole seconds left after
   * each tick and returns 'canceled' as soon as `isCanceled()` is true.
   */
  delay(ms: number, onTick: (secondsLeft: number) => void): Promise<'done' | 'canceled'>
  /** Random source for the pause, so tests can pin it (Math.random in production). */
  random(): number
  emit(progress: SequentialProgress): void
  isCanceled(): boolean
}

export interface SequentialSummary {
  status: SequentialStatus
  done: number
  failed: number
  failedSceneKeys: string[]
  skipped: number
  message: string | null
}

/**
 * Account-risk errors (gate G3): the whole batch stops at once, with no retry.
 * 401/429 are matched as whole numbers so a "4010" elsewhere in a message does
 * not trip the gate; the Flow phrases are matched case-insensitively.
 */
export function isGateError(error: string | null | undefined): boolean {
  if (!error) return false
  return /\b401\b/.test(error) || /\b429\b/.test(error) || /unusual[ _]activity/i.test(error) || /recaptcha/i.test(error)
}

/** Random pause between SEQUENTIAL_DELAY_MIN_MS and SEQUENTIAL_DELAY_MAX_MS. */
export function randomDelayMs(random: () => number): number {
  return SEQUENTIAL_DELAY_MIN_MS + random() * (SEQUENTIAL_DELAY_MAX_MS - SEQUENTIAL_DELAY_MIN_MS)
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sleeps in 1 s ticks, reporting the whole seconds left after each tick.
 * Returns 'canceled' early when `isCanceled()` turns true; a pause of 0 ms
 * returns 'done' at once without ticking.
 */
export async function cancellableDelay(
  ms: number,
  isCanceled: () => boolean,
  onTick: (secondsLeft: number) => void,
  sleep: (ms: number) => Promise<void> = sleepMs
): Promise<'done' | 'canceled'> {
  let left = ms
  while (left > 0) {
    if (isCanceled()) return 'canceled'
    const tick = Math.min(SEQUENTIAL_DELAY_TICK_MS, left)
    await sleep(tick)
    left -= tick
    if (isCanceled()) return 'canceled'
    onTick(Math.ceil(left / 1000))
  }
  return 'done'
}

function progress(
  projectId: string,
  total: number,
  patch: Partial<SequentialProgress> & { status: SequentialStatus }
): SequentialProgress {
  return {
    projectId,
    status: patch.status,
    current: patch.current ?? 0,
    total,
    clipId: patch.clipId ?? null,
    sceneKey: patch.sceneKey ?? null,
    attempt: patch.attempt ?? 1,
    waitSecondsLeft: patch.waitSecondsLeft ?? null,
    done: patch.done ?? 0,
    failed: patch.failed ?? 0,
    failedSceneKeys: patch.failedSceneKeys ?? [],
    skipped: patch.skipped ?? 0,
    message: patch.message ?? null
  }
}

/**
 * Runs the scenes in storyboard order, one job at a time. After each scene
 * except the last, waits a random 0-20 s before the next one — never before
 * the first. A scene gets up to 3 attempts; a scene that still fails is
 * recorded and the run moves on. A gate error (401 / 429 / UNUSUAL_ACTIVITY /
 * reCAPTCHA) stops the whole run at once, with no retry.
 */
export async function runSequentialImages(
  projectId: string,
  scenes: SequentialScene[],
  skipped: number,
  deps: SequentialDeps
): Promise<SequentialSummary> {
  const total = scenes.length
  let done = 0
  let failed = 0
  const failedSceneKeys: string[] = []
  const failedKeys = (): string[] => [...failedSceneKeys]

  const emitState = (patch: Partial<SequentialProgress> & { status: SequentialStatus }): void => {
    deps.emit(
      progress(projectId, total, {
        ...patch,
        done,
        failed,
        failedSceneKeys: failedKeys(),
        skipped
      })
    )
  }

  for (let i = 0; i < total; i++) {
    const scene = scenes[i]
    if (deps.isCanceled()) {
      const message = `Dibatalkan setelah ${done} dari ${total} adegan.`
      emitState({ status: 'canceled', current: i + 1, clipId: scene.clipId, sceneKey: scene.sceneKey, message })
      return { status: 'canceled', done, failed, failedSceneKeys, skipped, message }
    }
    let sceneDone = false
    let lastError: string | null = null
    for (let attempt = 1; attempt <= SEQUENTIAL_MAX_ATTEMPTS; attempt++) {
      emitState({ status: 'running', current: i + 1, clipId: scene.clipId, sceneKey: scene.sceneKey, attempt })
      let outcome: SequentialJobOutcome
      try {
        const job = deps.generateOne(scene.clipId)
        outcome = await deps.waitJob(job.id)
      } catch (e) {
        outcome = { status: 'failed', error: (e as Error)?.message ?? String(e) }
      }
      if (outcome.status === 'done') {
        sceneDone = true
        break
      }
      if (outcome.status === 'canceled') {
        const message = `Dibatalkan saat adegan ${scene.sceneKey} (${done} dari ${total} selesai).`
        emitState({ status: 'canceled', current: i + 1, clipId: scene.clipId, sceneKey: scene.sceneKey, attempt, message })
        return { status: 'canceled', done, failed, failedSceneKeys, skipped, message }
      }
      lastError = outcome.error
      if (isGateError(lastError)) {
        const message =
          `Berhenti: ${lastError} — kemungkinan pembatasan dari Google. Jangan generate berulang; ` +
          `istirahatkan akun dan cek lewat generate manual di flow.google.com.`
        emitState({ status: 'stopped', current: i + 1, clipId: scene.clipId, sceneKey: scene.sceneKey, attempt, message })
        return { status: 'stopped', done, failed, failedSceneKeys, skipped, message }
      }
      // Otherwise the next loop iteration retries the same scene, until the attempts run out.
    }
    if (sceneDone) {
      done++
    } else {
      failed++
      failedSceneKeys.push(scene.sceneKey)
    }
    const isLast = i === total - 1
    if (!isLast && !deps.isCanceled()) {
      const pauseMs = randomDelayMs(deps.random)
      emitState({ status: 'waiting', current: i + 1, clipId: scene.clipId, sceneKey: scene.sceneKey, waitSecondsLeft: Math.ceil(pauseMs / 1000) })
      const paused = await deps.delay(pauseMs, (secondsLeft) =>
        emitState({ status: 'waiting', current: i + 1, clipId: scene.clipId, sceneKey: scene.sceneKey, waitSecondsLeft: secondsLeft })
      )
      if (paused === 'canceled' || deps.isCanceled()) {
        const message = `Dibatalkan saat jeda (${done} dari ${total} adegan selesai).`
        emitState({ status: 'canceled', current: i + 2, clipId: scenes[i + 1]?.clipId ?? null, sceneKey: scenes[i + 1]?.sceneKey ?? null, message })
        return { status: 'canceled', done, failed, failedSceneKeys, skipped, message }
      }
    }
  }
  const message =
    failed === 0
      ? `Selesai: ${done} dari ${total} adegan berhasil dibuat.${skipped > 0 ? ` ${skipped} adegan manual dilewati.` : ''}`
      : `Selesai: ${done} berhasil, ${failed} gagal (${failedSceneKeys.join(', ')}).${skipped > 0 ? ` ${skipped} adegan manual dilewati.` : ''}`
  emitState({ status: 'done', current: total, message })
  return { status: 'done', done, failed, failedSceneKeys, skipped, message }
}
