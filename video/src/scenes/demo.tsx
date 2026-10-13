import type { ReactNode } from 'react'
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion'
import { Backdrop, Braille, BrowserFrame, Buzz, buzzing, Camera, Chip, clamp, Clip, EASE_IN_OUT, Icon, type IconName, inside, KIND_ICON, Laptop, Panel, Phone, Ripples, Sfx, Show, TV, usePop, Waveform } from '../components'
import { level, part, scene, wordAt, wordEnd } from '../data'
import { ALERT, C, type Kind, MONO } from '../theme'

const AMBER = ALERT.doorbell.flash

/** Converts clip pixels (1920 wide) to the pixels of a frame `width` wide. */
const scaleKeys = (keys: { f: number; x: number; y: number; s: number }[], width: number) => keys.map((k) => ({ ...k, x: (k.x * width) / 1920, y: (k.y * width) / 1920 }))

// ------------------------------------------------------------------------------------ setup

const PROFILES: { icon: IconName; name: string; outputs: string; color: string }[] = [
  { icon: 'earOff', name: 'Deaf or hard of hearing', outputs: 'Flash, vibration, captions', color: AMBER },
  { icon: 'eyeOff', name: 'Blind or low vision', outputs: 'Voice, screen reader', color: ALERT.person.flash },
  { icon: 'hand', name: 'Deafblind', outputs: 'Vibration rhythm, braille', color: ALERT.vehicle.flash },
  { icon: 'sliders', name: 'Custom mix', outputs: 'Pick each output', color: ALERT.package.flash },
]

export function Setup() {
  const frame = useCurrentFrame()
  const fw = 1360
  const fh = 765
  const t0 = 0.35 // clip second at scene frame 0, so each choice lands on its narrated word
  const at = (clipSeconds: number) => Math.round((clipSeconds - t0) * 30)
  const picks = [at(4.367), at(5.667), at(7.333), wordAt('setup', 'setup', 'custom') - 4]
  const start = at(9.4) - 3
  const keys = scaleKeys(
    [
      { f: 0, x: 960, y: 540, s: 1 },
      { f: picks[0] - 26, x: 960, y: 540, s: 1 },
      { f: picks[0] - 8, x: 700, y: 420, s: 1.55 },
      { f: picks[1] - 24, x: 700, y: 420, s: 1.55 },
      { f: picks[1] - 8, x: 1220, y: 420, s: 1.55 },
      { f: picks[2] - 24, x: 1220, y: 420, s: 1.55 },
      { f: picks[2] - 8, x: 700, y: 530, s: 1.55 },
      { f: picks[3] - 16, x: 700, y: 530, s: 1.55 },
      { f: picks[3], x: 1220, y: 530, s: 1.55 },
      { f: start - 22, x: 1220, y: 530, s: 1.55 },
      { f: start - 8, x: 640, y: 640, s: 1.45 },
      { f: start + 6, x: 640, y: 640, s: 1.45 },
      { f: start + 26, x: 960, y: 540, s: 1 },
    ],
    fw,
  )
  const enter = usePop(0, { damping: 20, stiffness: 90 })
  return (
    <Backdrop>
      <div style={{ position: 'absolute', left: 60, top: 70, perspective: 2400 }}>
        <div style={{ transform: `rotateY(${(1 - enter) * -14}deg) translateX(${(1 - enter) * -80}px)`, transformOrigin: '0 50%' }}>
          <BrowserFrame width={fw} height={fh}>
            <Camera keys={keys} width={fw} height={fh}>
              <div style={{ width: fw, height: fh }}>
                <Clip id="setup-desk" time={(f) => t0 + f / 30} />
              </div>
            </Camera>
          </BrowserFrame>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1460, top: 70, width: 400, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {PROFILES.map((p, i) => {
          const lit = inside(frame, picks[i], (picks[i + 1] ?? start) - 2, 6)
          const seen = frame >= picks[i]
          const pop = usePop(8 + i * 5)
          return (
            <Panel key={p.name} accent={lit > 0.5 ? p.color : undefined} style={{ height: 177, padding: '24px 26px', opacity: pop * (0.5 + 0.5 * Math.max(lit, seen ? 0.6 : 0)), transform: `translateX(${(1 - pop) * 60}px) scale(${1 + 0.04 * lit})`, boxShadow: lit > 0 ? `0 0 ${60 * lit}px -10px ${p.color}` : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 62, height: 62, borderRadius: 18, background: `${p.color}26`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name={p.icon} size={38} color={p.color} />
                </div>
                <div style={{ fontSize: 31, fontWeight: 700, lineHeight: 1.15 }}>{p.name}</div>
              </div>
              <div style={{ marginTop: 16, fontSize: 26, color: C.muted }}>{p.outputs}</div>
            </Panel>
          )
        })}
      </div>
      {[picks[0], picks[1], picks[2], start].map((f, i) => (
        <Sfx key={i} id="click" at={f - 1} volume={0.7} />
      ))}
    </Backdrop>
  )
}

// ------------------------------------------------------------------------------------ wall

function DeviceLabel({ icon, device, who, color, delay }: { icon: IconName; device: string; who: string; color: string; delay: number }) {
  const p = usePop(delay)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '10px 22px 10px 14px', borderRadius: 99, background: `${C.surface}ee`, border: `2px solid ${color}88`, opacity: p, transform: `translateY(${(1 - p) * 20}px)`, whiteSpace: 'nowrap' }}>
      <Icon name={icon} size={30} color={color} />
      <span style={{ fontSize: 28, fontWeight: 700 }}>{device}</span>
      <span style={{ fontSize: 26, color: C.muted }}>{who}</span>
    </div>
  )
}

export function Wall() {
  const frame = useCurrentFrame()
  const { duration } = scene('wall')
  const ring = part('wall', 'chime').at
  const response = ring + 9 // Herald answers a moment after the press
  const voice = part('wall', 'cold-alert')
  const tvAt = wordAt('wall', 'wall', 'tv')
  const laptopAt = wordAt('wall', 'wall', 'laptop')
  const phoneAt = wordAt('wall', 'wall', 'phone')
  const longAt = wordAt('wall', 'wall', 'long')
  const brailleAt = wordAt('wall', 'wall', 'braille')
  const end = duration - 24
  const pattern = ALERT.doorbell.vibration

  const spot = { tv: inside(frame, tvAt - 4, laptopAt - 6, 8), laptop: inside(frame, laptopAt - 4, phoneAt - 6, 8), phone: inside(frame, phoneAt - 4, end, 8) }
  const any = Math.max(spot.tv, spot.laptop, spot.phone)
  const dim = (w: number) => 1 - 0.62 * (any - w)
  const lift = (w: number) => `scale(${1 + 0.035 * w})`
  const speaking = inside(frame, voice.at - 2, voice.at + voice.len + 4, 6)
  const brailleLit = inside(frame, brailleAt - 4, end, 8)
  const tvTime = (f: number) => 3.133 + (f - response) / 30
  const deskTime = (f: number) => 3.0 + (f - response) / 30

  return (
    <Backdrop hue={AMBER} hue2={C.accentDeep}>
      <div style={{ position: 'absolute', left: 60, top: 128, opacity: dim(spot.tv), transform: lift(spot.tv), transformOrigin: '50% 60%' }}>
        <TV width={820} glow={frame >= response ? `${AMBER}66` : undefined}>
          <Clip id="wall-tv" time={tvTime} />
        </TV>
      </div>

      <div style={{ position: 'absolute', left: 962, top: 272, opacity: dim(spot.laptop), transform: lift(spot.laptop), transformOrigin: '50% 70%' }}>
        <Laptop width={540} ratio={1200 / 1920} glow={speaking > 0 ? `${C.accent}${Math.round(speaking * 99).toString().padStart(2, '0')}` : undefined}>
          <Clip id="wall-laptop" time={deskTime} />
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 18, opacity: speaking }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderRadius: 16, background: 'rgba(9,10,13,0.92)', border: `2px solid ${C.accent}` }}>
              <Icon name="volume" size={30} color={C.accent} />
              <Waveform level={(ago) => level('cold-alert', (frame - voice.at) / 30 - ago)} bars={30} width={330} height={48} color={C.accent} />
            </div>
          </AbsoluteFill>
        </Laptop>
      </div>

      <div style={{ position: 'absolute', left: 1606, top: 76, opacity: dim(spot.phone), transform: lift(spot.phone), transformOrigin: '50% 50%' }}>
        <div style={{ position: 'absolute', left: 141, top: 291 }}>
          <Ripples pattern={pattern} at={response} color={AMBER} size={420} />
          <Ripples pattern={pattern} at={longAt} color={AMBER} size={420} />
        </div>
        <Buzz pattern={pattern} at={buzzing(pattern, frame - longAt) ? longAt : response} amount={7}>
          <Phone height={560}>
            <Clip id="wall-phone" time={deskTime} style={{ objectPosition: '50% 0%' }} />
          </Phone>
        </Buzz>
      </div>

      <div style={{ position: 'absolute', left: 0, top: 692, width: 964, display: 'flex', justifyContent: 'center', opacity: dim(spot.tv) }}>
        <DeviceLabel icon="earOff" device="TV" who="Deaf" color={AMBER} delay={10} />
      </div>
      <div style={{ position: 'absolute', left: 900, top: 692, width: 690, display: 'flex', justifyContent: 'center', opacity: dim(spot.laptop) }}>
        <DeviceLabel icon="eyeOff" device="Laptop" who="Blind" color={C.accent} delay={14} />
      </div>
      <div style={{ position: 'absolute', left: 1560, top: 692, width: 380, display: 'flex', justifyContent: 'center', opacity: dim(spot.phone) }}>
        <DeviceLabel icon="hand" device="Phone" who="Deafblind" color={ALERT.vehicle.flash} delay={18} />
      </div>

      <Show from={response + 26} to={duration + 10} fade={10}>
        <div style={{ position: 'absolute', left: 930, top: 790, width: 960, opacity: dim(Math.max(spot.phone, brailleLit)), transform: `scale(${1 + 0.04 * brailleLit})`, transformOrigin: '50% 50%' }}>
          <Panel accent={brailleLit > 0.3 ? ALERT.vehicle.flash : undefined} style={{ padding: '16px 24px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, boxShadow: brailleLit > 0 ? `0 0 ${70 * brailleLit}px -12px ${ALERT.vehicle.flash}` : undefined }}>
            <Braille text="Doorbell. Someone is at the front door." at={response + 30} cell={20} gap={8} stagger={1} />
            <div style={{ fontSize: 22, color: C.muted, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: C.ink, letterSpacing: '0.08em' }}>BRAILLE DISPLAY</span>
              Doorbell. Someone is at the front door.
            </div>
          </Panel>
        </div>
      </Show>

      <Sfx id="buzz-doorbell" at={response} volume={0.55} />
      <Sfx id="buzz-doorbell" at={longAt} volume={0.32} />
    </Backdrop>
  )
}

// ------------------------------------------------------------------------------------ rhythm

const ROWS: Kind[] = ['doorbell', 'person', 'package', 'vehicle', 'motion', 'camera_offline', 'camera_online']
const PX_PER_MS = 0.26

export function Rhythm() {
  const frame = useCurrentFrame()
  const colour = wordAt('rhythm', 'rhythm', 'colour')
  const rhythm = wordAt('rhythm', 'rhythm', 'rhythm')
  const personAt = wordAt('rhythm', 'rhythm', 'person')
  const personPlay = wordAt('rhythm', 'rhythm', 'short')
  const packageAt = wordAt('rhythm', 'rhythm', 'package')
  const packagePlay = wordAt('rhythm', 'rhythm', 'short', 2)
  const end = wordEnd('rhythm', 'rhythm', 'long.') + 8
  const focus: Partial<Record<Kind, { lit: number; play: number }>> = {
    person: { lit: inside(frame, personAt - 4, packageAt - 6, 7), play: personPlay },
    package: { lit: inside(frame, packageAt - 4, end, 7), play: packagePlay },
  }
  const any = Math.max(focus.person!.lit, focus.package!.lit)
  return (
    <Backdrop hue={ALERT.person.flash} hue2={ALERT.package.flash}>
      <div style={{ position: 'absolute', left: 230, top: 64, width: 1460 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr 260px', padding: '0 34px 16px', fontSize: 24, fontWeight: 700, letterSpacing: '0.12em', color: C.muted, opacity: usePop(4) }}>
          <span>EVENT AND COLOUR</span>
          <span>VIBRATION</span>
          <span>RHYTHM</span>
        </div>
        {ROWS.map((kind, i) => {
          const s = ALERT[kind]
          const pop = usePop(14 + i * 5, { damping: 17 })
          const fill = interpolate(frame, [colour + i * 2, colour + i * 2 + 10], [0, 1], clamp)
          const draw = interpolate(frame, [rhythm + i * 2, rhythm + i * 2 + 16], [0, 1], { ...clamp, easing: EASE_IN_OUT })
          const f = focus[kind]
          const lit = f?.lit ?? 0
          const t = f ? frame - f.play : -1
          const head = t >= 0 ? (t / 30) * 1000 * PX_PER_MS : -1
          let x = 0
          return (
            <div key={kind} style={{ height: 106, marginBottom: 6, display: 'grid', gridTemplateColumns: '460px 1fr 260px', alignItems: 'center', padding: '0 34px', borderRadius: 22, background: lit > 0 ? `${s.flash}${Math.round(lit * 30).toString(16).padStart(2, '0')}` : `${C.surface}cc`, border: `2px solid ${lit > 0.4 ? s.flash : C.lineSoft}`, opacity: pop * (1 - 0.55 * (any - lit)), transform: `translateY(${(1 - pop) * 30}px) scale(${1 + 0.025 * lit})` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <Buzz pattern={s.vibration} at={f ? f.play : -999} amount={5}>
                  <div style={{ width: 70, height: 70, borderRadius: 20, display: 'grid', placeItems: 'center', background: fill > 0 ? s.flash : C.surface2, border: `2px solid ${s.flash}`, transform: `scale(${0.9 + 0.1 * fill})` }}>
                    <Icon name={KIND_ICON[kind]} size={40} color={fill > 0.5 ? s.ink : s.flash} />
                  </div>
                </Buzz>
                <span style={{ fontSize: 38, fontWeight: 700 }}>{s.label}</span>
              </div>
              <div style={{ position: 'relative', height: 30 }}>
                {s.vibration.map((ms, k) => {
                  const left = x
                  x += ms * PX_PER_MS
                  if (k % 2) return null
                  const w = ms * PX_PER_MS
                  const on = head >= left && head < left + w
                  return <div key={k} style={{ position: 'absolute', left, top: on ? -4 : 3, width: w * draw, height: on ? 32 : 24, borderRadius: 99, background: s.flash, opacity: draw > 0 ? 0.55 + 0.45 * (on ? 1 : lit) : 0, boxShadow: on ? `0 0 26px ${s.flash}` : undefined }} />
                })}
                {head >= 0 && head <= x + 10 && <div style={{ position: 'absolute', left: head, top: -14, width: 3, height: 58, borderRadius: 3, background: C.ink }} />}
              </div>
              <span style={{ fontSize: 32, color: lit > 0.5 ? C.ink : C.muted, fontWeight: lit > 0.5 ? 700 : 400 }}>{s.rhythm}</span>
            </div>
          )
        })}
      </div>
      <Sfx id="buzz-person" at={personPlay} volume={0.5} />
      <Sfx id="buzz-package" at={packagePlay} volume={0.5} />
    </Backdrop>
  )
}

// ------------------------------------------------------------------------------------ priority

const TIERS: { name: string; rule: string; kinds: Kind[]; color: string }[] = [
  { name: 'Urgent', rule: 'Always interrupts', kinds: ['doorbell', 'camera_offline'], color: AMBER },
  { name: 'Normal', rule: 'Interrupts by default', kinds: ['person', 'package'], color: ALERT.person.flash },
  { name: 'Info', rule: 'Goes to History', kinds: ['vehicle', 'motion'], color: ALERT.vehicle.flash },
]

export function Priority() {
  const frame = useCurrentFrame()
  const fw = 1240
  const fh = 698
  const t0 = 0.24 // the car arrives on "car", the package on "package"
  const vehicle = Math.round((3.367 - t0) * 30)
  const flash = Math.round((6.1 - t0) * 30)
  const keys = scaleKeys(
    [
      { f: 0, x: 960, y: 540, s: 1 },
      { f: vehicle - 22, x: 960, y: 540, s: 1 },
      { f: vehicle - 6, x: 1300, y: 330, s: 1.55 },
      { f: flash - 28, x: 1300, y: 330, s: 1.55 },
      { f: flash - 8, x: 960, y: 540, s: 1 },
    ],
    fw,
  )
  const lit: Partial<Record<Kind, number>> = { vehicle: inside(frame, vehicle, flash - 10, 6), package: inside(frame, flash, 400, 6) }
  return (
    <Backdrop hue={ALERT.vehicle.flash} hue2={ALERT.package.flash}>
      <div style={{ position: 'absolute', left: 60, top: 110 }}>
        <BrowserFrame width={fw} height={fh}>
          <Camera keys={keys} width={fw} height={fh}>
            <div style={{ width: fw, height: fh }}>
              <Clip id="priority-desk" time={(f) => t0 + f / 30} />
            </div>
          </Camera>
        </BrowserFrame>
      </div>
      <div style={{ position: 'absolute', left: 1350, top: 110, width: 510 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.12em', color: C.muted, marginBottom: 18, opacity: usePop(6) }}>WHAT INTERRUPTS</div>
        {TIERS.map((tier, i) => {
          const pop = usePop(wordAt('priority', 'priority', 'only') + i * 6, { damping: 16 })
          return (
            <Panel key={tier.name} accent={tier.color} style={{ padding: '22px 26px', marginBottom: 18, opacity: pop, transform: `translateX(${(1 - pop) * 60}px)` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 34, fontWeight: 700, color: tier.color }}>{tier.name}</span>
                <span style={{ fontSize: 25, color: C.muted }}>{tier.rule}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                {tier.kinds.map((k) => {
                  const on = lit[k] ?? 0
                  return (
                    <div key={k} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: on > 0 ? ALERT[k].flash : C.surface2, color: on > 0.5 ? ALERT[k].ink : C.ink, transform: `scale(${1 + 0.06 * on})`, boxShadow: on > 0 ? `0 0 ${50 * on}px ${ALERT[k].flash}` : undefined }}>
                      <Icon name={KIND_ICON[k]} size={32} color={on > 0.5 ? ALERT[k].ink : ALERT[k].flash} />
                      <span style={{ fontSize: 26, fontWeight: 700 }}>{ALERT[k].label}</span>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )
        })}
        <Show from={vehicle} to={flash - 10} fade={6} style={{ position: 'relative', inset: 'auto' }}>
          <Chip color={ALERT.vehicle.flash} delay={vehicle} size={28}>
            Car: into History, no flash
          </Chip>
        </Show>
        <Show from={flash} to={400} fade={6} style={{ position: 'relative', inset: 'auto', marginTop: -58 }}>
          <Chip color={ALERT.package.flash} delay={flash} size={28}>
            Package: full-screen green flash
          </Chip>
        </Show>
      </div>
      <Sfx id="click" at={Math.round((2.74 - t0) * 30)} volume={0.6} />
      <Sfx id="click" at={Math.round((5.721 - t0) * 30)} volume={0.6} />
    </Backdrop>
  )
}

// ------------------------------------------------------------------------------------ live

function Node({ icon, title, sub, color, delay, children }: { icon: IconName; title: string; sub: string; color: string; delay: number; children?: ReactNode }) {
  const p = usePop(delay, { damping: 16 })
  return (
    <Panel accent={color} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
      <div style={{ width: 70, height: 70, borderRadius: 20, background: `${color}24`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={42} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 23, color: C.muted, marginTop: 2 }}>{sub}</div>
      </div>
      {children}
    </Panel>
  )
}

/** A vertical connector with dashes flowing up or down. */
function Flow({ label, up, delay, color = C.accent }: { label: string; up: boolean; delay: number; color?: string }) {
  const frame = useCurrentFrame()
  const p = usePop(delay)
  return (
    <div style={{ height: 82, display: 'flex', alignItems: 'center', gap: 18, paddingLeft: 52, opacity: p }}>
      <div style={{ width: 4, height: 82, backgroundImage: `linear-gradient(${color} 50%, transparent 50%)`, backgroundSize: '4px 16px', backgroundPosition: `0 ${(up ? -1 : 1) * frame * 1.4}px` }} />
      <Icon name="play" size={18} color={color} style={{ transform: `rotate(${up ? -90 : 90}deg)`, fill: color }} />
      <span style={{ fontSize: 24, fontFamily: MONO, color: C.muted }}>{label}</span>
    </div>
  )
}

export function Live() {
  const frame = useCurrentFrame()
  const t0 = 0.17 // the button is pressed on "who's there"
  const click = Math.round((1.669 - t0) * 30)
  // The WebRTC handshake took 3.3 s in the recording (the picture appears at 4.933 s); it plays
  // at 1.8x so the picture arrives on "streams", then the footage runs at real speed.
  const live = wordAt('live', 'live', 'streams')
  const shown = 4.95
  const uiTime = (f: number) => (f <= click ? t0 + f / 30 : f <= live ? 1.669 + ((f - click) / (live - click)) * (shown - 1.669) : shown + (f - live) / 30)
  const swap = live + 12
  const tokenAt = wordAt('live', 'live', 'and')
  const ui = interpolate(frame, [swap, swap + 16], [1, 0], clamp)
  const player = interpolate(frame, [swap, swap + 18], [0, 1], { ...clamp, easing: EASE_IN_OUT })
  const side = interpolate(frame, [tokenAt - 12, tokenAt + 8], [0, 1], { ...clamp, easing: EASE_IN_OUT })
  // the stream recording has black bars at the sides (picture at x 26 to 1250 of 1280): the
  // player is cropped to the picture
  const pw = interpolate(side, [0, 1], [1440, 1110])
  const cw = (pw * 1224) / 1280
  const left = interpolate(side, [0, 1], [(1920 - (1440 * 1224) / 1280) / 2, 60])
  const top = interpolate(side, [0, 1], [70, 170])
  const keys = scaleKeys([{ f: 0, x: 640, y: 380, s: 1.45 }], 1400)
  const blocked = usePop(wordAt('live', 'live', 'never'), { damping: 12 })
  return (
    <Backdrop hue={ALERT.package.flash} hue2={C.accentDeep}>
      {ui > 0 && (
        <div style={{ position: 'absolute', left: 260, top: 80, opacity: ui, transform: `scale(${1 + 0.08 * (1 - ui)})` }}>
          <BrowserFrame width={1400} height={788}>
            <Camera keys={keys} width={1400} height={788}>
              <div style={{ width: 1400, height: 788 }}>
                <Clip id="live-ui" time={uiTime} />
              </div>
            </Camera>
          </BrowserFrame>
        </div>
      )}
      {player > 0 && (
        <div style={{ position: 'absolute', left, top, width: cw, height: (pw * 9) / 16, borderRadius: 22, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.18)', boxShadow: '0 60px 140px -40px #000', opacity: player, transform: `scale(${0.9 + 0.1 * player})` }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: (-pw * 26) / 1280, width: pw }}>
            <Clip id="live-stream" time={(f) => uiTime(f) - 4.884} />
          </div>
          <div style={{ position: 'absolute', left: 22, top: 20, display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderRadius: 12, background: 'rgba(0,0,0,0.72)', fontSize: 26, fontWeight: 700 }}>
              <span style={{ width: 14, height: 14, borderRadius: 99, background: '#ef4444', opacity: 0.55 + 0.45 * Math.abs(Math.sin(frame / 9)) }} />
              LIVE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 18px', borderRadius: 12, background: 'rgba(0,0,0,0.72)', fontSize: 24 }}>Playground camera, over WebRTC</div>
          </div>
        </div>
      )}
      <Show from={tokenAt - 6} to={400} fade={10}>
        <div style={{ position: 'absolute', left: 1230, top: 230, width: 630 }}>
          <Node icon="cloud" title="Ring" sub="WHEP live stream" color={ALERT.package.flash} delay={tokenAt - 4} />
          <Flow label="offer + token" up delay={tokenAt + 4} color={ALERT.package.flash} />
          <Node icon="server" title="Herald's server" sub="adds the token, relays the offer" color={AMBER} delay={tokenAt + 2}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, background: `${AMBER}26`, border: `2px solid ${AMBER}`, fontSize: 22, fontWeight: 700, boxShadow: `0 0 ${30 * blocked}px ${AMBER}` }}>
              <Icon name="lock" size={22} color={AMBER} />
              token
            </div>
          </Node>
          <Flow label="SDP offer" up delay={tokenAt + 10} />
          <Node icon="globe" title="Your browser" sub="never sees the token" color={C.accent} delay={tokenAt + 8}>
            <div style={{ width: 46, height: 46, borderRadius: 99, background: `${C.bad}22`, border: `2px solid ${C.bad}`, display: 'grid', placeItems: 'center', transform: `scale(${blocked})` }}>
              <Icon name="x" size={26} color={C.bad} stroke={3} />
            </div>
          </Node>
        </div>
      </Show>
      <Sfx id="click" at={click} volume={0.7} />
      <Sfx id="whoosh" at={swap - 4} volume={0.3} />
    </Backdrop>
  )
}
