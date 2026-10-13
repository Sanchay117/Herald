'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import type { Alert } from '@/lib/alerts'

const MAX_ALERTS = 100

export type StreamConnection = 'connecting' | 'open' | 'reconnecting'

/**
 * Subscribes to /api/events. `onAlert` fires only for alerts that arrive while this screen is open,
 * never for the history replayed on (re)connect, so a reconnect can't set off old alarms.
 */
export function useAlertStream(onAlert: (alert: Alert) => void) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [connection, setConnection] = useState<StreamConnection>('connecting')
  const handleAlert = useEffectEvent(onAlert)

  useEffect(() => {
    const source = new EventSource('/api/events')

    source.addEventListener('open', () => setConnection('open'))
    // EventSource reconnects on its own; this only reflects the state.
    source.addEventListener('error', () => setConnection('reconnecting'))

    source.addEventListener('snapshot', (e) => {
      setAlerts((JSON.parse((e as MessageEvent<string>).data) as Alert[]).slice(0, MAX_ALERTS))
    })
    source.addEventListener('alert', (e) => {
      const alert = JSON.parse((e as MessageEvent<string>).data) as Alert
      setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)].slice(0, MAX_ALERTS))
      handleAlert(alert)
    })
    source.addEventListener('alert-update', (e) => {
      const { id, patch } = JSON.parse((e as MessageEvent<string>).data) as { id: string; patch: Partial<Alert> }
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
    })

    return () => source.close()
  }, [])

  return { alerts, connection }
}
