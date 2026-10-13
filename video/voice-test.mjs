// Tries wordings and voices for one line: speaks each, then reports duration, pace and what
// speech-to-text heard. Files land in out/voice-test/ for comparison.
// usage: node voice-test.mjs <model> <text> [<model> <text> ...]
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const HERE = new URL('./', import.meta.url)
const p = (rel) => new URL(rel, HERE).pathname
mkdirSync(p('out/voice-test'), { recursive: true })
const env = readFileSync(p('../apps/web/.env.local'), 'utf8')
const KEY = ['DEEPGRAM_API', 'DEEPGRAM_KEY'].map((n) => env.match(new RegExp(`^${n}=(.*)$`, 'm'))?.[1]?.trim()).find(Boolean)

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i += 2) {
  const [model, text] = [args[i], args[i + 1]]
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&sample_rate=24000&container=wav`, {
    method: 'POST',
    headers: { Authorization: `Token ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    console.log(`${model}: HTTP ${res.status}`)
    continue
  }
  const file = p(`out/voice-test/${i / 2}-${model}.wav`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString())
  const stt = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&punctuate=true', {
    method: 'POST',
    headers: { Authorization: `Token ${KEY}`, 'Content-Type': 'audio/wav' },
    body: readFileSync(file),
  })
  const heard = (await stt.json()).results.channels[0].alternatives[0].transcript
  const words = text.split(/\s+/).length
  console.log(`[${i / 2}] ${model} ${dur.toFixed(2)}s ${Math.round((words / dur) * 60)} wpm\n    said:  ${text}\n    heard: ${heard}`)
}
