// Sound effects, synthesised in code (no samples, no licences): the doorbell chime, phone
// vibration rhythms (the same patterns Herald uses), whooshes, ticks and the title reveal.
// Writes 48 kHz stereo WAVs to public/sfx/.
// usage: node sfx.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const SR = 48000
const OUT = new URL('./public/sfx/', import.meta.url)
mkdirSync(OUT, { recursive: true })

let seed = 11
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 31 - 1
}

const buffer = (seconds) => ({ L: new Float32Array(Math.ceil(seconds * SR)), R: new Float32Array(Math.ceil(seconds * SR)) })

function writeWav(name, { L, R }, peakDb = -3) {
  let peak = 1e-9
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  const gain = Math.pow(10, peakDb / 20) / peak
  const n = L.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 4, 4)
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
  buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4)
  }
  writeFileSync(new URL(`${name}.wav`, OUT), buf)
  console.log(`${name}.wav  ${(n / SR).toFixed(2)} s`)
}

/** Small Schroeder room: four combs and two allpasses per channel, mixed in. */
function room(b, mix = 0.2, size = 1) {
  const run = (x, spread) => {
    const out = new Float32Array(x.length)
    for (const [ms, fb] of [[29.7, 0.82], [37.1, 0.8], [41.1, 0.78], [43.7, 0.76]]) {
      const d = Math.round(((ms + spread) * size * SR) / 1000)
      const line = new Float32Array(x.length)
      let lp = 0
      for (let i = 0; i < x.length; i++) {
        const fbk = i >= d ? line[i - d] : 0
        lp = lp * 0.35 + fbk * 0.65 // damping
        line[i] = x[i] + lp * fb
        out[i] += line[i] * 0.25
      }
    }
    for (const ms of [5.0, 1.7]) {
      const d = Math.round(((ms + spread * 0.1) * SR) / 1000)
      const y = new Float32Array(x.length)
      for (let i = 0; i < x.length; i++) {
        const del = i >= d ? y[i - d] : 0
        const xin = out[i]
        y[i] = -0.5 * xin + (i >= d ? out[i - d] : 0) + 0.5 * del
      }
      out.set(y)
    }
    return out
  }
  const wl = run(b.L, 0)
  const wr = run(b.R, 1.3)
  for (let i = 0; i < b.L.length; i++) {
    b.L[i] = b.L[i] * (1 - mix) + wl[i] * mix
    b.R[i] = b.R[i] * (1 - mix) + wr[i] * mix
  }
  return b
}

/** A struck tone bar: free-bar partials (1, 2.756, 5.404, 8.933), each decaying at its own rate. */
function bar(b, f0, t0, amp = 1, decay = 2.4, pan = 0) {
  const partials = [
    [1, 1, decay],
    [2.756, 0.38, decay * 0.42],
    [5.404, 0.16, decay * 0.2],
    [8.933, 0.07, decay * 0.11],
  ]
  const start = Math.floor(t0 * SR)
  const len = Math.min(b.L.length - start, Math.floor(decay * 2.2 * SR))
  for (let j = 0; j < len; j++) {
    const t = j / SR
    const attack = Math.min(1, t / 0.0025)
    let s = 0
    for (const [ratio, a, d] of partials) s += a * Math.exp((-6.9 * t) / d) * Math.sin(2 * Math.PI * f0 * ratio * t)
    // the striker's click
    if (t < 0.004) s += noise() * 0.25 * (1 - t / 0.004)
    s *= amp * attack
    b.L[start + j] += s * (1 - Math.max(0, pan))
    b.R[start + j] += s * (1 + Math.min(0, pan))
  }
}

// ---------------------------------------------------------------- doorbell chime: ding (E5), dong (C5)
{
  const b = buffer(3.6)
  bar(b, 659.25, 0.0, 1, 2.2, -0.15)
  bar(b, 523.25, 0.62, 1, 2.6, 0.15)
  writeWav('chime', room(b, 0.22, 1.1))
}

// ---------------------------------------------------------------- vibration motor, in Herald's rhythms (ms on, off, on...)
const RHYTHMS = {
  doorbell: [600, 200, 600],
  person: [150, 120, 150],
  package: [150, 120, 600],
  vehicle: [600, 200, 150],
  motion: [120],
}
for (const [kind, pattern] of Object.entries(RHYTHMS)) {
  const total = pattern.reduce((a, b) => a + b, 0) / 1000 + 0.15
  const b = buffer(total)
  let t = 0
  let phase = 0
  pattern.forEach((ms, k) => {
    const on = k % 2 === 0
    const len = ms / 1000
    if (on) {
      const start = Math.floor(t * SR)
      for (let j = 0; j < len * SR + 0.04 * SR; j++) {
        const tt = j / SR
        const spin = Math.min(1, tt / 0.045) // the motor spins up
        const f = 168 * (0.72 + 0.28 * spin) * (1 + 0.015 * Math.sin(2 * Math.PI * 9 * tt))
        phase += f / SR
        const x = 2 * Math.PI * phase
        // rattle: a rounded square plus a buzzing upper harmonic and a little grit
        let s = 0.62 * Math.tanh(2.2 * Math.sin(x)) + 0.18 * Math.sin(2 * x + 0.4) + 0.08 * Math.sin(3 * x) + 0.05 * noise()
        const env = tt < len ? Math.min(1, tt / 0.012) : Math.max(0, 1 - (tt - len) / 0.04)
        s *= env
        if (start + j < b.L.length) {
          b.L[start + j] += s
          b.R[start + j] += s * 0.94
        }
      }
    }
    t += len
  })
  // soften the upper harmonics a little
  let lpL = 0
  let lpR = 0
  for (let i = 0; i < b.L.length; i++) {
    lpL += 0.32 * (b.L[i] - lpL)
    lpR += 0.32 * (b.R[i] - lpR)
    b.L[i] = lpL
    b.R[i] = lpR
  }
  writeWav(`buzz-${kind}`, b, -5)
}

// ---------------------------------------------------------------- whoosh: noise through a sweeping band-pass, panned across
function whoosh(name, seconds, f1, f2, f3) {
  const b = buffer(seconds)
  let low = 0
  let band = 0
  const n = b.L.length
  for (let i = 0; i < n; i++) {
    const p = i / n
    const f = p < 0.55 ? f1 * Math.pow(f2 / f1, p / 0.55) : f2 * Math.pow(f3 / f2, (p - 0.55) / 0.45)
    const fc = 2 * Math.sin((Math.PI * f) / SR)
    const q = 0.7
    const x = noise()
    low += fc * band
    const high = x - low - q * band
    band += fc * high
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.05)), 1.6)
    const pan = -0.7 + 1.4 * p
    b.L[i] = band * env * (1 - Math.max(0, pan))
    b.R[i] = band * env * (1 + Math.min(0, pan))
  }
  writeWav(name, room(b, 0.15), -6)
}
whoosh('whoosh', 0.75, 350, 3800, 700)
whoosh('swoosh', 0.45, 900, 6000, 1800)

// ---------------------------------------------------------------- ticks, keys and clicks
function blip(name, seconds, fn, peak = -8) {
  const b = buffer(seconds)
  for (let i = 0; i < b.L.length; i++) {
    const s = fn(i / SR)
    b.L[i] = s
    b.R[i] = s
  }
  writeWav(name, b, peak)
}
blip('tick', 0.08, (t) => Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t / 0.012) + (t < 0.003 ? noise() * 0.4 : 0), -12)
blip('key', 0.09, (t) => {
  const thock = Math.sin(2 * Math.PI * (180 - 600 * t) * t) * Math.exp(-t / 0.018)
  const clack = noise() * Math.exp(-t / 0.006) * 0.6
  return thock * 0.8 + clack
}, -10)
blip('click', 0.06, (t) => noise() * Math.exp(-t / 0.004) * 0.7 + Math.sin(2 * Math.PI * 3100 * t) * Math.exp(-t / 0.008) * 0.5, -12)
blip('ok', 0.32, (t) => {
  const a = t < 0.09 ? Math.sin(2 * Math.PI * 1318.5 * t) * Math.exp(-t / 0.05) : 0
  const tb = t - 0.09
  const b2 = tb > 0 ? Math.sin(2 * Math.PI * 1975.5 * tb) * Math.exp(-tb / 0.08) : 0
  return a * 0.7 + b2
}, -10)

// ---------------------------------------------------------------- title reveal: soft sub thump plus a bell chord (D5, A5, D6, F#6)
{
  const b = buffer(4.5)
  for (let i = 0; i < 1.4 * SR; i++) {
    const t = i / SR
    const f = 46 + 70 * Math.exp(-t * 18)
    const s = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.35) * 0.9
    b.L[i] += s
    b.R[i] += s
  }
  bar(b, 587.33, 0.0, 0.55, 3.2, -0.3)
  bar(b, 880.0, 0.03, 0.4, 3.0, 0.3)
  bar(b, 1174.66, 0.06, 0.3, 2.6, -0.1)
  bar(b, 1479.98, 0.09, 0.22, 2.2, 0.2)
  writeWav('reveal', room(b, 0.28, 1.4), -4)
}

// ---------------------------------------------------------------- riser: filtered noise swelling for a second into a reveal
{
  const b = buffer(1.6)
  let lp = 0
  const n = b.L.length
  for (let i = 0; i < n; i++) {
    const p = i / n
    const fc = 2 * Math.sin((Math.PI * (200 * Math.pow(30, p))) / SR)
    lp += fc * (noise() - lp)
    const env = Math.pow(p, 2.2) * (p > 0.96 ? (1 - p) / 0.04 : 1)
    b.L[i] = lp * env
    b.R[i] = lp * env * 0.9
  }
  writeWav('riser', b, -8)
}
