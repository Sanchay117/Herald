// Records Herald's live view of the Ring Developer Playground camera while the Playground token is
// valid. Two captures from one take:
//   out/rec/live/      CDP screencast frames of the whole page (1920x1080) plus meta.json
//   out/live-stream.webm  the WebRTC video track itself at its native 1280x720, via MediaRecorder
// It also saves Herald's /api/ring/devices answer (out/ring-devices.json).
// Uses installed Google Chrome: the stream is H.264, which Playwright's own Chromium can't decode.
//
// usage: node record-live.mjs [take=1] [base url]
// Takes after the first write to out/rec/live-<take>/ and out/live-stream-<take>.webm.
import { chromium } from 'playwright'
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'

const TAKE = process.argv[2] ?? '1'
const BASE = process.argv[3] ?? 'http://localhost:5179/'
const SUFFIX = TAKE === '1' ? '' : `-${TAKE}`
const HERE = new URL('./', import.meta.url)
const DIR = new URL(`out/rec/live${SUFFIX}/`, HERE)
const WEBM = new URL(`out/live-stream${SUFFIX}.webm`, HERE).pathname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => performance.now() / 1000

rmSync(DIR, { recursive: true, force: true })
mkdirSync(DIR, { recursive: true })
rmSync(WEBM, { force: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--force-device-scale-factor=1.5'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'dark' })
await context.addInitScript(() => {
  localStorage.setItem(
    'herald.prefs.v1',
    JSON.stringify({ profile: 'deaf', speak: false, flash: true, vibrate: true, announce: true, minPriority: 'normal', voiceRate: 1 }),
  )
  // The Next.js dev indicator is not part of Herald.
  const hide = () => document.querySelectorAll('nextjs-portal').forEach((n) => n.remove())
  new MutationObserver(hide).observe(document, { childList: true, subtree: true })
})
const page = await context.newPage()
page.on('console', (m) => m.type() === 'error' && console.log('  [console]', m.text().slice(0, 200)))

const devices = await page.request.get(`${BASE}api/ring/devices`)
writeFileSync(new URL('out/ring-devices.json', HERE), JSON.stringify({ status: devices.status(), body: await devices.json() }, null, 2))
console.log('devices', devices.status())

await page.goto(BASE)
await page.getByText(/Playground Device: online/).waitFor({ timeout: 20_000 })
await page.getByText('Receiving alerts').waitFor()
// Any click counts as user activation, which hides the "turn on alerts" banner before the take.
await page.mouse.click(1270, 710)
await sleep(800)

const cdp = await context.newCDPSession(page)
const frames = []
const marks = []
const t0 = now()
cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
  const f = `${String(frames.length).padStart(5, '0')}.jpg`
  writeFileSync(new URL(f, DIR), Buffer.from(data, 'base64'))
  frames.push({ f, t: now() - t0 })
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080 })
await sleep(1200)

const start = page.getByRole('button', { name: 'Start live view' })
await start.scrollIntoViewIfNeeded()
const box = await start.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
await sleep(250)
marks.push({ name: 'click', t: now() - t0 })
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

await page.waitForFunction(() => {
  const v = document.querySelector('video')
  return v && v.srcObject && v.readyState >= 2 && v.videoWidth > 0
}, null, { timeout: 30_000 })
marks.push({ name: 'live', t: now() - t0 })
const size = await page.evaluate(() => {
  const v = document.querySelector('video')
  return `${v.videoWidth}x${v.videoHeight}`
})
console.log('live at', (now() - t0).toFixed(1), 's, stream', size)

await page.exposeFunction('__saveChunk', (b64) => appendFileSync(WEBM, Buffer.from(b64, 'base64')))
await page.evaluate(() => {
  const video = document.querySelector('video')
  const rec = new MediaRecorder(video.srcObject, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 14_000_000 })
  let chain = Promise.resolve()
  const toB64 = (blob) =>
    new Promise((done) => {
      const r = new FileReader()
      r.onload = () => done(String(r.result).split(',')[1] ?? '')
      r.readAsDataURL(blob)
    })
  rec.ondataavailable = (e) => {
    if (e.data.size) chain = chain.then(() => toB64(e.data)).then((b64) => window.__saveChunk(b64))
  }
  window.__recDone = new Promise((done) => (rec.onstop = () => chain.then(done)))
  rec.start(1000)
  window.__rec = rec
  // Stop when Ring ends the stream.
  video.srcObject.getVideoTracks()[0]?.addEventListener('ended', () => rec.state !== 'inactive' && rec.stop())
})

// Wait for the stream to end (the Playground clip runs about 30 s), at most 45 s.
const ended = await page
  .getByText('The camera ended the stream.')
  .first()
  .waitFor({ timeout: 45_000 })
  .then(() => true)
  .catch(() => false)
marks.push({ name: ended ? 'ended' : 'timeout', t: now() - t0 })
console.log(ended ? 'stream ended' : 'still live after 45 s', 'at', (now() - t0).toFixed(1), 's')
await page.evaluate(() => window.__rec.state !== 'inactive' && window.__rec.stop())
await page.evaluate(() => window.__recDone)
await sleep(1500)

await cdp.send('Page.stopScreencast')
await sleep(200)
writeFileSync(new URL('meta.json', DIR), JSON.stringify({ frames, marks, end: now() - t0 }))
console.log(frames.length, 'screencast frames,', (now() - t0).toFixed(1), 's')
await browser.close()
