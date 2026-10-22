import { onScopeDispose, ref } from 'vue'
import { todayDateOnly } from '../utils/dates'

/**
 * Today's local date as `YYYY-MM-DD`. It refreshes when the tab regains focus
 * and once a minute, so statuses roll over at midnight without a reload.
 */
export function useToday() {
  const today = ref(todayDateOnly())
  const refresh = () => {
    const next = todayDateOnly()
    if (next !== today.value) today.value = next
  }
  const timer = window.setInterval(refresh, 60_000)
  document.addEventListener('visibilitychange', refresh)
  onScopeDispose(() => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', refresh)
  })
  return today
}
