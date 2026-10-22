<script setup lang="ts">
import { useId } from 'vue'
import { CATEGORIES, CATEGORY_LABELS } from '../types/reminder'
import type { ReminderQuery, StatusFilter } from '../utils/reminders'
import AppIcon from './AppIcon.vue'

const query = defineModel<ReminderQuery>({ required: true })
const id = useId()

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]
</script>

<template>
  <div class="filters" role="search">
    <div class="search">
      <label :for="`${id}-search`" class="visually-hidden">Search reminders by title</label>
      <AppIcon name="search" :size="18" class="search-icon" />
      <input
        :id="`${id}-search`"
        v-model="query.search"
        class="input"
        type="search"
        placeholder="Search by title"
        autocomplete="off"
      />
    </div>

    <div class="status" role="radiogroup" aria-label="Show">
      <label v-for="opt in STATUS_OPTIONS" :key="opt.value" class="seg">
        <input v-model="query.status" type="radio" :name="`${id}-status`" :value="opt.value" />
        <span>{{ opt.label }}</span>
      </label>
    </div>

    <div class="selects">
      <label :for="`${id}-category`" class="visually-hidden">Category</label>
      <select :id="`${id}-category`" v-model="query.category" class="input">
        <option value="all">All categories</option>
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ CATEGORY_LABELS[c] }}</option>
      </select>
      <label :for="`${id}-sort`" class="visually-hidden">Sort order</label>
      <select :id="`${id}-sort`" v-model="query.sort" class="input">
        <option value="nearest">Nearest deadline first</option>
        <option value="latest">Latest deadline first</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  gap: 10px;
}

@media (min-width: 800px) {
  .filters {
    grid-template-columns: 1fr auto;
  }

  .selects {
    grid-column: 1 / -1;
  }
}

.search {
  position: relative;
}

.search .input {
  padding-left: 38px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.status {
  display: flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  overflow-x: auto;
}

.seg {
  flex: 1;
  position: relative;
}

.seg input {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  cursor: pointer;
}

.seg span {
  display: block;
  padding: 8px 14px;
  border-radius: 999px;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  transition: background-color 0.15s, color 0.15s;
}

.seg input:checked + span {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.seg input:focus-visible + span {
  outline: 3px solid var(--focus);
  outline-offset: 0;
}

.selects {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
