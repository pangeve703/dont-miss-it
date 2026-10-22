<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import { config } from '../config'
import { useEmailReminders } from '../composables/useEmailReminders'
import { ROUTE_HREFS } from '../composables/useRoute'

const { available: emailAvailable } = useEmailReminders()
</script>

<template>
  <div class="container page">
    <header class="page-header">
      <h1>About &amp; privacy</h1>
      <p class="lede">
        {{ config.appName }} is a small, free tool to help you remember the dates that cost
        money when they're missed.
      </p>
    </header>

    <div class="grid">
      <section class="card item">
        <span class="icon"><AppIcon name="shield" /></span>
        <h2>Your data stays with you</h2>
        <p>
          Reminders are saved in your browser's local storage on this device. There's no account,
          no analytics, no advertising trackers and no AI services. The app doesn't even load
          external fonts.
          <template v-if="emailAvailable">
            Nothing is sent to a server unless you turn on optional email reminders. Then only
            your email address and the title and date of your active reminders go to the
            reminder service (a Google Sheet run by the project maintainer). Turning it off
            deletes them.
          </template>
          <template v-else>Nothing is sent to a server.</template>
        </p>
      </section>

      <section class="card item">
        <span class="icon"><AppIcon name="download" /></span>
        <h2>Keep your own backups</h2>
        <p>
          Because nothing is stored online, clearing your browser data deletes your reminders,
          and they won't appear on your other devices automatically.
          <a :href="ROUTE_HREFS.backup">Export a backup</a> regularly and import it wherever you
          need it.
        </p>
      </section>

      <section class="card item">
        <span class="icon"><AppIcon name="calendar" /></span>
        <h2>About notifications</h2>
        <p>
          <template v-if="emailAvailable">
            Turn on optional <a :href="ROUTE_HREFS.backup">email reminders</a> to get an
            email before a deadline, even when the app is closed.
          </template>
          <template v-else>This app doesn't send notifications or emails.</template>
          It shows what's due whenever you open it. You can also use the calendar button on a reminder to download an
          <code>.ics</code> file. It includes an alert at 9am the day before, which Apple
          Calendar keeps. Some apps, including Google Calendar, ignore alerts in imported
          files, so check the event has a notification after adding it.
        </p>
      </section>

      <section class="card item">
        <span class="icon"><AppIcon name="coffee" /></span>
        <h2>Free and open source</h2>
        <p>
          {{ config.appName }} is MIT-licensed and free to use, with every feature available
          to everyone. It's supported by optional donations.
          <template v-if="config.donationUrl">
            If it's saved you some money, you can
            <a :href="config.donationUrl" target="_blank" rel="noopener noreferrer">buy me a coffee</a>.
          </template>
          <template v-if="config.repositoryUrl">
            The <a :href="config.repositoryUrl" target="_blank" rel="noopener noreferrer">source code</a>
            is on GitHub, where you can report issues or contribute.
          </template>
        </p>
      </section>
    </div>

    <section class="card item">
      <h2>How statuses work</h2>
      <dl class="statuses">
        <div><dt>Overdue</dt><dd>The deadline date has passed.</dd></div>
        <div><dt>Due today</dt><dd>The deadline is today.</dd></div>
        <div><dt>Due soon</dt><dd>The deadline is 1 to 7 days away.</dd></div>
        <div><dt>Upcoming</dt><dd>The deadline is more than 7 days away.</dd></div>
        <div><dt>Completed</dt><dd>You've marked it done.</dd></div>
      </dl>
      <p class="fine">
        Days are counted by calendar date in your device's time zone. Totals are shown
        separately for each currency and are never converted.
      </p>
    </section>
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
  max-width: 600px;
  color: var(--text-muted);
}

.grid {
  display: grid;
  gap: 16px;
}

@media (min-width: 700px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}

.item {
  padding: 20px;
}

.item h2 {
  font-size: 1.1rem;
  margin-bottom: 6px;
}

.item p {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.icon {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent-text);
}

code {
  font-size: 0.85em;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-muted);
}

.statuses {
  display: grid;
  gap: 6px;
  margin: 8px 0 12px;
}

.statuses div {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
  font-size: 0.95rem;
}

.statuses dt {
  font-weight: 650;
}

.statuses dd {
  margin: 0;
  color: var(--text-muted);
}

.fine {
  font-size: 0.875rem !important;
}
</style>
