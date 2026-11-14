import { app, safeStorage } from 'electron'
import type { ApiProvider, KeyStatus } from '@shared/types'
import { getDb } from './db'
import { getSettings } from './settings'

const PROVIDERS: ApiProvider[] = ['higgsfield', 'gemini', 'elevenlabs', 'openrouter', 'groq', 'custom', 'nexabot', 'kieai']

export const PROVIDER_NAMES: Record<ApiProvider, string> = {
  higgsfield: 'Higgsfield',
  gemini: 'Google Gemini',
  elevenlabs: 'ElevenLabs',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  custom: 'endpoint custom',
  nexabot: 'NexaBot',
  kieai: 'Kie.ai'
}

interface SecretRow {
  provider: ApiProvider
  value: Buffer
  last_ok: number | null
  last_message: string | null
  checked_at: number | null
}

/**
 * safeStorage (DPAPI on Windows) keeps its encryption key in Chromium's "Local State" file, which is only
 * written about ten seconds after the key is first created. Creating the key at startup means it is on disk
 * long before the user saves an API key, so killing the app (e.g. restarting the dev server) cannot orphan it.
 */
export function warmUpEncryption(): void {
  try {
    if (safeStorage.isEncryptionAvailable()) safeStorage.encryptString('kenstory')
  } catch {
    // Encryption unavailable: keys are refused below (D-07), never stored plain.
  }
}

/** True when the OS can encrypt keys. False on machines without a keyring (this Linux VM) or when DPAPI is unavailable. */
export function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

const ENCRYPTION_UNAVAILABLE_MESSAGE =
  'Enkripsi kunci tidak tersedia di perangkat ini, jadi kunci tidak disimpan. KenStory tidak pernah menyimpan kunci tanpa enkripsi.'

/**
 * Magic header marking a stored value as an encrypted envelope (D-07).
 * Values without it are legacy plaintext (or foreign) and are never used:
 * decrypt() returns null for them, so the user is asked to re-enter the key.
 * Mirrors the envelope validation in De-Story's secrets.rs.
 */
const ENVELOPE_PREFIX = Buffer.from('KS1:')

function hasEnvelope(value: Buffer): boolean {
  return value.length > ENVELOPE_PREFIX.length && value.subarray(0, ENVELOPE_PREFIX.length).equals(ENVELOPE_PREFIX)
}

function decrypt(value: Buffer): string | null {
  try {
    if (!hasEnvelope(value)) return null
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(value.subarray(ENVELOPE_PREFIX.length))
  } catch {
    return null
  }
}

function mask(key: string): string {
  if (key.length <= 10) return '•'.repeat(Math.max(4, key.length))
  return `${key.slice(0, Math.min(8, Math.floor(key.length / 3)))}${'•'.repeat(10)}${key.slice(-4)}`
}

function row(provider: ApiProvider): SecretRow | undefined {
  return getDb().prepare('SELECT * FROM secrets WHERE provider = ?').get(provider) as SecretRow | undefined
}

/**
 * Dev-only in-memory keys (never written to disk). Only the dev harness uses
 * this, via setTestKey(), so key flows can be exercised on machines without
 * an OS keyring — where setSecret() must refuse (D-07). Never populated in
 * a packaged build.
 */
const testKeys = new Map<ApiProvider, string>()
const testChecks = new Map<ApiProvider, { ok: boolean; message: string; at: number }>()

export function setTestKey(provider: ApiProvider, value: string): void {
  if (app.isPackaged) throw new Error('setTestKey hanya untuk mode pengembangan')
  testKeys.set(provider, value)
}

export function setSecret(provider: ApiProvider, value: string): void {
  // D-07 fail-closed: never store a key the OS cannot encrypt. The caller
  // (settings IPC) surfaces this message to the user as an error toast.
  if (!safeStorage.isEncryptionAvailable()) throw new Error(ENCRYPTION_UNAVAILABLE_MESSAGE)
  const enc = Buffer.concat([ENVELOPE_PREFIX, safeStorage.encryptString(value)])
  getDb()
    .prepare(
      `INSERT INTO secrets (provider, value) VALUES (?, ?)
       ON CONFLICT(provider) DO UPDATE SET value = excluded.value, last_ok = NULL, last_message = NULL, checked_at = NULL`
    )
    .run(provider, enc)
}

export function getSecret(provider: ApiProvider): string | null {
  const test = testKeys.get(provider)
  if (test !== undefined) return test
  const r = row(provider)
  if (!r || r.value.length === 0) return null
  if (!hasEnvelope(r.value))
    throw new Error(
      `Kunci ${PROVIDER_NAMES[provider]} tersimpan tanpa enkripsi (dari versi lama) dan tidak bisa dipakai lagi. Masukkan ulang kuncinya di Pengaturan.`
    )
  const value = decrypt(r.value)
  if (value == null)
    throw new Error(
      `Kunci ${PROVIDER_NAMES[provider]} tersimpan tapi tidak bisa dibuka lagi (biasanya karena aplikasi ditutup paksa sesaat setelah kunci disimpan). Masukkan ulang kuncinya di Pengaturan.`
    )
  return value
}

export function requireSecret(provider: ApiProvider): string {
  const key = getSecret(provider)
  if (!key) throw new Error(`Kunci API ${PROVIDER_NAMES[provider]} belum diatur. Buka Pengaturan untuk menambahkannya.`)
  return key
}

/** Full key for the "show key" button; null when missing or unreadable. */
export function revealSecret(provider: ApiProvider): string | null {
  const test = testKeys.get(provider)
  if (test !== undefined) return test
  const r = row(provider)
  return r && r.value.length ? decrypt(r.value) : null
}

export function clearSecret(provider: ApiProvider): void {
  testKeys.delete(provider)
  testChecks.delete(provider)
  getDb().prepare('DELETE FROM secrets WHERE provider = ?').run(provider)
}

/** Test results for the custom endpoint are kept even when it has no key (local servers). */
export function recordCheck(provider: ApiProvider, ok: boolean, message: string): void {
  const now = Date.now()
  if (testKeys.has(provider)) {
    testChecks.set(provider, { ok, message, at: now })
    return
  }
  const res = getDb()
    .prepare('UPDATE secrets SET last_ok = ?, last_message = ?, checked_at = ? WHERE provider = ?')
    .run(ok ? 1 : 0, message, now, provider)
  if (res.changes === 0 && provider === 'custom') {
    getDb()
      .prepare('INSERT INTO secrets (provider, value, last_ok, last_message, checked_at) VALUES (?, ?, ?, ?, ?)')
      .run(provider, Buffer.alloc(0), ok ? 1 : 0, message, now)
  }
}

export function keyStatuses(): KeyStatus[] {
  const rows = getDb().prepare('SELECT * FROM secrets').all() as SecretRow[]
  const customUrl = getSettings().customBaseUrl.trim()
  const encryption = encryptionAvailable()
  return PROVIDERS.map((provider) => {
    const test = testKeys.get(provider)
    const testCheck = testChecks.get(provider)
    const r = rows.find((x) => x.provider === provider)
    const hasKey = test !== undefined || (!!r && r.value.length > 0)
    const value = test ?? (hasKey && r ? decrypt(r.value) : null)
    const enveloped = !!r && r.value.length > 0 && hasEnvelope(r.value)
    const unreadable = hasKey && value == null
    return {
      provider,
      configured: provider === 'custom' ? !!customUrl : hasKey,
      lastOk: testCheck ? testCheck.ok : unreadable ? false : r?.last_ok == null ? null : r.last_ok === 1,
      lastMessage: testCheck
        ? testCheck.message
        : unreadable
          ? enveloped
            ? 'Kunci tersimpan tapi tidak bisa dibuka lagi. Masukkan ulang kuncinya.'
            : 'Kunci tersimpan tanpa enkripsi (dari versi lama). Masukkan ulang kuncinya.'
          : (r?.last_message ?? null),
      checkedAt: testCheck ? testCheck.at : (r?.checked_at ?? null),
      preview: value ? mask(value) : null,
      unreadable,
      encryptionAvailable: encryption
    }
  })
}
