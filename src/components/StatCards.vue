<script setup lang="ts">
import { formatMoney, type CurrencyTotal } from '../utils/currency'
import AppIcon from './AppIcon.vue'

defineProps<{
  activeCount: number
  dueThisWeekCount: number
  overdueCount: number
  totals: CurrencyTotal[]
}>()
</script>

<template>
  <section class="stats" aria-label="Summary">
    <div class="stat card">
      <span class="icon"><AppIcon name="list" :size="18" /></span>
      <p class="value">{{ activeCount }}</p>
      <p class="label">Active reminders</p>
    </div>
    <div class="stat card" :class="{ attention: dueThisWeekCount > 0 }">
      <span class="icon"><AppIcon name="clock" :size="18" /></span>
      <p class="value">{{ dueThisWeekCount }}</p>
      <p class="label">Due in the next 7 days</p>
    </div>
    <div class="stat card" :class="{ alert: overdueCount > 0 }">
      <span class="icon"><AppIcon name="alert" :size="18" /></span>
      <p class="value">{{ overdueCount }}</p>
      <p class="label">Overdue</p>
    </div>
    <div class="stat card money">
      <span class="icon"><AppIcon name="wallet" :size="18" /></span>
      <template v-if="totals.length">
        <p class="value">{{ formatMoney(totals[0]!.total, totals[0]!.currency) }}</p>
        <ul v-if="totals.length > 1" class="others" aria-label="Totals in other currencies">
          <li v-for="t in totals.slice(1)" :key="t.currency">+ {{ formatMoney(t.total, t.currency) }}</li>
        </ul>
      </template>
      <p v-else class="value">—</p>
      <p class="label">Value at stake</p>
    </div>
  </section>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (min-width: 800px) {
  .stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.stat {
  position: relative;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.icon {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-text);
  margin-bottom: 10px;
}

.attention .icon {
  background: var(--warning-soft);
  color: var(--warning-text);
}

.alert .icon {
  background: var(--danger-soft);
  color: var(--danger);
}

.value {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.money .value {
  font-size: 1.35rem;
}

.alert .value {
  color: var(--danger);
}

.label {
  margin-top: auto;
  padding-top: 4px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.others {
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
