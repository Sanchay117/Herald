// Records Herald for the demo. Drives the production app in Chrome with a visible cursor and
// captures CDP screencast frames from every page in a take at once. Actions are timed against
// the narration (src/voice.json and src/timeline.json): second 0 of a take is the first frame of
// its scene, so a click lands on the word that describes it.
//   out/rec/<take>/<page>/   JPEG frames plus meta.json (frame times and marks)
// Ring's device list is replayed from out/ring-devices.json (saved by record-live.mjs while the
// 30-minute Playground token was valid), so the status chip reads as it did live. Alerts are real:
// every event goes through /api/simulate, a signed webhook and Server-Sent Events.
//
// usage: node record.mjs [--only setup,wall] [--base http://localhost:5180/]
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const BASE = arg('base', 'http://localhost:5180/')
const ONLY = arg('only', null)?.split(',')
const HERE = new URL('./', import.meta.url)
const read = (rel) => JSON.parse(readFileSync(new URL(rel, HERE), 'utf8'))
const timeline = read('src/timeline.json')
const voice = read('src/voice.json')
const devices = read('out/ring-devices.json')
if (devices.status !== 200) throw new Error('out/ring-devices.json is not a successful response; run record-live.mjs with a valid token')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => performance.now() / 1000

// ---------------------------------------------------------------- narration timing
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')
const scene = (id) => timeline.scenes.find((s) => s.id === id)
const part = (sceneId, partId) => scene(sceneId).parts.find((p) => p.id === partId)
/** Seconds from the start of a scene to a part (a line or a sound). */
const partAt = (sceneId, partId) => part(sceneId, partId).at / timeline.fps
const partEnd = (sceneId, partId) => (part(sceneId, partId).at + part(sceneId, partId).len) / timeline.fps
/** Seconds from the start of a scene to a word of one of its lines (the nth match). */
function wordAt(sceneId, lineId, word, nth = 0) {
  const hits = voice.find((l) => l.id === lineId).words.filter((w) => norm(w.w) === norm(word))
  if (!hits[nth]) throw new Error(`"${word}" not in ${lineId}`)
  return partAt(sceneId, lineId) + hits[nth].s
}

// ---------------------------------------------------------------- pages
const PROFILE = {
  deaf: { profile: 'deaf', speak: false, flash: true, vibrate: true, announce: true, minPriority: 'normal', voiceRate: 1 },
  blind: { profile: 'blind', speak: true, flash: false, vibrate: true, announce: true, minPriority: 'normal', voiceRate: 1 },
  deafblind: { profile: 'deafblind', speak: false, flash: false, vibrate: true, announce: true, minPriority: 'normal', voiceRate: 1 },
}

// Headless Chrome draws no pointer, so pages get one: an arrow that follows the mouse and a ripple on press.
const CURSOR = `(() => {
  if (window.__cursorInstalled) return
  window.__cursorInstalled = true
  const install = () => {
    const c = document.createElement('div')
    c.id = '__cursor'
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 28 28"><path d="M4 3 L4 22 L9.2 17.2 L12.8 25 L16.4 23.4 L12.9 15.8 L19.8 15.8 Z" fill="#fff" stroke="#0b0c0f" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-200px,-200px)', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.6))' })
    document.documentElement.appendChild(c)
    const style = document.createElement('style')
    style.textContent = '@keyframes __ripple{from{transform:translate(-50%,-50%) scale(.3);opacity:.9}to{transform:translate(-50%,-50%) scale(1.7);opacity:0}}'
    document.documentElement.appendChild(style)
    const pos = window.__cursorPos
    if (pos) c.style.transform = 'translate(' + (pos[0] - 4) + 'px,' + (pos[1] - 3) + 'px)'
    addEventListener('mousemove', (e) => {
      window.__cursorPos = [e.clientX, e.clientY]
      c.style.transform = 'translate(' + (e.clientX - 4) + 'px,' + (e.clientY - 3) + 'px)'
    }, true)
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div')
      Object.assign(r.style, { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '46px', height: '46px', borderRadius: '50%', border: '3px solid #93c5fd', background: 'rgba(147,197,253,.22)', pointerEvents: 'none', zIndex: 2147483646, animation: '__ripple .6s ease-out forwards' })
      document.documentElement.appendChild(r)
      setTimeout(() => r.remove(), 650)
    }, true)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install)
  else install()
})()`

const browsers = {
  desk: await chromium.launch({ channel: 'chrome', headless: true, args: ['--force-device-scale-factor=1.5'] }),
  phone: await chromium.launch({ channel: 'chrome', headless: true, args: ['--force-device-scale-factor=3'] }),
}

async function openPage({ browser = 'desk', viewport, prefs, cursor = true }) {
  const dpr = browser === 'phone' ? 3 : 1.5
  const context = await browsers[browser].newContext({ viewport, deviceScaleFactor: dpr, colorScheme: 'dark', isMobile: browser === 'phone', hasTouch: browser === 'phone' })
  await context.addInitScript((prefs) => {
    if (prefs) localStorage.setItem('herald.prefs.v1', JSON.stringify(prefs))
    else localStorage.removeItem('herald.prefs.v1')
  }, prefs ?? null)
  if (cursor) await context.addInitScript(CURSOR)
  await context.route('**/api/ring/devices', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(devices.body) }))
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.on('console', (m) => m.type() === 'error' && console.log('  [console]', m.text().slice(0, 200)))
  page.__mouse = { x: viewport.width * 0.7, y: viewport.height * 0.8 }
  return page
}

/** Loads Herald and waits until it is connected and showing the device as online. */
async function load(page) {
  await page.goto(BASE)
  await page.getByText('Receiving alerts').waitFor()
  await page.getByText(/Playground Device: online/).waitFor()
  await page.evaluate(() => document.fonts.ready)
}

/** Any click counts as user activation, which hides the "turn on alerts" banner. */
async function arm(page) {
  const box = await page.locator('header h1').boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  page.__mouse = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await sleep(500)
}

// ---------------------------------------------------------------- cursor
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
async function moveTo(page, x, y, ms) {
  const from = { ...page.__mouse }
  const dist = Math.hypot(x - from.x, y - from.y)
  ms ??= Math.min(800, Math.max(300, 240 + dist * 0.5))
  const steps = Math.max(6, Math.round(ms / 16))
  for (let i = 1; i <= steps; i++) {
    const p = ease(i / steps)
    await page.mouse.move(from.x + (x - from.x) * p, from.y + (y - from.y) * p)
    await sleep(ms / steps)
  }
  page.__mouse = { x, y }
}
async function centre(loc) {
  const b = await loc.first().boundingBox()
  return { x: b.x + Math.min(b.width / 2, 120), y: b.y + b.height / 2 }
}
async function hover(page, loc, ms) {
  const c = await centre(loc)
  await moveTo(page, c.x, c.y, ms)
}
async function click(page, loc, ms) {
  await hover(page, loc, ms)
  await sleep(90)
  await page.mouse.down()
  await sleep(70)
  await page.mouse.up()
}

async function simulate(event) {
  const res = await fetch(`${BASE}api/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) })
  const body = await res.json()
  if (!res.ok || !body.delivered) throw new Error(`simulate ${event} failed: ${JSON.stringify(body)}`)
}

// ---------------------------------------------------------------- take runner
const results = []
async function take(id, { pages: specs, prepare, act }) {
  if (ONLY && !ONLY.includes(id)) return
  console.log(`take ${id}`)
  const pages = {}
  for (const [name, spec] of Object.entries(specs)) pages[name] = await openPage(spec)
  try {
    await prepare(pages)
    const recs = []
    for (const [name, page] of Object.entries(pages)) {
      const dir = new URL(`out/rec/${id}/${name}/`, HERE)
      rmSync(dir, { recursive: true, force: true })
      mkdirSync(dir, { recursive: true })
      const cdp = await page.context().newCDPSession(page)
      const rec = { name, dir, cdp, frames: [] }
      cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
        if (rec.t0 !== undefined) {
          const f = `${String(rec.frames.length).padStart(5, '0')}.jpg`
          writeFileSync(new URL(f, dir), Buffer.from(data, 'base64'))
          rec.frames.push({ f, t: Math.max(0, now() - rec.t0) })
        }
        await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
      })
      recs.push(rec)
    }
    const t0 = now()
    for (const rec of recs) {
      rec.t0 = t0
      await rec.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 4000, maxHeight: 4000 })
    }
    const marks = []
    const mark = (name) => marks.push({ name, t: now() - t0 })
    const until = async (sec) => {
      const wait = t0 + sec - now()
      if (wait > 0) await sleep(wait * 1000)
    }
    await act(pages, { until, mark })
    const end = now() - t0
    for (const rec of recs) {
      await rec.cdp.send('Page.stopScreencast')
      writeFileSync(new URL('meta.json', rec.dir), JSON.stringify({ frames: rec.frames, marks, end }))
      results.push({ take: id, page: rec.name, frames: rec.frames.length, seconds: end.toFixed(1) })
    }
  } finally {
    for (const page of Object.values(pages)) await page.context().close()
  }
}

const DESK = { width: 1280, height: 720 }

try {
  // First run: who uses this screen. Clicks land on each profile as the narrator names it.
  await take('setup', {
    pages: { desk: { viewport: DESK, prefs: null } },
    prepare: async ({ desk }) => {
      await load(desk)
      await desk.getByText('Who will use Herald on this screen?').waitFor()
      await arm(desk)
      await moveTo(desk, 980, 610, 400)
      await sleep(700)
    },
    act: async ({ desk }, { until, mark }) => {
      const option = (title) => desk.locator('label', { hasText: title }).first()
      const lead = 0.5
      await until(wordAt('setup', 'setup', 'Deaf') - lead)
      await click(desk, option('Deaf or hard of hearing'))
      await until(wordAt('setup', 'setup', 'blind') - lead)
      await click(desk, option('Blind or low vision'))
      await until(wordAt('setup', 'setup', 'Deafblind') - lead)
      await click(desk, option('Deafblind'))
      await until(wordAt('setup', 'setup', 'custom') - lead)
      await hover(desk, option('Choose myself'))
      await until(partEnd('setup', 'setup') - 0.35)
      await click(desk, desk.getByRole('button', { name: 'Start using Herald' }))
      mark('start')
      await sleep(2200)
    },
  })

  // One doorbell press, three screens set up for three people.
  await take('wall', {
    pages: {
      tv: { viewport: DESK, prefs: PROFILE.deaf, cursor: false },
      laptop: { viewport: { width: 1280, height: 800 }, prefs: PROFILE.blind, cursor: false },
      phone: { browser: 'phone', viewport: { width: 390, height: 844 }, prefs: PROFILE.deafblind, cursor: false },
    },
    prepare: async (pages) => {
      for (const page of Object.values(pages)) {
        await load(page)
        await arm(page)
      }
      await sleep(800)
    },
    act: async (_pages, { until, mark }) => {
      await until(partAt('wall', 'chime') + 0.55)
      mark('event')
      await simulate('doorbell')
      await sleep(7000)
    },
  })

  // Priorities: a vehicle is listed without interrupting; a package flashes green.
  await take('priority', {
    pages: { desk: { viewport: DESK, prefs: PROFILE.deaf } },
    prepare: async ({ desk }) => {
      await load(desk)
      await arm(desk)
      await desk.evaluate(() => {
        const top = document.getElementById('history-heading').getBoundingClientRect().top + scrollY
        scrollTo(0, top - 36)
      })
      await moveTo(desk, 640, 520, 400)
      await sleep(700)
    },
    act: async ({ desk }, { until, mark }) => {
      const lead = 0.75
      await until(wordAt('priority', 'priority', 'passing') - lead)
      await click(desk, desk.getByRole('button', { name: 'Vehicle', exact: true }))
      mark('vehicle')
      await until(wordAt('priority', 'priority', 'package') - lead)
      await click(desk, desk.getByRole('button', { name: 'Package delivery', exact: true }))
      mark('package')
      await sleep(3200)
    },
  })

  // Keyboard only: focus moves to Dismiss when the flash appears, then back to the button.
  await take('focus', {
    pages: { desk: { viewport: DESK, prefs: PROFILE.deaf, cursor: false } },
    prepare: async ({ desk }) => {
      await load(desk)
      await arm(desk)
      await desk.mouse.move(-10, -10)
      await desk.evaluate(() => {
        const sim = document.getElementById('sim-heading').getBoundingClientRect().top + scrollY
        scrollTo(0, sim - 300)
        // the history list sits just before the simulator in tab order
        document.querySelector('ol[aria-labelledby="history-heading"]').focus({ preventScroll: true })
      })
      await sleep(600)
    },
    act: async ({ desk }, { until, mark }) => {
      await until(0.5)
      mark('key:Tab')
      await desk.keyboard.press('Tab')
      await until(1.7)
      mark('key:Enter')
      await desk.keyboard.press('Enter')
      await until(4.0)
      mark('key:Enter')
      await desk.keyboard.press('Enter')
      await sleep(1800)
    },
  })
} finally {
  console.table(results)
  for (const b of Object.values(browsers)) await b.close()
}
