import type { Category, DeadlineStatus, Reminder } from '../types/reminder'
import { DUE_SOON_DAYS, daysBetween } from './dates'

export function getStatus(reminder: Reminder, today: string): DeadlineStatus {
  if (reminder.completed) return 'completed'
  const days = daysBetween(today, reminder.deadline)
  if (days === null) return 'upcoming'
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= DUE_SOON_DAYS) return 'soon'
  return 'upcoming'
}

export type StatusFilter = 'all' | 'active' | 'overdue' | 'completed'
export type SortOrder = 'nearest' | 'latest'

export interface ReminderQuery {
  search: string
  category: Category | 'all'
  status: StatusFilter
  sort: SortOrder
}

export const DEFAULT_QUERY: ReminderQuery = {
  search: '',
  category: 'all',
  status: 'active',
  sort: 'nearest',
}

export function matchesStatus(reminder: Reminder, filter: StatusFilter, today: string): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'active':
      return !reminder.completed
    case 'completed':
      return reminder.completed
    case 'overdue':
      return getStatus(reminder, today) === 'overdue'
  }
}

/** Compares deadlines; `YYYY-MM-DD` strings sort correctly as text. */
export function compareByDeadline(a: Reminder, b: Reminder, order: SortOrder = 'nearest'): number {
  const diff = a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0
  if (diff !== 0) return order === 'nearest' ? diff : -diff
  // Stable, predictable tie-break: title, then creation time.
  return a.title.localeCompare(b.title) || a.createdAt.localeCompare(b.createdAt)
}

export function queryReminders(
  reminders: readonly Reminder[],
  query: ReminderQuery,
  today: string,
): Reminder[] {
  const needle = query.search.trim().toLocaleLowerCase()
  return reminders
    .filter((r) => !needle || r.title.toLocaleLowerCase().includes(needle))
    .filter((r) => query.category === 'all' || r.category === query.category)
    .filter((r) => matchesStatus(r, query.status, today))
    .sort((a, b) => compareByDeadline(a, b, query.sort))
}

export interface DashboardSummary {
  activeCount: number
  dueThisWeekCount: number
  overdueCount: number
  overdue: Reminder[]
  upcoming: Reminder[]
}

/** Figures for the dashboard. "This week" means today plus the next seven days. */
export function summarize(reminders: readonly Reminder[], today: string): DashboardSummary {
  const active = reminders.filter((r) => !r.completed)
  const overdue: Reminder[] = []
  const upcoming: Reminder[] = []
  let dueThisWeekCount = 0
  for (const r of active) {
    const status = getStatus(r, today)
    if (status === 'overdue') overdue.push(r)
    else upcoming.push(r)
    if (status === 'today' || status === 'soon') dueThisWeekCount++
  }
  overdue.sort((a, b) => compareByDeadline(a, b))
  upcoming.sort((a, b) => compareByDeadline(a, b))
  return {
    activeCount: active.length,
    dueThisWeekCount,
    overdueCount: overdue.length,
    overdue,
    upcoming,
  }
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
