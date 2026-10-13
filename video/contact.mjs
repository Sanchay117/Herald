// Contact sheet of a clip for checking footage: N evenly spaced frames tiled into one PNG.
// usage: node contact.mjs <video> <out.png> [frames=12] [columns=4]
import { execFileSync } from 'node:child_process'

const [video, out, n = '12', cols = '4'] = process.argv.slice(2)
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString().trim())
const count = Number(n)
const rows = Math.ceil(count / Number(cols))
const fps = count / duration
execFileSync('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', video,
  '-vf', `fps=${fps.toFixed(5)},scale=480:-2,drawtext=text='%{pts\\:hms}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,tile=${cols}x${rows}:padding=4`,
  '-frames:v', '1', out,
])
console.log(`${out}: ${count} frames over ${duration.toFixed(1)} s`)
