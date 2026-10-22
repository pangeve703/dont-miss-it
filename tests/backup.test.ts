import { describe, expect, it } from 'vitest'
import { backupFileName, createBackup, parseBackup, serializeBackup } from '../src/services/backup'
import { makeReminder } from './fixtures'

describe('backup export/import', () => {
  it('round-trips a backup', () => {
    const reminders = [makeReminder({ amount: 10, currency: 'EUR', notes: 'Line 1\nLine 2' }), makeReminder()]
    const text = serializeBackup(createBackup(reminders, { currency: 'EUR' }))
    expect(parseBackup(text)).toEqual({ ok: true, reminders, preferences: { currency: 'EUR' } })
  })

  it('accepts an empty backup', () => {
    const result = parseBackup(serializeBackup(createBackup([], { currency: 'USD' })))
    expect(result).toEqual({ ok: true, reminders: [], preferences: { currency: 'USD' } })
  })

  it('rejects invalid JSON', () => {
    expect(parseBackup('{oops').ok).toBe(false)
  })

  it('rejects JSON that is not a backup', () => {
    expect(parseBackup('[]').ok).toBe(false)
    expect(parseBackup('{"hello":"world"}').ok).toBe(false)
    expect(parseBackup('null').ok).toBe(false)
  })

  it('rejects backups from a newer version', () => {
    const result = parseBackup(JSON.stringify({ app: 'dont-miss-it', version: 2, reminders: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/newer version/)
  })

  it('rejects the whole file if any reminder is invalid', () => {
    const backup = createBackup([makeReminder(), makeReminder({ deadline: '2026-02-30' })], { currency: 'USD' })
    const result = parseBackup(serializeBackup(backup))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/Reminder 2/)
  })

  it('rejects duplicate ids', () => {
    const r = makeReminder()
    const result = parseBackup(serializeBackup(createBackup([r, r], { currency: 'USD' })))
    expect(result.ok).toBe(false)
  })

  it('caps the number of error messages shown', () => {
    const bad = Array.from({ length: 10 }, () => ({ nope: true }))
    const result = parseBackup(JSON.stringify({ app: 'dont-miss-it', version: 1, reminders: bad }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toHaveLength(6)
  })

  it('names the file with the local date', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('dont-miss-it-backup-2026-01-05.json')
  })
})
