/**
 * Date helpers that work purely with local calendar dates.
 *
 * Deadlines are stored as `YYYY-MM-DD` strings. `new Date('2026-03-01')` parses
 * such a string as UTC midnight, which is the previous day for anyone west of
 * Greenwich, so these helpers always build dates from their parts instead.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** "Due soon" covers deadlines this many days away or fewer (excluding today). */
export const DUE_SOON_DAYS = 7

export interface DateParts {
  year: number
  month: number // 1-12
  day: number
}

/** Parses a `YYYY-MM-DD` string, rejecting impossible dates like 2025-02-29. */
export function parseDateOnly(value: string): DateParts | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return null
  if (day > daysInMonth(year, month)) return null
  return { year, month, day }
}

export function isValidDateOnly(value: unknown): value is string {
  return typeof value === 'string' && parseDateOnly(value) !== null
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this month. Date.UTC avoids DST.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Formats a Date's *local* calendar day as `YYYY-MM-DD`. */
export function toDateOnly(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayDateOnly(now: Date = new Date()): string {
  return toDateOnly(now)
}

/** A day count that is immune to DST because it compares UTC midnights. */
function dayNumber(parts: DateParts): number {
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY)
}

/**
 * Whole calendar days from `today` until `deadline`.
 * 0 = due today, negative = overdue. Returns null for invalid input.
 */
export function daysBetween(today: string, deadline: string): number | null {
  const a = parseDateOnly(today)
  const b = parseDateOnly(deadline)
  if (!a || !b) return null
  return dayNumber(b) - dayNumber(a)
}

export function daysRemaining(deadline: string, now: Date = new Date()): number | null {
  return daysBetween(todayDateOnly(now), deadline)
}

/** Adds calendar days to a `YYYY-MM-DD` string. */
export function addDays(value: string, days: number): string {
  const parts = parseDateOnly(value)
  if (!parts) throw new Error(`Invalid date: ${value}`)
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  const y = String(d.getUTCFullYear()).padStart(4, '0')
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A human-friendly date such as "Fri, 6 Mar 2026", in the user's locale. */
export function formatDate(value: string, locale?: string): string {
  const parts = parseDateOnly(value)
  if (!parts) return value
  // Noon local time keeps the displayed day stable in every timezone.
  const date = new Date(parts.year, parts.month - 1, parts.day, 12)
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** "in 3 days", "tomorrow", "today", "yesterday", "5 days ago". */
export function describeDays(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1) return `In ${days} days`
  return `${Math.abs(days)} days ago`
}
