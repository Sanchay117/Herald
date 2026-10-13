import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RingApiError, RingClient } from '../src/index.ts'

type Call = { url: string; method: string; headers: Headers; body: unknown; redirect?: RequestRedirect }

function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fn = (async (input: string | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      method: init.method ?? 'GET',
      headers: new Headers(init.headers),
      body: init.body,
      redirect: init.redirect,
    }
    calls.push(call)
    return handler(call)
  }) as unknown as typeof fetch
  return { fn, calls }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const DEVICE_DOC = {
  data: [
    {
      type: 'devices',
      id: 'ava1.ring.device.ABC',
      attributes: { name: 'Playground Device', image_url: 'https://example.test/doorbell.png' },
      relationships: { status: { links: { related: '/v1/devices/ava1.ring.device.ABC/status' } } },
    },
  ],
  meta: { time: '2026-10-12T19:08:14Z' },
}

test('listDevices unwraps the JSON:API document and sends the bearer token', async () => {
  const { fn, calls } = fakeFetch(() => json(DEVICE_DOC))
  const client = new RingClient({ token: 'tok', fetch: fn })
  const devices = await client.listDevices()
  assert.equal(devices.length, 1)
  assert.equal(devices[0]!.attributes.name, 'Playground Device')
  assert.equal(calls[0]!.url, 'https://api.amazonvision.com/v1/devices')
  assert.equal(calls[0]!.headers.get('Authorization'), 'Bearer tok')
})

test('a token function is called on every request (so rotated tokens are picked up)', async () => {
  let n = 0
  const { fn, calls } = fakeFetch(() => json(DEVICE_DOC))
  const client = new RingClient({ token: () => `tok${++n}`, fetch: fn })
  await client.listDevices()
  await client.listDevices()
  assert.deepEqual(calls.map((c) => c.headers.get('Authorization')), ['Bearer tok1', 'Bearer tok2'])
})

test('device ids are URL-encoded into paths', async () => {
  const { fn, calls } = fakeFetch(() => json({ data: { type: 'device-status', id: 's', attributes: { online: true } } }))
  const client = new RingClient({ token: 'tok', fetch: fn })
  const status = await client.getStatus('a/b c')
  assert.equal(status.attributes.online, true)
  assert.equal(calls[0]!.url, 'https://api.amazonvision.com/v1/devices/a%2Fb%20c/status')
})

test('getEventHistory forwards query params', async () => {
  const { fn, calls } = fakeFetch(() => json({ data: [] }))
  const client = new RingClient({ token: 'tok', fetch: fn })
  await client.getEventHistory('dev', { limit: 5 })
  assert.equal(calls[0]!.url, 'https://api.amazonvision.com/v1/history/devices/dev/events?limit=5')
})

test('API errors become RingApiError with Ring\'s error code and detail', async () => {
  const { fn } = fakeFetch(() =>
    json({ errors: [{ id: 'e1', status: '403', code: 'TIME_RANGE_NOT_AUTHORIZED', detail: 'Requested time range is not within authorized boundaries' }] }, 403),
  )
  const client = new RingClient({ token: 'tok', fetch: fn })
  await assert.rejects(client.listDevices(), (err: unknown) => {
    assert.ok(err instanceof RingApiError)
    assert.equal(err.status, 403)
    assert.equal(err.code, 'TIME_RANGE_NOT_AUTHORIZED')
    assert.equal(err.isAuthError, false)
    assert.match(err.message, /authorized boundaries/)
    return true
  })
})

test('401 is flagged as an auth error, even with a non-JSON body', async () => {
  const { fn } = fakeFetch(() => new Response('Unauthorized', { status: 401 }))
  const client = new RingClient({ token: 'expired', fetch: fn })
  await assert.rejects(client.listDevices(), (err: unknown) => err instanceof RingApiError && err.isAuthError)
})

test('a missing token fails before any request is made', async () => {
  const { fn, calls } = fakeFetch(() => json(DEVICE_DOC))
  const client = new RingClient({ token: () => '', fetch: fn })
  await assert.rejects(client.listDevices(), (err: unknown) => err instanceof RingApiError && err.isAuthError)
  assert.equal(calls.length, 0)
})

test('snapshot download follows the 303 itself and never sends the token to the storage host', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
  const { fn, calls } = fakeFetch((call) => {
    if (call.url.startsWith('https://api.amazonvision.com/')) {
      return new Response(null, { status: 303, headers: { Location: 'https://media.example.test/snap.jpg?sig=abc' } })
    }
    return new Response(jpeg, { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
  })
  const client = new RingClient({ token: 'tok', fetch: fn })
  const snap = await client.downloadSnapshot('dev', { type: 'latest_in_range', start_timestamp: 1 })

  assert.deepEqual([...snap.bytes], [...jpeg])
  assert.equal(snap.contentType, 'image/jpeg')
  assert.equal(calls.length, 2)
  assert.equal(calls[0]!.method, 'POST')
  assert.equal(calls[0]!.redirect, 'manual')
  assert.equal(calls[0]!.headers.get('Content-Type'), 'application/json')
  assert.deepEqual(JSON.parse(calls[0]!.body as string), { type: 'latest_in_range', start_timestamp: 1 })
  assert.equal(calls[1]!.url, 'https://media.example.test/snap.jpg?sig=abc')
  assert.equal(calls[1]!.headers.get('Authorization'), null)
})

test('clip download accepts a direct 200 response too', async () => {
  const { fn, calls } = fakeFetch(() => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'video/mp4' } }))
  const client = new RingClient({ token: 'tok', fetch: fn })
  const clip = await client.downloadClip('dev', { timestamp: 1, duration: 10_000 })
  assert.equal(clip.contentType, 'video/mp4')
  assert.equal(clip.bytes.length, 3)
  assert.equal(calls[0]!.url, 'https://api.amazonvision.com/v1/devices/dev/media/video/download')
})

test('startWhepSession posts SDP and returns the answer and absolute session URL', async () => {
  const { fn, calls } = fakeFetch(
    () =>
      new Response('v=0 answer', {
        status: 201,
        headers: { 'Content-Type': 'application/sdp', Location: '/v1/devices/dev/media/streaming/whep/sessions/s1?location=x' },
      }),
  )
  const client = new RingClient({ token: 'tok', fetch: fn })
  const session = await client.startWhepSession('dev', 'v=0 offer')
  assert.equal(session.sdpAnswer, 'v=0 answer')
  assert.equal(session.sessionUrl, 'https://api.amazonvision.com/v1/devices/dev/media/streaming/whep/sessions/s1?location=x')
  assert.equal(calls[0]!.headers.get('Content-Type'), 'application/sdp')
  assert.equal(calls[0]!.body, 'v=0 offer')
})

test('stopWhepSession deletes Ring session URLs and refuses foreign ones', async () => {
  const { fn, calls } = fakeFetch(() => new Response(null, { status: 204 }))
  const client = new RingClient({ token: 'tok', fetch: fn })
  await client.stopWhepSession('https://api.amazonvision.com/v1/devices/dev/media/streaming/whep/sessions/s1?location=x')
  assert.equal(calls[0]!.method, 'DELETE')
  assert.equal(calls[0]!.url, 'https://api.amazonvision.com/v1/devices/dev/media/streaming/whep/sessions/s1?location=x')

  await assert.rejects(client.stopWhepSession('https://evil.example.test/steal'), RingApiError)
  assert.equal(calls.length, 1)
})
