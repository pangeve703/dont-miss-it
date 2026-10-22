import { describe, expect, it, vi } from 'vitest'
import {
  MAX_SYNCED_REMINDERS,
  buildReminderPayload,
  callEmailService,
  createToken,
  describeDaysBefore,
  isValidEmail,
  parseEmailSettings,
} from '../src/services/emailReminders'
import { makeReminder } from './fixtures'

describe('buildReminderPayload', () => {
  it('sends only active, not-yet-past reminders, nearest first', () => {
    const payload = buildReminderPayload(
      [
        makeReminder({ id: 'late', deadline: '2026-12-01' }),
        makeReminder({ id: 'past', deadline: '2026-10-21' }),
        makeReminder({ id: 'done', deadline: '2026-11-01', completed: true }),
        makeReminder({ id: 'today', deadline: '2026-10-22' }),
      ],
      '2026-10-22',
    )
    expect(payload.map((r) => r.id)).toEqual(['today', 'late'])
  })

  it('never includes amounts, currencies or notes', () => {
    const [item] = buildReminderPayload(
      [makeReminder({ title: 'Return jacket', deadline: '2026-11-01', amount: 89, currency: 'USD', notes: 'Order #123' })],
      '2026-10-22',
    )
    expect(Object.keys(item!).sort()).toEqual(['deadline', 'id', 'title'])
  })

  it(`caps the list at ${MAX_SYNCED_REMINDERS}`, () => {
    const many = Array.from({ length: MAX_SYNCED_REMINDERS + 20 }, () => makeReminder({ deadline: '2026-11-01' }))
    expect(buildReminderPayload(many, '2026-10-22')).toHaveLength(MAX_SYNCED_REMINDERS)
  })
})

describe('email settings', () => {
  it('validates email addresses', () => {
    expect(isValidEmail('name@example.com')).toBe(true)
    expect(isValidEmail(' name@example.co.uk ')).toBe(true)
    expect(isValidEmail('name@example')).toBe(false)
    expect(isValidEmail('not an email')).toBe(false)
    expect(isValidEmail('a@b.c')).toBe(false)
  })

  it('creates URL-safe tokens the service accepts', () => {
    const token = createToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,64}$/)
    expect(createToken()).not.toBe(token)
  })

  it('parses stored settings and rejects bad ones', () => {
    const good = { token: createToken(), email: 'a@example.com', daysBefore: 3, status: 'active' }
    expect(parseEmailSettings(good)).toEqual(good)
    expect(parseEmailSettings({ ...good, daysBefore: 2 })).toBeNull()
    expect(parseEmailSettings({ ...good, status: 'none' })).toBeNull()
    expect(parseEmailSettings({ ...good, token: 'short' })).toBeNull()
    expect(parseEmailSettings(null)).toBeNull()
  })

  it('describes timing options', () => {
    expect(describeDaysBefore(0)).toBe('On the day only')
    expect(describeDaysBefore(1)).toBe('1 day before')
    expect(describeDaysBefore(7)).toBe('7 days before')
  })
})

describe('callEmailService', () => {
  const url = 'https://script.google.com/macros/s/x/exec'

  it('posts JSON as text/plain to avoid a CORS preflight', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, status: 'pending' })))
    const result = await callEmailService(url, { action: 'status', token: 't' }, fetchImpl as typeof fetch)
    expect(result).toEqual({ ok: true, status: 'pending' })
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/)
    expect(JSON.parse(init.body as string)).toEqual({ action: 'status', token: 't' })
  })

  it('reports network failures and bad responses instead of throwing', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await callEmailService(url, {}, failing as typeof fetch)).toEqual({ ok: false, error: 'network' })
    const html = vi.fn(async () => new Response('<html>error</html>'))
    expect((await callEmailService(url, {}, html as typeof fetch)).ok).toBe(false)
    const notOk = vi.fn(async () => new Response('', { status: 500 }))
    expect(await callEmailService(url, {}, notOk as typeof fetch)).toEqual({ ok: false, error: 'network' })
  })
})
