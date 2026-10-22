<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'
import AppIcon from './AppIcon.vue'

/**
 * Wraps the native <dialog> element, which gives us focus trapping, Escape to
 * close and correct screen-reader semantics for free. Mount it with v-if.
 */
defineProps<{ title: string; size?: 'sm' | 'md' }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

onMounted(() => dialog.value?.showModal())
// Closing (rather than just removing) lets the browser return focus to the
// element that opened the dialog.
onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
})

function onCancel(event: Event) {
  event.preventDefault()
  emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="size === 'sm' ? 'modal-sm' : 'modal-md'"
    :aria-labelledby="titleId"
    @cancel="onCancel"
  >
    <div class="modal-inner">
      <header class="modal-header">
        <h2 :id="titleId">{{ title }}</h2>
        <button type="button" class="icon-btn" aria-label="Close" @click="emit('close')">
          <AppIcon name="x" />
        </button>
      </header>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: calc(100% - 24px);
  max-height: calc(100dvh - 24px);
  padding: 0;
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-lg);
  overflow: auto;
}

.modal-sm {
  max-width: 420px;
}

.modal-md {
  max-width: 560px;
}

.modal::backdrop {
  background: rgb(29 33 32 / 0.45);
}

.modal[open] {
  animation: pop-in 0.18s ease-out;
}

.modal-inner {
  padding: 20px;
}

@media (min-width: 640px) {
  .modal-inner {
    padding: 24px 28px 28px;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.modal-header h2 {
  font-size: 1.2rem;
}

.modal-header .icon-btn {
  margin-right: -8px;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}
</style>
