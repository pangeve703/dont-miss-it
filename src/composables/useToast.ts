import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
  action?: { label: string; run: () => void }
}

const toasts = ref<Toast[]>([])
let nextId = 1

function dismiss(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function show(message: string, tone: Toast['tone'] = 'success', action?: Toast['action']): void {
  const id = nextId++
  // Keep at most three on screen.
  toasts.value = [...toasts.value.slice(-2), { id, message, tone, action }]
  setTimeout(() => dismiss(id), action ? 8000 : tone === 'error' ? 7000 : 4000)
}

export function useToast() {
  return { toasts, show, dismiss }
}
