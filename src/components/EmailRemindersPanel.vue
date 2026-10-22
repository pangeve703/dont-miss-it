<script setup lang="ts">
import { onMounted, ref, useId } from 'vue'
import { useEmailReminders } from '../composables/useEmailReminders'
import { useToast } from '../composables/useToast'
import {
  DAYS_BEFORE_OPTIONS,
  describeDaysBefore,
  describeServiceError,
  isValidEmail,
} from '../services/emailReminders'
import AppIcon from './AppIcon.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const email = useEmailReminders()
const toast = useToast()
const id = useId()

const address = ref('')
const daysBefore = ref(1)
const error = ref<string | null>(null)
const confirmOff = ref(false)

// The user may have confirmed (or unsubscribed) from their inbox meanwhile.
onMounted(() => void email.refreshStatus())

async function onTurnOn() {
  error.value = null
  if (!isValidEmail(address.value)) {
    error.value = 'Enter a valid email address, e.g. name@example.com.'
    return
  }
  const response = await email.turnOn(address.value, daysBefore.value)
  if (!response.ok) {
    error.value = describeServiceError(response.error)
    return
  }
  toast.show(
    response.status === 'active' ? 'Email reminders are on.' : 'Almost done. Check your inbox to confirm.',
  )
}

async function onResend() {
  const current = email.settings.value
  if (!current) return
  const response = await email.turnOn(current.email, current.daysBefore)
  toast.show(response.ok ? 'Confirmation email sent again (if it wasn’t sent in the last 10 minutes).' : describeServiceError(response.error), response.ok ? 'success' : 'error')
}

async function onCheck() {
  await email.refreshStatus()
  if (email.settings.value?.status === 'active') toast.show('Confirmed. Email reminders are on.')
  else toast.show('Not confirmed yet. Open the link in the email we sent you.', 'info')
}

async function onChangeTiming(event: Event) {
  const response = await email.setDaysBefore(Number((event.target as HTMLSelectElement).value))
  toast.show(response.ok ? 'Reminder timing updated.' : describeServiceError(response.error), response.ok ? 'success' : 'error')
}

async function onTurnOff() {
  confirmOff.value = false
  const response = await email.turnOff()
  toast.show(
    response.ok ? 'Email reminders are off. Your email address was deleted from the service.' : describeServiceError(response.error),
    response.ok ? 'success' : 'error',
  )
}
</script>

<template>
  <section v-if="email.available.value" class="card panel" aria-labelledby="email-heading">
    <div class="panel-text">
      <h2 id="email-heading">
        Email reminders <span class="optional">(optional)</span>
      </h2>

      <!-- Off -->
      <template v-if="!email.settings.value">
        <p>
          Get an email when a deadline is coming up, even when this app is closed.
        </p>
        <ul class="facts">
          <li>
            <AppIcon name="shield" :size="16" />
            <span>
              Only your email address and the <strong>title and date</strong> of your active
              reminders are sent to the reminder service. Amounts and notes stay in this browser.
            </span>
          </li>
          <li>
            <AppIcon name="info" :size="16" />
            <span>
              Emails come from the project's Google account. You can turn this off at any time,
              and every email has an unsubscribe link. Turning it off deletes your data from the service.
            </span>
          </li>
        </ul>

        <form class="email-form" novalidate @submit.prevent="onTurnOn">
          <div class="field">
            <label :for="`${id}-email`">Email address</label>
            <input
              :id="`${id}-email`"
              v-model="address"
              class="input"
              type="email"
              autocomplete="email"
              inputmode="email"
              placeholder="name@example.com"
              :aria-invalid="!!error"
              :aria-describedby="error ? `${id}-error` : undefined"
            />
          </div>
          <div class="field">
            <label :for="`${id}-when`">When</label>
            <select :id="`${id}-when`" v-model.number="daysBefore" class="input">
              <option v-for="d in DAYS_BEFORE_OPTIONS" :key="d" :value="d">{{ describeDaysBefore(d) }}</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="email.busy.value">
            <AppIcon name="clock" :size="18" />
            {{ email.busy.value ? 'Turning on…' : 'Turn on email reminders' }}
          </button>
        </form>
        <p class="hint">You'll also get an email on the day itself, around 8am your time.</p>
        <p v-if="error" :id="`${id}-error`" class="error" role="alert">{{ error }}</p>
      </template>

      <!-- Waiting for confirmation -->
      <template v-else-if="email.settings.value.status === 'pending'">
        <div class="notice notice-info">
          <AppIcon name="info" />
          <p>
            We sent a confirmation link to <strong>{{ email.settings.value.email }}</strong>.
            Open it to start getting reminders. Check your spam folder if you don't see it.
          </p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-primary" :disabled="email.busy.value" @click="onCheck">
            I've confirmed
          </button>
          <button type="button" class="btn btn-secondary" :disabled="email.busy.value" @click="onResend">
            Resend email
          </button>
          <button type="button" class="btn btn-ghost" :disabled="email.busy.value" @click="confirmOff = true">
            Cancel
          </button>
        </div>
      </template>

      <!-- On -->
      <template v-else>
        <p>
          <AppIcon name="check" :size="16" class="on-icon" />
          Reminders are emailed to <strong>{{ email.settings.value.email }}</strong> around
          8am your time, including on the day itself.
        </p>
        <div class="active-row">
          <div class="field">
            <label :for="`${id}-timing`">When</label>
            <select
              :id="`${id}-timing`"
              class="input"
              :value="email.settings.value.daysBefore"
              :disabled="email.busy.value"
              @change="onChangeTiming"
            >
              <option v-for="d in DAYS_BEFORE_OPTIONS" :key="d" :value="d">{{ describeDaysBefore(d) }}</option>
            </select>
          </div>
          <button type="button" class="btn btn-secondary" :disabled="email.busy.value" @click="confirmOff = true">
            Turn off
          </button>
        </div>
      </template>

      <p v-if="email.settings.value && email.syncError.value" class="error" role="status">
        Your latest changes haven't reached the reminder service yet: {{ email.syncError.value }}
        It will try again next time you make a change.
      </p>
    </div>

    <ConfirmDialog
      v-if="confirmOff"
      title="Turn off email reminders?"
      confirm-label="Turn off"
      @confirm="onTurnOff"
      @cancel="confirmOff = false"
    >
      <p>You'll stop getting emails, and your email address and reminders will be deleted from the reminder service. Your reminders in this browser aren't affected.</p>
    </ConfirmDialog>
  </section>
</template>

<style scoped>
.panel {
  padding: 20px;
}

.panel-text {
  display: grid;
  gap: 12px;
}

h2 {
  font-size: 1.1rem;
}

.optional {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 0.95rem;
}

p {
  color: var(--text-muted);
  font-size: 0.925rem;
}

.facts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.facts li {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.facts svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent);
}

.email-form {
  display: grid;
  gap: 12px;
  align-items: end;
}

@media (min-width: 700px) {
  .email-form {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
  }
}

.hint {
  font-size: 0.825rem;
}

.error {
  color: var(--danger);
  font-weight: 500;
}

.actions,
.active-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
}

.active-row .field {
  flex: 0 1 280px;
}

.on-icon {
  vertical-align: -3px;
  margin-right: 4px;
  color: var(--accent);
}
</style>
