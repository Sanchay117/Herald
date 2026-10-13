import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSpeech, VOICE_MODEL } from '../lib/server/speech.ts'

const MP3 = new Uint8Array([0xff, 0xf3, 0x44, 0xc4]).buffer

function fakeFetch(statuses: number[] = []) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const status = statuses.shift() ?? 200
    return new Response(status === 200 ? MP3 : 'error', { status })
  }) as typeof globalThis.fetch
  return { fetch, calls }
}

test('asks Deepgram for the sentence in Herald voice, with the key in the Authorization header', async () => {
  const { fetch, calls } = fakeFetch()
  const speech = createSpeech({ key: () => 'test-key', fetch })
  const audio = await speech.speak('Doorbell. Someone is at the front door.')
  assert.deepEqual(new Uint8Array(audio), new Uint8Array(MP3))
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url, `https://api.deepgram.com/v1/speak?model=${VOICE_MODEL}&encoding=mp3`)
  assert.equal(new Headers(calls[0]!.init.headers).get('Authorization'), 'Token test-key')
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { text: 'Doorbell. Someone is at the front door.' })
})

test('each sentence is synthesised once, even when asked for twice at the same moment', async () => {
  const { fetch, calls } = fakeFetch()
  const speech = createSpeech({ key: () => 'test-key', fetch })
  await Promise.all([speech.speak('Doorbell.'), speech.speak('Doorbell.')])
  await speech.speak('Doorbell.')
  await speech.speak('Package delivery at the front door.')
  assert.equal(calls.length, 2)
})

test('a failure is not cached, so the next alert tries again', async () => {
  const { fetch, calls } = fakeFetch([500, 200])
  const speech = createSpeech({ key: () => 'test-key', fetch })
  await assert.rejects(speech.speak('Doorbell.'), /Deepgram answered 500/)
  await speech.speak('Doorbell.')
  assert.equal(calls.length, 2)
})

test('configured follows the key, read on every call', () => {
  let key = ''
  const speech = createSpeech({ key: () => key, fetch: fakeFetch().fetch })
  assert.equal(speech.configured(), false)
  key = 'added-later'
  assert.equal(speech.configured(), true)
})
