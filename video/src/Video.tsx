// The whole film: twelve scenes in a TransitionSeries, with the narration, sound effects and
// music laid on one timeline (timeline.json) and captions over everything.
import { linearTiming, TransitionSeries, type TransitionPresentation, type TransitionPresentationComponentProps } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { iris } from '@remotion/transitions/iris'
import { pushCut } from '@remotion/transitions/push-cut'
import { slide } from '@remotion/transitions/slide'
import { Fragment, type ComponentType } from 'react'
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from 'remotion'
import { Captions } from './Captions'
import { clamp, EASE_IN_OUT } from './components'
import { line, TIMELINE, type Enter, type SceneId } from './data'
import { Outro, RingKit, Safe, Tech } from './scenes/build'
import { Live, Priority, Rhythm, Setup, Wall } from './scenes/demo'
import { Cold, Title, Why } from './scenes/open'
import { C, FPS, H, SANS, W } from './theme'

const SCENES: Record<SceneId, ComponentType> = { cold: Cold, title: Title, why: Why, setup: Setup, wall: Wall, rhythm: Rhythm, priority: Priority, live: Live, safe: Safe, tech: Tech, ringkit: RingKit, outro: Outro }

// ------------------------------------------------------------------------------------ transitions

type NoProps = Record<string, never>

/** The old scene rushes past the camera while the new one comes up out of the depth. */
function ZoomThrough({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<NoProps>) {
  const entering = presentationDirection === 'entering'
  const scale = entering ? interpolate(p, [0, 1], [0.86, 1]) : interpolate(p, [0, 1], [1, 1.2])
  const opacity = entering ? interpolate(p, [0, 0.6], [0, 1], clamp) : interpolate(p, [0.35, 1], [1, 0], clamp)
  const blur = entering ? (1 - p) * 12 : p * 12
  return <AbsoluteFill style={{ transform: `scale(${scale})`, opacity, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>
}
const zoomThrough = (): TransitionPresentation<NoProps> => ({ component: ZoomThrough, props: {} })

function presentation(enter: Enter): TransitionPresentation<Record<string, unknown>> {
  const p = (() => {
    switch (enter) {
      case 'slide':
        return slide({ direction: 'from-right' })
      case 'iris':
        return iris({ width: W, height: H })
      case 'push':
        // ends at scale 1, so nothing jumps when the transition hands over to the scene
        return pushCut({ incomingStartScale: 1.06, incomingEndScale: 1, flashColor: '#ffffff', flashOpacity: 0.12 })
      case 'zoom':
        return zoomThrough()
      default:
        return fade()
    }
  })()
  return p as unknown as TransitionPresentation<Record<string, unknown>>
}

const WHOOSH: Partial<Record<Enter, { id: string; volume: number }>> = {
  zoom: { id: 'whoosh', volume: 0.3 },
  iris: { id: 'whoosh', volume: 0.24 },
  slide: { id: 'swoosh', volume: 0.28 },
  push: { id: 'swoosh', volume: 0.3 },
}

// ------------------------------------------------------------------------------------ sound

const SFX_VOLUME: Record<string, number> = { chime: 0.8, reveal: 0.8, 'buzz-doorbell': 0.55 }

// Music sits under the voice: ducked while anyone speaks, opening up in the gaps. It dips just
// before a line starts and recovers more slowly after it ends.
const DUCKED = 0.13
const OPEN = 0.38
const ATTACK = 8
const RELEASE = 20
const VOICED = TIMELINE.scenes.flatMap((s) => s.parts.filter((p) => p.kind === 'line').map((p) => [s.from + p.at, s.from + p.at + p.len] as const))
const MUSIC = Array.from({ length: TIMELINE.total }, (_, f) => {
  let k = 1
  for (const [a, b] of VOICED) {
    const d = f < a ? (a - f) / ATTACK : f > b ? (f - b) / RELEASE : 0
    k = Math.min(k, d)
  }
  return DUCKED + (OPEN - DUCKED) * Math.min(1, k)
})
// fade the music in and out at the very ends
const musicVolume = (f: number) => (MUSIC[Math.max(0, Math.min(MUSIC.length - 1, f))] ?? OPEN) * interpolate(f, [TIMELINE.total - 40, TIMELINE.total - 4], [1, 0], clamp)

function Soundtrack() {
  return (
    <>
      <Audio src={staticFile('music.wav')} volume={musicVolume} />
      {TIMELINE.scenes.map((s) => (
        <Fragment key={s.id}>
          {s.parts.map((p, i) => {
            const from = s.from + p.at
            const length = p.kind === 'line' ? Math.ceil(line(p.id).duration * FPS) + 10 : 200
            return (
              <Sequence key={i} from={from} durationInFrames={Math.min(length, TIMELINE.total - from)} layout="none">
                <Audio src={staticFile(p.kind === 'line' ? `audio/${p.id}.wav` : `sfx/${p.id}.wav`)} volume={p.kind === 'line' ? 1 : (SFX_VOLUME[p.id] ?? 0.6)} />
              </Sequence>
            )
          })}
          {WHOOSH[s.enter] && s.overlap > 0 && (
            <Sequence from={Math.max(0, s.from - 4)} durationInFrames={60} layout="none">
              <Audio src={staticFile(`sfx/${WHOOSH[s.enter]!.id}.wav`)} volume={WHOOSH[s.enter]!.volume} />
            </Sequence>
          )}
        </Fragment>
      ))}
    </>
  )
}

// ------------------------------------------------------------------------------------ film

export function Demo() {
  return (
    <AbsoluteFill style={{ background: C.canvas, fontFamily: SANS, color: C.ink }}>
      <TransitionSeries>
        {TIMELINE.scenes.map((s, i) => {
          const Scene = SCENES[s.id]
          return (
            <Fragment key={s.id}>
              {i > 0 && s.overlap > 0 && <TransitionSeries.Transition presentation={presentation(s.enter)} timing={linearTiming({ durationInFrames: s.overlap, easing: EASE_IN_OUT })} />}
              <TransitionSeries.Sequence durationInFrames={s.duration} name={s.id}>
                <Scene />
              </TransitionSeries.Sequence>
            </Fragment>
          )
        })}
      </TransitionSeries>
      <Soundtrack />
      <Captions />
    </AbsoluteFill>
  )
}
