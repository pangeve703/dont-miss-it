export const CATEGORIES = [
  'returns',
  'subscriptions',
  'trials',
  'warranties',
  'bills',
  'other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  returns: 'Returns & Refunds',
  subscriptions: 'Subscriptions',
  trials: 'Free Trials',
  warranties: 'Warranties',
  bills: 'Bills & Renewals',
  other: 'Other',
}

export interface Reminder {
  id: string
  title: string
  category: Category
  /** Local calendar date in `YYYY-MM-DD` form. Never parsed as UTC. */
  deadline: string
  /** Optional monetary value, e.g. the refund you would lose. */
  amount: number | null
  /** ISO 4217 code. Present whenever `amount` is set. */
  currency: string | null
  notes: string
  /** ISO 8601 timestamp. */
  createdAt: string
  completed: boolean
  /** ISO 8601 timestamp, set when the reminder is marked done. */
  completedAt: string | null
}

/** The fields a user fills in on the form. */
export interface ReminderInput {
  title: string
  category: Category
  deadline: string
  amount: number | null
  currency: string | null
  notes: string
}

export type DeadlineStatus = 'overdue' | 'today' | 'soon' | 'upcoming' | 'completed'

export const STATUS_LABELS: Record<DeadlineStatus, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  soon: 'Due soon',
  upcoming: 'Upcoming',
  completed: 'Completed',
}

export interface Preferences {
  /** Default currency for new reminders. */
  currency: string
}

export const SCHEMA_VERSION = 1

export interface StoredData {
  version: typeof SCHEMA_VERSION
  reminders: Reminder[]
  preferences: Preferences
}

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}
