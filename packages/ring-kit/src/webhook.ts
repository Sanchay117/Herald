// Ring webhook v1.1: payload types, HMAC-SHA256 signing and verification.
// Uses Web Crypto only, so it runs on Node 18+, Deno, Bun, Cloudflare Workers and edge runtimes.

export const SIGNATURE_HEADER = 'X-Signature'
const SIGNATURE_PREFIX = 'sha256='

/** Event types documented for webhook v1.1. Unknown values are passed through, not rejected. */
export type RingWebhookEventType =
  | 'motion_detected'
  | 'button_press'
  | 'device_added'
  | 'device_removed'
  | 'device_online'
  | 'device_offline'
  | 'app_integration_added'
  | 'app_integration_removed'
  | 'subscription_activated'
  | 'subscription_deactivated'
  | (string & {})

/**
 * `motion` when Smart Alerts is off; one of the classified values when it is on.
 * No API reports whether Smart Alerts is enabled, so treat this as open-ended.
 */
export type MotionSubType = 'motion' | 'human' | 'vehicle' | 'package_delivery' | 'other_motion' | (string & {})

export interface RingWebhookMeta {
  version: string
  time: string
  request_id: string
  account_id?: string
}

export interface RingWebhookAttributes {
  source: string
  source_type: string
  /** Epoch milliseconds. */
  timestamp?: number
  timestamp_readable?: string
  sub_type?: MotionSubType
  /** Present only on multi-camera devices such as Ring Elite. */
  component_ids?: string[]
  [key: string]: unknown
}

export interface RingWebhookPayload {
  meta: RingWebhookMeta
  data: {
    id: string
    type: RingWebhookEventType
    attributes: RingWebhookAttributes
    relationships?: Record<string, unknown>
  }
}

const encoder = new TextEncoder()

function toBytes(body: string | Uint8Array): Uint8Array<ArrayBuffer> {
  return typeof body === 'string' ? encoder.encode(body) : new Uint8Array(body)
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function importKey(signingKey: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(signingKey), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

/** Compute the `X-Signature` header value (`sha256=<hex>`) for a raw request body. */
export async function signWebhookBody(signingKey: string, rawBody: string | Uint8Array): Promise<string> {
  const key = await importKey(signingKey, 'sign')
  const mac = await crypto.subtle.sign('HMAC', key, toBytes(rawBody))
  return SIGNATURE_PREFIX + toHex(mac)
}

/**
 * Check an `X-Signature` header against the raw body bytes exactly as received.
 * Verify before parsing: re-serialized JSON will not match.
 */
export async function verifyWebhookSignature(
  signingKey: string,
  rawBody: string | Uint8Array,
  signatureHeader: string | null | undefined,
): Promise<boolean> {
  if (!signingKey || !signatureHeader) return false
  const hex = signatureHeader.trim().startsWith(SIGNATURE_PREFIX)
    ? signatureHeader.trim().slice(SIGNATURE_PREFIX.length)
    : signatureHeader.trim()
  const signature = fromHex(hex)
  if (!signature || signature.length !== 32) return false
  const key = await importKey(signingKey, 'verify')
  // subtle.verify compares in constant time.
  return crypto.subtle.verify('HMAC', key, signature, toBytes(rawBody))
}

export type ParseResult = { ok: true; payload: RingWebhookPayload } | { ok: false; error: string }

/** Parse and shape-check a webhook body. Does not verify the signature. */
export function parseWebhookPayload(rawBody: string): ParseResult {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return { ok: false, error: 'Body is not valid JSON' }
  }
  const b = body as Partial<RingWebhookPayload>
  if (!b || typeof b !== 'object') return { ok: false, error: 'Body is not an object' }
  if (!b.meta || typeof b.meta.request_id !== 'string' || typeof b.meta.version !== 'string') {
    return { ok: false, error: 'Missing meta.request_id or meta.version' }
  }
  if (!b.data || typeof b.data.id !== 'string' || typeof b.data.type !== 'string') {
    return { ok: false, error: 'Missing data.id or data.type' }
  }
  if (!b.data.attributes || typeof b.data.attributes.source !== 'string') {
    return { ok: false, error: 'Missing data.attributes.source' }
  }
  return { ok: true, payload: b as RingWebhookPayload }
}
