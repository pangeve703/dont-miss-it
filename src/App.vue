<script setup lang="ts">
import { useTemplateRef } from 'vue'
import AppFooter from './components/AppFooter.vue'
import AppHeader from './components/AppHeader.vue'
import ToastHost from './components/ToastHost.vue'
import { useRoute } from './composables/useRoute'
import AboutView from './views/AboutView.vue'
import BackupView from './views/BackupView.vue'
import DashboardView from './views/DashboardView.vue'

const route = useRoute()
const main = useTemplateRef<HTMLElement>('main')
</script>

<template>
  <a href="#main" class="skip-link" @click.prevent="main?.focus()">Skip to content</a>
  <AppHeader />
  <main id="main" ref="main" tabindex="-1">
    <DashboardView v-if="route === 'dashboard'" />
    <BackupView v-else-if="route === 'backup'" />
    <AboutView v-else />
  </main>
  <AppFooter />
  <ToastHost />
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: 12px;
  top: -48px;
  z-index: 100;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.skip-link:focus {
  top: 12px;
}

main:focus {
  outline: none;
}
</style>
