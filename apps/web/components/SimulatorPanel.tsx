'use client'

import { useState } from 'react'
import type { AlertKind } from '@/lib/alerts'
import type { SimulatedEventName } from '@/lib/api-types'
import { AlertIcon } from './Icon'

const BUTTONS: { event: SimulatedEventName; kind: AlertKind; label: string; ringEvent: string }[] = [
  { event: 'doorbell', kind: 'doorbell', label: 'Doorbell press', ringEvent: 'button_press' },
  { event: 'person', kind: 'person', label: 'Person', ringEvent: 'motion_detected · human' },
  { event: 'package', kind: 'package', label: 'Package delivery', ringEvent: 'motion_detected · package_delivery' },
  { event: 'vehicle', kind: 'vehicle', label: 'Vehicle', ringEvent: 'motion_detected · vehicle' },
  { event: 'motion', kind: 'motion', label: 'Movement', ringEvent: 'motion_detected · motion' },
  { event: 'offline', kind: 'camera_offline', label: 'Camera offline', ringEvent: 'device_offline' },
  { event: 'online', kind: 'camera_online', label: 'Camera online', ringEvent: 'device_online' },
]

interface SimulateResponse {
  delivered?: boolean
  webhookStatus?: number
  result?: { status?: string } | null
  error?: string
}

export function SimulatorPanel() {
  const [result, setResult] = useState('')

  // The buttons never disable while sending: disabling the focused button would drop keyboard focus.
  async function fire(button: (typeof BUTTONS)[number]) {
    setResult('')
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: button.event }),
      })
      const body = (await res.json().catch(() => ({}))) as SimulateResponse
      setResult(
        res.ok
          ? `Sent a signed ${button.ringEvent} webhook. Herald answered ${body.webhookStatus} (${body.result?.status ?? 'ok'}).`
          : `Failed: ${body.error ?? `webhook answered ${body.webhookStatus ?? res.status}`}`,
      )
    } catch {
      setResult('Failed: Herald server is not reachable.')
    }
  }

  return (
    <section aria-labelledby="sim-heading" className="rounded-3xl border-2 border-dashed border-line bg-surface p-6">
      <h2 id="sim-heading" className="text-xl font-bold">
        Simulate a Ring event
      </h2>
      <p className="mt-1 text-base text-muted">
        Sends a webhook in Ring&rsquo;s v1.1 format, HMAC-signed, to Herald&rsquo;s own endpoint, the same way Ring delivers one.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {BUTTONS.map((button) => (
          <button
            key={button.event}
            type="button"
            onClick={() => fire(button)}
            className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-line px-3 py-2 text-left text-base font-bold hover:bg-canvas"
          >
            <AlertIcon kind={button.kind} className="size-5 shrink-0" />
            {button.label}
          </button>
        ))}
      </div>
      <p role="status" className="mt-3 min-h-6 text-base text-muted">
        {result}
      </p>
    </section>
  )
}
