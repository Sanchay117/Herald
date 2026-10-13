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
const targetCache = singleton('simulationTarget', () => ({ value: null as SimulationTarget | null, at: 0 }))

/**
 * Simulated webhooks name a real device and account when a Ring token is configured
 * (the Playground gives you one doorbell), so they look exactly like a real delivery.
 */
export async function simulationTarget(): Promise<SimulationTarget> {
  if (targetCache.value && Date.now() - targetCache.at < 5 * 60_000) return targetCache.value
  if (!ringConfigured()) return FALLBACK_TARGET
  try {
    const [devices, me] = await Promise.all([ring.listDevices(), ring.getMe()])
    const first = devices[0]
    if (!first) return FALLBACK_TARGET
    targetCache.value = { deviceId: first.id, accountId: me.id }
    targetCache.at = Date.now()
    return targetCache.value
  } catch {
    return FALLBACK_TARGET
  }
}
