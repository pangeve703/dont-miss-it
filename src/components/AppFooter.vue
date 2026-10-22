<script setup lang="ts">
import { config } from '../config'
import { useEmailReminders } from '../composables/useEmailReminders'
import { ROUTE_HREFS } from '../composables/useRoute'
import AppIcon from './AppIcon.vue'

const { available: emailAvailable } = useEmailReminders()
</script>

<template>
  <footer class="footer">
    <div class="container inner">
      <p class="privacy">
        <AppIcon name="shield" :size="16" />
        Your reminders are stored only in this browser.
        {{ emailAvailable ? 'Nothing is sent to a server unless you turn on email reminders.' : 'Nothing is sent to a server.' }}
        <a :href="ROUTE_HREFS.about">Learn more</a>
      </p>
      <p class="links">
        <span>Free &amp; open source (MIT)</span>
        <a v-if="config.repositoryUrl" :href="config.repositoryUrl" target="_blank" rel="noopener noreferrer">
          Source code
        </a>
        <a v-if="config.donationUrl" :href="config.donationUrl" target="_blank" rel="noopener noreferrer">
          Buy me a coffee
        </a>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  margin-top: 56px;
  border-top: 1px solid var(--border);
  padding: 24px 0 96px;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.inner {
  display: grid;
  gap: 8px;
}

.privacy svg {
  vertical-align: -3px;
  margin-right: 6px;
  color: var(--accent);
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
}
</style>
