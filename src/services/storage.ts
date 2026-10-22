import { SCHEMA_VERSION, type Preferences, type Reminder, type StoredData } from '../types/reminder'
import { DEFAULT_CURRENCY, isCurrencyCode } from '../utils/currency'
import { parseReminder } from '../utils/validation'

export const STORAGE_KEY = 'dont-miss-it'
/** Unreadable data is copied here before anything is overwritten. */
export const RECOVERY_KEY_PREFIX = 'dont-miss-it:recovery:'

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

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

function getDefaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function preserveRaw(store: KeyValueStore, raw: string, now: Date): void {
  try {
    store.setItem(`${RECOVERY_KEY_PREFIX}${now.toISOString()}`, raw)
  } catch {
    // Storage full: nothing more we can safely do.
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
