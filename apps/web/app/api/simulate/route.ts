import { NextResponse, type NextRequest } from 'next/server'
import { buildWebhookPayload, sendSimulatedWebhook, type SimulatedEvent } from 'ring-kit'
import type { SimulatedEventName } from '@/lib/api-types'
import { simulatorEnabled, webhookSigningKey } from '@/lib/server/config'
import { simulationTarget } from '@/lib/server/ring'

// Fires a signed Ring webhook (v1.1) at Herald's own /api/webhook, exactly as Ring would deliver it.
// The Ring Developer Playground has no webhooks, so this is how events reach Herald without a device.

const EVENTS: Record<SimulatedEventName, SimulatedEvent> = {
  doorbell: { type: 'button_press' },
  person: { type: 'motion_detected', subType: 'human' },
  package: { type: 'motion_detected', subType: 'package_delivery' },
  vehicle: { type: 'motion_detected', subType: 'vehicle' },
  motion: { type: 'motion_detected', subType: 'motion' },
  offline: { type: 'device_offline' },
  online: { type: 'device_online' },
}

export async function POST(request: NextRequest) {
  const key = webhookSigningKey()
  if (!simulatorEnabled() || !key) {
    return NextResponse.json({ error: 'Simulator is disabled' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as { event?: unknown } | null
  const name = body?.event
  if (typeof name !== 'string' || !Object.hasOwn(EVENTS, name)) {
    return NextResponse.json({ error: `Unknown event. Use one of: ${Object.keys(EVENTS).join(', ')}` }, { status: 400 })
  }

  const target = await simulationTarget()
  const payload = buildWebhookPayload({ ...EVENTS[name as SimulatedEventName], ...target })

  try {
    const res = await sendSimulatedWebhook({
      url: new URL('/api/webhook', request.nextUrl.origin).toString(),
      signingKey: key,
      payload,
      headers: { 'X-Herald-Simulated': '1' },
    })
    const result = await res.json().catch(() => null)
    return NextResponse.json({ delivered: res.ok, webhookStatus: res.status, result, payload }, { status: res.ok ? 200 : 502 })
  } catch (err) {
    return NextResponse.json({ error: `Could not reach the webhook: ${err instanceof Error ? err.message : err}` }, { status: 502 })
  }
}
