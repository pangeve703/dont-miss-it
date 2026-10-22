import type { Reminder } from '../types/reminder'

/** A short list shown first in the currency picker. Any valid ISO code is accepted. */
export const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'HKD', 'SGD',
  'MYR', 'INR', 'CHF', 'SEK', 'NOK', 'DKK', 'ZAR', 'BRL', 'MXN', 'KRW',
]

export const DEFAULT_CURRENCY = 'USD'

export function isCurrencyCode(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) return false
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: value })
    return true
  } catch {
    return false
  }
}

export function formatMoney(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export interface CurrencyTotal {
  currency: string
  total: number
  count: number
}

/**
 * Sums amounts per currency. Different currencies are never added together.
 * The preferred currency (if present) comes first, the rest alphabetically.
 */
export function totalsByCurrency(
  reminders: readonly Reminder[],
  preferred?: string,
): CurrencyTotal[] {
  const map = new Map<string, CurrencyTotal>()
  for (const r of reminders) {
    if (r.amount === null || r.currency === null || !Number.isFinite(r.amount)) continue
    const entry = map.get(r.currency) ?? { currency: r.currency, total: 0, count: 0 }
    // Work in minor units to avoid floating-point drift such as 0.1 + 0.2.
    entry.total = Math.round(entry.total * 100 + r.amount * 100) / 100
    entry.count += 1
    map.set(r.currency, entry)
  }
  return [...map.values()].sort((a, b) => {
    if (a.currency === preferred) return -1
    if (b.currency === preferred) return 1
    return a.currency.localeCompare(b.currency)
  })
}

/**
 * Parses what a user typed into the amount box. Returns null for an empty
 * field and NaN for something that isn't a number. Accepts "1,299.99" and,
 * when there's a single comma and no dot, the decimal-comma form "49,99".
 */
export function parseAmountInput(value: string): number | null {
  let text = value.replace(/\s/g, '')
  if (!text) return null
  if (/^-?\d+,\d{1,2}$/.test(text)) text = text.replace(',', '.')
  else text = text.replace(/,/g, '')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return Number.NaN
  return Number(text)
}

/** Distinct currency options: the preferred ones first, then the common list. */
export function currencyOptions(...preferred: Array<string | null | undefined>): string[] {
  const out: string[] = []
  for (const c of [...preferred, ...COMMON_CURRENCIES]) {
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}
