# Friction log: building Herald on the Ring Partner API

Herald was built from India, so the Ring Developer Playground was the only way to reach the Ring API: real-device testing needs a device located in the US. Each entry below lists the task, the steps, what we expected and what happened, a severity, our workaround, and a suggestion.

**Severity:** High blocks a core feature or puts user data at risk. Medium costs real time or forces a workaround. Low is an annoyance with an easy workaround.

| # | Friction | Severity |
|---|---|---|
| 1 | Doorbell presses and webhooks can't be tested without a US device | High |
| 2 | The sample's webhook endpoint can't verify real Ring deliveries | High |
| 3 | The sample hands the access token to any caller | High |
| 4 | What the Playground stream shows is set through a console-only endpoint | Medium |
| 5 | Snapshot errors read like permission problems | Medium |
| 6 | No documented way to tell whether Smart Alerts is on | Medium |
| 7 | The sample asks for audio that live view doesn't carry | Low |
| 8 | Playground simulations appear in history as live views | Low |
| 9 | The whole developer guide is one very long page | Low |
| 10 | Playground tokens expire after 30 minutes | Low |
| 11 | Calling the API from a browser fails for some endpoints only | Low |

---

## 1. Doorbell presses and webhooks can't be tested without a US device

- **Severity:** High
- **Task:** Receive a doorbell press (`button_press`) and motion events by webhook, the core of a doorbell alert app.
- **Steps:** Read "Test Your Ring App Store Integration". It requires "a Ring account with an active Ring Protection subscription plan" and warns that only devices located in the US are supported. Switched to the Developer Playground, which says no physical device is required.
- **Expected:** The Playground can stand in for a device for the events the API documents.
- **Actual:** The Playground plays Package, Vehicle and Motion video on one simulated device. It has no doorbell press and sends no webhooks, so `button_press`, `motion_detected`, `device_online` and `device_offline` deliveries can't be tested end to end.
- **Workaround:** We built a webhook simulator into ring-kit. It produces v1.1 payloads in the documented shape, signs them with HMAC-SHA256 and POSTs them to our own endpoint, so Herald's real verification path runs on every simulated event.
- **Suggestion:** Add "Send test webhook" to the Playground: pick an event (button press, motion with each `sub_type`, online, offline), enter an endpoint URL, and Ring signs and delivers it exactly as in production. Stripe's `stripe trigger` and GitHub's "Redeliver" are good models.

## 2. The sample's webhook endpoint can't verify real Ring deliveries

- **Severity:** High
- **Task:** Use [ring-api-helloworld](https://github.com/AmazonAppDev/ring-api-helloworld) as the reference for receiving webhooks.
- **Steps:** Read `app/api/webhook/route.ts` and `lib/schemas/webhook.ts`, and compared them with the Webhooks v1.1 documentation.
- **Expected:** The sample checks `X-Signature`, an HMAC-SHA256 of the raw body, as the documentation describes.
- **Actual:**
  - The route compares `Authorization: Bearer <RING_WEBHOOK_SECRET>` as a plain string, and skips the check entirely when the secret is unset. Ring doesn't send that header. With the secret set, every real delivery gets a 401, which Ring treats as a permanent failure and doesn't retry. With it unset, the endpoint accepts anything from anyone.
  - The schema's event types are `motion_detected`, `device_added`, `device_removed` and `person_detected`. `button_press`, `device_online` and `device_offline` are missing, `person_detected` isn't a documented v1.1 type (people arrive as `motion_detected` with `sub_type: human`), and `sub_type`, `account_id`, `timestamp_readable` and `component_ids` aren't modelled. Payloads that fail the schema fall back to generic handling rather than being rejected.
  - The sample's test route, `app/api/webhook/test/route.ts`, pushes an unsigned event straight into the event stream, so nothing in the sample ever exercises verification.
- **Workaround:** We wrote verification from the documentation: Web Crypto HMAC over the exact bytes received, a constant-time compare, and verification before parsing, with tests for tampered bodies, re-serialized JSON, wrong keys and malformed headers.
- **Suggestion:** Update the sample to verify `X-Signature`, model the v1.1 schema (passing unknown fields through), and route its test endpoint through the real verification path with a signed payload.

## 3. The sample hands the access token to any caller

- **Severity:** High
- **Task:** Work out how to keep the Ring token safe while the browser runs WebRTC for live view.
- **Steps:** Read the sample's `app/api/ring/token/route.ts`.
- **Expected:** The token stays on the server, and the server relays the WHEP exchange.
- **Actual:** The route returns `{ accessToken }` to any caller, with no authentication. In the sample's refresh-token (production) mode, that's a live customer token for their cameras.
- **Workaround:** Herald's browser sends its SDP offer to Herald's own `/api/ring/stream`, which adds the token and relays the offer to Ring. The browser never sees the token.
- **Suggestion:** Remove the token route from the sample, show the server-side relay instead, and add a security note to the live-view guide.

## 4. What the Playground stream shows is set through a console-only endpoint

- **Severity:** Medium
- **Task:** Show Playground video inside Herald and control which clip plays.
- **Steps:** Generated a token and watched the Playground's own network traffic while choosing Package, Vehicle and Motion.
- **Expected:** A documented way, ideally through the public API, to choose what the simulated device streams.
- **Actual:** Choosing a clip calls `/ring/console/api/playground/link-video`, a console-only endpoint authenticated by the console's session cookie. The public API has no equivalent, and the documentation doesn't explain how a third-party live-view session relates to the clip chosen in the console.
- **Workaround:** Herald shows a hint on the Playground device: choose Package, Vehicle or Motion in the Playground first.
- **Suggestion:** Document the Playground's live-view behaviour (what plays, for how long, and for which sessions), and expose clip selection as a token-scoped API so apps and CI can drive it.

## 5. Snapshot errors read like permission problems

- **Severity:** Medium
- **Task:** Download a still image with `POST /v1/devices/{id}/media/image/download`.
- **Steps:** Sent a body without timestamps, then a `latest_in_range` request for the last few minutes on the Playground device.
- **Expected:** A 400 naming the missing field for the first request, and an image or a clear "no image in this range" for the second.
- **Actual:** The first returned **403 REQUEST_FORBIDDEN**, "Cannot authorize: missing required timestamp fields in request body": a validation error presented as an authorization failure. The second returned **403 TIME_RANGE_NOT_AUTHORIZED**, "Requested time range is not within authorized boundaries". On the Playground, images seem to exist only within a live-view session's time window, which isn't documented.
- **Workaround:** Herald's snapshot route passes Ring's error code through and treats only a 401 as a token problem, so a 403 isn't mistaken for an expired token.
- **Suggestion:** Return 400 with a pointer to the bad field for malformed bodies, and document which time ranges are authorized and what the Playground keeps.

## 6. No documented way to tell whether Smart Alerts is on

- **Severity:** Medium
- **Task:** Decide how loudly to announce motion. A person at the door should interrupt a Deaf user; a passing car shouldn't.
- **Steps:** Read the webhook `sub_type` documentation and the device capabilities and configurations references.
- **Expected:** A field that tells an app whether `sub_type` will carry classifications (`human`, `vehicle`, `package_delivery`) for this device.
- **Actual:** `sub_type` is `motion` when Smart Alerts is off and a classification when it's on, but we couldn't find a documented field that says which applies. An app can't tell "unclassified movement" from "classification turned off".
- **Workaround:** Herald treats plain `motion` as low priority and doesn't interrupt by default. The doorbell press always interrupts, so no visitor who rings is missed.
- **Suggestion:** Report Smart Alerts status, and which classes are enabled, in device capabilities or configurations.

## 7. The sample asks for audio that live view doesn't carry

- **Severity:** Low
- **Task:** Start a WHEP live-view session following the sample.
- **Steps:** Read the sample's `app/hooks/useWebRTCStream.ts` and compared it with the live-view documentation.
- **Expected:** The sample's offer matches the documentation: one receive-only video transceiver.
- **Actual:** The sample adds an `audio` transceiver with direction `sendrecv` and creates its offer with `offerToReceiveAudio: true`, while the documentation describes video only.
- **Workaround:** Herald offers a single receive-only video transceiver.
- **Suggestion:** Align the sample with the documentation, or document audio if it's planned.

## 8. Playground simulations appear in history as live views

- **Severity:** Low
- **Task:** Read back simulated events with `GET /v1/history/devices/{id}/events`, for example to show "a package arrived at 2:14".
- **Steps:** Simulated Package and Motion in the Playground, then listed the device's history.
- **Expected:** Entries for the simulated motion, with their detections.
- **Actual:** The entries have `event_type: on_demand` and an empty `cv_detections` list, the same as a plain live view.
- **Workaround:** None. Herald keeps its own alert history from webhooks.
- **Suggestion:** Log Playground simulations as the events they simulate, with matching detections.

## 9. The whole developer guide is one very long page

- **Severity:** Low
- **Task:** Look up the webhook payload format, then the live-view and media rules.
- **Steps:** Used the developer guide in a browser.
- **Expected:** One page per topic, with stable links.
- **Actual:** The guide loads as a single page of about 369,000 characters. Find-in-page works, but sharing a link to a section, reading on a phone, or giving the docs to tools is hard.
- **Workaround:** Find-in-page and our own notes.
- **Suggestion:** Split the guide into topic pages with stable anchors, and publish an OpenAPI spec plus a JSON Schema for webhook payloads.

## 10. Playground tokens expire after 30 minutes

- **Severity:** Low
- **Task:** Keep live view working through a development session and a demo recording.
- **Steps:** Generated a token and pasted it into the app's environment file.
- **Expected:** A development token that lasts a working session, or a way to refresh it.
- **Actual:** Tokens expire after 30 minutes, and every call fails with 401 until a new one is pasted in.
- **Workaround:** Herald reads the token on every request, so a fresh one works without a restart, and the interface says when the token has expired and how to get a new one.
- **Suggestion:** Offer longer-lived development tokens, or a refresh token for the Playground.

## 11. Calling the API from a browser fails for some endpoints only

- **Severity:** Low
- **Task:** Prototype API calls from a browser page before writing server code.
- **Steps:** Called several endpoints with `fetch` from a page on the Playground's origin.
- **Expected:** Either every endpoint works from a browser, or the documentation says the API is server-side only.
- **Actual:** Device and history calls returned data, but `GET /v1/devices/{id}/configurations` and media downloads that redirect to storage failed with an opaque "TypeError: Failed to fetch".
- **Workaround:** Herald calls the API only from its server.
- **Suggestion:** State that the API is meant for server-side use, or send CORS headers consistently.
