// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { STORAGE_KEY } from '../src/services/storage'
import type { ReminderInput } from '../src/types/reminder'

const input = (title: string): ReminderInput => ({
  title,
  category: 'returns',
  deadline: '2026-11-30',
  amount: null,
  currency: null,
  notes: '',
})

function storedTitles(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as { reminders: Array<{ title: string }> }).reminders.map((r) => r.title) : []
}

/** Imports a fresh copy of the store module, like opening the app in a new tab. */
async function openApp() {
  vi.resetModules()
  const mod = await import('../src/composables/useReminders')
  return { ...mod, store: mod.useReminders() }
}

beforeEach(() => {
  localStorage.clear()
})

describe('useReminders persistence', () => {
  it('saves add, edit, complete and delete to localStorage', async () => {
    const { store } = await openApp()
    const r = store.addReminder(input('  Return jacket  '))
    await nextTick()
    expect(storedTitles()).toEqual(['Return jacket'])

    expect(store.updateReminder(r.id, input('Return coat'))).toBe(true)
    await nextTick()
    expect(storedTitles()).toEqual(['Return coat'])

    store.setCompleted(r.id, true)
    await nextTick()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).reminders[0].completed).toBe(true)

    store.deleteReminder(r.id)
    await nextTick()
    expect(storedTitles()).toEqual([])
  })

  it('reloads saved data when the app is opened again', async () => {
    const first = await openApp()
    first.store.addReminder(input('Cancel trial'))
    await nextTick()
    const second = await openApp()
    expect(second.store.reminders.value.map((r) => r.title)).toEqual(['Cancel trial'])
  })

  it('reports when editing a reminder that no longer exists', async () => {
    const { store } = await openApp()
    expect(store.updateReminder('missing', input('x'))).toBe(false)
  })
})

describe('useReminders with several tabs open', () => {
  it("picks up another tab's changes instead of overwriting them", async () => {
    // Regression: tab B kept a stale copy and erased tab A's new reminder on its next save.
    const tabB = await openApp()

    // Tab A (simulated) saves a reminder, and the browser notifies tab B.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        preferences: { currency: 'EUR' },
        reminders: [
          {
            id: 'from-tab-a',
            title: 'Added in tab A',
            category: 'returns',
            deadline: '2026-11-30',
            amount: null,
            currency: null,
            notes: '',
            createdAt: '2026-10-22T00:00:00.000Z',
            completed: false,
            completedAt: null,
          },
        ],
      }),
    )
    tabB.handleStorageEvent({ key: STORAGE_KEY })
    await nextTick()
    expect(tabB.store.reminders.value.map((r) => r.title)).toEqual(['Added in tab A'])
    expect(tabB.store.preferences.value.currency).toBe('EUR')

    tabB.store.addReminder(input('Added in tab B'))
    await nextTick()
    expect(storedTitles()).toEqual(['Added in tab A', 'Added in tab B'])
  })

  it('also syncs when another tab clears storage', async () => {
    const tab = await openApp()
    tab.store.addReminder(input('Something'))
    await nextTick()
    localStorage.clear()
    tab.handleStorageEvent({ key: null })
    await nextTick()
    expect(tab.store.reminders.value).toEqual([])
  })

  it('ignores changes to unrelated keys', async () => {
    const tab = await openApp()
    tab.store.addReminder(input('Keep me'))
    await nextTick()
    tab.handleStorageEvent({ key: 'some-other-app' })
    expect(tab.store.reminders.value.map((r) => r.title)).toEqual(['Keep me'])
  })

  it('does not write data straight back after loading it from another tab', async () => {
    const tab = await openApp()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, preferences: { currency: 'USD' }, reminders: [] }))
    setItem.mockClear()
    tab.handleStorageEvent({ key: STORAGE_KEY })
    await nextTick()
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('listens for the browser storage event', async () => {
    const tab = await openApp()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, preferences: { currency: 'GBP' }, reminders: [] }),
    )
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    await nextTick()
    expect(tab.store.preferences.value.currency).toBe('GBP')
  })
})
