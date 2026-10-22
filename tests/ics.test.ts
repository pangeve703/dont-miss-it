import { describe, expect, it } from 'vitest'
import { buildIcs, escapeIcsText, foldLine, icsFileName } from '../src/services/ics'
import { makeReminder } from './fixtures'

const NOW = new Date('2026-03-01T12:34:56.789Z')

function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n')
}

describe('escapeIcsText', () => {
  it('escapes special characters', () => {
    expect(escapeIcsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d')
    expect(escapeIcsText('line1\nline2\r\nline3')).toBe('line1\\nline2\\nline3')
  })
})

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds long lines to 75 octets', () => {
    const folded = foldLine(`DESCRIPTION:${'x'.repeat(200)}`)
    const encoder = new TextEncoder()
    for (const line of folded.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'x'.repeat(200)}`)
  })

  it('never splits a multi-byte character', () => {
    const text = `SUMMARY:${'€'.repeat(60)}`
    const folded = foldLine(text)
    const encoder = new TextEncoder()
    for (const line of folded.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(text)
  })
})

describe('buildIcs', () => {
  it('creates a valid all-day event', () => {
    const r = makeReminder({ id: 'abc', title: 'Return shoes', deadline: '2026-12-31' })
    const ics = buildIcs(r, NOW)
    const lines = unfold(ics)
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines).toContain('UID:abc@dont-miss-it')
    expect(lines).toContain('DTSTAMP:20260301T123456Z')
    expect(lines).toContain('DTSTART;VALUE=DATE:20261231')
    // DTEND is exclusive, so it's the next day, crossing the year boundary here.
    expect(lines).toContain('DTEND;VALUE=DATE:20270101')
    expect(lines).toContain('SUMMARY:Deadline: Return shoes')
    expect(lines).toContain('TRIGGER:-P1D')
    expect(lines.filter((l) => l.startsWith('BEGIN:')).length).toBe(
      lines.filter((l) => l.startsWith('END:')).length,
    )
  })

  it('uses CRLF line endings only', () => {
    const ics = buildIcs(makeReminder({ notes: 'a\nb' }), NOW)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('escapes user-provided text', () => {
    const r = makeReminder({
      title: 'Cancel gym; call, then email\\',
      notes: 'Line one\nLine two, with comma',
      amount: 1234.5,
      currency: 'USD',
    })
    const lines = unfold(buildIcs(r, NOW))
    expect(lines).toContain('SUMMARY:Deadline: Cancel gym\\; call\\, then email\\\\')
    const description = lines.find((l) => l.startsWith('DESCRIPTION:Category'))
    expect(description).toContain('Amount: $1\\,234.50')
    expect(description).toContain('Notes: Line one\\nLine two\\, with comma')
  })

  it('handles leap day deadlines', () => {
    const lines = unfold(buildIcs(makeReminder({ deadline: '2028-02-29' }), NOW))
    expect(lines).toContain('DTSTART;VALUE=DATE:20280229')
    expect(lines).toContain('DTEND;VALUE=DATE:20280301')
  })

  it('rejects an invalid deadline', () => {
    expect(() => buildIcs(makeReminder({ deadline: '2026-02-30' }), NOW)).toThrow()
  })
})

describe('icsFileName', () => {
  it('creates a safe file name', () => {
    expect(icsFileName(makeReminder({ title: 'Return: Shoes / Size 10!', deadline: '2026-03-10' }))).toBe(
      'return-shoes-size-10-2026-03-10.ics',
    )
    expect(icsFileName(makeReminder({ title: '!!!', deadline: '2026-03-10' }))).toBe('reminder-2026-03-10.ics')
  })
})
