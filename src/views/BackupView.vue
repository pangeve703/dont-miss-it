<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useReminders } from '../composables/useReminders'
import { useToast } from '../composables/useToast'
import { backupFileName, createBackup, parseBackup, serializeBackup, MAX_BACKUP_BYTES } from '../services/backup'
import { downloadText } from '../services/download'
import { listRecoveryCopies, removeRecoveryCopies, type RecoveryCopy } from '../services/storage'
import type { Preferences, Reminder } from '../types/reminder'
import { currencyOptions } from '../utils/currency'

const store = useReminders()
const { reminders, preferences } = store
const toast = useToast()
const id = useId()

const currencies = computed(() => currencyOptions(preferences.value.currency))
const fileInput = ref<HTMLInputElement | null>(null)
const importErrors = ref<string[]>([])
const pendingImport = ref<{ reminders: Reminder[]; preferences: Preferences; fileName: string } | null>(null)

function onCurrencyChange(event: Event) {
  store.setPreferredCurrency((event.target as HTMLSelectElement).value)
  toast.show('Default currency updated.')
}

function exportBackup() {
  const backup = createBackup([...reminders.value], { ...preferences.value })
  downloadText(backupFileName(), serializeBackup(backup), 'application/json')
  toast.show(`Backup downloaded with ${backup.reminders.length} reminder(s).`)
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow choosing the same file again
  if (!file) return

  importErrors.value = []
  if (file.size > MAX_BACKUP_BYTES) {
    importErrors.value = ['This file is too large to be a Don’t Miss It backup.']
    toast.show('Import failed. Nothing was changed.', 'error')
    return
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    importErrors.value = ['The file couldn’t be read.']
    toast.show('Import failed. Nothing was changed.', 'error')
    return
  }

  const result = parseBackup(text)
  if (!result.ok) {
    importErrors.value = result.errors
    toast.show('Import failed. Nothing was changed.', 'error')
    return
  }

  pendingImport.value = { reminders: result.reminders, preferences: result.preferences, fileName: file.name }
  // With nothing to lose, there's no need to ask.
  if (reminders.value.length === 0) applyImport()
}

// Data the app couldn't read on startup is kept aside rather than deleted.
const recoveryCopies = ref<RecoveryCopy[]>(listRecoveryCopies())
const confirmClearRecovery = ref(false)

function downloadRecovery() {
  const bundle = recoveryCopies.value.map((copy) => ({ savedAt: copy.savedAt, content: copy.raw }))
  downloadText('dont-miss-it-recovered-data.json', JSON.stringify(bundle, null, 2), 'application/json')
  toast.show('Recovered data downloaded.')
}

function clearRecovery() {
  removeRecoveryCopies()
  recoveryCopies.value = listRecoveryCopies()
  confirmClearRecovery.value = false
  toast.show('Recovered data deleted.')
}

function applyImport() {
  if (!pendingImport.value) return
  store.replaceAll(pendingImport.value.reminders, pendingImport.value.preferences)
  toast.show(`Restored ${pendingImport.value.reminders.length} reminder(s) from your backup.`)
  pendingImport.value = null
}
</script>

<template>
  <div class="container page">
    <header class="page-header">
      <h1>Backup &amp; settings</h1>
      <p class="lede">Keep a copy of your reminders, or move them to another device or browser.</p>
    </header>

    <div class="notice notice-warning">
      <AppIcon name="alert" />
      <p>
        Your reminders are saved <strong>only in this browser</strong> on this device.
        Clearing your browsing data, using private browsing, or switching browsers
        will lose them. Export a backup every so often and keep it somewhere safe.
      </p>
    </div>

    <section v-if="recoveryCopies.length" class="card panel" aria-labelledby="recovery-heading">
      <div class="panel-text">
        <h2 id="recovery-heading">Recovered data</h2>
        <p>
          Some saved data couldn't be read, so instead of deleting it the app kept
          {{ recoveryCopies.length === 1 ? 'a copy' : `${recoveryCopies.length} copies` }}
          in this browser. Download it to keep it safe. It contains your reminders, so only
          share it with people you trust.
        </p>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-secondary" @click="downloadRecovery">
          <AppIcon name="download" :size="18" />
          Download
        </button>
        <button type="button" class="btn btn-ghost" @click="confirmClearRecovery = true">
          <AppIcon name="trash" :size="18" />
          Delete
        </button>
      </div>
    </section>

    <section class="card panel" aria-labelledby="export-heading">
      <div class="panel-text">
        <h2 id="export-heading">Export a backup</h2>
        <p>
          Downloads a <code>.json</code> file with
          {{ reminders.length === 1 ? 'your 1 reminder' : `all ${reminders.length} of your reminders` }}. The file is created on your device and isn't uploaded anywhere.
        </p>
      </div>
      <button type="button" class="btn btn-primary" @click="exportBackup">
        <AppIcon name="download" :size="18" />
        Export backup
      </button>
    </section>

    <section class="card panel" aria-labelledby="import-heading">
      <div class="panel-text">
        <h2 id="import-heading">Restore from a backup</h2>
        <p>
          Choose a backup file exported from Don't Miss It. The file is checked first,
          and nothing changes unless it's valid. Restoring <strong>replaces</strong> the
          reminders currently in this browser, and you'll be asked to confirm first.
        </p>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        class="visually-hidden"
        tabindex="-1"
        aria-hidden="true"
        @change="onFileChosen"
      />
      <button type="button" class="btn btn-secondary" @click="fileInput?.click()">
        <AppIcon name="upload" :size="18" />
        Choose backup file
      </button>
      <div v-if="importErrors.length" class="notice notice-danger import-errors" role="alert">
        <AppIcon name="alert" />
        <div>
          <p><strong>That file couldn't be imported.</strong> Your existing reminders were not changed.</p>
          <ul>
            <li v-for="e in importErrors" :key="e">{{ e }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="card panel" aria-labelledby="prefs-heading">
      <div class="panel-text">
        <h2 id="prefs-heading">Default currency</h2>
        <p>
          Used for new reminders and shown first in your totals. Amounts in different
          currencies are always totalled separately and never converted.
        </p>
      </div>
      <div class="field currency-field">
        <label :for="`${id}-currency`" class="visually-hidden">Default currency</label>
        <select :id="`${id}-currency`" class="input" :value="preferences.currency" @change="onCurrencyChange">
          <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </section>

    <ConfirmDialog
      v-if="pendingImport && reminders.length > 0"
      title="Replace your reminders?"
      confirm-label="Replace reminders"
      danger
      @confirm="applyImport"
      @cancel="pendingImport = null"
    >
      <p>
        <strong>{{ pendingImport.fileName }}</strong> contains
        <strong>{{ pendingImport.reminders.length }}</strong> reminder(s).
      </p>
      <p>
        Restoring it will permanently replace the <strong>{{ reminders.length }}</strong>
        reminder(s) currently in this browser. If you might need them, cancel and export a
        backup first.
      </p>
    </ConfirmDialog>

    <ConfirmDialog
      v-if="confirmClearRecovery"
      title="Delete recovered data?"
      confirm-label="Delete"
      danger
      @confirm="clearRecovery"
      @cancel="confirmClearRecovery = false"
    >
      <p>The recovered copies will be permanently removed from this browser. Your current reminders aren't affected.</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  padding-top: 28px;
}

.page-header h1 {
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  font-weight: 750;
}

.lede {
  margin-top: 4px;
  color: var(--text-muted);
}

.panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 24px;
  padding: 20px;
}

.panel-text {
  flex: 1 1 320px;
}

.panel h2 {
  font-size: 1.1rem;
  margin-bottom: 4px;
}

.panel p {
  color: var(--text-muted);
  font-size: 0.925rem;
}

code {
  font-size: 0.85em;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-muted);
}

.import-errors {
  flex-basis: 100%;
}

.import-errors p {
  color: inherit;
}

.import-errors ul {
  margin: 6px 0 0;
  padding-left: 18px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.currency-field {
  width: 140px;
}
</style>
