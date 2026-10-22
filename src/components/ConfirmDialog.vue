<script setup lang="ts">
import ModalDialog from './ModalDialog.vue'

withDefaults(
  defineProps<{
    title: string
    confirmLabel?: string
    danger?: boolean
  }>(),
  { confirmLabel: 'Confirm', danger: false },
)
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <ModalDialog :title="title" size="sm" @close="emit('cancel')">
    <div class="confirm-body">
      <slot />
    </div>
    <div class="confirm-actions">
      <!-- Cancel comes first so it receives initial focus: the safe default. -->
      <button type="button" class="btn btn-secondary" @click="emit('cancel')">Cancel</button>
      <button
        type="button"
        class="btn"
        :class="danger ? 'btn-danger' : 'btn-primary'"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.confirm-body {
  color: var(--text-muted);
  display: grid;
  gap: 10px;
}

.confirm-body :deep(strong) {
  color: var(--text);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  flex-wrap: wrap;
}
</style>
