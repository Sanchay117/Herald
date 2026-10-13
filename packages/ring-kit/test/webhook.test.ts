import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { parseWebhookPayload, signWebhookBody, verifyWebhookSignature } from '../src/index.ts'

const KEY = 'test-signing-key'
const BODY = '{"meta":{"version":"1.1","time":"2026-02-14T00:02:53Z","request_id":"c83081fc","account_id":"ava1.ring.account.X"},"data":{"id":"dev_button_press_1771027372393","type":"button_press","attributes":{"source":"dev","source_type":"devices","timestamp":1771027372393}}}'

// Ring documents the signature as Python's hmac.new(key.encode(), raw_body, sha256).hexdigest()
// with a "sha256=" prefix. node:crypto is an independent implementation of the same thing.
function reference(key: string, body: string): string {
  return 'sha256=' + createHmac('sha256', key).update(body).digest('hex')
}

test('signWebhookBody matches the documented HMAC-SHA256 hex format', async () => {
  assert.equal(await signWebhookBody(KEY, BODY), reference(KEY, BODY))
})

test('signing a string and its UTF-8 bytes gives the same signature', async () => {
  const bytes = new TextEncoder().encode(BODY)
  assert.equal(await signWebhookBody(KEY, bytes), await signWebhookBody(KEY, BODY))
})

test('verifyWebhookSignature accepts a valid signature, with or without the prefix', async () => {
  const sig = reference(KEY, BODY)
  assert.equal(await verifyWebhookSignature(KEY, BODY, sig), true)
  assert.equal(await verifyWebhookSignature(KEY, BODY, sig.slice('sha256='.length)), true)
  assert.equal(await verifyWebhookSignature(KEY, BODY, `  ${sig.toUpperCase().replace('SHA256=', 'sha256=')}  `), true)
})

test('verifyWebhookSignature rejects a tampered body', async () => {
  const sig = reference(KEY, BODY)
  assert.equal(await verifyWebhookSignature(KEY, BODY.replace('button_press', 'motion_detected'), sig), false)
})

test('verifyWebhookSignature rejects re-serialized JSON (verify raw bytes, then parse)', async () => {
  const sig = reference(KEY, BODY)
  const reserialized = JSON.stringify(JSON.parse(BODY), null, 2)
  assert.equal(await verifyWebhookSignature(KEY, reserialized, sig), false)
})

test('verifyWebhookSignature rejects the wrong key, missing and malformed headers', async () => {
  const sig = reference(KEY, BODY)
  assert.equal(await verifyWebhookSignature('other-key', BODY, sig), false)
  assert.equal(await verifyWebhookSignature(KEY, BODY, null), false)
  assert.equal(await verifyWebhookSignature(KEY, BODY, ''), false)
  assert.equal(await verifyWebhookSignature(KEY, BODY, 'sha256=not-hex'), false)
  assert.equal(await verifyWebhookSignature(KEY, BODY, 'sha256=abcd'), false)
  assert.equal(await verifyWebhookSignature('', BODY, sig), false)
})

test('parseWebhookPayload accepts a documented v1.1 payload', () => {
  const result = parseWebhookPayload(BODY)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.data.type, 'button_press')
    assert.equal(result.payload.meta.account_id, 'ava1.ring.account.X')
  }
})

test('parseWebhookPayload passes unknown event types through', () => {
  const body = BODY.replace('"button_press"', '"something_new"')
  const result = parseWebhookPayload(body)
  assert.equal(result.ok, true)
})

test('parseWebhookPayload rejects malformed bodies with a reason', () => {
  for (const body of ['not json', 'null', '[]', '{}', '{"meta":{"version":"1.1","request_id":"x"}}', '{"meta":{"version":"1.1","request_id":"x"},"data":{"id":"a","type":"b","attributes":{}}}']) {
    const result = parseWebhookPayload(body)
    assert.equal(result.ok, false, body)
    if (!result.ok) assert.ok(result.error.length > 0)
  }
})
