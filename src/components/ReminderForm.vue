<script setup lang="ts">
import { computed, nextTick, reactive, ref, useId } from 'vue'
import { CATEGORIES, CATEGORY_LABELS, type Category, type Reminder, type ReminderInput } from '../types/reminder'
import { currencyOptions, parseAmountInput } from '../utils/currency'
import { addDays, todayDateOnly } from '../utils/dates'
import { NOTES_MAX, TITLE_MAX, validateInput, type FieldErrors } from '../utils/validation'

const props = defineProps<{
  reminder?: Reminder
  defaultCurrency: string
}>()
const emit = defineEmits<{ submit: [input: ReminderInput]; cancel: [] }>()

const id = useId()
const form = reactive({
  title: props.reminder?.title ?? '',
  category: (props.reminder?.category ?? 'returns') as Category,
  deadline: props.reminder?.deadline ?? '',
  amount: props.reminder?.amount != null ? String(props.reminder.amount) : '',
  currency: props.reminder?.currency ?? props.defaultCurrency,
  notes: props.reminder?.notes ?? '',
})

const attempted = ref(false)
const formEl = ref<HTMLFormElement | null>(null)

const currencies = computed(() => currencyOptions(props.defaultCurrency, props.reminder?.currency))

const QUICK_DATES = [
  { label: '+7 days', days: 7 },
  { label: '+14 days', days: 14 },
  { label: '+30 days', days: 30 },
  { label: '+1 year', days: 365 },
]

function setQuickDate(days: number) {
  form.deadline = addDays(todayDateOnly(), days)
}

function toInput(): ReminderInput {
  const amount = parseAmountInput(form.amount)
  return {
    title: form.title,
    category: form.category,
    deadline: form.deadline,
    amount,
    currency: amount === null ? null : form.currency,
    notes: form.notes,
  }
}

// Errors appear once the user has tried to submit, then update as they type.
const errors = computed<FieldErrors>(() => (attempted.value ? validateInput(toInput()) : {}))

async function onSubmit() {
  attempted.value = true
  if (Object.keys(errors.value).length > 0) {
    await nextTick()
    formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  emit('submit', toInput())
}
</script>

<template>
  <form ref="formEl" class="reminder-form" novalidate @submit.prevent="onSubmit">
    <div class="field">
      <label :for="`${id}-title`">What do you need to remember?</label>
      <input
        :id="`${id}-title`"
        v-model="form.title"
        class="input"
        type="text"
        :maxlength="TITLE_MAX"
        placeholder="e.g. Return winter jacket"
        autocomplete="off"
        autofocus
        :aria-invalid="!!errors.title"
        :aria-describedby="errors.title ? `${id}-title-error` : undefined"
      />
      <p v-if="errors.title" :id="`${id}-title-error`" class="error">{{ errors.title }}</p>
    </div>

    <div class="row">
      <div class="field">
        <label :for="`${id}-category`">Category</label>
        <select
          :id="`${id}-category`"
          v-model="form.category"
          class="input"
          :aria-invalid="!!errors.category"
        >
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ CATEGORY_LABELS[c] }}</option>
        </select>
        <p v-if="errors.category" class="error">{{ errors.category }}</p>
      </div>

      <div class="field">
        <label :for="`${id}-deadline`">Deadline</label>
        <input
          :id="`${id}-deadline`"
          v-model="form.deadline"
          class="input"
          type="date"
          :aria-invalid="!!errors.deadline"
          :aria-describedby="`${id}-deadline-hint${errors.deadline ? ` ${id}-deadline-error` : ''}`"
        />
        <p v-if="errors.deadline" :id="`${id}-deadline-error`" class="error">{{ errors.deadline }}</p>
      </div>
    </div>

    <div class="quick-dates" role="group" :aria-labelledby="`${id}-deadline-hint`">
      <span :id="`${id}-deadline-hint`" class="hint">Set deadline from today:</span>
      <button
        v-for="q in QUICK_DATES"
        :key="q.days"
        type="button"
        class="chip"
        @click="setQuickDate(q.days)"
      >
        {{ q.label }}
      </button>
    </div>

    <fieldset class="field money">
      <legend class="label">Money at stake <span class="optional">(optional)</span></legend>
      <div class="money-row">
        <label class="visually-hidden" :for="`${id}-amount`">Amount</label>
        <input
          :id="`${id}-amount`"
          v-model="form.amount"
          class="input"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          autocomplete="off"
          :aria-invalid="!!errors.amount"
          :aria-describedby="`${id}-amount-hint${errors.amount ? ` ${id}-amount-error` : ''}`"
        />
        <label class="visually-hidden" :for="`${id}-currency`">Currency</label>
        <select
          :id="`${id}-currency`"
          v-model="form.currency"
          class="input currency"
          :aria-invalid="!!errors.currency"
        >
          <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <p :id="`${id}-amount-hint`" class="hint">The refund, fee or renewal cost you'd lose if you miss it.</p>
      <p v-if="errors.amount" :id="`${id}-amount-error`" class="error">{{ errors.amount }}</p>
      <p v-if="errors.currency" class="error">{{ errors.currency }}</p>
    </fieldset>

    <div class="field">
      <label :for="`${id}-notes`">Notes <span class="optional">(optional)</span></label>
      <textarea
        :id="`${id}-notes`"
        v-model="form.notes"
        class="input"
        :maxlength="NOTES_MAX"
        placeholder="Order number, where to cancel, return address…"
        :aria-invalid="!!errors.notes"
      />
      <p v-if="errors.notes" class="error">{{ errors.notes }}</p>
    </div>

    <div class="actions">
      <button type="button" class="btn btn-secondary" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="btn btn-primary">
        {{ reminder ? 'Save changes' : 'Add reminder' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.reminder-form {
  display: grid;
  gap: 18px;
}

.row {
  display: grid;
  gap: 18px;
}

@media (min-width: 480px) {
  .row {
    grid-template-columns: 1fr 1fr;
  }
}

.quick-dates {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: -6px;
}

.quick-dates .hint {
  font-size: 0.825rem;
  color: var(--text-muted);
  margin-right: 2px;
}

.chip {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.825rem;
  font-weight: 500;
  cursor: pointer;
}

.chip:hover {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}

fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

legend {
  padding: 0;
  margin-bottom: 6px;
}

.money-row {
  display: grid;
  grid-template-columns: 1fr 112px;
  gap: 8px;
}

.optional {
  font-weight: 400;
  color: var(--text-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

@media (max-width: 479px) {
  .actions .btn {
    flex: 1;
  }
}
</style>
