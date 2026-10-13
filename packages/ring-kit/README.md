# ring-kit

A typed, dependency-free TypeScript client for the [Ring Partner API](https://developer.amazon.com/ring), with webhook signature verification and a signed webhook simulator.

- **No dependencies.** Uses only `fetch` and Web Crypto, so it runs on Node.js 22+, Bun, Deno, Cloudflare Workers and other edge runtimes.
- **Webhooks v1.1.** Verifies `X-Signature` (HMAC-SHA256, compared in constant time) and shape-checks payloads. Event types Ring adds later pass through instead of being rejected.
- **Simulator.** Builds v1.1 payloads in the documented shape and delivers them signed, so you can test a webhook endpoint without a Ring device. The Ring Developer Playground doesn't send webhooks.
- **API client.** Devices, status, capabilities, location, configurations, event history, user profile, snapshot and clip downloads, and WHEP live view.

Built for [Herald](../../README.md), an accessible doorbell for Ring.

## Install

ring-kit ships as TypeScript source and isn't on npm yet. Use it from this repository as a workspace package, or copy `src/`. It works anywhere TypeScript is compiled for you: Next.js (add it to `transpilePackages`), Vite, Bun and Deno. Plain Node.js won't strip types inside `node_modules`, so an npm release will need a compiled build.

## Call the API

```ts
import { RingClient, RingApiError } from 'ring-kit'

// A string, or a function that returns the current token. The function runs before every request,
// so a refreshed token is picked up without recreating the client.
const ring = new RingClient({ token: () => process.env.RING_ACCESS_TOKEN ?? '' })

try {
  const devices = await ring.listDevices()
  const status = await ring.getStatus(devices[0].id)
  console.log(devices[0].attributes.name, status.attributes.online ? 'online' : 'offline')
} catch (err) {
  if (err instanceof RingApiError && err.isAuthError) {
    // Missing or expired token. Playground tokens last 30 minutes.
  }
  throw err
}
```

`RingApiError` carries the HTTP `status`, Ring's error `code` (for example `TIME_RANGE_NOT_AUTHORIZED`) and the full JSON:API `errors` array.

### Snapshots and clips

```ts
const { bytes, contentType } = await ring.downloadSnapshot(deviceId, {
  type: 'latest_in_range',
  start_timestamp: Date.now() - 10 * 60_000,
  end_timestamp: Date.now(),
  image_options: { format: 'jpeg' },
})
```

Ring answers media downloads with a 303 redirect to a pre-signed URL. ring-kit follows it itself and doesn't send your token to the storage host.

### Live view (WHEP)

Ring streams video only. Create a receive-only video transceiver in the browser, then relay the offer through your server so the token stays there:

```ts
// Server
const { sdpAnswer, sessionUrl } = await ring.startWhepSession(deviceId, sdpOfferFromBrowser)
// ...later, to end the stream:
if (sessionUrl) await ring.stopWhepSession(sessionUrl)
```

`stopWhepSession` refuses any URL that isn't on Ring's API host, so it can't be tricked into sending your token elsewhere.

## Verify webhooks

Verify the raw bytes before parsing: re-serialized JSON won't match the signature.

```ts
import { SIGNATURE_HEADER, parseWebhookPayload, verifyWebhookSignature } from 'ring-kit'

export async function POST(request: Request) {
  const raw = new Uint8Array(await request.arrayBuffer())
  const valid = await verifyWebhookSignature(process.env.RING_WEBHOOK_SIGNING_KEY ?? '', raw, request.headers.get(SIGNATURE_HEADER))
  if (!valid) return new Response('Invalid signature', { status: 401 })

  const parsed = parseWebhookPayload(new TextDecoder().decode(raw))
  if (!parsed.ok) return new Response(parsed.error, { status: 400 })

  const { type, attributes } = parsed.payload.data
  // type: 'button_press', 'motion_detected' (see attributes.sub_type), 'device_offline', ...
  return Response.json({ received: type })
}
```

Ring expects a 2xx within 5 seconds. It treats 4xx as permanent and retries 5xx with the same `meta.request_id`, so deduplicate on that id.

## Simulate webhooks

```ts
import { buildWebhookPayload, sendSimulatedWebhook } from 'ring-kit'

const payload = buildWebhookPayload({
  type: 'motion_detected',
  subType: 'package_delivery',
  deviceId: 'ava1.ring.device.EXAMPLE',
})

const res = await sendSimulatedWebhook({
  url: 'http://localhost:3000/api/webhook',
  signingKey: 'the same key your endpoint verifies with',
  payload,
})
```

Supported events: `button_press`, `motion_detected` (with any `subType`: `human`, `vehicle`, `package_delivery`, `other_motion`, or the default `motion`), `device_online` and `device_offline`. Each payload gets a fresh `request_id`, an id in Ring's `<device>_<type or sub_type>_<timestamp>` format, and `timestamp_readable` on motion events, matching the documented format.

## Tests

```bash
npm test -w packages/ring-kit
```

27 tests cover the client (auth, URL encoding, errors, the media redirect, WHEP), the payload builder, and signing and verification, including tampered bodies, re-serialized JSON, wrong keys and malformed headers.

## License

MIT
