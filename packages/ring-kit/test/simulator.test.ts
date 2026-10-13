import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWebhookPayload, parseWebhookPayload, sendSimulatedWebhook, verifyWebhookSignature } from '../src/index.ts'

const DEVICE = 'ava1.ring.device.TEST'
const TS = Date.UTC(2026, 7, 14, 8, 53, 16, 787)

test('button_press payload follows the documented v1.1 shape', () => {
  const p = buildWebhookPayload({ type: 'button_press', deviceId: DEVICE, accountId: 'ava1.ring.account.A', timestamp: TS })
  assert.equal(p.meta.version, '1.1')
  assert.equal(p.meta.account_id, 'ava1.ring.account.A')
  assert.match(p.meta.request_id, /^[0-9a-f-]{36}$/)
  assert.ok(!Number.isNaN(Date.parse(p.meta.time)))
  assert.equal(p.data.id, `${DEVICE}_button_press_${TS}`)
  assert.equal(p.data.type, 'button_press')
  assert.deepEqual(p.data.attributes, { source: DEVICE, source_type: 'devices', timestamp: TS })
  assert.deepEqual(p.data.relationships, { devices: { links: { self: `/v1/devices/${DEVICE}` } } })
})

test('motion payload carries sub_type, timestamp_readable and a sub_type-based id', () => {
  const p = buildWebhookPayload({ type: 'motion_detected', subType: 'package_delivery', deviceId: DEVICE, timestamp: TS })
  assert.equal(p.data.id, `${DEVICE}_package_delivery_${TS}`)
  assert.equal(p.data.attributes.sub_type, 'package_delivery')
  assert.equal(p.data.attributes.timestamp_readable, '2026-08-14 08:53:16')
  assert.equal(p.data.attributes.component_ids, undefined)
})

test('motion defaults to sub_type "motion" (Smart Alerts off)', () => {
  const p = buildWebhookPayload({ type: 'motion_detected', deviceId: DEVICE, timestamp: TS })
  assert.equal(p.data.attributes.sub_type, 'motion')
  assert.equal(p.data.id, `${DEVICE}_motion_${TS}`)
})

test('component ids are included only when given', () => {
  const p = buildWebhookPayload({ type: 'motion_detected', subType: 'human', deviceId: DEVICE, componentIds: ['0'] })
  assert.deepEqual(p.data.attributes.component_ids, ['0'])
})

test('every payload gets a fresh request_id', () => {
  const a = buildWebhookPayload({ type: 'button_press', deviceId: DEVICE })
  const b = buildWebhookPayload({ type: 'button_press', deviceId: DEVICE })
  assert.notEqual(a.meta.request_id, b.meta.request_id)
})

test('built payloads pass parseWebhookPayload', () => {
  for (const input of [
    { type: 'button_press' as const, deviceId: DEVICE },
    { type: 'motion_detected' as const, subType: 'vehicle', deviceId: DEVICE },
    { type: 'device_offline' as const, deviceId: DEVICE },
  ]) {
    assert.equal(parseWebhookPayload(JSON.stringify(buildWebhookPayload(input))).ok, true)
  }
})

test('sendSimulatedWebhook signs the exact bytes it sends', async () => {
  let captured: { url: string; init: RequestInit } | undefined
  const fakeFetch = (async (url: string, init: RequestInit) => {
    captured = { url, init }
    return new Response(null, { status: 200 })
  }) as unknown as typeof fetch

  const payload = buildWebhookPayload({ type: 'button_press', deviceId: DEVICE })
  const res = await sendSimulatedWebhook({
    url: 'https://example.test/hook',
    signingKey: 'k',
    payload,
    headers: { 'X-Extra': '1', 'X-Signature': 'caller cannot override this' },
    fetch: fakeFetch,
  })

  assert.equal(res.status, 200)
  assert.ok(captured)
  assert.equal(captured.url, 'https://example.test/hook')
  assert.equal(captured.init.method, 'POST')
  const headers = captured.init.headers as Record<string, string>
  assert.equal(headers['Content-Type'], 'application/json')
  assert.equal(headers['X-Extra'], '1')
  const body = captured.init.body as string
  assert.deepEqual(JSON.parse(body), payload)
  assert.equal(await verifyWebhookSignature('k', body, headers['X-Signature']), true)
})
