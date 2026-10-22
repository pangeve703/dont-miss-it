import type { Reminder } from '../types/reminder'
import type { KeyValueStore } from './storage'

/**
 * Client for the optional email reminder service (see email-service/).
 *
 * Nothing here runs unless the user turns email reminders on. Only the email
 * address, time zone, and the title and date of active reminders are sent.
 * Amounts and notes never leave the browser.
 */

export const EMAIL_SETTINGS_KEY = 'dont-miss-it:email'
export const MAX_SYNCED_REMINDERS = 100
export const DAYS_BEFORE_OPTIONS = [0, 1, 3, 7] as const

export type EmailStatus = 'none' | 'pending' | 'active'

export interface EmailSettings {
  /** Random secret identifying this browser's subscription. */
  token: string
  email: string
  daysBefore: number
  status: Exclude<EmailStatus, 'none'>
}

export interface SyncedReminder {
  id: string
  title: string
  deadline: string
}

export interface ServiceResponse {
  ok: boolean
  status?: EmailStatus
  error?: string
}

export function describeDaysBefore(days: number): string {
  if (days === 0) return 'On the day only'
  return `${days} ${days === 1 ? 'day' : 'days'} before`
}

export function isValidEmail(value: string): boolean {
  const email = value.trim()
  return email.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/.test(email)
}

/** The minimum the service needs: active reminders that aren't past, nearest first. */
export function buildReminderPayload(reminders: readonly Reminder[], today: string): SyncedReminder[] {
  return reminders
    .filter((r) => !r.completed && r.deadline >= today)
    .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0))
    .slice(0, MAX_SYNCED_REMINDERS)
    .map((r) => ({ id: r.id, title: r.title, deadline: r.deadline }))
}

export function createToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function parseEmailSettings(raw: unknown): EmailSettings | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { token, email, daysBefore, status } = raw as Record<string, unknown>
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  if (typeof email !== 'string' || !isValidEmail(email)) return null
  if (typeof daysBefore !== 'number' || !(DAYS_BEFORE_OPTIONS as readonly number[]).includes(daysBefore)) return null
  if (status !== 'pending' && status !== 'active') return null
  return { token, email, daysBefore, status }
}

export function loadEmailSettings(store: KeyValueStore | null): EmailSettings | null {
  try {
    const raw = store?.getItem(EMAIL_SETTINGS_KEY)
    return raw ? parseEmailSettings(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function saveEmailSettings(store: KeyValueStore | null, settings: EmailSettings | null): void {
  try {
    if (settings) store?.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings))
    else store?.removeItem(EMAIL_SETTINGS_KEY)
  } catch {
    // Storage blocked: settings just won't persist past this session.
  }
}

/**
 * Calls the Apps Script web app. The body is sent as text/plain so the browser
 * doesn't need a CORS preflight, which Apps Script can't answer.
 */
export async function callEmailService(
  url: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 20000,
): Promise<ServiceResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!response.ok) return { ok: false, error: 'network' }
    const data = (await response.json()) as unknown
    if (typeof data !== 'object' || data === null || typeof (data as ServiceResponse).ok !== 'boolean') {
      return { ok: false, error: 'bad_response' }
    }
    return data as ServiceResponse
  } catch {
    return { ok: false, error: 'network' }
  } finally {
    clearTimeout(timer)
  }
}

export function describeServiceError(error: string | undefined): string {
  switch (error) {
    case 'invalid_email':
      return 'That email address doesn’t look right.'
    case 'busy':
      return 'The reminder service is busy right now. Please try again in an hour.'
    case 'network':
      return 'Couldn’t reach the reminder service. Check your connection and try again.'
    default:
      return 'Something went wrong with the reminder service. Please try again later.'
  }
}
