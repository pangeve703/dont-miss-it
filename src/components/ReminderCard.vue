<script setup lang="ts">
import { computed } from 'vue'
import { CATEGORY_LABELS, STATUS_LABELS, type Reminder } from '../types/reminder'
import { formatMoney } from '../utils/currency'
import { daysBetween, describeDays, formatDate } from '../utils/dates'
import { getStatus } from '../utils/reminders'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ reminder: Reminder; today: string }>()
const emit = defineEmits<{
  edit: [reminder: Reminder]
  toggle: [reminder: Reminder]
  delete: [reminder: Reminder]
  calendar: [reminder: Reminder]
}>()

const status = computed(() => getStatus(props.reminder, props.today))
const days = computed(() => daysBetween(props.today, props.reminder.deadline))
const when = computed(() => (days.value === null ? '' : describeDays(days.value)))
const money = computed(() =>
  props.reminder.amount !== null && props.reminder.currency
    ? formatMoney(props.reminder.amount, props.reminder.currency)
    : null,
)
</script>

<template>
  <article class="reminder card" :class="`status-${status}`">
    <div class="main">
      <div class="top">
        <span class="badge">{{ STATUS_LABELS[status] }}</span>
        <span class="category">{{ CATEGORY_LABELS[reminder.category] }}</span>
      </div>
      <h3 class="title">{{ reminder.title }}</h3>
      <p class="meta">
        <time :datetime="reminder.deadline">{{ formatDate(reminder.deadline) }}</time>
        <template v-if="!reminder.completed && when">
          <span aria-hidden="true"> · </span>
          <span class="when">{{ when }}</span>
        </template>
      </p>
      <p v-if="reminder.notes" class="notes">{{ reminder.notes }}</p>
    </div>

    <div class="side">
      <p v-if="money" class="amount">
        <span class="visually-hidden">Amount: </span>{{ money }}
      </p>
      <div class="actions">
        <button
          type="button"
          class="btn btn-sm"
          :class="reminder.completed ? 'btn-ghost' : 'btn-secondary'"
          @click="emit('toggle', reminder)"
        >
          <AppIcon :name="reminder.completed ? 'undo' : 'check'" :size="16" />
          {{ reminder.completed ? 'Reopen' : 'Done' }}
          <span class="visually-hidden">: {{ reminder.title }}</span>
        </button>
        <button
          type="button"
          class="icon-btn"
          :aria-label="`Edit ${reminder.title}`"
          title="Edit"
          @click="emit('edit', reminder)"
        >
          <AppIcon name="edit" :size="18" />
        </button>
        <button
          type="button"
          class="icon-btn"
          :aria-label="`Add ${reminder.title} to your calendar (.ics file)`"
          title="Add to calendar (.ics)"
          @click="emit('calendar', reminder)"
        >
          <AppIcon name="calendar" :size="18" />
        </button>
        <button
          type="button"
          class="icon-btn danger"
          :aria-label="`Delete ${reminder.title}`"
          title="Delete"
          @click="emit('delete', reminder)"
        >
          <AppIcon name="trash" :size="18" />
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.reminder {
  --status-color: var(--accent);
  --status-bg: var(--accent-soft);
  position: relative;
  display: grid;
  gap: 12px;
  padding: 16px 16px 12px 20px;
  overflow: hidden;
}

.reminder::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--status-color);
}

@media (min-width: 640px) {
  .reminder {
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 16px 16px 16px 22px;
  }
}

.status-overdue {
  --status-color: var(--danger);
  --status-bg: var(--danger-soft);
}

.status-today {
  --status-color: #c2410c;
  --status-bg: var(--today-soft);
}

.status-soon {
  --status-color: #d97706;
  --status-bg: var(--warning-soft);
}

.status-completed {
  --status-color: var(--border-strong);
  --status-bg: var(--surface-muted);
  background: var(--surface-muted);
  box-shadow: none;
}

.main {
  min-width: 0;
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: var(--status-bg);
  color: var(--accent-text);
}

.status-overdue .badge {
  color: #8f1c12;
}

.status-today .badge {
  color: var(--today-text);
}

.status-soon .badge {
  color: var(--warning-text);
}

.status-completed .badge {
  color: var(--text-muted);
  background: var(--border);
}

.category {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.title {
  font-size: 1.05rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.status-completed .title {
  text-decoration: line-through;
  text-decoration-color: var(--border-strong);
  color: var(--text-muted);
}

.meta {
  margin-top: 2px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.when {
  font-weight: 600;
  color: var(--text);
}

.status-overdue .when {
  color: var(--danger);
}

.notes {
  margin-top: 6px;
  font-size: 0.875rem;
  color: var(--text-muted);
  white-space: pre-line;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.side {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

@media (min-width: 640px) {
  .side {
    flex-direction: column;
    align-items: flex-end;
    padding-top: 0;
    border-top: 0;
  }
}

.amount {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.actions .btn {
  margin-right: 4px;
}
</style>
