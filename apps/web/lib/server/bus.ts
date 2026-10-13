import type { Alert } from '@/lib/alerts'
import { singleton } from './singleton'

export type BusMessage = { type: 'alert'; alert: Alert } | { type: 'alert-update'; id: string; patch: Partial<Alert> }

type Listener = (message: BusMessage) => void

const MAX_RECENT = 50
const DEDUPE_WINDOW_MS = 24 * 60 * 60_000
const MAX_SEEN = 5_000

const state = singleton('bus', () => ({
  listeners: new Set<Listener>(),
  recent: [] as Alert[],
  seen: new Map<string, number>(),
}))

export function publish(message: BusMessage): void {
  if (message.type === 'alert') {
    state.recent.unshift(message.alert)
    if (state.recent.length > MAX_RECENT) state.recent.length = MAX_RECENT
  } else {
    const index = state.recent.findIndex((a) => a.id === message.id)
    if (index !== -1) state.recent[index] = { ...state.recent[index]!, ...message.patch }
  }
  for (const listener of state.listeners) {
    try {
      listener(message)
    } catch {
      state.listeners.delete(listener)
    }
  }
}

export function subscribe(listener: Listener): () => void {
  state.listeners.add(listener)
  return () => state.listeners.delete(listener)
}

export function recentAlerts(): Alert[] {
  return [...state.recent]
}

/** Ring retries failed deliveries with the same request_id. Returns false if this id was already handled. */
export function markSeen(requestId: string): boolean {
  const now = Date.now()
  if (state.seen.has(requestId)) return false
  state.seen.set(requestId, now)
  if (state.seen.size > MAX_SEEN) {
    for (const [id, at] of state.seen) {
      if (now - at > DEDUPE_WINDOW_MS || state.seen.size > MAX_SEEN) state.seen.delete(id)
      else break
    }
  }
  return true
}
