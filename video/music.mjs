// Composes the score in code (no samples, no licences) to fit src/timeline.json: silence through
// the cold open, so the doorbell and voices stand alone; a warm D major bed from the title reveal;
// bass and a soft kick under the demo; claps and shakers for the technical part; a final chord
// with a bell for the outro. 96 BPM, Dmaj9, Bm9, Gmaj9, A6/9, two bars each.
// Writes public/music.wav (48 kHz stereo).
// usage: node music.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const HERE = new URL('./', import.meta.url)
const timeline = JSON.parse(readFileSync(new URL('src/timeline.json', HERE), 'utf8'))
const at = (id) => timeline.scenes.find((s) => s.id === id).from / timeline.fps

const SR = 48000
const SECONDS = timeline.total / timeline.fps
const N = Math.ceil(SECONDS * SR)
const L = new Float32Array(N)
const R = new Float32Array(N)

const START = at('title') // the music begins with the logo reveal
const DEMO = at('setup')
const KICK = at('wall')
const HATS = at('rhythm')
const TECH = at('tech')
const OUTRO = at('outro')

const BPM = 96
const BEAT = 60 / BPM
const BAR = 4 * BEAT
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
const CHORDS = [
  { root: 50, notes: [66, 69, 73, 76] }, // Dmaj9
  { root: 47, notes: [62, 66, 69, 73] }, // Bm9
  { root: 43, notes: [66, 69, 71, 74] }, // Gmaj9
  { root: 45, notes: [64, 66, 71, 73] }, // A6/9
]
const OUTRO_CHORD = { root: 50, notes: [62, 66, 69, 73, 76] }
/** The chord at a moment, and when it started. Music time starts at START; the outro holds Dmaj9. */
function chordAt(t) {
  if (t >= OUTRO) return { chord: OUTRO_CHORD, since: OUTRO, prev: CHORDS[Math.floor((OUTRO - START) / (2 * BAR)) % 4] }
  const k = Math.floor((t - START) / (2 * BAR))
  return { chord: CHORDS[((k % 4) + 4) % 4], since: START + k * 2 * BAR, prev: CHORDS[(((k - 1) % 4) + 4) % 4] }
}
const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)))
const fadeOut = (t) => 1 - ramp(t, SECONDS - 3.2, SECONDS - 0.2)

let seed = 3
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 31 - 1
}

// ---------------------------------------------------------------- pad: detuned saws, crossfaded at each chord change
{
  const phase = new Float64Array(64)
  let lpL = 0
  let lpR = 0
  for (let i = Math.floor(START * SR); i < N; i++) {
    const t = i / SR
    const { chord, since, prev } = chordAt(t)
    const x = Math.min(1, (t - since) / 0.45)
    let sL = 0
    let sR = 0
    const voices = (notes, gain, base) =>
      notes.forEach((m, n) => {
        for (let d = 0; d < 3; d++) {
          const k = base + n * 3 + d
          phase[k] = (phase[k] + hz(m + [-0.09, 0, 0.1][d]) / SR) % 1
          const saw = (2 * phase[k] - 1) * gain
          if (d === 0) sL += saw
          else if (d === 2) sR += saw
          else {
            sL += saw * 0.5
            sR += saw * 0.5
          }
        }
      })
    voices(chord.notes, x, 0)
    if (x < 1) voices(prev.notes, 1 - x, 32)
    const bright = ramp(t, TECH - 4, TECH + 2) * (1 - ramp(t, OUTRO, OUTRO + 4))
    const cutoff = 520 + 380 * (0.5 + 0.5 * Math.sin((t - START) / 6)) + 700 * ramp(t, DEMO, DEMO + 6) + 900 * bright
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR)
    lpL += a * (sL - lpL)
    lpR += a * (sR - lpR)
    // the pad breathes with the kick once it is in
    const beatPos = ((t - START) % BEAT) / BEAT
    const pump = t >= KICK && t < OUTRO ? 1 - 0.35 * Math.exp(-beatPos * 7) : 1
    const amp = 0.042 * ramp(t, START, START + 2.5) * fadeOut(t) * pump
    L[i] += lpL * amp
    R[i] += lpR * amp
  }
}

// ---------------------------------------------------------------- struck bells (free-bar partials), used for accents
function bell(t0, midi, amp, pan = 0, decay = 2.6) {
  const f = hz(midi)
  const start = Math.floor(t0 * SR)
  for (let j = 0; j < decay * 2 * SR && start + j < N; j++) {
    const t = j / SR
    let s = 0
    for (const [ratio, a, d] of [[1, 1, decay], [2.756, 0.32, decay * 0.4], [5.404, 0.12, decay * 0.18]]) s += a * Math.exp((-6.9 * t) / d) * Math.sin(2 * Math.PI * f * ratio * t)
    s *= amp * Math.min(1, t / 0.002) * fadeOut(t0 + t)
    L[start + j] += s * (1 - Math.max(0, pan))
    R[start + j] += s * (1 + Math.min(0, pan))
  }
}
// the title: a rising D major bell figure, then a bell on the first beat of every chord until the demo
;[[0.05, 74], [0.3, 78], [0.55, 81], [0.8, 86]].forEach(([dt, m], k) => bell(START + dt, m, 0.07, k % 2 ? 0.3 : -0.3))
for (let t = START + 2 * BAR; t < DEMO; t += 2 * BAR) bell(t, chordAt(t).chord.notes[3] + 12, 0.05, 0.2)
bell(OUTRO + 0.1, 86, 0.08, -0.2, 4)
bell(OUTRO + 0.35, 81, 0.06, 0.25, 4)

// ---------------------------------------------------------------- plucked arpeggio, into a ping-pong delay
const arpL = new Float32Array(N)
const arpR = new Float32Array(N)
{
  const step = BEAT / 2
  const pattern = [0, 1, 2, 3, 2, 1, 3, 1]
  for (let s = 0; START + s * step < OUTRO; s++) {
    const t0 = START + s * step
    if (t0 < DEMO - 4 * BEAT && s % 2) continue // quarter notes until the demo starts
    const { chord } = chordAt(t0)
    const m = chord.notes[pattern[s % pattern.length]] + 12
    const vel = (s % 4 === 0 ? 1 : 0.72) * 0.05 * ramp(t0, START + BAR, START + 2 * BAR) * fadeOut(t0)
    const pan = 0.5 + 0.32 * Math.sin(s * 0.9)
    const start = Math.floor(t0 * SR)
    const f = hz(m)
    for (let j = 0; j < 0.5 * SR && start + j < N; j++) {
      const t = j / SR
      const v = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t) + 0.08 * Math.sin(6 * Math.PI * f * t)) * Math.exp(-t * 8) * Math.min(1, t / 0.003) * vel
      arpL[start + j] += v * (1 - pan)
      arpR[start + j] += v * pan
    }
  }
  const d = Math.floor(BEAT * 0.75 * SR)
  const bufL = new Float32Array(N)
  const bufR = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const inL = arpL[i] + (i >= d ? bufR[i - d] * 0.38 : 0)
    const inR = arpR[i] + (i >= d ? bufL[i - d] * 0.38 : 0)
    bufL[i] = inL
    bufR[i] = inR
    L[i] += inL * 0.85
    R[i] += inR * 0.85
  }
}

// ---------------------------------------------------------------- sub bass: the chord root, pulsing on each beat
{
  let ph = 0
  for (let i = Math.floor(DEMO * SR); i < N; i++) {
    const t = i / SR
    const { chord } = chordAt(t)
    ph = (ph + hz(chord.root - 12) / SR) % 1
    const pos = ((t - START) % BEAT) / BEAT
    const env = t < OUTRO ? 0.55 + 0.45 * Math.exp(-pos * 4) : 0.7
    const s = Math.sin(2 * Math.PI * ph) * env * 0.085 * ramp(t, DEMO, DEMO + 2) * fadeOut(t)
    L[i] += s
    R[i] += s
  }
}

// ---------------------------------------------------------------- drums: soft kick, offbeat hats, then claps and a shaker
function hit(t0, len, fn) {
  const start = Math.floor(t0 * SR)
  for (let j = 0; j < len * SR && start + j < N; j++) {
    const [l, r] = fn(j / SR)
    L[start + j] += l
    R[start + j] += r
  }
}
for (let b = 0; START + b * BEAT < OUTRO; b++) {
  const t0 = START + b * BEAT
  if (t0 >= KICK) {
    let ph = 0
    const v = 0.22 * ramp(t0, KICK, KICK + BAR)
    hit(t0, 0.35, (t) => {
      ph += (44 + 95 * Math.exp(-t * 32)) / SR
      const s = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 8) * v
      return [s, s]
    })
  }
  if (t0 >= HATS) {
    let hp = 0
    let prev = 0
    const v = 0.035 * ramp(t0, HATS, HATS + BAR)
    hit(t0 + BEAT / 2, 0.05, (t) => {
      const x = noise()
      hp = 0.82 * (hp + x - prev)
      prev = x
      const s = hp * Math.exp(-t * 75) * v
      return [s * 0.75, s]
    })
  }
  if (t0 >= TECH && b % 2 === 1) {
    // clap: three quick noise bursts through a band
    let low = 0
    let band = 0
    const v = 0.07 * ramp(t0, TECH, TECH + BAR)
    hit(t0, 0.25, (t) => {
      const burst = t < 0.03 ? 0.6 + 0.4 * Math.cos(t * 2 * Math.PI * 100) : 1
      const fc = 2 * Math.sin((Math.PI * 1500) / SR)
      low += fc * band
      const high = noise() - low - 0.9 * band
      band += fc * high
      const s = band * Math.exp(-t * 18) * burst * v
      return [s, s * 0.9]
    })
  }
  if (t0 >= TECH) {
    for (const q of [0.25, 0.75]) {
      let hp = 0
      let prev = 0
      const v = 0.018 * ramp(t0, TECH, TECH + BAR)
      hit(t0 + q * BEAT, 0.04, (t) => {
        const x = noise()
        hp = 0.9 * (hp + x - prev)
        prev = x
        const s = hp * Math.exp(-t * 90) * v
        return [s, s * 0.7]
      })
    }
  }
}

// ---------------------------------------------------------------- a soft noise swell into the technical part
{
  let lp = 0
  const a0 = TECH - 1.6
  for (let i = Math.floor(a0 * SR); i < Math.floor(TECH * SR); i++) {
    // floor() can land a sample before a0, and a negative base to a fractional power is NaN
    const p = Math.max(0, (i / SR - a0) / 1.6)
    const fc = 2 * Math.sin((Math.PI * (300 * Math.pow(25, p))) / SR)
    lp += fc * (noise() - lp)
    const s = lp * Math.pow(p, 2.4) * Math.min(1, (1 - p) / 0.04) * 0.12
    L[i] += s
    R[i] += s * 0.85
  }
}

// ---------------------------------------------------------------- normalise to -3 dBFS and write
let peak = 1e-9
for (let i = 0; i < N; i++) {
  if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) throw new Error(`the mix breaks at ${(i / SR).toFixed(3)} s`)
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const gain = 0.707 / peak
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0)
buf.writeUInt32LE(36 + N * 4, 4)
buf.write('WAVE', 8)
buf.write('fmt ', 12)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20)
buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24)
buf.writeUInt32LE(SR * 4, 28)
buf.writeUInt16LE(4, 32)
buf.writeUInt16LE(16, 34)
buf.write('data', 36)
buf.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4)
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4)
}
writeFileSync(new URL('public/music.wav', HERE), buf)
console.log(`public/music.wav: ${SECONDS.toFixed(1)} s, music from ${START.toFixed(1)} s, peak ${peak.toFixed(3)} normalised to -3 dBFS`)
