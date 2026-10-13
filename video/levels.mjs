// Loudness envelopes for the sounds the picture reacts to (Herald's spoken alert drives the voice
// waveform), so the render doesn't decode audio. Writes src/levels.json: 120 values a second, 0 to 1.
// usage: node levels.mjs
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const RATE = 120
const SR = 48000
const FILES = { 'cold-alert': 'public/audio/cold-alert.wav' }

const out = {}
for (const [id, file] of Object.entries(FILES)) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
  const window = SR / RATE
  const rms = []
  for (let i = 0; i + window <= samples.length; i += window) {
    let sum = 0
    for (let j = i; j < i + window; j++) sum += samples[j] * samples[j]
    rms.push(Math.sqrt(sum / window))
  }
  const peak = Math.max(...rms)
  out[id] = rms.map((v) => Math.round((v / peak) * 1000) / 1000)
  console.log(`${id}: ${rms.length} values over ${(rms.length / RATE).toFixed(2)} s`)
}
writeFileSync(new URL('src/levels.json', import.meta.url), JSON.stringify({ rate: RATE, levels: out }))
