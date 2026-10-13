import { RingClient } from 'ring-kit'
import { ringAccessToken } from './config'
import { singleton } from './singleton'

export const ring = singleton('ringClient', () => new RingClient({ token: ringAccessToken }))

export function ringConfigured(): boolean {
  return ringAccessToken() !== ''
}

export interface SimulationTarget {
  deviceId: string
  accountId?: string
}

const FALLBACK_TARGET: SimulationTarget = { deviceId: 'ava1.ring.device.SIMULATED' }
const targetCache = singleton('simulationTarget', () => ({ value: null as SimulationTarget | null, until: 0 }))

function remember(value: SimulationTarget, ms: number): SimulationTarget {
  targetCache.value = value
  targetCache.until = Date.now() + ms
  return value
}

/**
 * Simulated webhooks name a real device and account when a Ring token is configured
 * (the Playground gives you one doorbell), so they look exactly like a real delivery.
 */
export async function simulationTarget(): Promise<SimulationTarget> {
  if (targetCache.value && Date.now() < targetCache.until) return targetCache.value
  if (!ringConfigured()) return FALLBACK_TARGET
  try {
    const [devices, me] = await Promise.all([ring.listDevices(), ring.getMe()])
    const first = devices[0]
    if (!first) return remember(FALLBACK_TARGET, 60_000)
    return remember({ deviceId: first.id, accountId: me.id }, 5 * 60_000)
  } catch {
    // An expired Playground token fails every call. Remember that for a minute, so each simulated
    // event doesn't wait on a round trip to Ring just to be told so.
    return remember(FALLBACK_TARGET, 60_000)
  }
}
