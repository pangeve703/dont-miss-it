import { computed, reactive, readonly, ref, watch } from 'vue'
import type { Preferences, Reminder, ReminderInput, StoredData } from '../types/reminder'
import { SCHEMA_VERSION } from '../types/reminder'
import { loadData, saveData, type LoadStatus } from '../services/storage'
import { createId } from '../utils/reminders'

/**
 * App-wide reminder state. A single module-level store is enough for an app
 * this size; every change is written straight back to localStorage.
 */
const loaded = loadData()

const state = reactive<{ reminders: Reminder[]; preferences: Preferences }>({
  reminders: loaded.data.reminders,
  preferences: loaded.data.preferences,
})

const loadStatus = ref<LoadStatus>(loaded.status)
const skippedOnLoad = ref(loaded.skipped)
const saveFailed = ref(false)

function persist(): void {
  const data: StoredData = {
    version: SCHEMA_VERSION,
    reminders: state.reminders,
    preferences: state.preferences,
  }
  saveFailed.value = !saveData(data)
}

// If stored data was unreadable, loadData() already copied it to a recovery
// key, so writing fresh data here never destroys the only copy.
watch(state, persist, { deep: true })

function cleanInput(input: ReminderInput): ReminderInput {
  return {
    title: input.title.trim(),
    category: input.category,
    deadline: input.deadline,
    amount: input.amount,
    currency: input.amount === null ? null : input.currency,
    notes: input.notes.trim(),
  }
}

export function useReminders() {
  function addReminder(input: ReminderInput): Reminder {
    const reminder: Reminder = {
      ...cleanInput(input),
      id: createId(),
      createdAt: new Date().toISOString(),
      completed: false,
      completedAt: null,
    }
    state.reminders.push(reminder)
    return reminder
  }

  function updateReminder(id: string, input: ReminderInput): void {
    const reminder = state.reminders.find((r) => r.id === id)
    if (reminder) Object.assign(reminder, cleanInput(input))
  }

  function setCompleted(id: string, completed: boolean): void {
    const reminder = state.reminders.find((r) => r.id === id)
    if (!reminder) return
    reminder.completed = completed
    reminder.completedAt = completed ? new Date().toISOString() : null
  }

  function deleteReminder(id: string): Reminder | undefined {
    const index = state.reminders.findIndex((r) => r.id === id)
    if (index === -1) return undefined
    return state.reminders.splice(index, 1)[0]
  }

  function replaceAll(reminders: Reminder[], preferences: Preferences): void {
    state.reminders.splice(0, state.reminders.length, ...reminders)
    state.preferences.currency = preferences.currency
  }

  function setPreferredCurrency(currency: string): void {
    state.preferences.currency = currency
  }

  return {
    reminders: computed<readonly Reminder[]>(() => state.reminders),
    preferences: computed(() => state.preferences),
    loadStatus: readonly(loadStatus),
    skippedOnLoad: readonly(skippedOnLoad),
    saveFailed: readonly(saveFailed),
    addReminder,
    updateReminder,
    setCompleted,
    deleteReminder,
    replaceAll,
    setPreferredCurrency,
  }
}
