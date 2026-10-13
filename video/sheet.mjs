// Tiles stills from stills.mjs into one contact sheet, 4 across, each labelled with its frame.
// usage: node sheet.mjs <out.png> <still.png...>   (2 to 16 stills)
import { execFileSync } from 'node:child_process'

const [out, ...files] = process.argv.slice(2)
const COLS = 4
const TW = 480
const TH = 270
const tiles = files.map((f, i) => {
  const frame = Number(f.match(/f(\d+)\.png$/)[1])
  return `[${i}:v]scale=${TW}:${TH},drawtext=text='f${frame}  ${(frame / 30).toFixed(1)}s':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7[v${i}]`
})
const layout = files.map((_, i) => `${(i % COLS) * TW}_${Math.floor(i / COLS) * TH}`).join('|')
const graph = `${tiles.join(';')};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black`
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...files.flatMap((f) => ['-i', f]), '-filter_complex', graph, '-frames:v', '1', out])
console.log(out)
