'use client'

import { useCallback, useEffect, useRef } from 'react'

/** How long to wait for Herald's voice before the browser's built-in voice says the alert instead. */
const SERVER_VOICE_TIMEOUT_MS = 2500

// Ten milliseconds of silence. Playing it during a tap or key press unlocks the audio element, so
// browsers that only allow sound straight after a user gesture (Safari) let later alerts play too.
const SILENCE =
  'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='

/**
 * Speaks alerts in Herald's voice: Deepgram audio that the server synthesises and caches per
 * sentence. When the server has no voice, doesn't answer in time, or the browser won't play the
 * audio, the browser's built-in voice says the alert instead, so an alert is never silent.
 */
export function useVoice(rate: number) {
  const rateRef = useRef(rate)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cache = useRef(new Map<string, Promise<Blob | null>>())
  // Set to false when the server says it has no voice, so later alerts don't ask again.
  const serverVoice = useRef(true)
  const queue = useRef<Promise<void>>(Promise.resolve())
  // Bumped by an interruption: anything queued before it is dropped.
  const generation = useRef(0)

  useEffect(() => {
    rateRef.current = rate
  }, [rate])

  const element = useCallback(() => (audioRef.current ??= new Audio()), [])

  /** Call while handling a tap or key press. */
  const unlock = useCallback(() => {
    const audio = element()
    audio.src = SILENCE
    audio.play().catch(() => {})
  }, [element])

  const stop = useCallback(() => {
    generation.current++
    queue.current = Promise.resolve()
    audioRef.current?.pause()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  useEffect(() => stop, [stop])

  const fetchAudio = useCallback((text: string) => {
    let pending = cache.current.get(text)
    if (!pending) {
      pending = fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(SERVER_VOICE_TIMEOUT_MS),
      })
        .then((res) => {
          if (res.status === 503) serverVoice.current = false
          return res.ok ? res.blob() : null
        })
        .catch(() => null)
      cache.current.set(text, pending)
      void pending.then((blob) => {
        if (!blob) cache.current.delete(text)
      })
    }
    return pending
  }, [])

  /** Plays the audio to the end. False if the browser refused to play it. */
  const playAudio = useCallback(
    async (blob: Blob) => {
      const audio = element()
      const url = URL.createObjectURL(blob)
      try {
        audio.src = url
        // Loading a new source resets the rate, so set it afterwards.
        audio.defaultPlaybackRate = audio.playbackRate = rateRef.current
        await audio.play()
      } catch {
        URL.revokeObjectURL(url)
        return false
      }
      await new Promise<void>((resolve) => {
        const done = () => {
          audio.removeEventListener('pause', done)
          audio.removeEventListener('error', done)
          resolve()
        }
        // "pause" also fires when the audio reaches its end.
        audio.addEventListener('pause', done)
        audio.addEventListener('error', done)
      })
      URL.revokeObjectURL(url)
      return true
    },
    [element],
  )

  const browserVoice = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!('speechSynthesis' in window)) return resolve()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = rateRef.current
        utterance.lang = document.documentElement.lang || 'en'
        utterance.onend = utterance.onerror = () => resolve()
        // Some browsers never fire "end" for a cancelled utterance; don't let the queue stall on it.
        setTimeout(resolve, 4000 + text.length * 120)
        window.speechSynthesis.speak(utterance)
      }),
    [],
  )

  /** Says the text after anything already speaking, or straight away if `interrupt` is set. */
  const say = useCallback(
    (text: string, interrupt: boolean) => {
      if (interrupt) stop()
      const gen = generation.current
      const audio = serverVoice.current ? fetchAudio(text) : Promise.resolve(null)
      queue.current = queue.current
        .then(async () => {
          const blob = await audio
          if (gen !== generation.current) return
          if (blob && (await playAudio(blob))) return
          if (gen !== generation.current) return
          await browserVoice(text)
        })
        .catch(() => {})
    },
    [stop, fetchAudio, playAudio, browserVoice],
  )

  return { say, unlock }
}
