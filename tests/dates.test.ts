import { afterEach, describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  daysInMonth,
  daysRemaining,
  describeDays,
  isValidDateOnly,
  parseDateOnly,
  toDateOnly,
} from '../src/utils/dates'

describe('parseDateOnly', () => {
  it('parses valid dates', () => {
    expect(parseDateOnly('2026-03-01')).toEqual({ year: 2026, month: 3, day: 1 })
  })

  it.each(['', '2026-3-1', '2026/03/01', '2026-13-01', '2026-00-10', '2026-04-31', '2026-01-00', 'abc', '2026-02-30'])(
    'rejects %j',
    (value) => {
      expect(parseDateOnly(value)).toBeNull()
    },
  )

  it('handles leap years', () => {
    expect(isValidDateOnly('2024-02-29')).toBe(true)
    expect(isValidDateOnly('2025-02-29')).toBe(false)
    expect(isValidDateOnly('2000-02-29')).toBe(true) // divisible by 400
    expect(isValidDateOnly('1900-02-29')).toBe(false) // divisible by 100
  })

  it('rejects non-strings', () => {
    expect(isValidDateOnly(20260301)).toBe(false)
    expect(isValidDateOnly(null)).toBe(false)
  })
})

describe('daysInMonth', () => {
  it('knows month lengths', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })
})

describe('daysBetween', () => {
  it('returns 0 for the same day', () => {
    expect(daysBetween('2026-05-05', '2026-05-05')).toBe(0)
  })

  it('counts forward and backward', () => {
    expect(daysBetween('2026-05-05', '2026-05-06')).toBe(1)
    expect(daysBetween('2026-05-05', '2026-05-04')).toBe(-1)
    expect(daysBetween('2026-05-05', '2026-05-12')).toBe(7)
  })

  it('crosses month boundaries', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2026-04-30', '2026-05-01')).toBe(1)
  })

  it('crosses year boundaries', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2027-01-01', '2026-12-25')).toBe(-7)
  })

  it('handles February in leap and non-leap years', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })

  it('is unaffected by daylight-saving transitions', () => {
    // US and EU clocks change in March and October/November.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1)
  })

  it('returns null for invalid input', () => {
    expect(daysBetween('2026-05-05', 'not-a-date')).toBeNull()
    expect(daysBetween('2026-02-30', '2026-03-01')).toBeNull()
  })
})

describe('local-time handling', () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
  })

  it('uses the local calendar day late in the evening west of UTC', () => {
    process.env.TZ = 'America/Los_Angeles'
    // 11:30pm on 1 March in Los Angeles is already 2 March in UTC.
    const lateEvening = new Date(2026, 2, 1, 23, 30)
    expect(lateEvening.toISOString()).toBe('2026-03-02T07:30:00.000Z')
    expect(toDateOnly(lateEvening)).toBe('2026-03-01')
    expect(daysRemaining('2026-03-01', lateEvening)).toBe(0)
    expect(daysRemaining('2026-03-02', lateEvening)).toBe(1)
  })

  it('uses the local calendar day early in the morning east of UTC', () => {
    process.env.TZ = 'Pacific/Auckland'
    // 12:30am on 1 Jan in Auckland is still 31 Dec in UTC.
    const earlyMorning = new Date(2027, 0, 1, 0, 30)
    expect(earlyMorning.toISOString()).toBe('2026-12-31T11:30:00.000Z')
    expect(toDateOnly(earlyMorning)).toBe('2027-01-01')
    expect(daysRemaining('2026-12-31', earlyMorning)).toBe(-1)
  })
})

describe('addDays', () => {
  it('adds across boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01')
  })

  it('throws on invalid input', () => {
    expect(() => addDays('nope', 1)).toThrow()
  })
})

describe('describeDays', () => {
  it('produces friendly labels', () => {
    expect(describeDays(0)).toBe('Today')
    expect(describeDays(1)).toBe('Tomorrow')
    expect(describeDays(-1)).toBe('Yesterday')
    expect(describeDays(5)).toBe('In 5 days')
    expect(describeDays(-3)).toBe('3 days ago')
  })
})
