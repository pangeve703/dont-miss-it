import { describe, expect, it } from 'vitest'
import { DEFAULT_QUERY, compareByDeadline, getStatus, queryReminders, summarize } from '../src/utils/reminders'
import { makeReminder } from './fixtures'

const TODAY = '2026-03-10'

describe('getStatus', () => {
  it('marks past deadlines as overdue', () => {
    expect(getStatus(makeReminder({ deadline: '2026-03-09' }), TODAY)).toBe('overdue')
  })

  it('marks today as due today', () => {
    expect(getStatus(makeReminder({ deadline: '2026-03-10' }), TODAY)).toBe('today')
  })

  it('marks 1 to 7 days as due soon', () => {
    expect(getStatus(makeReminder({ deadline: '2026-03-11' }), TODAY)).toBe('soon')
    expect(getStatus(makeReminder({ deadline: '2026-03-17' }), TODAY)).toBe('soon')
  })

  it('marks more than 7 days as upcoming', () => {
    expect(getStatus(makeReminder({ deadline: '2026-03-18' }), TODAY)).toBe('upcoming')
  })

  it('treats completed reminders as completed regardless of date', () => {
    expect(getStatus(makeReminder({ deadline: '2020-01-01', completed: true }), TODAY)).toBe('completed')
  })

  it('handles the overdue boundary across a year change', () => {
    expect(getStatus(makeReminder({ deadline: '2026-12-31' }), '2027-01-01')).toBe('overdue')
    expect(getStatus(makeReminder({ deadline: '2027-01-01' }), '2026-12-31')).toBe('soon')
  })
})

describe('compareByDeadline', () => {
  it('sorts nearest first and latest first', () => {
    const a = makeReminder({ deadline: '2026-03-01' })
    const b = makeReminder({ deadline: '2026-04-01' })
    expect([b, a].sort((x, y) => compareByDeadline(x, y, 'nearest'))).toEqual([a, b])
    expect([a, b].sort((x, y) => compareByDeadline(x, y, 'latest'))).toEqual([b, a])
  })

  it('breaks ties by title', () => {
    const a = makeReminder({ deadline: '2026-03-01', title: 'Apple' })
    const b = makeReminder({ deadline: '2026-03-01', title: 'Banana' })
    expect([b, a].sort((x, y) => compareByDeadline(x, y))).toEqual([a, b])
  })
})

describe('queryReminders', () => {
  const shoes = makeReminder({ title: 'Return running shoes', category: 'returns', deadline: '2026-03-15' })
  const netflix = makeReminder({ title: 'Cancel Netflix trial', category: 'trials', deadline: '2026-03-05' })
  const laptop = makeReminder({ title: 'Laptop warranty', category: 'warranties', deadline: '2027-01-01' })
  const done = makeReminder({ title: 'Return shirt', category: 'returns', deadline: '2026-03-01', completed: true })
  const all = [shoes, netflix, laptop, done]

  it('shows active reminders sorted by nearest deadline by default', () => {
    expect(queryReminders(all, DEFAULT_QUERY, TODAY)).toEqual([netflix, shoes, laptop])
  })

  it('searches titles case-insensitively', () => {
    const result = queryReminders(all, { ...DEFAULT_QUERY, status: 'all', search: '  RETURN ' }, TODAY)
    expect(result).toEqual([done, shoes])
  })

  it('filters by category', () => {
    expect(queryReminders(all, { ...DEFAULT_QUERY, category: 'warranties' }, TODAY)).toEqual([laptop])
  })

  it('filters by completed and overdue status', () => {
    expect(queryReminders(all, { ...DEFAULT_QUERY, status: 'completed' }, TODAY)).toEqual([done])
    // A completed reminder with a past date is not overdue.
    expect(queryReminders(all, { ...DEFAULT_QUERY, status: 'overdue' }, TODAY)).toEqual([netflix])
  })

  it('sorts by latest deadline', () => {
    expect(queryReminders(all, { ...DEFAULT_QUERY, sort: 'latest' }, TODAY)).toEqual([laptop, shoes, netflix])
  })

  it('does not mutate the input array', () => {
    const copy = [...all]
    queryReminders(all, { ...DEFAULT_QUERY, sort: 'latest' }, TODAY)
    expect(all).toEqual(copy)
  })

  it('handles an empty dataset', () => {
    expect(queryReminders([], DEFAULT_QUERY, TODAY)).toEqual([])
  })
})

describe('summarize', () => {
  it('counts active, due this week and overdue reminders', () => {
    const reminders = [
      makeReminder({ deadline: '2026-03-09' }), // overdue
      makeReminder({ deadline: '2026-03-10' }), // today
      makeReminder({ deadline: '2026-03-17' }), // soon (7 days)
      makeReminder({ deadline: '2026-03-18' }), // upcoming (8 days)
      makeReminder({ deadline: '2026-03-11', completed: true }),
    ]
    const s = summarize(reminders, TODAY)
    expect(s.activeCount).toBe(4)
    expect(s.dueThisWeekCount).toBe(2)
    expect(s.overdueCount).toBe(1)
    expect(s.overdue.map((r) => r.deadline)).toEqual(['2026-03-09'])
    expect(s.upcoming.map((r) => r.deadline)).toEqual(['2026-03-10', '2026-03-17', '2026-03-18'])
  })

  it('handles an empty dataset', () => {
    expect(summarize([], TODAY)).toEqual({
      activeCount: 0,
      dueThisWeekCount: 0,
      overdueCount: 0,
      overdue: [],
      upcoming: [],
    })
  })
})
