import { ref } from 'vue'

export type RouteName = 'dashboard' | 'backup' | 'about'

const ROUTES: Record<string, RouteName> = {
  '#/': 'dashboard',
  '#/backup': 'backup',
  '#/about': 'about',
}

export const ROUTE_HREFS: Record<RouteName, string> = {
  dashboard: '#/',
  backup: '#/backup',
  about: '#/about',
}

function current(): RouteName {
  return ROUTES[window.location.hash] ?? 'dashboard'
}

/**
 * Minimal hash-based routing. Hash URLs work on any static host (including
 * GitHub Pages sub-paths) without server rewrite rules.
 */
const route = ref<RouteName>(current())
window.addEventListener('hashchange', () => {
  route.value = current()
  window.scrollTo({ top: 0 })
})

export function useRoute() {
  return route
}
