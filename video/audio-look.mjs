// Pictures of audio files for checking them without listening: a spectrogram over a waveform per
// file, stacked into one PNG.
// usage: node audio-look.mjs <out.png> <file> [file ...]
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [out, ...files] = process.argv.slice(2)
const dir = mkdtempSync(join(tmpdir(), 'audio-look-'))
const parts = files.map((f, i) => {
  const img = join(dir, `${i}.png`)
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', f,
    '-filter_complex', `[0:a]showspectrumpic=s=1400x220:legend=0:scale=log:fscale=log[s];[0:a]showwavespic=s=1400x90:colors=white[w];[s][w]vstack,drawtext=text='${f.split('/').pop()}':x=6:y=6:fontsize=16:fontcolor=yellow`,
    '-frames:v', '1', img,
  ])
  return img
})
if (parts.length === 1) copyFileSync(parts[0], out)
else execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...parts.flatMap((p) => ['-i', p]), '-filter_complex', `vstack=inputs=${parts.length}`, out])
rmSync(dir, { recursive: true, force: true })
console.log(out)
