/** Herald's voice: Deepgram Aura-2 Orion, a calm voice that is easy to follow at speed. */
export const VOICE_MODEL = 'aura-2-orion-en'

const TIMEOUT_MS = 8000

export interface SpeechOptions {
  /** Read on every request, like the Ring token, so a key added to .env.local works without a restart. */
  key: () => string
  model?: string
  fetch?: typeof fetch
}

/**
 * Text to speech with a cache per sentence. Herald only ever says a handful of sentences, so each is
 * synthesised once and then served from memory. A failure is not cached: the next alert tries again.
 */
export function createSpeech({ key, model = VOICE_MODEL, fetch: fetchImpl = fetch }: SpeechOptions) {
  const cache = new Map<string, Promise<ArrayBuffer>>()

  async function synthesize(text: string): Promise<ArrayBuffer> {
    const res = await fetchImpl(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`, {
      method: 'POST',
      headers: { Authorization: `Token ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`Deepgram answered ${res.status}`)
    return res.arrayBuffer()
  }

  return {
    configured: () => key() !== '',
    /** MP3 audio of the sentence. */
    speak(text: string): Promise<ArrayBuffer> {
      let audio = cache.get(text)
      if (!audio) {
        audio = synthesize(text)
        cache.set(text, audio)
        audio.catch(() => cache.delete(text))
      }
      return audio
    },
  }
}
