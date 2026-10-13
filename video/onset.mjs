// Finds when a clip changes: the average colour of each frame (or of a crop), printed whenever it
// moves by more than a threshold. Used to line the recorded flashes up with the soundtrack.
// usage: node onset.mjs <video> [crop=w:h:x:y] [threshold=12]
import { execFileSync } from 'node:child_process'

const [video, crop, threshold = '12'] = process.argv.slice(2)
const filters = [crop ? `crop=${crop}` : null, 'scale=1:1:flags=area', 'format=rgb24'].filter(Boolean).join(',')
const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', filters, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 })
const fps = 30
let last = null
for (let i = 0; i + 2 < raw.length; i += 3) {
  const rgb = [raw[i], raw[i + 1], raw[i + 2]]
  const moved = last ? Math.max(...rgb.map((v, k) => Math.abs(v - last[k]))) : Infinity
  if (moved > Number(threshold)) {
    console.log(`${(i / 3 / fps).toFixed(3)} s  frame ${i / 3}  rgb(${rgb.join(', ')})`)
    last = rgb
  }
}
