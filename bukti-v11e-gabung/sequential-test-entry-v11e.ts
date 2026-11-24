// Direct test of the sequential engine (src/main/sequential.ts) with fake jobs.
// Run via test-sequential-service.mjs (esbuild bundle + node). Exits non-zero on any failure.
import {
  cancellableDelay,
  isGateError,
  randomDelayMs,
  runSequentialImages,
  SEQUENTIAL_MAX_ATTEMPTS,
  type SequentialDeps,
  type SequentialJobOutcome,
  type SequentialScene
} from '/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung/src/main/sequential'
import type { SequentialProgress } from '/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung/src/shared/types'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    passed++
    console.log(`PASS ${name}`)
  } else {
    failed++
    console.log(`FAIL ${name} ${extra !== undefined ? JSON.stringify(extra) : ''}`)
  }
}

/** Scripted outcomes per scene: 'done' or an error message per attempt. */
type Script = Record<string, Array<'done' | { fail: string } | { throw: string } | 'canceled'>>

interface Fake {
  deps: SequentialDeps
  calls: string[]
  delays: number[]
  emitted: SequentialProgress[]
  active: number
  maxActive: number
  canceled: boolean
}

function makeFake(script: Script, randomValues: number[] = [0.5]): Fake {
  const calls: string[] = []
  const delays: number[] = []
  const emitted: SequentialProgress[] = []
  const attempts: Record<string, number> = {}
  const fake: Fake = {
    calls,
    delays,
    emitted,
    active: 0,
    maxActive: 0,
    canceled: false,
    deps: {
      generateOne(clipId: string): { id: string } {
        const n = (attempts[clipId] = (attempts[clipId] ?? 0) + 1)
        calls.push(`${clipId}#${n}`)
        fake.active++
        fake.maxActive = Math.max(fake.maxActive, fake.active)
        const step = script[clipId]?.[n - 1]
        if (step && typeof step === 'object' && 'throw' in step) {
          fake.active--
          throw new Error(step.throw)
        }
        return { id: `job-${clipId}-${n}` }
      },
      async waitJob(jobId: string): Promise<SequentialJobOutcome> {
        const clipId = jobId.replace(/^job-/, '').replace(/-\d+$/, '')
        const n = attempts[clipId] ?? 1
        const step = script[clipId]?.[n - 1]
        fake.active--
        if (step === 'canceled') return { status: 'canceled', error: null }
        if (step && typeof step === 'object' && 'fail' in step) return { status: 'failed', error: step.fail }
        return { status: 'done', error: null }
      },
      async delay(ms: number, onTick: (secondsLeft: number) => void): Promise<'done' | 'canceled'> {
        delays.push(ms)
        // Simulate the 1 s ticks instantly, honouring the cancel flag.
        let left = ms
        while (left > 0) {
          if (fake.canceled) return 'canceled'
          left -= Math.min(1000, left)
          onTick(Math.ceil(left / 1000))
          if (fake.canceled) return 'canceled'
        }
        return 'done'
      },
      random(): number {
        return randomValues.shift() ?? 0.5
      },
      emit(p: SequentialProgress): void {
        emitted.push({ ...p, failedSceneKeys: [...p.failedSceneKeys] })
      },
      isCanceled(): boolean {
        return fake.canceled
      }
    }
  }
  return fake
}

const scenes = (keys: string[]): SequentialScene[] => keys.map((sceneKey, i) => ({ clipId: `clip-${i + 1}`, sceneKey }))

async function main(): Promise<void> {
  // Gate-error detection (G3)
  check('gate: 401', isGateError('HTTP 401 Unauthorized') === true)
  check('gate: 429', isGateError('Flow2API: 429 Too Many Requests') === true)
  check('gate: UNUSUAL_ACTIVITY', isGateError('PUBLIC_ERROR_UNUSUAL_ACTIVITY') === true)
  check('gate: reCAPTCHA', isGateError('Failed to obtain reCAPTCHA token') === true)
  check('gate: unusual activity lowercase', isGateError('detected unusual activity on this account') === true)
  check('gate: plain error is not a gate', isGateError('Flow2API belum dinyalakan') === false)
  check('gate: 4010 is not 401', isGateError('error 4010 in queue') === false)
  check('gate: null is not a gate', isGateError(null) === false)
  check('gate: empty is not a gate', isGateError('') === false)

  // Random pause bounds (KenFlow default 0-20 s)
  check('delay: random 0 -> 0 ms', randomDelayMs(() => 0) === 0)
  check('delay: random 0.5 -> 10000 ms', randomDelayMs(() => 0.5) === 10000)
  check('delay: random 1 -> 20000 ms', randomDelayMs(() => 1) === 20000)

  // Cancellable delay ticks in whole seconds and honours cancel.
  const ticks: number[] = []
  const r1 = await cancellableDelay(2500, () => false, (s) => ticks.push(s), () => Promise.resolve())
  check('cancellableDelay: 2500 ms ticks 2,1,0 then done', r1 === 'done' && JSON.stringify(ticks) === '[2,1,0]', ticks)
  check('cancellableDelay: 0 ms returns done at once', (await cancellableDelay(0, () => false, () => {}, () => Promise.resolve())) === 'done')
  let cancelAfterFirst = false
  const ticks2: number[] = []
  const r2 = await cancellableDelay(
    5000,
    () => cancelAfterFirst,
    (s) => {
      ticks2.push(s)
      cancelAfterFirst = true
    },
    () => Promise.resolve()
  )
  check('cancellableDelay: cancel mid-delay returns canceled', r2 === 'canceled' && ticks2.length === 1, ticks2)
  check('max attempts is 3 (1 + 2 retries)', SEQUENTIAL_MAX_ATTEMPTS === 3)

  // 1. Sequential order, one at a time, pause between scenes only.
  {
    const f = makeFake({ 'clip-1': ['done'], 'clip-2': ['done'], 'clip-3': ['done'] }, [0.5, 0.25])
    const s = await runSequentialImages('p1', scenes(['01', '02', '03']), 0, f.deps)
    check('order: scenes run in storyboard order', JSON.stringify(f.calls) === '["clip-1#1","clip-2#1","clip-3#1"]', f.calls)
    check('order: never two jobs at once', f.maxActive === 1, f.maxActive)
    check('order: pause between scenes only (2 pauses, none before first)', JSON.stringify(f.delays) === '[10000,5000]', f.delays)
    check('order: summary done=3 failed=0', s.status === 'done' && s.done === 3 && s.failed === 0, s)
    const waiting = f.emitted.filter((p) => p.status === 'waiting')
    check('order: waiting states carry the countdown', waiting.length > 0 && waiting[0].waitSecondsLeft === 10, waiting.map((p) => p.waitSecondsLeft))
    check('order: no waiting state before the first scene', !f.emitted.slice(0, 1).some((p) => p.status === 'waiting'))
  }

  // 2. Retry 2x then move on (scene fails 3 times, next scene still runs).
  {
    const f = makeFake({ 'clip-1': [{ fail: 'boom' }, { fail: 'boom' }, { fail: 'boom' }], 'clip-2': ['done'] })
    const s = await runSequentialImages('p1', scenes(['01', '02']), 0, f.deps)
    check('retry: failed scene tried 3 times then next scene ran', JSON.stringify(f.calls) === '["clip-1#1","clip-1#2","clip-1#3","clip-2#1"]', f.calls)
    check('retry: summary done=1 failed=1 scene 01', s.status === 'done' && s.done === 1 && s.failed === 1 && JSON.stringify(s.failedSceneKeys) === '["01"]', s)
  }

  // 3. Retry then success on the 2nd attempt.
  {
    const f = makeFake({ 'clip-1': [{ fail: 'sekali gagal' }, 'done'], 'clip-2': ['done'] })
    const s = await runSequentialImages('p1', scenes(['01', '02']), 0, f.deps)
    check('retry-then-ok: scene retried once and finished', JSON.stringify(f.calls) === '["clip-1#1","clip-1#2","clip-2#1"]', f.calls)
    check('retry-then-ok: summary done=2 failed=0', s.status === 'done' && s.done === 2 && s.failed === 0, s)
    const second = f.emitted.find((p) => p.clipId === 'clip-1' && p.attempt === 2)
    check('retry-then-ok: progress reports attempt 2', second !== undefined, second)
  }

  // 4. A throw from generateOne counts as a failed attempt (config error path).
  {
    const f = makeFake({ 'clip-1': [{ throw: 'Flow2API belum dinyalakan' }, { throw: 'Flow2API belum dinyalakan' }, { throw: 'Flow2API belum dinyalakan' }], 'clip-2': ['done'] })
    const s = await runSequentialImages('p1', scenes(['01', '02']), 0, f.deps)
    check('throw: config error retried then scene marked failed, run continues', s.done === 1 && s.failed === 1 && JSON.stringify(s.failedSceneKeys) === '["01"]', s)
  }

  // 5. UNUSUAL_ACTIVITY stops the whole batch at once, no retry, later scenes never start.
  {
    const f = makeFake({ 'clip-1': [{ fail: 'PUBLIC_ERROR_UNUSUAL_ACTIVITY' }], 'clip-2': ['done'], 'clip-3': ['done'] })
    const s = await runSequentialImages('p1', scenes(['01', '02', '03']), 0, f.deps)
    check('gate-stop: UNUSUAL_ACTIVITY tried once only', JSON.stringify(f.calls) === '["clip-1#1"]', f.calls)
    check('gate-stop: status stopped with a plain-language message', s.status === 'stopped' && (s.message ?? '').includes('Jangan generate berulang'), s)
    check('gate-stop: no pause after a gate stop', f.delays.length === 0, f.delays)
  }

  // 6. 429 and reCAPTCHA are gate errors too.
  {
    const f = makeFake({ 'clip-1': [{ fail: 'HTTP 429 Too Many Requests' }] })
    const s = await runSequentialImages('p1', scenes(['01', '02']), 0, f.deps)
    check('gate-stop: 429 stops the run', s.status === 'stopped' && f.calls.length === 1, s)
  }
  {
    const f = makeFake({ 'clip-1': [{ fail: 'Failed to obtain reCAPTCHA token' }] })
    const s = await runSequentialImages('p1', scenes(['01', '02']), 0, f.deps)
    check('gate-stop: reCAPTCHA stops the run', s.status === 'stopped' && f.calls.length === 1, s)
  }

  // 7. Cancel during the pause: the next scene never starts.
  {
    const f = makeFake({ 'clip-1': ['done'], 'clip-2': ['done'] })
    const origDelay = f.deps.delay
    f.deps.delay = async (ms, onTick) => {
      const r = await origDelay(ms, onTick)
      return r
    }
    // Cancel from the first waiting tick.
    const origEmit = f.deps.emit
    f.deps.emit = (p) => {
      if (p.status === 'waiting') f.canceled = true
      origEmit(p)
    }
    const s = await runSequentialImages('p1', scenes(['01', '02']), 0, f.deps)
    check('cancel-pause: next scene never starts', JSON.stringify(f.calls) === '["clip-1#1"]', f.calls)
    check('cancel-pause: status canceled', s.status === 'canceled', s)
  }

  // 8. Cancel before the first scene: nothing starts.
  {
    const f = makeFake({ 'clip-1': ['done'] })
    f.canceled = true
    const s = await runSequentialImages('p1', scenes(['01']), 0, f.deps)
    check('cancel-before-start: no job started', f.calls.length === 0 && s.status === 'canceled', s)
  }

  // 9. A job canceled from outside stops the run as canceled.
  {
    const f = makeFake({ 'clip-1': ['canceled'], 'clip-2': ['done'] })
    const s = await runSequentialImages('p1', scenes(['01', '02']), 0, f.deps)
    check('cancel-job: externally canceled job stops the run', s.status === 'canceled' && f.calls.length === 1, s)
  }

  // 10. Skipped manual scenes are reported in the final message.
  {
    const f = makeFake({ 'clip-1': ['done'] })
    const s = await runSequentialImages('p1', scenes(['01']), 2, f.deps)
    check('skipped: final message names the skipped manual scenes', s.skipped === 2 && (s.message ?? '').includes('2 adegan manual dilewati'), s)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
