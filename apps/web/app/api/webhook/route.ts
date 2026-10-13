import { NextResponse, type NextRequest } from 'next/server'
import { SIGNATURE_HEADER, parseWebhookPayload, verifyWebhookSignature } from 'ring-kit'
import { alertFromWebhook } from '@/lib/alerts'
import { markSeen, publish } from '@/lib/server/bus'
import { doorLabel, webhookSigningKey } from '@/lib/server/config'

// Ring's webhook endpoint. Ring expects a 2xx within 5 seconds; 4xx is treated as permanent
// (no retry), 5xx and timeouts are retried with backoff. So: verify, publish, answer fast.

export async function POST(request: NextRequest) {
  const key = webhookSigningKey()
  if (!key) {
    return NextResponse.json({ error: 'Webhook signing key not configured' }, { status: 503 })
  }

  // Verify the exact bytes received, then parse.
  const raw = new Uint8Array(await request.arrayBuffer())
  if (!(await verifyWebhookSignature(key, raw, request.headers.get(SIGNATURE_HEADER)))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const parsed = parseWebhookPayload(new TextDecoder().decode(raw))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { payload } = parsed

  if (!markSeen(payload.meta.request_id)) {
    return NextResponse.json({ status: 'duplicate', requestId: payload.meta.request_id })
  }

  const alert = alertFromWebhook(payload, {
    doorLabel: doorLabel(),
    // Set by Herald's own simulator. Not covered by the signature; it only labels the alert in the UI.
    simulated: request.headers.get('x-herald-simulated') === '1',
  })
  if (!alert) {
    return NextResponse.json({ status: 'ignored', type: payload.data.type })
  }

  publish({ type: 'alert', alert })
  return NextResponse.json({ status: 'processed', alertId: alert.id })
}
