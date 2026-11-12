#!/usr/bin/env node
/**
 * H7 — periksa agar tidak ada kunci yang bocor (tugas 0.7, W2).
 *
 * Dua pemindaian:
 * 1. Repo (berkas terlacak git): pola kunci asli (sk-, AIza, xox, hf_,
 *    glpat-, github_pat_, dan nilai api-key yang ditulis literal). Berkas
 *    skrip ini sendiri, package-lock.json, dan peta sumber dikecualikan.
 * 2. Artefak (--artifacts <dir> ...): file apa pun termasuk biner
 *    (studio.db, log, hasil ekspor) dicari penanda uji D07-TEST-KEY,
 *    D07-LEGACY-PLAIN, dan dev-harness-fake-key, plus pola kunci asli.
 *    Penanda uji tidak boleh muncul di log/ekspor/DB — kunci yang ditolak
 *    (D-07) dan kunci uji memori tidak pernah sampai ke disk.
 *
 * Pemakaian:
 *   node scripts/h7-check-no-secrets.mjs [--repo <dir>] [--artifacts <dir> ...]
 * Keluar 1 bila ada temuan, 0 bila bersih.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'node:path'

const SELF = fileURLToPath(import.meta.url)
const DEFAULT_REPO = resolve(SELF, '..', '..')

const REAL_KEY_PATTERNS = [
  { name: 'sk-...', re: /sk-[A-Za-z0-9]{16,}/ },
  { name: 'AIza...', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'xox...', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'hf_...', re: /hf_[A-Za-z0-9]{20,}/ },
  { name: 'glpat-...', re: /glpat-[A-Za-z0-9_-]{15,}/ },
  { name: 'github_pat_...', re: /github_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'api-key literal', re: /(api[_-]?key|apikey)\s*[:=]\s*["'][^"'\s]{16,}["']/i }
]

const MARKER_PATTERNS = [
  { name: 'D07-TEST-KEY', re: /D07-TEST-KEY/ },
  { name: 'D07-LEGACY-PLAIN', re: /D07-LEGACY-PLAIN/ },
  { name: 'dev-harness-fake-key', re: /dev-harness-fake-key/ }
]

const SKIP_BASENAMES = new Set(['package-lock.json'])
const SKIP_SUFFIXES = ['.map']

function parseArgs(argv) {
  const out = { repo: DEFAULT_REPO, artifacts: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') out.repo = resolve(argv[++i])
    else if (argv[i] === '--artifacts') {
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out.artifacts.push(resolve(argv[++i]))
    }
  }
  return out
}

function trackedFiles(repo) {
  try {
    const list = execFileSync('git', ['-C', repo, 'ls-files'], { encoding: 'utf8' })
    return list.split('\n').filter(Boolean).map((f) => join(repo, f))
  } catch {
    const found = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', 'out', 'dist'].includes(e.name)) continue
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else found.push(p)
      }
    }
    walk(repo)
    return found
  }
}

function isText(buf) {
  return !buf.includes(0)
}

function scanTextFile(path, patterns, hits) {
  const buf = readFileSync(path)
  if (!isText(buf)) return
  const lines = buf.toString('utf8').split('\n')
  lines.forEach((line, idx) => {
    for (const p of patterns) {
      if (p.re.test(line)) hits.push(`${path}:${idx + 1}: [${p.name}] ${line.trim().slice(0, 120)}`)
    }
  })
}

function scanArtifactFile(path, patterns, hits) {
  const buf = readFileSync(path)
  for (const p of patterns) {
    const m = buf.toString('latin1').match(p.re)
    if (m) hits.push(`${path} @offset ${m.index}: [${p.name}]`)
  }
}

function walkArtifacts(dir, out) {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkArtifacts(p, out)
    else if (e.isFile()) out.push(p)
  }
}

function main() {
  const { repo, artifacts } = parseArgs(process.argv.slice(2))
  const hits = []

  const files = trackedFiles(repo).filter(
    (f) => resolve(f) !== resolve(SELF) && !SKIP_BASENAMES.has(f.split('/').pop()) && !SKIP_SUFFIXES.some((s) => f.endsWith(s))
  )
  let checked = 0
  for (const f of files) {
    if (!existsSync(f) || !statSync(f).isFile()) continue
    checked++
    scanTextFile(f, REAL_KEY_PATTERNS, hits)
  }
  console.log(`H7 repo: ${checked} berkas terlacak diperiksa di ${relative(process.cwd(), repo) || repo}`)

  for (const dir of artifacts) {
    const list = []
    walkArtifacts(dir, list)
    for (const f of list) scanArtifactFile(f, [...MARKER_PATTERNS, ...REAL_KEY_PATTERNS], hits)
    console.log(`H7 artefak: ${list.length} berkas diperiksa di ${dir}`)
  }

  if (hits.length > 0) {
    console.log(`H7 GAGAL: ${hits.length} temuan:`)
    for (const h of hits) console.log('  ' + h)
    process.exit(1)
  }
  console.log('H7 bersih: tidak ada kunci yang bocor.')
}

main()
