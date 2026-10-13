// Build and deliver Ring webhook v1.1 events that are byte-for-byte what a real
// delivery looks like, signed with your HMAC key. Useful when you have no Ring
// device (the Developer Playground does not send webhooks) or in CI.

import { SIGNATURE_HEADER, signWebhookBody } from './webhook.ts'
import type { MotionSubType, RingWebhookPayload } from './webhook.ts'

export type SimulatedEvent =
  | { type: 'button_press' }
  | { type: 'motion_detected'; subType?: MotionSubType }
  | { type: 'device_online' }
  | { type: 'device_offline' }

export type SimulatedEventInput = SimulatedEvent & {
  deviceId: string
  accountId?: string
  /** Epoch milliseconds. Defaults to now. */
  timestamp?: number
  /** Set for multi-camera devices. */
  componentIds?: string[]
}

/** `YYYY-MM-DD HH:mm:ss` in UTC with no offset, matching Ring's `timestamp_readable`. */
function readable(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19)
}

export function buildWebhookPayload(input: SimulatedEventInput): RingWebhookPayload {
  const timestamp = input.timestamp ?? Date.now()
  const idPart = input.type === 'motion_detected' ? (input.subType ?? 'motion') : input.type

  const attributes: RingWebhookPayload['data']['attributes'] = {
    source: input.deviceId,
    source_type: 'devices',
    timestamp,
  }
  if (input.type === 'motion_detected') {
    attributes.timestamp_readable = readable(timestamp)
    attributes.sub_type = input.subType ?? 'motion'
  }
  if (input.componentIds?.length) attributes.component_ids = input.componentIds

  return {
    meta: {
      version: '1.1',
      time: new Date().toISOString(),
      request_id: crypto.randomUUID(),
      account_id: input.accountId ?? 'ava1.ring.account.SIMULATED',
    },
    data: {
      id: `${input.deviceId}_${idPart}_${timestamp}`,
      type: input.type,
      attributes,
      relationships: {
        devices: { links: { self: `/v1/devices/${input.deviceId}` } },
      },
    },
  }
}

export interface SendOptions {
  url: string
  signingKey: string
  payload: RingWebhookPayload
  /** Extra request headers. They are not covered by the signature, which signs the body only. */
  headers?: Record<string, string>
  fetch?: typeof fetch
}

/** POST a payload the way Ring does: JSON body, `X-Signature: sha256=<hex>` over the exact bytes sent. */
export async function sendSimulatedWebhook({ url, signingKey, payload, headers, fetch: f = fetch }: SendOptions): Promise<Response> {
  const body = JSON.stringify(payload)
  return f(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      [SIGNATURE_HEADER]: await signWebhookBody(signingKey, body),
    },
    body,
  })
}
