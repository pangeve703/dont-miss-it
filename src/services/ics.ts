import { CATEGORY_LABELS, type Reminder } from '../types/reminder'
import { formatMoney } from '../utils/currency'
import { addDays, parseDateOnly } from '../utils/dates'

/** Escapes a TEXT value per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Folds a content line to at most 75 octets (RFC 5545 §3.1). Continuation
 * lines start with a single space. Multi-byte characters are never split.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    const limit = out.length === 0 ? 75 : 74 // the leading space counts
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

function compactDate(value: string): string {
  return value.replace(/-/g, '')
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Builds a single all-day VEVENT for the reminder's deadline, with a calendar
 * alarm one day before. The alarm is handled by the user's calendar app.
 */
export function buildIcs(reminder: Reminder, now = new Date()): string {
  if (!parseDateOnly(reminder.deadline)) throw new Error('Reminder has an invalid deadline')

  const description = [
    `Category: ${CATEGORY_LABELS[reminder.category]}`,
    reminder.amount !== null && reminder.currency
      ? `Amount: ${formatMoney(reminder.amount, reminder.currency, 'en')}`
      : null,
    reminder.notes.trim() ? `Notes: ${reminder.notes.trim()}` : null,
    'Created with Don’t Miss It',
  ]
    .filter((line): line is string => line !== null)
    .join('\n')

  const summary = `Deadline: ${reminder.title}`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dont Miss It//Deadline Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${reminder.id}@dont-miss-it`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;VALUE=DATE:${compactDate(reminder.deadline)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(reminder.deadline, 1))}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(summary)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export function icsFileName(reminder: Reminder): string {
  const slug = reminder.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return `${slug || 'reminder'}-${reminder.deadline}.ics`
}
