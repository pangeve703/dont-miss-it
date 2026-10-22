import { SCHEMA_VERSION, type Preferences, type Reminder } from '../types/reminder'
import { parseReminder } from '../utils/validation'
import { parsePreferences } from './storage'

export const BACKUP_APP_ID = 'dont-miss-it'
/** Imported files larger than this are rejected before parsing. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  version: typeof SCHEMA_VERSION
  exportedAt: string
  reminders: Reminder[]
  preferences: Preferences
}

export function createBackup(reminders: Reminder[], preferences: Preferences, now = new Date()): BackupFile {
  return {
    app: BACKUP_APP_ID,
    version: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    reminders,
    preferences,
  }
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `dont-miss-it-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

export type ImportResult =
  | { ok: true; reminders: Reminder[]; preferences: Preferences }
  | { ok: false; errors: string[] }

/**
 * Validates the text of a backup file. Nothing is changed here: the caller
 * decides whether to apply the result after asking the user. The whole file
 * is rejected if any reminder is invalid, so a bad file can never half-apply.
 */
export function parseBackup(text: string): ImportResult {
  if (text.length > MAX_BACKUP_BYTES) {
    return { ok: false, errors: ['This file is too large to be a Don’t Miss It backup.'] }
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['This file isn’t valid JSON. Choose a backup exported from Don’t Miss It.'] }
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, errors: ['This file isn’t a Don’t Miss It backup.'] }
  }
  const obj = data as Record<string, unknown>
  if (obj.app !== BACKUP_APP_ID) {
    return { ok: false, errors: ['This file isn’t a Don’t Miss It backup.'] }
  }
  if (typeof obj.version !== 'number' || obj.version > SCHEMA_VERSION) {
    return { ok: false, errors: ['This backup was made by a newer version of the app. Please update and try again.'] }
  }
  if (obj.version !== SCHEMA_VERSION) {
    return { ok: false, errors: ['This backup uses an unsupported format version.'] }
  }
  if (!Array.isArray(obj.reminders)) {
    return { ok: false, errors: ['The backup has no reminder list.'] }
  }

  const errors: string[] = []
  const reminders: Reminder[] = []
  const ids = new Set<string>()
  obj.reminders.forEach((item, index) => {
    const result = parseReminder(item)
    if (!result.ok) {
      errors.push(`Reminder ${index + 1} ${result.error}.`)
    } else if (ids.has(result.value.id)) {
      errors.push(`Reminder ${index + 1} has a duplicate id.`)
    } else {
      ids.add(result.value.id)
      reminders.push(result.value)
    }
  })

  if (errors.length > 0) {
    const shown = errors.slice(0, 5)
    if (errors.length > 5) shown.push(`…and ${errors.length - 5} more problem(s).`)
    return { ok: false, errors: shown }
  }
  return { ok: true, reminders, preferences: parsePreferences(obj.preferences) }
}
