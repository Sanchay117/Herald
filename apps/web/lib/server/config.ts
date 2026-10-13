import { randomBytes } from 'node:crypto'
import { singleton } from './singleton'

/** Read on every call so a fresh Playground token pasted into .env.local is picked up without a restart. */
export function ringAccessToken(): string {
  return process.env.RING_ACCESS_TOKEN?.trim() ?? ''
}

export function simulatorEnabled(): boolean {
  const flag = process.env.HERALD_SIMULATOR?.trim().toLowerCase()
  if (flag === 'on') return true
  if (flag === 'off') return false
  return process.env.NODE_ENV !== 'production'
}

/**
 * The HMAC key Ring signs webhooks with. Without one, and only while the simulator is on,
 * Herald uses a random key that lives for this server run so simulated webhooks still verify.
 */
export function webhookSigningKey(): string | null {
  const configured = process.env.RING_WEBHOOK_SIGNING_KEY?.trim()
  if (configured) return configured
  if (!simulatorEnabled()) return null
  return singleton('devSigningKey', () => randomBytes(32).toString('hex'))
}

/** Deepgram key for Herald's voice. Without one, each browser speaks alerts with its own built-in voice. */
export function deepgramKey(): string {
  return (process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_KEY || '').trim()
}

export function doorLabel(): string {
  return process.env.HERALD_DOOR_LABEL?.trim() || 'front door'
}
