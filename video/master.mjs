// Final loudness pass: two-pass EBU R128 loudnorm to -16 LUFS with true peaks under -1.5 dBTP.
// The video stream is copied untouched; only the soundtrack is re-encoded.
// usage: node master.mjs [in=out/herald-demo.mp4] [out=out/herald-demo-final.mp4]
import { execFileSync, spawnSync } from 'node:child_process'

const [input = 'out/herald-demo.mp4', output = 'out/herald-demo-final.mp4'] = process.argv.slice(2)
const TARGET = 'I=-16:TP=-1.5:LRA=11'

// pass 1: measure (loudnorm prints its JSON on stderr)
const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', input, '-af', `loudnorm=${TARGET}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' })
const json = probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1)
const m = JSON.parse(json)
console.log(`measured: ${m.input_i} LUFS, true peak ${m.input_tp} dBTP, LRA ${m.input_lra} LU`)

// pass 2: apply as one linear gain where the peaks allow it
const filter = `loudnorm=${TARGET}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=summary`
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', output], { stdio: 'inherit' })
console.log(`wrote ${output}`)
