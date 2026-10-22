<script setup lang="ts">
import { config } from '../config'
import { ROUTE_HREFS, useRoute, type RouteName } from '../composables/useRoute'
import AppIcon from './AppIcon.vue'

const route = useRoute()
// Relative to the deployed base path, so the logo works under a sub-path too.
const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`

const LINKS: Array<{ name: RouteName; label: string }> = [
  { name: 'dashboard', label: 'Reminders' },
  { name: 'backup', label: 'Backup' },
  { name: 'about', label: 'About' },
]
</script>

<template>
  <header class="header">
    <div class="container inner">
      <a :href="ROUTE_HREFS.dashboard" class="brand">
        <img :src="logoUrl" alt="" width="30" height="30" />
        <span>{{ config.appName }}</span>
      </a>
      <nav aria-label="Main">
        <a
          v-for="link in LINKS"
          :key="link.name"
          :href="ROUTE_HREFS[link.name]"
          class="nav-link"
          :aria-current="route === link.name ? 'page' : undefined"
        >
          {{ link.label }}
        </a>
        <a
          v-if="config.donationUrl"
          :href="config.donationUrl"
          class="coffee"
          target="_blank"
          rel="noopener noreferrer"
        >
          <AppIcon name="coffee" :size="16" />
          <span class="coffee-text">Buy me a coffee</span>
          <span class="visually-hidden"> (opens in a new tab)</span>
        </a>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.header {
  border-bottom: 1px solid var(--border);
  background: rgb(247 245 240 / 0.9);
  backdrop-filter: saturate(1.4) blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 60px;
  flex-wrap: wrap;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 750;
  font-size: 1.05rem;
  color: var(--text);
  text-decoration: none;
  letter-spacing: -0.01em;
}

.brand img {
  border-radius: 8px;
}

nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-link {
  padding: 8px 10px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
}

.nav-link:hover {
  color: var(--text);
  background: var(--surface-muted);
}

.nav-link[aria-current='page'] {
  color: var(--accent-text);
  background: var(--accent-soft);
}

.coffee {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 6px;
  padding: 7px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
}

.coffee:hover {
  background: var(--surface-muted);
}

@media (max-width: 520px) {
  .coffee-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  .coffee {
    padding: 8px;
  }
}
</style>
