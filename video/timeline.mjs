// The demo's timeline, derived from the narration lengths in src/voice.json: where each scene
// starts, how it enters, and when each voice line and captioned sound plays inside it.
// Remotion and music.mjs both read the result, src/timeline.json.
// usage: node timeline.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const FPS = 30
const HERE = new URL('./', import.meta.url)
const voice = JSON.parse(readFileSync(new URL('src/voice.json', HERE), 'utf8'))
const lineById = Object.fromEntries(voice.map((l) => [l.id, l]))

/** Frames each kind of scene entrance overlaps the scene before it. */
const ENTER_FRAMES = { cut: 0, fade: 15, slide: 18, iris: 22, push: 14, zoom: 16 }

// Parts play in order; `gap` is seconds of silence before a part. Sounds with a caption get one on
// screen, like any spoken line. `tail` is seconds the scene holds after its last part.
const PLAN = [
  {
    id: 'cold',
    parts: [
      { sfx: 'chime', gap: 0.7, len: 1.9, caption: '[Doorbell chimes]' },
      { line: 'cold-deaf', gap: 0.15 },
      // the Deaf answer is the amber flash, which needs time on screen before the next line
      { line: 'cold-blind', gap: 1.6 },
      { line: 'cold-alert', gap: 0.35 },
      { line: 'cold-deafblind', gap: 1.0 },
      { sfx: 'buzz-doorbell', gap: 0.35, len: 1.45, caption: '[Phone vibrates: long, long]' },
    ],
    tail: 1.1,
  },
  { id: 'title', enter: 'cut', parts: [{ sfx: 'reveal', gap: 0, len: 0.4 }, { line: 'title', gap: 0.35 }], tail: 1.5 },
  { id: 'why', enter: 'zoom', parts: [{ line: 'why', gap: 0.45 }, { line: 'promise', gap: 0.8 }], tail: 1.0 },
  { id: 'setup', enter: 'slide', parts: [{ line: 'setup', gap: 0.6 }], tail: 1.3 },
  {
    id: 'wall',
    enter: 'iris',
    parts: [
      { sfx: 'chime', gap: 0.8, len: 1.1, caption: '[Doorbell chimes]' },
      // the laptop answers in Herald's voice while the TV flashes and the phone buzzes
      { line: 'cold-alert', gap: 0 },
      { line: 'wall', gap: 0.45 },
    ],
    tail: 1.0,
  },
  { id: 'rhythm', enter: 'slide', parts: [{ line: 'rhythm', gap: 0.5 }], tail: 0.9 },
  { id: 'priority', enter: 'push', parts: [{ line: 'priority', gap: 0.4 }], tail: 1.9 },
  { id: 'live', enter: 'zoom', parts: [{ line: 'live', gap: 1.0 }], tail: 1.3 },
  { id: 'safe', enter: 'fade', parts: [{ line: 'safe', gap: 0.6 }], tail: 1.0 },
  { id: 'tech', enter: 'slide', parts: [{ line: 'tech', gap: 0.6 }], tail: 1.2 },
  { id: 'ringkit', enter: 'push', parts: [{ line: 'ringkit', gap: 0.6 }], tail: 1.2 },
  { id: 'outro', enter: 'fade', parts: [{ line: 'outro', gap: 0.9 }], tail: 4.0 },
]

const sec = (s) => Math.round(s * FPS)
const scenes = []
let from = 0
for (const [i, s] of PLAN.entries()) {
  const enter = i === 0 ? 'cut' : (s.enter ?? 'fade')
  const overlap = ENTER_FRAMES[enter]
  from -= overlap
  let cursor = 0
  const parts = s.parts.map((part) => {
    cursor += part.gap ?? 0
    const line = part.line ? lineById[part.line] : null
    if (part.line && !line) throw new Error(`no narration for ${part.line}: run voice.mjs`)
    const len = line ? line.duration : part.len
    const out = { kind: line ? 'line' : 'sfx', id: part.line ?? part.sfx, at: sec(cursor), len: sec(len), ...(part.caption ? { caption: part.caption } : {}) }
    cursor += len
    return out
  })
  const duration = sec(cursor + s.tail)
  if (i > 0 && scenes[i - 1].duration - scenes[i - 1].lastEnd < overlap) {
    throw new Error(`${scenes[i - 1].id} must hold at least ${overlap} frames after its last line for the ${enter} into ${s.id}`)
  }
  scenes.push({ id: s.id, enter, overlap, from, duration, parts, lastEnd: parts.at(-1).at + parts.at(-1).len })
  from += duration
}
const total = from

writeFileSync(new URL('src/timeline.json', HERE), JSON.stringify({ fps: FPS, total, scenes: scenes.map(({ lastEnd, ...s }) => s) }, null, 1))
for (const s of scenes) console.log(`${s.id.padEnd(9)} ${(s.from / FPS).toFixed(1).padStart(6)}s  +${(s.duration / FPS).toFixed(1)}s  ${s.enter}`)
console.log(`total ${(total / FPS).toFixed(1)} s (${Math.floor(total / FPS / 60)}:${String(Math.round((total / FPS) % 60)).padStart(2, '0')})`)
