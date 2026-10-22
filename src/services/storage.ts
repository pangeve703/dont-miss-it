import { SCHEMA_VERSION, type Preferences, type Reminder, type StoredData } from '../types/reminder'
import { DEFAULT_CURRENCY, isCurrencyCode } from '../utils/currency'
import { parseReminder } from '../utils/validation'

export const STORAGE_KEY = 'dont-miss-it'
/** Unreadable data is copied here before anything is overwritten. */
export const RECOVERY_KEY_PREFIX = 'dont-miss-it:recovery:'
/** Older recovery copies beyond this many are removed, so they can't fill storage. */
export const MAX_RECOVERY_COPIES = 5

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

export type LoadStatus =
  /** Data loaded normally (or nothing was stored yet). */
  | 'ok'
  /** Some reminders were unreadable and were skipped. A raw copy was kept. */
  | 'partial'
  /** Stored data could not be read at all. A raw copy was kept. */
  | 'corrupted'
  /** Browser storage is blocked (e.g. some private browsing modes). */
  | 'unavailable'

export interface LoadResult {
  data: StoredData
  status: LoadStatus
  skipped: number
}

export function emptyData(): StoredData {
  return { version: SCHEMA_VERSION, reminders: [], preferences: defaultPreferences() }
}

export function defaultPreferences(): Preferences {
  return { currency: DEFAULT_CURRENCY }
}

export function parsePreferences(raw: unknown): Preferences {
  const prefs = defaultPreferences()
  if (typeof raw === 'object' && raw !== null && 'currency' in raw && isCurrencyCode(raw.currency)) {
    prefs.currency = raw.currency
  }
  return prefs
}

/**
 * Upgrades older stored shapes to the current schema. Version 1 is the first
 * release, so there is nothing to migrate yet; future versions add steps here.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (raw.version === SCHEMA_VERSION) return raw
  return null
}

export function getDefaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export interface RecoveryCopy {
  key: string
  /** ISO timestamp of when the copy was made. */
  savedAt: string
  raw: string
}

/** Recovery copies, oldest first. */
export function listRecoveryCopies(store: KeyValueStore | null = getDefaultStore()): RecoveryCopy[] {
  if (!store) return []
  const copies: RecoveryCopy[] = []
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (!key?.startsWith(RECOVERY_KEY_PREFIX)) continue
      const raw = store.getItem(key)
      if (raw !== null) copies.push({ key, savedAt: key.slice(RECOVERY_KEY_PREFIX.length), raw })
    }
  } catch {
    return []
  }
  return copies.sort((a, b) => a.savedAt.localeCompare(b.savedAt))
}

export function removeRecoveryCopies(store: KeyValueStore | null = getDefaultStore()): void {
  if (!store) return
  for (const copy of listRecoveryCopies(store)) {
    try {
      store.removeItem(copy.key)
    } catch {
      // Ignore: nothing else depends on this succeeding.
    }
  }
}

/**
 * Keeps a copy of data that couldn't be fully read. An identical copy is never
 * stored twice (the same damaged data is seen on every page load), and only
 * the newest few copies are kept.
 */
function preserveRaw(store: KeyValueStore, raw: string, now: Date): void {
  const existing = listRecoveryCopies(store)
  if (existing.some((copy) => copy.raw === raw)) return
  try {
    store.setItem(`${RECOVERY_KEY_PREFIX}${now.toISOString()}`, raw)
  } catch {
    // Storage full: nothing more we can safely do.
    return
  }
  const excess = existing.length + 1 - MAX_RECOVERY_COPIES
  for (const copy of existing.slice(0, Math.max(0, excess))) {
    try {
      store.removeItem(copy.key)
    } catch {
      // Ignore.
    }
  }
}

export function loadData(store: KeyValueStore | null = getDefaultStore(), now = new Date()): LoadResult {
  if (!store) return { data: emptyData(), status: 'unavailable', skipped: 0 }

  let raw: string | null
  try {
    raw = store.getItem(STORAGE_KEY)
  } catch {
    return { data: emptyData(), status: 'unavailable', skipped: 0 }
  }
  if (raw === null) return { data: emptyData(), status: 'ok', skipped: 0 }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    preserveRaw(store, raw, now)
    return { data: emptyData(), status: 'corrupted', skipped: 0 }
  }

  const migrated =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? migrate(parsed as Record<string, unknown>)
      : null
  if (!migrated || !Array.isArray(migrated.reminders)) {
    preserveRaw(store, raw, now)
    return { data: emptyData(), status: 'corrupted', skipped: 0 }
  }

  const reminders: Reminder[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const item of migrated.reminders) {
    const result = parseReminder(item)
    if (result.ok && !seen.has(result.value.id)) {
      seen.add(result.value.id)
      reminders.push(result.value)
    } else {
      skipped++
    }
  }
  if (skipped > 0) preserveRaw(store, raw, now)

  return {
    data: { version: SCHEMA_VERSION, reminders, preferences: parsePreferences(migrated.preferences) },
    status: skipped > 0 ? 'partial' : 'ok',
    skipped,
  }
}

/** Returns false if the data could not be written (storage blocked or full). */
export function saveData(data: StoredData, store: KeyValueStore | null = getDefaultStore()): boolean {
  if (!store) return false
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
