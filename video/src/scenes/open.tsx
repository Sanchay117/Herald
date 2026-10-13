import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion'
import { Backdrop, Braille, Buzz, Chip, clamp, Clip, Counter, EASE_IN_OUT, Icon, type IconName, Logo, Panel, Phone, Ripples, Sfx, Show, Spoken, usePop, Waveform } from '../components'
import { level, part, scene, wordAt, wordEnd } from '../data'
import { ALERT, C } from '../theme'

const AMBER = ALERT.doorbell.flash
const SENSE = [ALERT.doorbell.flash, ALERT.person.flash, ALERT.package.flash, ALERT.vehicle.flash]

/** Rings that burst out of a point, one per colour. */
function Burst({ at, colours, x, y, size = 1200 }: { at: number; colours: string[]; x: number; y: number; size?: number }) {
  const frame = useCurrentFrame()
  return (
    <>
      {colours.map((c, i) => {
        const t = frame - at - i * 4
        if (t < 0) return null
        const p = interpolate(t, [0, 48], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
        if (p >= 1) return null
        const d = 160 + p * size
        return <div key={i} style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%', border: `${8 - 6 * p}px solid ${c}`, opacity: 0.9 * (1 - p), boxShadow: `0 0 ${30 * (1 - p)}px ${c}` }} />
      })}
    </>
  )
}

// ------------------------------------------------------------------------------------ cold open

/** The chime, for anyone who can't hear it: a bell that swings and sends out sound waves. */
function Chime({ notes }: { notes: number[] }) {
  const frame = useCurrentFrame()
  const swing = notes.reduce((a, n) => a + (frame >= n ? Math.sin((frame - n) * 0.75) * 15 * Math.exp(-(frame - n) / 10) : 0), 0)
  const appear = interpolate(frame, [notes[0] - 12, notes[0] - 2], [0, 1], clamp)
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {notes.flatMap((n, i) =>
        [0, 8, 16].map((lag) => {
          const t = frame - n - lag
          if (t < 0) return null
          const p = interpolate(t, [0, 46], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) })
          if (p >= 1) return null
          const d = 220 + p * 900
          return <div key={`${i}-${lag}`} style={{ position: 'absolute', width: d, height: d, borderRadius: '50%', border: `${3 - 2 * p}px solid ${C.ink}`, opacity: 0.55 * (1 - p) * (lag ? 0.6 : 1) }} />
        }),
      )}
      <div style={{ opacity: appear, transform: `rotate(${swing}deg)`, transformOrigin: '50% 12%' }}>
        <Icon name="bell" size={170} color={C.ink} stroke={1.5} />
      </div>
    </AbsoluteFill>
  )
}

export function Cold() {
  const frame = useCurrentFrame()
  const { duration } = scene('cold')
  const chime = part('cold', 'chime').at
  const deaf = part('cold', 'cold-deaf')
  const flash = deaf.at + deaf.len + 1 // the answer comes the moment the line ends
  const blind = part('cold', 'cold-blind')
  const voice = part('cold', 'cold-alert')
  const db = part('cold', 'cold-deafblind')
  const buzz = part('cold', 'buzz-doorbell').at
  const pattern = ALERT.doorbell.vibration

  // the blind and Deafblind lines move up when their answer arrives
  const blindUp = interpolate(frame, [voice.at - 10, voice.at + 6], [0, 1], { ...clamp, easing: EASE_IN_OUT })
  // (the line is out of the phone's way before the phone fades in)
  const dbUp = interpolate(frame, [buzz - 26, buzz - 9], [0, 1], { ...clamp, easing: EASE_IN_OUT })
  const zoom = interpolate(frame, [flash, blind.at], [1.0, 1.06], clamp)

  return (
    <AbsoluteFill style={{ background: '#000', color: C.ink }}>
      <Show from={0} to={deaf.at - 8} fade={6}>
        <Chime notes={[chime, chime + 19]} />
      </Show>

      <Show from={deaf.at - 3} to={flash} fade={0}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 200px' }}>
          <Spoken sceneId="cold" lineId="cold-deaf" size={100} accent={['deaf']} accentColor={AMBER} />
        </AbsoluteFill>
      </Show>

      {/* The Deaf answer: Herald's flash on a TV, filmed in the app, in silence. */}
      <Show from={flash} to={blind.at - 3} fade={0}>
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <Clip id="wall-tv" time={(f) => 3.133 + (f - flash) / 30} />
        </AbsoluteFill>
      </Show>

      <Show from={blind.at - 3} to={db.at - 6} fade={5}>
        <AbsoluteFill>
          <div style={{ position: 'absolute', left: 160, right: 160, top: 470 - blindUp * 300, transform: `scale(${1 - 0.32 * blindUp})` }}>
            <Spoken sceneId="cold" lineId="cold-blind" size={100} accent={['blind']} accentColor={C.accent} />
          </div>
          <Show from={voice.at - 4} to={db.at} fade={8}>
            <AbsoluteFill style={{ alignItems: 'center', top: 440 }}>
              <Chip color={C.accent} delay={voice.at - 6} size={30}>
                Herald speaking
              </Chip>
              <div style={{ marginTop: 28 }}>
                <Waveform level={(ago) => level('cold-alert', (frame - voice.at) / 30 - ago)} bars={56} width={1000} height={170} color={C.accent} />
              </div>
              <Spoken sceneId="cold" lineId="cold-alert" size={62} style={{ marginTop: 26 }} />
            </AbsoluteFill>
          </Show>
        </AbsoluteFill>
      </Show>

      <Show from={db.at - 3} to={duration + 10} fade={5}>
        <AbsoluteFill>
          <div style={{ position: 'absolute', left: 160, right: 160, top: 470 - dbUp * 330, transform: `scale(${1 - 0.32 * dbUp})` }}>
            <Spoken sceneId="cold" lineId="cold-deafblind" size={100} accent={['deafblind']} accentColor={ALERT.vehicle.flash} />
          </div>
          <Show from={buzz - 2} to={duration + 10} fade={8}>
            <div style={{ position: 'absolute', left: 470, top: 330 }}>
              <div style={{ position: 'absolute', left: 135, top: 255 }}>
                <Ripples pattern={pattern} at={buzz} color={AMBER} size={560} />
              </div>
              <Buzz pattern={pattern} at={buzz} amount={9}>
                <Phone height={500}>
                  <Clip id="wall-phone" time={(f) => (f < buzz ? 2.9 : 3.0 + (f - buzz) / 30)} style={{ objectPosition: '50% 0%' }} />
                </Phone>
              </Buzz>
            </div>
            <div style={{ position: 'absolute', left: 920, top: 470 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.muted, marginBottom: 26, letterSpacing: '0.06em' }}>ON A BRAILLE DISPLAY</div>
              <Braille text="Doorbell" at={buzz + 8} cell={74} stagger={3} labels />
              <div style={{ display: 'flex', gap: 14, marginTop: 34, alignItems: 'center' }}>
                <Icon name="vibrate" size={40} color={AMBER} />
                {pattern.map((ms, k) =>
                  k % 2 === 0 ? <div key={k} style={{ width: ms / 4, height: 16, borderRadius: 99, background: frame >= buzz + (k === 0 ? 0 : 24) ? AMBER : 'rgba(255,255,255,0.15)' }} /> : <div key={k} style={{ width: ms / 6 }} />,
                )}
                <span style={{ fontSize: 30, fontWeight: 700, marginLeft: 8 }}>long, long</span>
              </div>
            </div>
          </Show>
        </AbsoluteFill>
      </Show>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------ title

export function Title() {
  const frame = useCurrentFrame()
  const logo = usePop(0, { damping: 9, stiffness: 120, mass: 0.7 })
  const rock = Math.sin(frame * 0.6) * Math.exp(-frame / 16)
  const nameAt = wordAt('title', 'title', 'herald') - 5
  const name = usePop(nameAt, { damping: 15, stiffness: 150 })
  return (
    <Backdrop hue={AMBER} hue2={C.accentDeep}>
      <Burst at={0} colours={SENSE} x={960} y={330} size={1500} />
      <div style={{ position: 'absolute', left: 860, top: 230, transform: `scale(${0.3 + 0.7 * logo})`, opacity: Math.min(1, logo * 2) }}>
        <Logo size={200} glow={1} ring={rock} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', fontSize: 180, fontWeight: 700, letterSpacing: '-0.02em', opacity: name, transform: `translateY(${(1 - name) * 50}px)`, filter: `blur(${(1 - name) * 12}px)` }}>Herald</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 700 }}>
        <Spoken sceneId="title" lineId="title" first={3} size={64} color={C.muted} accent={['every', 'sense']} accentColor={C.ink} />
      </div>
    </Backdrop>
  )
}

// ------------------------------------------------------------------------------------ why

function Stat({ icon, color, value, unit, label, source, at, count }: { icon: IconName; color: string; value: number; unit: string; label: string; source: string; at: number; count: number }) {
  const p = usePop(at, { damping: 16 })
  return (
    <Panel accent={color} style={{ width: 720, padding: '40px 50px 44px', opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 70}px) scale(${0.9 + 0.1 * p})` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 100, height: 100, borderRadius: 26, background: `${color}22`, display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={62} color={color} />
        </div>
        <div style={{ fontSize: 28, color: C.muted }}>{source}</div>
      </div>
      <div style={{ marginTop: 22, display: 'flex', alignItems: 'baseline', gap: 20 }}>
        <Counter value={value} from={count} to={count + 40} style={{ fontSize: 200, fontWeight: 700, color, lineHeight: 1 }} />
        <span style={{ fontSize: 76, fontWeight: 700 }}>{unit}</span>
      </div>
      <div style={{ marginTop: 16, fontSize: 42, lineHeight: 1.25 }}>{label}</div>
    </Panel>
  )
}

/** A device and the sense it was designed for, joined by a travelling wave. */
function MadeFor({ device, sense, senseOff, label, at, off, color }: { device: IconName; sense: IconName; senseOff: IconName; label: string; at: number; off: number; color: string }) {
  const frame = useCurrentFrame()
  const p = usePop(at, { damping: 15 })
  const crossed = frame >= off
  const hit = interpolate(frame - off, [0, 4, 20], [0, 1, 0], clamp)
  const tile = (name: IconName, c: string, glow = 0) => (
    <div style={{ width: 150, height: 150, borderRadius: 36, background: C.surface, border: `2px solid ${c}`, display: 'grid', placeItems: 'center', boxShadow: `0 0 ${50 * glow}px ${c}` }}>
      <Icon name={name} size={80} color={c} />
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        {tile(device, C.ink)}
        <div style={{ display: 'flex', gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: 99, background: color, opacity: 0.25 + 0.75 * Math.max(0, Math.sin((frame - at) * 0.25 - i * 0.9)) }} />
          ))}
        </div>
        {tile(crossed ? senseOff : sense, crossed ? AMBER : color, hit)}
      </div>
      <div style={{ marginTop: 26, fontSize: 44, fontWeight: 700 }}>{label}</div>
    </div>
  )
}

function Pledge({ icon, title, detail, at, check, color }: { icon: IconName; title: string; detail: string; at: number; check: number; color: string }) {
  const p = usePop(at, { damping: 15 })
  const c = usePop(check, { damping: 11, stiffness: 200 })
  return (
    <Panel accent={color} style={{ width: 660, padding: '36px 44px', opacity: p, transform: `translateY(${(1 - p) * 50}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        <div style={{ width: 110, height: 110, borderRadius: 30, background: `${color}22`, display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={66} color={color} />
        </div>
        <div style={{ fontSize: 60, fontWeight: 700 }}>{title}</div>
      </div>
      <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 18, fontSize: 36, color: C.muted }}>
        <div style={{ width: 52, height: 52, borderRadius: 99, background: C.ok, display: 'grid', placeItems: 'center', transform: `scale(${c})`, flexShrink: 0 }}>
          <Icon name="check" size={34} color="#00210D" stroke={3} />
        </div>
        {detail}
      </div>
    </Panel>
  )
}

export function Why() {
  const frame = useCurrentFrame()
  const hearing = wordAt('why', 'why', '430')
  const blind = wordAt('why', 'why', '43')
  const but = wordAt('why', 'why', 'but')
  const promise = part('why', 'promise').at
  const shrink = interpolate(frame, [but - 12, but + 6], [0, 1], { ...clamp, easing: EASE_IN_OUT })
  const so = wordAt('why', 'promise', 'so')
  const herald = usePop(so - 2, { damping: 13 })
  return (
    <Backdrop hue={AMBER}>
      <Show from={0} to={promise - 12} fade={10}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 150 - shrink * 105, display: 'flex', justifyContent: 'center', gap: 60, transform: `scale(${1 - 0.36 * shrink})`, transformOrigin: '50% 0' }}>
          <Stat icon="earOff" color={AMBER} value={430} unit="million" label="people live with disabling hearing loss" source="WHO, 2026" at={hearing - 8} count={hearing} />
          <Stat icon="eyeOff" color={ALERT.person.flash} value={43} unit="million" label="people are blind" source="Lancet Global Health, 2021" at={blind - 14} count={blind} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', justifyContent: 'center', gap: 200 }}>
          <MadeFor device="bell" sense="ear" senseOff="earOff" label="A doorbell is made for ears" at={wordAt('why', 'why', 'doorbell') - 4} off={wordEnd('why', 'why', 'eyes.') + 2} color={C.accent} />
          <MadeFor device="camera" sense="eye" senseOff="eyeOff" label="A camera is made for eyes" at={wordAt('why', 'why', 'camera') - 4} off={wordEnd('why', 'why', 'eyes.') + 6} color={C.accent} />
        </div>
      </Show>
      <Show from={promise - 4} to={scene('why').duration + 10} fade={8}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', justifyContent: 'center', gap: 60 }}>
          <Pledge icon="volumeX" title="Sound off" detail="Every word and sound is captioned" at={promise + 2} check={wordEnd('why', 'promise', 'off,')} color={AMBER} />
          <Pledge icon="eyeClosed" title="Eyes closed" detail="The narration describes the screen" at={wordAt('why', 'promise', 'eyes') - 6} check={wordEnd('why', 'promise', 'closed.')} color={C.accent} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: herald, transform: `translateY(${(1 - herald) * 40}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Logo size={110} glow={0.6} />
            <span style={{ fontSize: 96, fontWeight: 700 }}>So does Herald.</span>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 34 }}>
            {(['Flash', 'Voice', 'Vibration', 'Braille'] as const).map((t, i) => (
              <Chip key={t} color={SENSE[i]} delay={so + 10 + i * 5} size={30}>
                {t}
              </Chip>
            ))}
          </div>
        </div>
      </Show>
      <Sfx id="ok" at={wordEnd('why', 'promise', 'off,')} volume={0.35} />
      <Sfx id="ok" at={wordEnd('why', 'promise', 'closed.')} volume={0.35} />
    </Backdrop>
  )
}
