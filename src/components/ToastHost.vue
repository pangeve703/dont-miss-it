<script setup lang="ts">
import { useToast } from '../composables/useToast'
import AppIcon from './AppIcon.vue'

const { toasts, dismiss } = useToast()
</script>

<template>
  <!-- A polite live region, so screen readers announce each message. -->
  <div class="toasts" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast-${t.tone}`">
        <AppIcon :name="t.tone === 'error' ? 'alert' : t.tone === 'info' ? 'info' : 'check'" :size="18" />
        <span class="message">{{ t.message }}</span>
        <button
          v-if="t.action"
          type="button"
          class="toast-action"
          @click="t.action.run(); dismiss(t.id)"
        >
          {{ t.action.label }}
        </button>
        <button type="button" class="toast-close" aria-label="Dismiss message" @click="dismiss(t.id)">
          <AppIcon name="x" :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  z-index: 50;
  left: 16px;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 440px;
  padding: 10px 8px 10px 14px;
  border-radius: 12px;
  background: #1d2120;
  color: #fff;
  box-shadow: var(--shadow-lg);
  font-size: 0.925rem;
}

.toast-success svg:first-child {
  color: #5eead4;
}

.toast-error {
  background: #7a1a11;
}

.message {
  flex: 1;
}

.toast-action {
  border: 0;
  background: transparent;
  color: #5eead4;
  font-weight: 700;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.toast-action:hover {
  background: rgb(255 255 255 / 0.1);
}

.toast-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(255 255 255 / 0.75);
  cursor: pointer;
}

.toast-close:hover {
  background: rgb(255 255 255 / 0.1);
  color: #fff;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
