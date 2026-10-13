// Captions for every spoken line and captioned sound, cut into short phrases and timed by the
// narration's word timings. The word being spoken is drawn in Herald's focus yellow.
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { clamp, Icon } from './components'
import { line, sec, TIMELINE, type Word } from './data'
import { C, SANS } from './theme'

/** Lines the picture already shows as big type, word by word. */
const ON_SCREEN = new Set(['cold:cold-deaf', 'cold:cold-blind', 'cold:cold-alert', 'cold:cold-deafblind', 'title:title', 'outro:outro'])
/** Single phrases the picture shows as big type (scene:line:phrase number). */
const ON_SCREEN_PHRASES = new Set(['safe:safe:0'])

const MAX = 64 // characters in a one-line caption

interface Cue { from: number; to: number; words?: { w: string; s: number; e: number }[]; sound?: string; speaker?: string }

const length = (ws: Word[]) => ws.map((w) => w.w).join(' ').length

/** Splits a phrase at the comma or colon nearest its middle (or a space, failing that) until each piece fits. */
function split(ws: Word[]): Word[][] {
  if (length(ws) <= MAX || ws.length < 2) return [ws]
  const mid = length(ws) / 2
  const ends: { i: number; pos: number; punct: boolean }[] = []
  let pos = 0
  ws.forEach((w, i) => {
    pos += w.w.length + 1
    if (i < ws.length - 1) ends.push({ i, pos, punct: /[,:;]$/.test(w.w) })
  })
  const punct = ends.filter((e) => e.punct)
  const pool = punct.length ? punct : ends
  const cut = pool.reduce((a, b) => (Math.abs(b.pos - mid) < Math.abs(a.pos - mid) ? b : a))
  return [...split(ws.slice(0, cut.i + 1)), ...split(ws.slice(cut.i + 1))]
}

function phrases(words: Word[]): Word[][] {
  const sentences: Word[][] = [[]]
  for (const w of words) {
    sentences[sentences.length - 1].push(w)
    if (/[.!?]$/.test(w.w)) sentences.push([])
  }
  return sentences.filter((s) => s.length).flatMap(split)
}

function buildCues(): Cue[] {
  const cues: Cue[] = []
  for (const s of TIMELINE.scenes) {
    for (const p of s.parts) {
      const start = s.from + p.at
      if (p.kind === 'sfx') {
        if (p.caption) cues.push({ from: start, to: start + p.len, sound: p.caption })
        continue
      }
      if (ON_SCREEN.has(`${s.id}:${p.id}`)) continue
      const l = line(p.id)
      for (const [k, ws] of phrases(l.words).entries()) {
        if (ON_SCREEN_PHRASES.has(`${s.id}:${p.id}:${k}`)) continue
        cues.push({
          from: start + sec(ws[0].s),
          to: start + sec(ws[ws.length - 1].e),
          words: ws.map((w) => ({ w: w.w, s: start + sec(w.s), e: start + sec(w.e) })),
          speaker: l.voice === 'herald' ? 'Herald' : undefined,
        })
      }
    }
  }
  cues.sort((a, b) => a.from - b.from)
  // hold each caption until the next one when the gap is short, so captions don't blink
  cues.forEach((c, i) => {
    const next = cues[i + 1]
    c.to = next && next.from - c.to < 20 ? next.from : c.to + 14
  })
  return cues
}

export const CUES = buildCues()

export function Captions() {
  const frame = useCurrentFrame()
  const i = CUES.findIndex((c) => frame >= c.from && frame < c.to)
  if (i < 0) return null
  const cue = CUES[i]
  const joinedBefore = i > 0 && CUES[i - 1].to >= cue.from
  const joinedAfter = i < CUES.length - 1 && CUES[i + 1].from <= cue.to
  const opacity = Math.min(joinedBefore ? 1 : interpolate(frame, [cue.from, cue.from + 5], [0, 1], clamp), joinedAfter ? 1 : interpolate(frame, [cue.to - 6, cue.to], [1, 0], clamp))
  const rise = joinedBefore ? 0 : interpolate(frame, [cue.from, cue.from + 7], [10, 0], clamp)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 44, pointerEvents: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          maxWidth: 1600,
          padding: '14px 30px 16px',
          borderRadius: 18,
          background: 'rgba(9,10,13,0.9)',
          border: '1.5px solid rgba(255,255,255,0.13)',
          boxShadow: '0 20px 50px -20px #000',
          fontFamily: SANS,
          fontSize: 44,
          fontWeight: 700,
          lineHeight: 1.28,
          color: C.ink,
          textAlign: 'center',
          opacity,
          transform: `translateY(${rise}px)`,
        }}
      >
        {cue.speaker && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px 4px 10px', borderRadius: 99, background: C.accent, color: '#0b1220', fontSize: 28, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <Icon name="bell" size={24} stroke={2.6} />
            {cue.speaker}
          </span>
        )}
        {cue.sound ? (
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: C.muted }}>{cue.sound}</span>
        ) : (
          <span>
            {cue.words!.map((w, k) => (
              <span key={k} style={{ color: frame >= w.s && frame < Math.max(w.e, w.s + 4) ? C.focus : C.ink }}>
                {w.w}
                {k < cue.words!.length - 1 ? ' ' : ''}
              </span>
            ))}
          </span>
        )}
      </div>
    </AbsoluteFill>
  )
}
