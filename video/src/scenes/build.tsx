import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion'
import { Backdrop, BrowserFrame, Camera, Chip, clamp, Clip, Counter, EASE, EASE_IN_OUT, Icon, type IconName, inside, Keycap, Kicker, Logo, Panel, Sfx, Show, Spoken, usePop, Words } from '../components'
import { part, scene, wordAt, wordEnd } from '../data'
import { ALERT, C, MONO } from '../theme'

const AMBER = ALERT.doorbell.flash
const SENSE = [ALERT.doorbell.flash, ALERT.person.flash, ALERT.package.flash, ALERT.vehicle.flash]

/** A terminal window: a title bar and monospaced lines. */
function Terminal({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: '#07080a', border: '1.5px solid rgba(255,255,255,0.16)', boxShadow: '0 50px 120px -40px #000', ...style }}>
      <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px', background: C.surface2, borderBottom: `1px solid ${C.lineSoft}` }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 99, background: C.line, opacity: 0.7 }} />
        ))}
        <span style={{ marginLeft: 12, fontFamily: MONO, fontSize: 18, color: C.muted }}>{title}</span>
      </div>
      <div style={{ padding: '18px 24px', fontFamily: MONO, fontSize: 21, lineHeight: 1.62, color: C.muted }}>{children}</div>
    </div>
  )
}

// ------------------------------------------------------------------------------------ safe

// The flash: a dark layer over the margins fades in and out, 667 ms per change, six changes,
// then holds (globals.css).
const CHANGE = 0.667
function pulse(t: number): number {
  if (t < 0 || t >= 6 * CHANGE) return 0
  const k = Math.floor(t / CHANGE)
  const x = (t % CHANGE) / CHANGE
  const e = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2 // ease-in-out
  return k % 2 === 0 ? e : 1 - e
}

/** Herald's flash, drawn small: the margins darken and lighten, the text panel stays solid. */
function FlashPreview({ start, again }: { start: number; again: number }) {
  const frame = useCurrentFrame()
  const dark = 0.45 * pulse((frame - start) / 30)
  // a second alert with Reduce motion on: it arrives, and the colour simply holds
  const pop = usePop(again, { damping: 12, stiffness: 200 })
  const bump = frame >= again ? 1 + 0.05 * Math.sin(Math.PI * Math.min(1, pop)) : 1
  return (
    <div style={{ width: 600, height: 360, borderRadius: 24, background: AMBER, position: 'relative', overflow: 'hidden', boxShadow: `0 0 90px -20px ${AMBER}`, transform: `scale(${bump})` }}>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: dark }} />
      <div style={{ position: 'absolute', inset: 34, borderRadius: 18, background: AMBER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: ALERT.doorbell.ink }}>
        <Icon name="bell" size={70} stroke={2.4} />
        <div style={{ fontSize: 56, fontWeight: 700, marginTop: 8 }}>Doorbell</div>
        <div style={{ fontSize: 26, marginTop: 4 }}>Someone is at the front door.</div>
      </div>
    </div>
  )
}

/** Brightness over four seconds: Herald's flash against the WCAG 2.3.1 limit of three flashes a second. */
function PulseChart({ drawHerald, drawLimit, flatten }: { drawHerald: number; drawLimit: number; flatten: number }) {
  const w = 860
  const h = 300
  // full colour at the top, the darkest point of a pulse at the bottom
  const y = (dark: number) => 30 + dark * (h - 60)
  const path = (fn: (t: number) => number, upto: number) => {
    const pts: string[] = []
    for (let t = 0; t <= 4 * upto + 1e-9; t += 0.01) pts.push(`${((t / 4) * w).toFixed(1)},${y(fn(t)).toFixed(1)}`)
    return pts.length > 1 ? `M${pts.join(' L')}` : ''
  }
  const herald = (t: number) => pulse(t) * (1 - flatten)
  const limit = (t: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * 3 * t)
  const headT = 4 * drawHerald
  return (
    <svg width={w + 20} height={h + 60} style={{ overflow: 'visible' }}>
      {[0, 1, 2, 3, 4].map((s) => (
        <g key={s}>
          <line x1={(s / 4) * w} x2={(s / 4) * w} y1={10} y2={h} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
          <text x={(s / 4) * w} y={h + 40} fill={C.muted} fontSize={24} textAnchor="middle" fontFamily={MONO}>
            {s}s
          </text>
        </g>
      ))}
      {drawLimit > 0 && <path d={path(limit, drawLimit)} fill="none" stroke={C.bad} strokeWidth={3} strokeDasharray="10 8" opacity={0.9} />}
      {drawHerald > 0 && <path d={path(herald, drawHerald)} fill="none" stroke={AMBER} strokeWidth={7} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 10px ${AMBER})` }} />}
      {drawHerald > 0 && drawHerald < 1 && <circle cx={(headT / 4) * w} cy={y(herald(headT))} r={11} fill={AMBER} />}
    </svg>
  )
}

// The output of `npm run check:contrast` (video/out/contrast-output.txt), line for line.
const CONTRAST = [
  'PASS  light  ink on canvas                 17.86:1  (min 7)',
  'PASS  light  muted on canvas                9.77:1  (min 7)',
  'PASS  light  accent on canvas               7.92:1  (min 7)',
  'PASS  light  ok on canvas                   8.27:1  (min 7)',
  'PASS  light  warn on canvas                 8.51:1  (min 7)',
  'PASS  light  bad on canvas                  7.55:1  (min 7)',
  'PASS  light  line on canvas                 3.11:1  (min 3)',
  'PASS  light  focus on canvas                7.92:1  (min 3)',
  'PASS  light  ink on surface                19.67:1  (min 7)',
  'PASS  light  muted on surface              10.76:1  (min 7)',
  'PASS  light  accent on surface              8.72:1  (min 7)',
  'PASS  light  ok on surface                  9.11:1  (min 7)',
  'PASS  light  warn on surface                9.37:1  (min 7)',
  'PASS  light  bad on surface                 8.31:1  (min 7)',
  'PASS  light  line on surface                3.42:1  (min 3)',
  'PASS  light  focus on surface               8.72:1  (min 3)',
  'PASS  light  accent-ink on accent           8.72:1  (min 7)',
  'PASS  dark   ink on canvas                 17.93:1  (min 7)',
  'PASS  dark   muted on canvas               11.64:1  (min 7)',
  'PASS  dark   accent on canvas              10.85:1  (min 7)',
  'PASS  dark   ok on canvas                  11.22:1  (min 7)',
  'PASS  dark   warn on canvas                11.72:1  (min 7)',
  'PASS  dark   bad on canvas                 10.30:1  (min 7)',
  'PASS  dark   line on canvas                 4.05:1  (min 3)',
  'PASS  dark   focus on canvas               13.56:1  (min 3)',
  'PASS  dark   ink on surface                16.44:1  (min 7)',
  'PASS  dark   muted on surface              10.67:1  (min 7)',
  'PASS  dark   accent on surface              9.94:1  (min 7)',
  'PASS  dark   ok on surface                 10.29:1  (min 7)',
  'PASS  dark   warn on surface               10.74:1  (min 7)',
  'PASS  dark   bad on surface                 9.45:1  (min 7)',
  'PASS  dark   line on surface                3.71:1  (min 3)',
  'PASS  dark   focus on surface              12.44:1  (min 3)',
  'PASS  dark   accent-ink on accent          10.38:1  (min 7)',
  'PASS  alert  doorbell ink on its colour    10.16:1  (min 7)',
  'PASS  alert  person ink on its colour       9.46:1  (min 7)',
  'PASS  alert  package ink on its colour      9.85:1  (min 7)',
  'PASS  alert  vehicle ink on its colour      9.44:1  (min 7)',
  'PASS  alert  motion ink on its colour      14.48:1  (min 7)',
  'PASS  alert  camera_offline ink on its colour   8.42:1  (min 7)',
  'PASS  alert  camera_online ink on its colour  14.48:1  (min 7)',
]

function Swatch({ bg, fg, name, ratio, delay }: { bg: string; fg: string; name: string; ratio: string; delay: number }) {
  const p = usePop(delay, { damping: 15 })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
      <div style={{ width: 96, height: 72, borderRadius: 16, background: bg, color: fg, display: 'grid', placeItems: 'center', fontSize: 40, fontWeight: 700, border: '1.5px solid rgba(255,255,255,0.18)' }}>Aa</div>
      <div style={{ flex: 1, fontSize: 30 }}>{name}</div>
      <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, color: C.ok }}>{ratio}</div>
    </div>
  )
}

export function Safe() {
  const frame = useCurrentFrame()
  const pulses = wordAt('safe', 'safe', 'pulses')
  const far = wordAt('safe', 'safe', 'far')
  const reduce = wordAt('safe', 'safe', 'reduce')
  const focusAt = wordAt('safe', 'safe', 'focus')
  const allAt = wordAt('safe', 'safe', 'all')
  const scriptAt = wordAt('safe', 'safe', 'script')
  const beat2 = wordAt('safe', 'safe', 'the', 1) - 6
  const beat3 = focusAt - 12
  const beat4 = allAt - 10
  const { duration } = scene('safe')

  // the focus clip, keyboard only: Enter on "Doorbell press", the flash with focus on Dismiss,
  // Enter again, and focus back on the button. The wait for the server is cut out.
  const enter1 = focusAt + 2
  const cut = enter1 + 2
  const enter2 = wordAt('safe', 'safe', 'then') - 6
  const focusTime = (f: number) => {
    if (f < cut) return 1.7 + (f - enter1) / 30
    if (f < enter2) return 3.467 + ((f - cut) / (enter2 - cut)) * (3.99 - 3.467)
    return 3.99 + (f - enter2) / 30
  }
  const fw = 1240
  const fh = 698
  const button = { x: 1425, y: 709, s: 1.75 }
  const keys = [
    { f: 0, ...button },
    { f: cut - 1, ...button },
    { f: cut, x: 960, y: 610, s: 1.18 },
    { f: enter2 + 1, x: 960, y: 610, s: 1.18 },
    { f: enter2 + 2, ...button },
  ].map((k) => ({ ...k, x: (k.x * fw) / 1920, y: (k.y * fw) / 1920 }))
  const focusLabel = frame < cut ? 'Doorbell press' : frame < enter2 + 2 ? 'Dismiss' : 'Doorbell press, where you were'

  const shown = Math.floor(interpolate(frame, [allAt + 6, scriptAt + 10], [0, CONTRAST.length], clamp))
  const done = frame >= scriptAt + 12
  return (
    <Backdrop hue={AMBER} hue2={C.accentDeep}>
      <Show from={0} to={beat2 - 6} fade={8}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Kicker delay={6} color={C.focus}>
            Accessibility
          </Kicker>
          <Words text="is the spec," delay={wordAt('safe', 'safe', 'is') - 2} size={120} style={{ marginTop: 26 }} />
          <div style={{ position: 'relative', marginTop: 4 }}>
            <Words text="not polish." delay={wordAt('safe', 'safe', 'not') - 2} size={120} color={C.muted} />
            <div style={{ position: 'absolute', left: 0, top: '55%', height: 10, borderRadius: 9, background: C.focus, width: `${interpolate(frame, [wordAt('safe', 'safe', 'polish.') + 2, wordAt('safe', 'safe', 'polish.') + 14], [0, 96], { ...clamp, easing: EASE })}%` }} />
          </div>
        </AbsoluteFill>
      </Show>

      <Show from={beat2 + 10} to={beat3 - 6} fade={8}>
        <div style={{ position: 'absolute', left: 90, top: 150 }}>
          <FlashPreview start={pulses} again={reduce + 8} />
          <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 18, fontSize: 30 }}>
            <div style={{ width: 84, height: 46, borderRadius: 99, background: frame >= reduce + 4 ? C.ok : C.surface2, border: `2px solid ${frame >= reduce + 4 ? C.ok : C.line}`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 5, left: interpolate(frame, [reduce, reduce + 8], [6, 42], { ...clamp, easing: EASE_IN_OUT }), width: 32, height: 32, borderRadius: 99, background: C.ink }} />
            </div>
            <span style={{ fontWeight: 700 }}>Reduce motion</span>
            <span style={{ color: C.muted }}>{frame >= reduce + 6 ? 'colour holds steady' : 'off'}</span>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 820, top: 130 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.12em', color: C.muted, marginBottom: 18 }}>FLASH BRIGHTNESS, FIRST 4 SECONDS</div>
          <PulseChart drawHerald={interpolate(frame, [pulses, pulses + 70], [0, 1], clamp)} drawLimit={interpolate(frame, [far, far + 40], [0, 1], clamp)} flatten={interpolate(frame, [reduce + 4, reduce + 18], [0, 1], { ...clamp, easing: EASE_IN_OUT })} />
          <div style={{ display: 'flex', gap: 22, marginTop: 20 }}>
            <Chip color={AMBER} delay={pulses + 20} size={28}>
              Herald: 0.75 flashes a second
            </Chip>
            <Chip color={C.bad} delay={far + 16} size={28}>
              WCAG limit: 3 a second
            </Chip>
          </div>
        </div>
      </Show>

      <Show from={beat3} to={beat4 - 6} fade={8}>
        <div style={{ position: 'absolute', left: 60, top: 110 }}>
          <BrowserFrame width={fw} height={fh}>
            <Camera keys={keys} width={fw} height={fh}>
              <div style={{ width: fw, height: fh }}>
                <Clip id="focus-desk" time={focusTime} />
              </div>
            </Camera>
          </BrowserFrame>
        </div>
        <div style={{ position: 'absolute', left: 1350, top: 150, width: 510 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.12em', color: C.muted }}>KEYBOARD ONLY</div>
          <div style={{ display: 'flex', gap: 20, marginTop: 24 }}>
            <Keycap label="Enter" pressAt={enter1} size={70} />
            <Keycap label="Enter" pressAt={enter2} size={70} />
          </div>
          <Panel accent={C.focus} style={{ marginTop: 40, padding: '24px 28px' }}>
            <div style={{ fontSize: 24, color: C.muted }}>Keyboard focus is on</div>
            <div style={{ fontSize: 38, fontWeight: 700, marginTop: 8, color: C.focus }}>{focusLabel}</div>
          </Panel>
        </div>
      </Show>

      <Show from={beat4} to={duration + 10} fade={8}>
        <div style={{ position: 'absolute', left: 90, top: 130, width: 900 }}>
          <Terminal title="herald">
            <div style={{ color: C.ink }}>$ npm run check:contrast</div>
            <div style={{ height: 13 * 31, overflow: 'hidden', fontSize: 19 }}>
              {CONTRAST.slice(Math.max(0, shown - 13), shown).map((l) => (
                <div key={l} style={{ whiteSpace: 'pre', height: 31, lineHeight: '31px' }}>
                  <span style={{ color: C.ok }}>{l.slice(0, 4)}</span>
                  {l.slice(4)}
                </div>
              ))}
            </div>
            <div style={{ color: C.ok, fontWeight: 700, marginTop: 8, opacity: done ? 1 : 0 }}>All 41 pairs pass</div>
          </Terminal>
        </div>
        <div style={{ position: 'absolute', left: 1080, top: 140, width: 760 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            {/* counts the PASS lines as the terminal prints them */}
            <span style={{ fontSize: 170, fontWeight: 700, color: C.ok, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
            <span style={{ fontSize: 80, fontWeight: 700, color: C.muted }}>/ 41</span>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, marginTop: 6 }}>colour pairs pass, checked by a script</div>
          <div style={{ fontSize: 28, color: C.muted, marginTop: 6 }}>Text at WCAG AAA (7:1). Borders and focus at 3:1.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 40 }}>
            <Swatch bg={C.canvas} fg={C.ink} name="Text on the dark canvas" ratio="17.93:1" delay={wordAt('safe', 'safe', 'wcag')} />
            <Swatch bg={AMBER} fg={ALERT.doorbell.ink} name="Text on the doorbell flash" ratio="10.16:1" delay={wordAt('safe', 'safe', 'wcag') + 8} />
            <Swatch bg={ALERT.vehicle.flash} fg={ALERT.vehicle.ink} name="Text on the vehicle flash" ratio="9.44:1" delay={wordAt('safe', 'safe', 'wcag') + 16} />
          </div>
        </div>
      </Show>
      <Sfx id="key" at={enter1} volume={0.7} />
      <Sfx id="key" at={enter2} volume={0.7} />
      <Sfx id="ok" at={scriptAt + 12} volume={0.4} />
    </Backdrop>
  )
}

// ------------------------------------------------------------------------------------ tech

function Stage({ icon, title, sub, color, delay, glow = 0, style, children }: { icon: IconName; title: string; sub: string; color: string; delay: number; glow?: number; style?: CSSProperties; children?: ReactNode }) {
  const p = usePop(delay, { damping: 15 })
  return (
    <div style={{ position: 'absolute', opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`, ...style }}>
      <Panel accent={color} style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: glow > 0 ? `0 0 ${80 * glow}px -10px ${color}` : undefined }}>
        <div style={{ width: 92, height: 92, borderRadius: 26, background: `${color}24`, display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={56} color={color} />
        </div>
        <div style={{ fontSize: 34, fontWeight: 700, marginTop: 14 }}>{title}</div>
        <div style={{ fontSize: 23, color: C.muted, marginTop: 4, lineHeight: 1.3 }}>{sub}</div>
        {children}
      </Panel>
    </div>
  )
}

/**
 * A request riding from x1 to x2 between `from` and `to` frames, then absorbed by the stage it
 * reached; or, with `reject`, knocked out of the pipeline at that frame.
 */
function Packet({ x1, x2, y, from, to, color, label, reject }: { x1: number; x2: number; y: number; from: number; to: number; color: string; label?: string; reject?: number }) {
  const frame = useCurrentFrame()
  if (frame < from) return null
  const p = interpolate(frame, [from, to], [0, 1], { ...clamp, easing: EASE_IN_OUT })
  const r = reject !== undefined ? interpolate(frame, [reject, reject + 18], [0, 1], clamp) : 0
  const absorbed = reject === undefined ? interpolate(frame, [to, to + 6], [0, 1], clamp) : 0
  if (r >= 1 || absorbed >= 1) return null
  const x = x1 + (x2 - x1) * p
  return (
    <div style={{ position: 'absolute', left: x - 30, top: y - 30 + r * 120, opacity: (1 - r) * (1 - absorbed), transform: `rotate(${r * 40}deg) scale(${1 - 0.5 * absorbed})` }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: color, display: 'grid', placeItems: 'center', boxShadow: `0 0 30px ${color}` }}>
        <Icon name={reject !== undefined && frame >= reject ? 'x' : 'mail'} size={34} color={C.canvas} stroke={2.6} />
      </div>
      {label && p < 1 && <div style={{ position: 'absolute', left: -60, top: 70, width: 180, textAlign: 'center', fontFamily: MONO, fontSize: 18, color: C.muted }}>{label}</div>}
    </div>
  )
}

function Track({ x1, x2, y, delay }: { x1: number; x2: number; y: number; delay: number }) {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [delay, delay + 14], [0, 1], clamp)
  return <div style={{ position: 'absolute', left: x1, top: y - 2, width: (x2 - x1) * p, height: 4, backgroundImage: `linear-gradient(90deg, ${C.line} 50%, transparent 50%)`, backgroundSize: '18px 4px', backgroundPosition: `${frame * 1.5}px 0` }} />
}

// An excerpt of apps/web/app/api/webhook/route.ts, in order; each line lights while the
// narration describes it.
const CODE: { text: string; on?: 'raw' | 'verifies' | 'parsing' | 'drops' | 'streams' }[] = [
  { text: '// Verify the exact bytes received, then parse.' },
  { text: 'const raw = new Uint8Array(await request.arrayBuffer())', on: 'raw' },
  { text: 'if (!(await verifyWebhookSignature(key, raw, request.headers.get(SIGNATURE_HEADER)))) {', on: 'verifies' },
  { text: "  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })", on: 'verifies' },
  { text: '}' },
  { text: 'const parsed = parseWebhookPayload(new TextDecoder().decode(raw))', on: 'parsing' },
  { text: '...' },
  { text: 'if (!markSeen(payload.meta.request_id)) {', on: 'drops' },
  { text: "  return NextResponse.json({ status: 'duplicate', requestId: payload.meta.request_id })", on: 'drops' },
  { text: '}' },
  { text: '...' },
  { text: "publish({ type: 'alert', alert })", on: 'streams' },
]

export function Tech() {
  const frame = useCurrentFrame()
  const w = (word: string, nth = 0) => wordAt('tech', 'tech', word, nth)
  const ring = w('ring')
  const verify = w('verifies')
  const sig = w('signature')
  const parse = w('parsing')
  const drops = w('drops')
  const streams = w('streams')
  const sse = w('server-sent')
  // when each highlighted part of the code is being described
  const spans = { raw: [w('raw'), w('before')], verifies: [verify, drops - 4], parsing: [parse, drops - 4], drops: [drops, streams - 4], streams: [streams, 999] }
  const y = 270
  const screens: { icon: IconName; name: string }[] = [
    { icon: 'tv', name: 'TV' },
    { icon: 'laptop', name: 'Laptop' },
    { icon: 'smartphone', name: 'Phone' },
  ]
  const verified = usePop(sig + 4, { damping: 11, stiffness: 200 })
  return (
    <Backdrop hue={C.accent} hue2={ALERT.package.flash}>
      <Track x1={330} x2={560} y={y} delay={ring} />
      <Track x1={880} x2={1080} y={y} delay={verify + 20} />
      <Track x1={1400} x2={1540} y={y} delay={streams - 10} />
      <Stage icon="cloud" title="Ring" sub="signs every webhook" color={ALERT.package.flash} delay={ring - 12} style={{ left: 80, top: y - 130, width: 250 }} />
      <Stage icon="shield" title="Verify HMAC" sub="on the raw bytes, before parsing" color={AMBER} delay={verify - 10} glow={inside(frame, verify, drops - 6, 8)} style={{ left: 560, top: y - 150, width: 320 }}>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 19, color: C.ok, opacity: verified, transform: `scale(${0.8 + 0.2 * verified})` }}>
          <Icon name="check" size={24} color={C.ok} stroke={3} />
          X-Signature matches
        </div>
      </Stage>
      <Stage icon="copy" title="Drop duplicates" sub="Ring retries; each request_id once" color={ALERT.vehicle.flash} delay={drops - 14} glow={inside(frame, drops, streams - 6, 8)} style={{ left: 1080, top: y - 130, width: 320 }} />
      <div style={{ position: 'absolute', left: 1540, top: y - 190, width: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {screens.map((s, i) => {
          const p = usePop(streams - 8 + i * 4, { damping: 15 })
          const hit = frame >= streams + 18 + i * 6
          return (
            <Panel key={s.name} accent={hit ? AMBER : undefined} style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16, opacity: p, transform: `translateX(${(1 - p) * 40}px)`, background: hit ? `${AMBER}22` : undefined }}>
              <Icon name={s.icon} size={40} color={hit ? AMBER : C.ink} />
              <span style={{ fontSize: 30, fontWeight: 700 }}>{s.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 22, color: hit ? AMBER : C.muted }}>{hit ? 'alert' : 'listening'}</span>
            </Panel>
          )
        })}
        <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 22, color: C.accent, opacity: usePop(sse - 4) }}>Server-Sent Events</div>
      </div>
      <Packet x1={330} x2={560} y={y} from={w('signs')} to={verify - 6} color={ALERT.package.flash} label="X-Signature" />
      <Packet x1={880} x2={1080} y={y} from={parse + 10} to={drops - 2} color={AMBER} />
      <Packet x1={330} x2={1080} y={y + 10} from={drops - 22} to={drops + 16} color={ALERT.vehicle.flash} reject={drops + 18} />
      <Show from={drops + 18} to={streams - 2} fade={6}>
        <div style={{ position: 'absolute', left: 1080, width: 320, top: 440, display: 'flex', justifyContent: 'center' }}>
          <Chip color={C.bad} delay={drops + 18} size={22}>
            Same request_id, dropped
          </Chip>
        </div>
      </Show>
      <Packet x1={1400} x2={1540} y={y} from={streams - 4} to={streams + 14} color={AMBER} />

      <div style={{ position: 'absolute', left: 120, top: 500, width: 1680, opacity: usePop(verify - 4), transform: `translateY(${(1 - usePop(verify - 4)) * 30}px)` }}>
        <Terminal title="apps/web/app/api/webhook/route.ts" style={{ background: '#07080acc' }}>
          {CODE.map((l, i) => {
            const lit = l.on !== undefined && inside(frame, spans[l.on][0], spans[l.on][1], 5) > 0.5
            const dim = l.text.startsWith('//') || l.text === '...'
            return (
              <div key={i} style={{ whiteSpace: 'pre', fontSize: 19, lineHeight: 1.45, color: lit ? C.ink : dim ? C.line : C.muted, background: lit ? `${AMBER}1f` : undefined, borderLeft: `4px solid ${lit ? AMBER : 'transparent'}`, paddingLeft: 12, marginLeft: -16 }}>
                {l.text}
              </div>
            )
          })}
        </Terminal>
      </div>
    </Backdrop>
  )
}

// ------------------------------------------------------------------------------------ ring-kit

// An excerpt of `npm test` (video/out/test-output.txt): five tests from each package, in order,
// and each package's real totals.
const SUITES: { name: string; tests: string[]; total: number }[] = [
  {
    name: 'ring-kit',
    total: 27,
    tests: [
      'snapshot download follows the 303 itself and never sends the token to the storage host',
      'button_press payload follows the documented v1.1 shape',
      'sendSimulatedWebhook signs the exact bytes it sends',
      'verifyWebhookSignature rejects a tampered body',
      'verifyWebhookSignature rejects re-serialized JSON (verify raw bytes, then parse)',
    ],
  },
  {
    name: '@herald/web',
    total: 25,
    tests: [
      'a doorbell press is urgent and says someone is at the door',
      'motion sub_types map to person, package, vehicle and movement',
      'meetsPriority: urgent always interrupts, info only when asked for everything',
      'every kind of alert has its own vibration rhythm that can be felt',
      'every profile leaves at least one output the person can perceive',
    ],
  },
]
const TEST_LINES: { text: string; kind: 'suite' | 'test' | 'more' | 'total' }[] = SUITES.flatMap((s) => [
  { text: `> ${s.name} test`, kind: 'suite' as const },
  ...s.tests.map((t) => ({ text: t, kind: 'test' as const })),
  { text: '...', kind: 'more' as const },
  { text: `ℹ tests ${s.total}  ℹ pass ${s.total}  ℹ fail 0`, kind: 'total' as const },
])

const FRICTION: [string, 'High' | 'Medium' | 'Low'][] = [
  ['Webhooks need a US device to test', 'High'],
  ["The sample can't verify Ring's deliveries", 'High'],
  ['The sample hands the token to any caller', 'High'],
  ['Playground stream set by a console-only endpoint', 'Medium'],
  ['Snapshot errors read like permission problems', 'Medium'],
  ['No documented way to tell if Smart Alerts is on', 'Medium'],
  ["The sample asks for audio live view doesn't carry", 'Low'],
  ['Simulations show in history as live views', 'Low'],
  ['The developer guide is one very long page', 'Low'],
  ['Playground tokens expire after 30 minutes', 'Low'],
  ['Browser calls fail for some endpoints only', 'Low'],
]
const SEVERITY = { High: C.bad, Medium: AMBER, Low: C.accent }

export function RingKit() {
  const frame = useCurrentFrame()
  const w = (word: string, nth = 0) => wordAt('ringkit', 'ringkit', word, nth)
  const cant = w("can't")
  const built = w('built')
  const every = w('every')
  const tests = w('52')
  const logged = w('11')
  const { duration } = scene('ringkit')
  const shownTests = Math.floor(interpolate(frame, [tests - 6, tests + 30], [0, TEST_LINES.length], clamp))
  const cross = usePop(cant, { damping: 10, stiffness: 200 })
  const kit = usePop(built - 4, { damping: 16, stiffness: 110 })
  const feature = (word: string) => usePop(w(word) - 4, { damping: 15 })
  const features: { icon: IconName; text: string; p: number }[] = [
    { icon: 'code', text: 'Ring API client: devices, live view, media', p: feature('client') },
    { icon: 'shield', text: 'Webhook signing and verification', p: feature('signed') },
    { icon: 'zap', text: 'Signed event simulator', p: feature('simulator.') },
  ]
  return (
    <Backdrop hue={ALERT.package.flash} hue2={C.accentDeep}>
      <Show from={0} to={every - 8} fade={8}>
        <div style={{ position: 'absolute', left: 110, top: 190, width: 640 }}>
          <Panel style={{ padding: '34px 38px', opacity: usePop(2), transform: `translateY(${(1 - usePop(2)) * 30}px)` }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.12em', color: C.muted }}>RING DEVELOPER PLAYGROUND</div>
            {[
              ['Devices and live view', true],
              ['Event history', true],
              ['Webhooks', false],
            ].map(([label, ok], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 26, fontSize: 36, fontWeight: 700, padding: ok ? 0 : '12px 16px', margin: ok ? undefined : '22px -16px 0', borderRadius: 16, border: ok ? undefined : `2px solid ${cross > 0.5 ? C.bad : 'transparent'}`, background: ok ? undefined : `rgba(252,165,165,${0.14 * cross})` }}>
                <div style={{ width: 50, height: 50, borderRadius: 99, display: 'grid', placeItems: 'center', background: ok ? `${C.ok}26` : `${C.bad}26`, transform: ok ? undefined : `scale(${0.6 + 0.4 * cross})` }}>
                  <Icon name={ok ? 'check' : 'x'} size={30} color={ok ? C.ok : C.bad} stroke={3} />
                </div>
                {label}
              </div>
            ))}
          </Panel>
        </div>
        <div style={{ position: 'absolute', left: 770, top: 430, opacity: kit, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 120 * kit, height: 6, borderRadius: 9, background: ALERT.package.flash }} />
          <Icon name="play" size={30} color={ALERT.package.flash} style={{ fill: ALERT.package.flash }} />
        </div>
        <div style={{ position: 'absolute', left: 950, top: 120, width: 880, opacity: kit, transform: `translateX(${(1 - kit) * 120}px)` }}>
          <Panel accent={ALERT.package.flash} style={{ padding: '36px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontFamily: MONO, fontSize: 72, fontWeight: 700 }}>ring-kit</span>
              <Chip color={ALERT.package.flash} delay={w('open-source') - 2} size={26}>
                open source
              </Chip>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
              {features.map((f) => (
                <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 32, opacity: f.p, transform: `translateX(${(1 - f.p) * 40}px)` }}>
                  <Icon name={f.icon} size={40} color={ALERT.package.flash} />
                  {f.text}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 30, padding: '20px 24px', borderRadius: 16, background: '#07080a', fontFamily: MONO, fontSize: 21, lineHeight: 1.55, color: C.muted, opacity: features[2].p, whiteSpace: 'pre' }}>
              <span style={{ color: C.accent }}>await</span> sendSimulatedWebhook({'{'}
              {'\n'}  url, signingKey,
              {'\n'}  payload: buildWebhookPayload({'{'} type: <span style={{ color: AMBER }}>'button_press'</span>, deviceId {'}'}),
              {'\n'}{'}'})
            </div>
          </Panel>
        </div>
      </Show>

      <Show from={every - 4} to={tests - 10} fade={8}>
        <SamePath every={every} real={w('real')} />
      </Show>

      <Show from={tests - 6} to={duration + 10} fade={8}>
        <div style={{ position: 'absolute', left: 80, top: 110, width: 960 }}>
          <Terminal title="herald">
            <div style={{ color: C.ink }}>$ npm test</div>
            <div style={{ height: TEST_LINES.length * 31 + 6, fontSize: 19 }}>
              {TEST_LINES.slice(0, shownTests).map((l, i) => (
                <div key={i} style={{ height: 31, lineHeight: '31px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: l.kind === 'suite' ? C.ink : l.kind === 'more' ? C.line : C.muted, marginTop: l.kind === 'suite' && i > 0 ? 6 : 0 }}>
                  {l.kind === 'test' && <span style={{ color: C.ok }}>✔ </span>}
                  {l.kind === 'total' ? <span style={{ color: C.ok }}>{l.text}</span> : l.text}
                </div>
              ))}
            </div>
          </Terminal>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 26 }}>
            <Counter value={52} from={tests} to={tests + 32} style={{ fontSize: 120, fontWeight: 700, color: C.ok, lineHeight: 1 }} />
            <span style={{ fontSize: 48, fontWeight: 700 }}>tests passing</span>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 1090, top: 110, width: 760 }}>
          <Panel style={{ padding: '26px 30px', opacity: usePop(logged - 10), transform: `translateX(${(1 - usePop(logged - 10)) * 60}px)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Icon name="fileText" size={34} color={C.accent} />
              <span style={{ fontFamily: MONO, fontSize: 24, color: C.muted }}>FRICTION_LOG.md</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
              <Counter value={11} from={logged} to={logged + 26} style={{ fontSize: 76, fontWeight: 700, color: AMBER }} />
              <span style={{ fontSize: 34, fontWeight: 700 }}>friction points for the Ring team</span>
            </div>
            <div style={{ marginTop: 12 }}>
              {FRICTION.map(([t, sev], i) => {
                const p = usePop(logged - 2 + i * 3, { damping: 18 })
                return (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 14, height: 46, fontSize: 23, opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
                    <span style={{ width: 30, color: C.line, fontFamily: MONO }}>{i + 1}</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{t}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, padding: '3px 12px', borderRadius: 99, color: SEVERITY[sev], border: `1.5px solid ${SEVERITY[sev]}` }}>{sev}</span>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>
      </Show>
    </Backdrop>
  )
}

/** Two sources, one gate: real Ring deliveries and ring-kit test events take the same verification path. */
function SamePath({ every, real }: { every: number; real: number }) {
  const frame = useCurrentFrame()
  const flow = (delay: number) => interpolate(frame, [delay, delay + 20], [0, 1], { ...clamp, easing: EASE })
  const gate = usePop(real - 6, { damping: 12 })
  const dash = { strokeDasharray: '14 12', strokeDashoffset: -frame * 2 }
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <path d="M640 300 C 800 300, 800 470, 930 470" fill="none" stroke={ALERT.package.flash} strokeWidth={5} opacity={flow(every)} style={dash} />
        <path d="M640 640 C 800 640, 800 490, 930 490" fill="none" stroke={AMBER} strokeWidth={5} opacity={flow(every + 10)} style={dash} />
        <path d="M1330 480 L 1480 480" fill="none" stroke={C.accent} strokeWidth={5} opacity={flow(real)} style={dash} />
      </svg>
      <div style={{ position: 'absolute', left: 170, top: 225, width: 470, opacity: flow(every - 6) }}>
        <Panel accent={ALERT.package.flash} style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <Icon name="cloud" size={50} color={ALERT.package.flash} />
          <div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>Ring</div>
            <div style={{ fontSize: 24, color: C.muted }}>real deliveries</div>
          </div>
        </Panel>
      </div>
      <div style={{ position: 'absolute', left: 170, top: 565, width: 470, opacity: flow(every + 4) }}>
        <Panel accent={AMBER} style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <Icon name="zap" size={50} color={AMBER} />
          <div>
            <div style={{ fontSize: 34, fontWeight: 700, fontFamily: MONO }}>ring-kit</div>
            <div style={{ fontSize: 24, color: C.muted }}>signed test events</div>
          </div>
        </Panel>
      </div>
      <div style={{ position: 'absolute', left: 930, top: 360, width: 400, transform: `scale(${0.85 + 0.15 * gate})`, opacity: gate }}>
        <Panel accent={C.ok} style={{ padding: '28px 30px', textAlign: 'center', boxShadow: `0 0 80px -16px ${C.ok}` }}>
          <Icon name="shield" size={64} color={C.ok} />
          <div style={{ fontFamily: MONO, fontSize: 25, marginTop: 12 }}>verifyWebhookSignature</div>
          <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>the same check for both</div>
        </Panel>
      </div>
      <div style={{ position: 'absolute', left: 1480, top: 400, width: 300, opacity: flow(real + 6) }}>
        <Panel accent={C.accent} style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <Logo size={64} />
          <div style={{ fontSize: 36, fontWeight: 700 }}>Herald</div>
        </Panel>
      </div>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------ outro

export function Outro() {
  const frame = useCurrentFrame()
  const { duration } = scene('outro')
  const nameAt = wordAt('outro', 'outro', 'herald') - 6
  const logo = usePop(4, { damping: 12, stiffness: 120 })
  const name = usePop(nameAt, { damping: 15 })
  const fadeOut = interpolate(frame, [duration - 26, duration - 2], [1, 0], clamp)
  const lineEnd = wordEnd('outro', 'outro', 'door.')
  const breathe = 1 + 0.025 * Math.sin(frame / 14)
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Backdrop hue={AMBER} hue2={C.accentDeep}>
        {[0, 1, 2, 3].map((i) => {
          const p = ((frame + i * 22) % 88) / 88
          const d = 260 + p * 900
          return <div key={i} style={{ position: 'absolute', left: 960 - d / 2, top: 300 - d / 2, width: d, height: d, borderRadius: '50%', border: `3px solid ${SENSE[i]}`, opacity: 0.4 * (1 - p) * logo }} />
        })}
        <div style={{ position: 'absolute', left: 870, top: 210, transform: `scale(${(0.4 + 0.6 * logo) * breathe})`, opacity: logo }}>
          <Logo size={180} glow={0.8} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 420, textAlign: 'center', fontSize: 150, fontWeight: 700, letterSpacing: '-0.02em', opacity: name, transform: `translateY(${(1 - name) * 40}px)` }}>Herald</div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 650 }}>
          <Spoken sceneId="outro" lineId="outro" first={1} size={60} accent={['everyone']} accentColor={AMBER} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 790, display: 'flex', justifyContent: 'center', gap: 18 }}>
          {(['Flash', 'Voice', 'Vibration', 'Braille'] as const).map((t, i) => (
            <Chip key={t} color={SENSE[i]} delay={lineEnd + 4 + i * 5} size={28}>
              {t}
            </Chip>
          ))}
        </div>
      </Backdrop>
    </AbsoluteFill>
  )
}
