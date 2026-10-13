import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWebhookPayload } from 'ring-kit'
import { ALERT_STYLE } from '../lib/alert-style.ts'
import { alertFromWebhook, meetsPriority, type AlertKind } from '../lib/alerts.ts'

const DEVICE = 'ava1.ring.device.TEST'
// The Ring docs' example: epoch milliseconds for 2026-08-14 08:53:16 UTC.
const TS = 1786715596787
const OPTIONS = { doorLabel: 'front door', simulated: false, receivedAt: TS + 400 }

test('a doorbell press is urgent and says someone is at the door', () => {
  const payload = buildWebhookPayload({ type: 'button_press', deviceId: DEVICE, timestamp: TS })
  assert.deepEqual(alertFromWebhook(payload, OPTIONS), {
    id: payload.meta.request_id,
    eventId: `${DEVICE}_button_press_${TS}`,
    kind: 'doorbell',
    priority: 'urgent',
    headline: 'Doorbell',
    detail: 'Someone is at the front door.',
    spoken: 'Doorbell. Someone is at the front door.',
    deviceId: DEVICE,
    occurredAt: TS,
    receivedAt: TS + 400,
    simulated: false,
  })
})

test('motion sub_types map to person, package, vehicle and movement', () => {
  const cases = [
    ['human', 'person', 'normal', 'Person at the front door'],
    ['package_delivery', 'package', 'normal', 'Package delivery at the front door'],
    ['vehicle', 'vehicle', 'info', 'Vehicle near the front door'],
    ['motion', 'motion', 'info', 'Movement at the front door'],
    ['other_motion', 'motion', 'info', 'Movement at the front door'],
    // A value Ring might add later still produces an alert.
    ['animal', 'motion', 'info', 'Movement at the front door'],
  ] as const
  for (const [subType, kind, priority, headline] of cases) {
    const payload = buildWebhookPayload({ type: 'motion_detected', subType, deviceId: DEVICE, timestamp: TS })
    const alert = alertFromWebhook(payload, OPTIONS)
    assert.equal(alert?.kind, kind, subType)
    assert.equal(alert?.priority, priority, subType)
    assert.equal(alert?.headline, headline, subType)
    assert.equal(alert?.spoken, `${headline}.`, subType)
  }
})

test('camera offline is urgent and explains the consequence; back online is info', () => {
  const offline = alertFromWebhook(buildWebhookPayload({ type: 'device_offline', deviceId: DEVICE, timestamp: TS }), OPTIONS)
  assert.equal(offline?.kind, 'camera_offline')
  assert.equal(offline?.priority, 'urgent')
  assert.equal(offline?.headline, 'Front door camera is offline')
  assert.equal(offline?.spoken, "Front door camera is offline. Herald can't see the door until it reconnects.")

  const online = alertFromWebhook(buildWebhookPayload({ type: 'device_online', deviceId: DEVICE, timestamp: TS }), OPTIONS)
  assert.equal(online?.kind, 'camera_online')
  assert.equal(online?.priority, 'info')
  assert.equal(online?.headline, 'Front door camera is back online')
})

test('account and subscription events are not about the door, so they make no alert', () => {
  for (const type of ['device_added', 'device_removed', 'app_integration_added', 'app_integration_removed', 'subscription_activated', 'subscription_deactivated']) {
    const payload = buildWebhookPayload({ type: 'button_press', deviceId: DEVICE, timestamp: TS })
    payload.data.type = type
    assert.equal(alertFromWebhook(payload, OPTIONS), null, type)
  }
})

test('the door label appears in every message and is capitalised at the start of a sentence', () => {
  const options = { ...OPTIONS, doorLabel: 'back gate' }
  const press = alertFromWebhook(buildWebhookPayload({ type: 'button_press', deviceId: DEVICE }), options)
  assert.equal(press?.spoken, 'Doorbell. Someone is at the back gate.')
  const offline = alertFromWebhook(buildWebhookPayload({ type: 'device_offline', deviceId: DEVICE }), options)
  assert.equal(offline?.headline, 'Back gate camera is offline')
})

test('falls back to the time Herald received the webhook when Ring sends no timestamp', () => {
  const payload = buildWebhookPayload({ type: 'button_press', deviceId: DEVICE, timestamp: TS })
  delete payload.data.attributes.timestamp
  assert.equal(alertFromWebhook(payload, OPTIONS)?.occurredAt, OPTIONS.receivedAt)
})

test('carries the simulated flag through', () => {
  const payload = buildWebhookPayload({ type: 'button_press', deviceId: DEVICE })
  assert.equal(alertFromWebhook(payload, { ...OPTIONS, simulated: true })?.simulated, true)
})

test('meetsPriority: urgent always interrupts, info only when asked for everything', () => {
  assert.ok(meetsPriority('urgent', 'urgent'))
  assert.ok(meetsPriority('urgent', 'normal'))
  assert.ok(meetsPriority('normal', 'normal'))
  assert.ok(!meetsPriority('normal', 'urgent'))
  assert.ok(!meetsPriority('info', 'normal'))
  assert.ok(meetsPriority('info', 'info'))
})

test('every kind of alert has its own vibration rhythm that can be felt', () => {
  const kinds = Object.keys(ALERT_STYLE) as AlertKind[]
  const patterns = kinds.map((kind) => ALERT_STYLE[kind].vibration.join(','))
  assert.equal(new Set(patterns).size, kinds.length, 'two kinds share a rhythm')
  for (const kind of kinds) {
    const pattern = ALERT_STYLE[kind].vibration
    // Odd length: the pattern ends on a pulse, not on a gap.
    assert.equal(pattern.length % 2, 1, kind)
    // Pulses shorter than about 100 ms are hard to feel through a pocket or a mattress.
    assert.ok(pattern.filter((_, i) => i % 2 === 0).every((ms) => ms >= 100), kind)
    assert.ok(pattern.reduce((a, b) => a + b, 0) <= 3000, `${kind} rhythm is too long`)
  }
})
