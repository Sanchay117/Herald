// Turns the screencast recordings into constant 30 fps mp4 clips for Remotion and records their timing.
//   out/rec/<take>/<page>/   ->  public/clips/<take>-<page>.mp4
//   out/rec/live-2/          ->  public/clips/live-ui.mp4      (Herald's page during live view)
//   out/live-stream-2.webm   ->  public/clips/live-stream.mp4  (the Ring stream itself, 1280x720)
// src/clips.json: per clip, its length, frame size and marks (seconds from the start of the take).
// usage: node clips.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'

const HERE = new URL('./', import.meta.url)
const p = (rel) => new URL(rel, HERE).pathname
mkdirSync(p('public/clips'), { recursive: true })

const probe = (file) =>
  execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file]).toString()

// Screencast frames arrive whenever the page changes, sometimes 60 a second, sometimes none for
// seconds. Each output frame at 30 fps shows the latest screencast frame at that moment, laid
// out as a numbered image sequence (symlinks), so the clip's timing is exact.
function encodeFrames(dir, out) {
  const meta = JSON.parse(readFileSync(`${dir}meta.json`, 'utf8'))
  const seq = `${dir}seq/`
  rmSync(seq, { recursive: true, force: true })
  mkdirSync(seq)
  const count = Math.ceil(meta.end * 30)
  let j = 0
  for (let k = 0; k < count; k++) {
    while (j + 1 < meta.frames.length && meta.frames[j + 1].t <= k / 30) j++
    symlinkSync(`${dir}${meta.frames[j].f}`, `${seq}${String(k).padStart(5, '0')}.jpg`)
  }
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '30', '-i', `${seq}%05d.jpg`, '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-movflags', '+faststart', out])
  rmSync(seq, { recursive: true, force: true })
  const info = JSON.parse(probe(out))
  return {
    seconds: +meta.end.toFixed(3),
    width: info.streams[0].width,
    height: info.streams[0].height,
    marks: meta.marks.map((m) => ({ name: m.name, t: +m.t.toFixed(3) })),
  }
}

const clips = {}
for (const take of readdirSync(p('out/rec'), { withFileTypes: true })) {
  if (!take.isDirectory()) continue
  const takeDir = p(`out/rec/${take.name}/`)
  if (existsSync(`${takeDir}meta.json`)) {
    // a single-page take (the live view recordings)
    if (take.name !== 'live-2') continue
    clips['live-ui'] = encodeFrames(takeDir, p('public/clips/live-ui.mp4'))
    continue
  }
  for (const page of readdirSync(takeDir, { withFileTypes: true })) {
    if (!page.isDirectory()) continue
    const id = `${take.name}-${page.name}`
    clips[id] = encodeFrames(`${takeDir}${page.name}/`, p(`public/clips/${id}.mp4`))
  }
}

// The Ring stream as MediaRecorder captured it: re-timed to a steady 30 fps.
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', p('out/live-stream-2.webm'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-movflags', '+faststart', p('public/clips/live-stream.mp4')])
const stream = JSON.parse(probe(p('public/clips/live-stream.mp4')))
clips['live-stream'] = { seconds: +Number(stream.format.duration).toFixed(3), width: stream.streams[0].width, height: stream.streams[0].height, marks: [] }

writeFileSync(p('src/clips.json'), JSON.stringify(clips, null, 1))
for (const [id, c] of Object.entries(clips)) console.log(`${id.padEnd(16)} ${c.seconds.toFixed(1).padStart(5)}s  ${c.width}x${c.height}  ${c.marks.map((m) => `${m.name}@${m.t.toFixed(1)}`).join(' ')}`)
