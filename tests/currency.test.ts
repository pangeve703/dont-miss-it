import { describe, expect, it } from 'vitest'
import { currencyOptions, isCurrencyCode, parseAmountInput, totalsByCurrency } from '../src/utils/currency'
import { makeReminder } from './fixtures'

describe('totalsByCurrency', () => {
  it('never adds different currencies together', () => {
    const totals = totalsByCurrency(
      [
        makeReminder({ amount: 10, currency: 'USD' }),
        makeReminder({ amount: 5.5, currency: 'EUR' }),
        makeReminder({ amount: 20, currency: 'USD' }),
      ],
      'USD',
    )
    expect(totals).toEqual([
      { currency: 'USD', total: 30, count: 2 },
      { currency: 'EUR', total: 5.5, count: 1 },
    ])
  })

  it('puts the preferred currency first, then alphabetical', () => {
    const totals = totalsByCurrency(
      [
        makeReminder({ amount: 1, currency: 'USD' }),
        makeReminder({ amount: 1, currency: 'AUD' }),
        makeReminder({ amount: 1, currency: 'GBP' }),
      ],
      'GBP',
    )
    expect(totals.map((t) => t.currency)).toEqual(['GBP', 'AUD', 'USD'])
  })

  it('ignores reminders without an amount', () => {
    expect(totalsByCurrency([makeReminder(), makeReminder({ amount: null, currency: null })])).toEqual([])
  })

  it('avoids floating-point drift', () => {
    const totals = totalsByCurrency([
      makeReminder({ amount: 0.1, currency: 'USD' }),
      makeReminder({ amount: 0.2, currency: 'USD' }),
    ])
    expect(totals[0]?.total).toBe(0.3)
  })

  it('handles an empty dataset', () => {
    expect(totalsByCurrency([], 'USD')).toEqual([])
  })
})

describe('parseAmountInput', () => {
  it('parses plain and formatted numbers', () => {
    expect(parseAmountInput('49.99')).toBe(49.99)
    expect(parseAmountInput(' 1,299.50 ')).toBe(1299.5)
    expect(parseAmountInput('49,99')).toBe(49.99)
    expect(parseAmountInput('100')).toBe(100)
    expect(parseAmountInput('.5')).toBe(0.5)
  })

  it('returns null for an empty field', () => {
    expect(parseAmountInput('')).toBeNull()
    expect(parseAmountInput('   ')).toBeNull()
  })

  it('returns NaN for non-numbers', () => {
    expect(parseAmountInput('abc')).toBeNaN()
    expect(parseAmountInput('1.2.3')).toBeNaN()
    expect(parseAmountInput('$5')).toBeNaN()
    expect(parseAmountInput('.')).toBeNaN()
  })

  it('parses negatives so validation can explain the problem', () => {
    expect(parseAmountInput('-5')).toBe(-5)
  })
})

describe('isCurrencyCode', () => {
  it('accepts ISO codes and rejects others', () => {
    expect(isCurrencyCode('USD')).toBe(true)
    expect(isCurrencyCode('MYR')).toBe(true)
    expect(isCurrencyCode('usd')).toBe(false)
    expect(isCurrencyCode('DOLLARS')).toBe(false)
    expect(isCurrencyCode(42)).toBe(false)
  })
})

describe('currencyOptions', () => {
  it('lists preferred currencies first without duplicates', () => {
    const options = currencyOptions('GBP', 'GBP', null, 'THB')
    expect(options.slice(0, 3)).toEqual(['GBP', 'THB', 'USD'])
    expect(new Set(options).size).toBe(options.length)
  })
})
