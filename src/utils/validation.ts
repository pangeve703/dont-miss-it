import { isCategory, type Reminder, type ReminderInput } from '../types/reminder'
import { isCurrencyCode } from './currency'
import { isValidDateOnly } from './dates'

export const TITLE_MAX = 120
export const NOTES_MAX = 2000
export const AMOUNT_MAX = 1_000_000_000

export type FieldErrors = Partial<Record<keyof ReminderInput, string>>

/** Validates what the user typed into the reminder form. */
export function validateInput(input: ReminderInput): FieldErrors {
  const errors: FieldErrors = {}
  const title = input.title.trim()
  if (!title) errors.title = 'Give this reminder a name, e.g. \u201cReturn running shoes\u201d.'
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`

  if (!isCategory(input.category)) errors.category = 'Choose a category.'

  if (!input.deadline) errors.deadline = 'Pick the deadline date.'
  else if (!isValidDateOnly(input.deadline)) errors.deadline = 'That date doesn’t look right. Use the date picker.'

  if (input.amount !== null) {
    if (!Number.isFinite(input.amount)) errors.amount = 'Enter a number, e.g. 49.99.'
    else if (input.amount < 0) errors.amount = 'The amount can’t be negative.'
    else if (input.amount > AMOUNT_MAX) errors.amount = 'That amount is too large.'
    if (!input.currency || !isCurrencyCode(input.currency)) {
      errors.currency = 'Choose a currency for this amount.'
    }
  }

  if (input.notes.length > NOTES_MAX) errors.notes = `Notes are limited to ${NOTES_MAX} characters.`
  return errors
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

/**
 * Checks that an unknown value (from storage or an imported file) is a
 * well-formed reminder. Returns a cleaned copy containing only known fields.
 */
export function parseReminder(raw: unknown): ParseResult<Reminder> {
  if (!isPlainObject(raw)) return { ok: false, error: 'is not an object' }
  const { id, title, category, deadline, amount, currency, notes, createdAt, completed, completedAt } = raw

  if (typeof id !== 'string' || !id || id.length > 100) return { ok: false, error: 'has a missing or invalid id' }
  if (typeof title !== 'string' || !title.trim() || title.length > TITLE_MAX) {
    return { ok: false, error: 'has a missing or invalid title' }
  }
  if (!isCategory(category)) return { ok: false, error: `has an unknown category "${String(category)}"` }
  if (!isValidDateOnly(deadline)) return { ok: false, error: `has an invalid deadline "${String(deadline)}"` }

  const amountValue = amount ?? null
  if (amountValue !== null && (typeof amountValue !== 'number' || !Number.isFinite(amountValue) || amountValue < 0 || amountValue > AMOUNT_MAX)) {
    return { ok: false, error: 'has an invalid amount' }
  }
  const currencyValue = currency ?? null
  if (currencyValue !== null && !isCurrencyCode(currencyValue)) {
    return { ok: false, error: `has an invalid currency "${String(currencyValue)}"` }
  }
  if (amountValue !== null && currencyValue === null) {
    return { ok: false, error: 'has an amount without a currency' }
  }

  const notesValue = notes ?? ''
  if (typeof notesValue !== 'string' || notesValue.length > NOTES_MAX) return { ok: false, error: 'has invalid notes' }
  if (!isIsoTimestamp(createdAt)) return { ok: false, error: 'has an invalid creation time' }
  if (typeof completed !== 'boolean') return { ok: false, error: 'has an invalid completion status' }
  const completedAtValue = completedAt ?? null
  if (completedAtValue !== null && !isIsoTimestamp(completedAtValue)) {
    return { ok: false, error: 'has an invalid completion time' }
  }

  return {
    ok: true,
    value: {
      id,
      title: title.trim(),
      category,
      deadline,
      amount: amountValue,
      // A currency without an amount carries no meaning, so drop it.
      currency: amountValue === null ? null : currencyValue,
      notes: notesValue,
      createdAt,
      completed,
      completedAt: completed ? completedAtValue : null,
    },
  }
}
