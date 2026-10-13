// Narration: Deepgram Aura-2 speaks each line, ffmpeg cleans it up, then Deepgram speech-to-text
// times every word so the captions can follow the voice.
//   public/audio/<id>.wav   48 kHz mono, silence trimmed, loudness normalised to -16 LUFS
//   src/voice.json          per line: caption text, duration and word timings
// Results are cached in out/voice/ by model and text, so unchanged lines aren't billed again.
// The key is read from ../apps/web/.env.local (DEEPGRAM_API or DEEPGRAM_KEY) and never printed.
//
// usage: node voice.mjs [--only id,id]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cacheKey, FILTERS, LINES, VOICES } from './narration.mjs'

const HERE = new URL('./', import.meta.url)
const p = (rel) => new URL(rel, HERE).pathname
const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : null
}
const ONLY = arg('only')?.split(',')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync(p('out/voice'), { recursive: true })
mkdirSync(p('public/audio'), { recursive: true })

function deepgramKey() {
  const env = readFileSync(p('../apps/web/.env.local'), 'utf8')
  for (const name of ['DEEPGRAM_API', 'DEEPGRAM_KEY', 'DEEPGRAM_API_KEY']) {
    const value = env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
    if (value) return value
  }
  throw new Error('No Deepgram key in apps/web/.env.local (DEEPGRAM_API or DEEPGRAM_KEY)')
}
const KEY = deepgramKey()

async function deepgram(url, init, what) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { Authorization: `Token ${KEY}`, ...init.headers } })
    if (res.ok) return res
    const body = (await res.text()).slice(0, 300)
    // 4xx other than rate limiting won't succeed on retry
    if ((res.status < 500 && res.status !== 429) || attempt >= 4) throw new Error(`${what} failed: HTTP ${res.status} ${body}`)
    await sleep(1500 * attempt)
  }
}

function processAudio(raw, out, voice) {
  const chain = [
    ...FILTERS[voice],
    // trim leading and trailing silence, keeping a few milliseconds of air
    'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04',
    'areverse',
    'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08',
    'areverse',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
  ].join(',')
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af', chain, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', out])
}

const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())

// ---------------------------------------------------------------- caption word timing
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')
const tokens = (s) => s.split(/\s+/).filter(Boolean)

/** Aligns the spoken script with the recognised words (edit distance on normalised words). */
function align(script, heard) {
  const n = script.length
  const m = heard.length
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 0; i <= n; i++) cost[i][0] = i
  for (let j = 0; j <= m; j++) cost[0][j] = j
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      cost[i][j] = Math.min(cost[i - 1][j - 1] + (norm(script[i - 1]) === norm(heard[j - 1].word) ? 0 : 1), cost[i - 1][j] + 1, cost[i][j - 1] + 1)
  const match = new Array(n).fill(null)
  for (let i = n, j = m; i > 0 && j > 0; ) {
    const same = norm(script[i - 1]) === norm(heard[j - 1].word)
    if (cost[i][j] === cost[i - 1][j - 1] + (same ? 0 : 1)) {
      if (same) match[i - 1] = heard[j - 1]
      i--
      j--
    } else if (cost[i][j] === cost[i - 1][j] + 1) i--
    else j--
  }
  return match
}

/** Start and end of every script word: matched words take the recogniser's times, the rest are spread between them. */
function scriptTimes(script, heard, total) {
  const match = align(script, heard)
  const anchors = [{ i: -1, t: heard[0]?.start ?? 0 }]
  match.forEach((h, i) => h && anchors.push({ i, t: h.start }))
  anchors.push({ i: script.length, t: heard.at(-1)?.end ?? total })
  const starts = script.map((_, i) => {
    if (match[i]) return match[i].start
    const a = [...anchors].reverse().find((x) => x.i < i)
    const b = anchors.find((x) => x.i > i)
    return a.t + ((b.t - a.t) * (i - a.i)) / (b.i - a.i)
  })
  return script.map((_, i) => ({ s: starts[i], e: match[i]?.end ?? starts[i + 1] ?? heard.at(-1)?.end ?? total }))
}

/** Maps caption words onto spoken words sentence by sentence (they differ where numbers are spelled out). */
function captionTimes(text, say, sayTimes) {
  const split = (s) => s.match(/[^.!?]+[.!?]*/g).map((x) => tokens(x))
  let textS = split(text)
  let sayS = split(say)
  // A pause written as "..." splits the spoken text differently: map the whole line at once.
  if (textS.length !== sayS.length) {
    textS = [tokens(text)]
    sayS = [tokens(say)]
  }
  const out = []
  let base = 0
  textS.forEach((words, s) => {
    const n = sayS[s].length
    words.forEach((w, j) => {
      const a = base + Math.floor((j * n) / words.length)
      const b = base + Math.max(Math.floor(((j + 1) * n) / words.length) - 1, Math.floor((j * n) / words.length))
      out.push({ w, s: sayTimes[a].s, e: sayTimes[b].e })
    })
    base += n
  })
  return out
}

// ---------------------------------------------------------------- run
const result = []
for (const line of LINES) {
  const voice = line.voice ?? 'narrator'
  const say = line.say ?? line.text
  const model = VOICES[voice]
  const key = cacheKey(line)
  const raw = p(`out/voice/${key}.raw.wav`)
  const clean = p(`out/voice/${key}.wav`)
  const wordsFile = p(`out/voice/${key}.words.json`)
  const skip = ONLY && !ONLY.includes(line.id)

  if (!skip && !existsSync(raw)) {
    const res = await deepgram(
      `https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&sample_rate=24000&container=wav`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: say }) },
      `speak ${line.id}`,
    )
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()))
  }
  if (!existsSync(raw)) {
    console.log(`${line.id}: not generated yet (skipped by --only)`)
    continue
  }
  if (!existsSync(clean)) processAudio(raw, clean, voice)
  if (!existsSync(wordsFile)) {
    const res = await deepgram(
      'https://api.deepgram.com/v1/listen?model=nova-3&punctuate=true&numerals=false',
      { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: readFileSync(clean) },
      `listen ${line.id}`,
    )
    const json = await res.json()
    writeFileSync(wordsFile, JSON.stringify(json.results.channels[0].alternatives[0].words))
  }

  writeFileSync(p(`public/audio/${line.id}.wav`), readFileSync(clean))
  const total = duration(clean)
  const heard = JSON.parse(readFileSync(wordsFile, 'utf8'))
  const words = captionTimes(line.text, say, scriptTimes(tokens(say), heard, total)).map((w) => ({ ...w, s: +w.s.toFixed(3), e: +w.e.toFixed(3) }))
  const wpm = (tokens(say).length / total) * 60
  const matched = align(tokens(say), heard).filter(Boolean).length
  result.push({ id: line.id, voice, text: line.text, duration: +total.toFixed(3), words })
  console.log(`${line.id.padEnd(15)} ${total.toFixed(2).padStart(6)}s  ${Math.round(wpm)} wpm  ${matched}/${tokens(say).length} words timed`)
}

writeFileSync(p('src/voice.json'), JSON.stringify(result, null, 1))
console.log(`src/voice.json: ${result.length} lines, ${result.reduce((a, l) => a + l.duration, 0).toFixed(1)} s of voice`)
