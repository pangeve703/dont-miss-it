import { describe, expect, it } from 'vitest'
import type { ReminderInput } from '../src/types/reminder'
import { parseReminder, validateInput } from '../src/utils/validation'
import { makeReminder } from './fixtures'

const valid: ReminderInput = {
  title: 'Return jacket',
  category: 'returns',
  deadline: '2026-03-10',
  amount: 89.99,
  currency: 'USD',
  notes: '',
}

describe('validateInput', () => {
  it('accepts a valid reminder', () => {
    expect(validateInput(valid)).toEqual({})
    expect(validateInput({ ...valid, amount: null, currency: null })).toEqual({})
  })

  it('requires a title and a deadline', () => {
    const errors = validateInput({ ...valid, title: '   ', deadline: '' })
    expect(errors.title).toBeDefined()
    expect(errors.deadline).toBeDefined()
  })

  it('rejects impossible dates', () => {
    expect(validateInput({ ...valid, deadline: '2026-02-30' }).deadline).toBeDefined()
  })

  it('rejects bad amounts', () => {
    expect(validateInput({ ...valid, amount: Number.NaN }).amount).toBeDefined()
    expect(validateInput({ ...valid, amount: -1 }).amount).toBeDefined()
  })

  it('requires a currency when an amount is given', () => {
    expect(validateInput({ ...valid, currency: null }).currency).toBeDefined()
  })
})

describe('parseReminder', () => {
  it('accepts a valid reminder', () => {
    const r = makeReminder({ amount: 5, currency: 'EUR' })
    expect(parseReminder(r)).toEqual({ ok: true, value: r })
  })

  it('strips unknown fields', () => {
    const r = { ...makeReminder(), extra: '<script>' }
    const result = parseReminder(r)
    expect(result.ok && 'extra' in result.value).toBe(false)
  })

  it.each([
    ['a non-object', 'nope'],
    ['a missing id', { ...makeReminder(), id: '' }],
    ['an unknown category', { ...makeReminder(), category: 'groceries' }],
    ['an invalid date', { ...makeReminder(), deadline: '2026-13-01' }],
    ['a string amount', { ...makeReminder(), amount: '5', currency: 'USD' }],
    ['an amount without currency', { ...makeReminder(), amount: 5, currency: null }],
    ['a bad currency', { ...makeReminder(), amount: 5, currency: 'XX' }],
    ['a non-boolean completed', { ...makeReminder(), completed: 'yes' }],
    ['a bad createdAt', { ...makeReminder(), createdAt: 'yesterday' }],
  ])('rejects %s', (_label, value) => {
    expect(parseReminder(value).ok).toBe(false)
  })
})
