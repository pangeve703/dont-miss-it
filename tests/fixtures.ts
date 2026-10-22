import type { Reminder } from '../src/types/reminder'

let counter = 0

export function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  counter++
  return {
    id: `id-${counter}`,
    title: `Reminder ${counter}`,
    category: 'returns',
    deadline: '2026-03-10',
    amount: null,
    currency: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    completed: false,
    completedAt: null,
    ...overrides,
  }
}
