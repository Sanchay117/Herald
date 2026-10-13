// What speech-to-text heard in each narration clip, next to the script, to catch mispronunciations.
// usage: node heard.mjs
import { existsSync, readFileSync } from 'node:fs'
import { cacheKey, LINES } from './narration.mjs'

const HERE = new URL('./', import.meta.url)
for (const line of LINES) {
  const file = new URL(`out/voice/${cacheKey(line)}.words.json`, HERE)
  if (!existsSync(file)) {
    console.log(`${line.id}: no words file`)
    continue
  }
  const words = JSON.parse(readFileSync(file, 'utf8'))
  console.log(`${line.id}\n  script: ${line.say ?? line.text}\n  heard:  ${words.map((w) => w.punctuated_word ?? w.word).join(' ')}`)
}
