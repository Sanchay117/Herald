import { spokenPhrases } from '@/lib/alerts'
import { deepgramKey, doorLabel } from './config'
import { singleton } from './singleton'
import { createSpeech } from './speech'

export const speech = singleton('speech', () => createSpeech({ key: deepgramKey }))

const warm = singleton('speechWarm', () => ({ started: false }))

/**
 * Synthesises every sentence Herald can say, once per server run, so the first alert plays without
 * waiting for Deepgram. Called when a screen connects.
 */
export function warmSpeech(): void {
  if (warm.started || !speech.configured()) return
  warm.started = true
  for (const text of spokenPhrases(doorLabel())) speech.speak(text).catch(() => {})
}
