<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import FilterBar from '../components/FilterBar.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ReminderCard from '../components/ReminderCard.vue'
import ReminderForm from '../components/ReminderForm.vue'
import StatCards from '../components/StatCards.vue'
import { useReminders } from '../composables/useReminders'
import { ROUTE_HREFS } from '../composables/useRoute'
import { useToast } from '../composables/useToast'
import { useToday } from '../composables/useToday'
import { downloadText } from '../services/download'
import { buildIcs, icsFileName } from '../services/ics'
import type { Reminder, ReminderInput } from '../types/reminder'
import { totalsByCurrency } from '../utils/currency'
import { DEFAULT_QUERY, getStatus, queryReminders, summarize, type ReminderQuery } from '../utils/reminders'

const store = useReminders()
const { reminders, preferences } = store
const toast = useToast()
const today = useToday()

const query = ref<ReminderQuery>({ ...DEFAULT_QUERY })
const summary = computed(() => summarize(reminders.value, today.value))
const totals = computed(() =>
  totalsByCurrency(
    reminders.value.filter((r) => !r.completed),
    preferences.value.currency,
  ),
)
const results = computed(() => queryReminders(reminders.value, query.value, today.value))
const isFiltered = computed(
  () =>
    query.value.search.trim() !== '' ||
    query.value.category !== DEFAULT_QUERY.category ||
    query.value.status !== DEFAULT_QUERY.status,
)

/** For the "Active" view, split results into overdue and upcoming sections. */
const sections = computed(() => {
  if (query.value.status !== 'active') {
    return [{ key: 'results', title: 'Reminders', items: results.value }]
  }
  const overdue = results.value.filter((r) => getStatus(r, today.value) === 'overdue')
  const upcoming = results.value.filter((r) => getStatus(r, today.value) !== 'overdue')
  return [
    { key: 'overdue', title: 'Overdue', items: overdue },
    { key: 'upcoming', title: 'Coming up', items: upcoming },
  ].filter((s) => s.items.length > 0)
})

// Form and confirmation dialogs ---------------------------------------------

const formOpen = ref(false)
const editing = ref<Reminder | undefined>()
const pendingDelete = ref<Reminder | null>(null)

function openAdd() {
  editing.value = undefined
  formOpen.value = true
}

function openEdit(reminder: Reminder) {
  editing.value = reminder
  formOpen.value = true
}

function onSubmit(input: ReminderInput) {
  if (editing.value) {
    store.updateReminder(editing.value.id, input)
    toast.show('Changes saved.')
  } else {
    store.addReminder(input)
    toast.show(`Reminder added: ${input.title.trim()}`)
  }
  formOpen.value = false
}

function onToggle(reminder: Reminder) {
  const completing = !reminder.completed
  store.setCompleted(reminder.id, completing)
  if (completing) {
    toast.show('Marked as done.', 'success', {
      label: 'Undo',
      run: () => store.setCompleted(reminder.id, false),
    })
  } else {
    toast.show('Reminder reopened.')
  }
}

function confirmDelete() {
  if (!pendingDelete.value) return
  store.deleteReminder(pendingDelete.value.id)
  toast.show('Reminder deleted.')
  pendingDelete.value = null
}

function exportCalendar(reminder: Reminder) {
  try {
    downloadText(icsFileName(reminder), buildIcs(reminder), 'text/calendar;charset=utf-8')
    toast.show('Calendar file downloaded. Open it to add the event to your calendar.')
  } catch {
    toast.show('Sorry, the calendar file couldn’t be created.', 'error')
  }
}

function clearFilters() {
  query.value = { ...DEFAULT_QUERY, sort: query.value.sort }
}
</script>

<template>
  <div class="container dashboard">
    <!-- Storage problems are shown first because they affect everything else. -->
    <div v-if="store.loadStatus.value === 'unavailable'" class="notice notice-danger" role="alert">
      <AppIcon name="alert" />
      <p>
        Your browser is blocking local storage (this can happen in private browsing).
        Reminders you add now <strong>won't be saved</strong> after you close this tab.
      </p>
    </div>
    <div v-else-if="store.saveFailed.value" class="notice notice-danger" role="alert">
      <AppIcon name="alert" />
      <p>
        Your latest changes couldn't be saved, possibly because browser storage is full.
        <a :href="ROUTE_HREFS.backup">Export a backup</a> to keep them safe.
      </p>
    </div>
    <div v-if="store.loadStatus.value === 'corrupted'" class="notice notice-warning" role="alert">
      <AppIcon name="alert" />
      <p>
        Your saved reminders couldn't be read, so the app started fresh. A copy of the
        unreadable data was kept in this browser. If you have a backup file, you can
        <a :href="ROUTE_HREFS.backup">restore it</a>.
      </p>
    </div>
    <div v-else-if="store.loadStatus.value === 'partial'" class="notice notice-warning" role="alert">
      <AppIcon name="alert" />
      <p>
        {{ store.skippedOnLoad.value }} saved reminder(s) were damaged and couldn't be loaded.
        Everything else loaded normally.
      </p>
    </div>

    <section class="hero">
      <div>
        <h1>Your deadlines</h1>
        <p class="lede">Never forget a deadline that could cost you money.</p>
      </div>
      <button v-if="reminders.length > 0" type="button" class="btn btn-primary add-btn" @click="openAdd">
        <AppIcon name="plus" :size="18" />
        Add reminder
      </button>
    </section>

    <!-- First-run empty state -->
    <section v-if="reminders.length === 0" class="empty card">
      <div class="empty-icon"><AppIcon name="calendar" :size="28" /></div>
      <h2>Nothing to remember yet</h2>
      <p>
        Add the dates that cost you money when they slip by: a return window
        closing, a free trial converting to paid, a subscription renewing,
        or a warranty running out.
      </p>
      <ul class="examples">
        <li>Return headphones · 30 days</li>
        <li>Streaming trial ends · 7 days</li>
        <li>Laptop warranty · 1 year</li>
      </ul>
      <button type="button" class="btn btn-primary" @click="openAdd">
        <AppIcon name="plus" :size="18" />
        Add your first reminder
      </button>
      <p class="small">
        Everything stays private in this browser, with no account needed.
        Moving from another device? <a :href="ROUTE_HREFS.backup">Restore a backup</a>.
      </p>
    </section>

    <template v-else>
      <StatCards
        :active-count="summary.activeCount"
        :due-this-week-count="summary.dueThisWeekCount"
        :overdue-count="summary.overdueCount"
        :totals="totals"
      />

      <section class="list-area" aria-labelledby="list-heading">
        <h2 id="list-heading" class="visually-hidden">Reminder list</h2>
        <FilterBar v-model="query" />

        <p class="result-count" aria-live="polite">
          {{ results.length }} {{ results.length === 1 ? 'reminder' : 'reminders' }}
          <button v-if="isFiltered" type="button" class="link-btn" @click="clearFilters">
            Clear filters
          </button>
        </p>

        <div v-if="results.length === 0" class="no-results card">
          <p v-if="query.status === 'active' && !query.search && query.category === 'all'">
            🎉 All caught up. You have no active reminders.
          </p>
          <p v-else-if="query.status === 'overdue' && !query.search && query.category === 'all'">
            Nothing is overdue. Nice work.
          </p>
          <p v-else>No reminders match your search or filters.</p>
        </div>

        <section v-for="section in sections" :key="section.key" class="group">
          <h3 v-if="sections.length > 1 || section.key === 'overdue'" class="group-title" :class="section.key">
            {{ section.title }} <span class="count">{{ section.items.length }}</span>
          </h3>
          <ul class="reminder-list">
            <li v-for="r in section.items" :key="r.id">
              <ReminderCard
                :reminder="r"
                :today="today"
                @edit="openEdit"
                @toggle="onToggle"
                @delete="pendingDelete = $event"
                @calendar="exportCalendar"
              />
            </li>
          </ul>
        </section>
      </section>

      <p class="backup-hint">
        <AppIcon name="info" :size="16" />
        Reminders live only in this browser. Clearing browser data deletes them, so
        <a :href="ROUTE_HREFS.backup">export a backup</a> now and then.
        This app doesn't send notifications. To get an alert, add a reminder to your
        calendar with the <AppIcon name="calendar" :size="14" /> button.
      </p>
    </template>

    <ModalDialog v-if="formOpen" :title="editing ? 'Edit reminder' : 'New reminder'" @close="formOpen = false">
      <ReminderForm
        :reminder="editing"
        :default-currency="preferences.currency"
        @submit="onSubmit"
        @cancel="formOpen = false"
      />
    </ModalDialog>

    <ConfirmDialog
      v-if="pendingDelete"
      title="Delete this reminder?"
      confirm-label="Delete"
      danger
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    >
      <p><strong>{{ pendingDelete.title }}</strong> will be permanently removed. This can't be undone.</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 20px;
  padding-top: 24px;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-top: 4px;
}

.hero h1 {
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  font-weight: 750;
}

.lede {
  margin-top: 4px;
  color: var(--text-muted);
}

@media (max-width: 479px) {
  .add-btn {
    width: 100%;
    min-height: 48px;
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  padding: 40px 20px;
}

.empty h2 {
  font-size: 1.3rem;
}

.empty > p {
  max-width: 460px;
  color: var(--text-muted);
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: var(--accent-soft);
  color: var(--accent-text);
}

.examples {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.examples li {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px dashed var(--border-strong);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.empty .small {
  font-size: 0.85rem;
}

.list-area {
  display: grid;
  gap: 12px;
  margin-top: 8px;
}

.result-count {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.link-btn {
  border: 0;
  background: none;
  padding: 4px 0;
  color: var(--accent-text);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.no-results {
  padding: 28px 20px;
  text-align: center;
  color: var(--text-muted);
}

.group {
  display: grid;
  gap: 10px;
}

.group + .group {
  margin-top: 12px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.group-title.overdue {
  color: var(--danger);
}

.count {
  padding: 0 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.reminder-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.backup-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.backup-hint > svg:first-child {
  vertical-align: -3px;
  margin-right: 4px;
  color: var(--accent);
}

.backup-hint svg {
  vertical-align: -2px;
}
</style>
