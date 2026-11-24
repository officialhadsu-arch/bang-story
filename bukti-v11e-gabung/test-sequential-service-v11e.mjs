// Bundles sequential-test-entry.ts with esbuild (from the repo's node_modules) and runs it.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const esbuild = require('/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung/node_modules/esbuild/lib/main.js')

await esbuild.build({
  entryPoints: ['/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung/bukti-v11e-gabung/sequential-test-entry-v11e.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: '/tmp/sequential-test-v11e.cjs',
  alias: { '@shared': '/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung/src/shared' },
  logLevel: 'warning'
})

const run = spawnSync(process.execPath, ['/tmp/sequential-test-v11e.cjs'], { stdio: 'inherit', env: process.env })
process.exit(run.status ?? 1)
