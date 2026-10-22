import { computed, readonly, ref, watch } from 'vue'
import { config } from '../config'
import {
  buildReminderPayload,
  callEmailService,
  createToken,
  describeServiceError,
  loadEmailSettings,
  localTimeZone,
  saveEmailSettings,
  type EmailSettings,
  type ServiceResponse,
} from '../services/emailReminders'
import { getDefaultStore } from '../services/storage'
import { todayDateOnly } from '../utils/dates'
import { useReminders } from './useReminders'

/**
 * Optional email reminders. Off by default; nothing is sent anywhere until the
 * user turns it on. While on, the reminder list is re-sent to the service
 * (debounced) whenever it changes, so emails always match the app.
 */
const store = getDefaultStore()
const settings = ref<EmailSettings | null>(loadEmailSettings(store))
const busy = ref(false)
const syncError = ref<string | null>(null)

const { reminders } = useReminders()

function setSettings(next: EmailSettings | null): void {
  settings.value = next
  saveEmailSettings(store, next)
}

function payload(current: EmailSettings): Record<string, unknown> {
  return {
    token: current.token,
    daysBefore: current.daysBefore,
    timeZone: localTimeZone(),
    reminders: buildReminderPayload(reminders.value, todayDateOnly()),
  }
}

async function call(body: Record<string, unknown>): Promise<ServiceResponse> {
  return callEmailService(config.emailServiceUrl, body)
}

/** Applies the service's view of the subscription (it may have been unsubscribed by email link). */
function applyStatus(response: ServiceResponse): void {
  if (!response.ok || !settings.value) return
  if (response.status === 'none') setSettings(null)
  else if (response.status && response.status !== settings.value.status) {
    setSettings({ ...settings.value, status: response.status })
  }
}

async function sync(): Promise<void> {
  const current = settings.value
  if (!current || !config.emailServiceUrl) return
  const response = await call({ action: 'sync', ...payload(current) })
  syncError.value = response.ok ? null : describeServiceError(response.error)
  applyStatus(response)
}

let timer: ReturnType<typeof setTimeout> | undefined
function scheduleSync(): void {
  clearTimeout(timer)
  timer = setTimeout(() => void sync(), 2000)
}

// Keep the service up to date with reminder changes (including other tabs).
watch(reminders, scheduleSync, { deep: true })
// Also sync once on start-up, so a new day or missed change is caught.
if (settings.value) scheduleSync()

export function useEmailReminders() {
  async function turnOn(email: string, daysBefore: number): Promise<ServiceResponse> {
    busy.value = true
    try {
      const token = settings.value?.token ?? createToken()
      const draft: EmailSettings = { token, email: email.trim(), daysBefore, status: 'pending' }
      const response = await call({ action: 'subscribe', email: draft.email, ...payload(draft) })
      if (response.ok) setSettings({ ...draft, status: response.status === 'active' ? 'active' : 'pending' })
      return response
    } finally {
      busy.value = false
    }
  }

  async function turnOff(): Promise<ServiceResponse> {
    if (!settings.value) return { ok: true, status: 'none' }
    busy.value = true
    try {
      const response = await call({ action: 'unsubscribe', token: settings.value.token })
      if (response.ok) setSettings(null)
      return response
    } finally {
      busy.value = false
    }
  }

  async function refreshStatus(): Promise<void> {
    if (!settings.value) return
    applyStatus(await call({ action: 'status', token: settings.value.token }))
  }

  async function setDaysBefore(daysBefore: number): Promise<ServiceResponse> {
    if (!settings.value) return { ok: false }
    setSettings({ ...settings.value, daysBefore })
    busy.value = true
    try {
      const response = await call({ action: 'sync', ...payload(settings.value) })
      applyStatus(response)
      return response
    } finally {
      busy.value = false
    }
  }

  return {
    available: computed(() => config.emailServiceUrl !== ''),
    settings: readonly(settings),
    busy: readonly(busy),
    syncError: readonly(syncError),
    turnOn,
    turnOff,
    refreshStatus,
    setDaysBefore,
  }
}
