'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DeviceSummary, DevicesResponse } from '@/lib/api-types'

export type RingStatus =
  | { state: 'loading' }
  | { state: 'unconfigured' }
  | { state: 'ok'; devices: DeviceSummary[] }
  | { state: 'error'; message: string; tokenProblem: boolean }

const REFRESH_MS = 60_000

export function useRingStatus() {
  const [status, setStatus] = useState<RingStatus>({ state: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ring/devices', { cache: 'no-store' })
      const body = (await res.json()) as DevicesResponse
      if (!body.configured) setStatus({ state: 'unconfigured' })
      else if (!res.ok || body.error) setStatus({ state: 'error', message: body.error ?? `HTTP ${res.status}`, tokenProblem: !!body.tokenProblem })
      else setStatus({ state: 'ok', devices: body.devices })
    } catch {
      setStatus({ state: 'error', message: 'Herald server is not reachable.', tokenProblem: false })
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  return { status, refresh }
}
