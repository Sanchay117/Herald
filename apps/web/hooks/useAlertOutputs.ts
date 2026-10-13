'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { meetsPriority, type Alert } from '@/lib/alerts'
import { ALERT_STYLE } from '@/lib/alert-style'
import type { Prefs } from '@/lib/prefs'

/**
 * Turns an alert into whatever this screen's person can perceive: speech, vibration,
 * a full-screen flash, and screen-reader announcements (which also reach braille displays).
 */
export function useAlertOutputs(prefs: Prefs) {
  // Browsers allow speech and vibration only after the person has interacted with the page.
  const [armed, setArmed] = useState(false)
  const [flashAlert, setFlashAlert] = useState<Alert | null>(null)
  const [assertive, setAssertive] = useState('')
  const [polite, setPolite] = useState('')
  const announceTimer = useRef<number | undefined>(undefined)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const activation = navigator.userActivation
    if (activation?.hasBeenActive) {
      setArmed(true)
      return
    }
    // Listen for click, not pointerdown: hiding the banner shifts the layout, and doing that
    // mid-click would move the target out from under the pointer. Window listeners run after
    // the clicked element has handled the event.
    function onInteract(e: Event) {
      // Count only input the browser itself treats as user activation.
      if (activation ? !activation.hasBeenActive : e instanceof KeyboardEvent && e.key === 'Escape') return
      setArmed(true)
      stopListening()
    }
    function stopListening() {
      window.removeEventListener('click', onInteract)
      window.removeEventListener('keydown', onInteract)
    }
    window.addEventListener('click', onInteract)
    window.addEventListener('keydown', onInteract)
    return stopListening
  }, [])

  useEffect(() => () => window.clearTimeout(announceTimer.current), [])

  // Once the flash is gone and the page is interactive again, put focus back where the person was.
  useEffect(() => {
    if (flashAlert !== null) return
    const target = returnFocus.current
    returnFocus.current = null
    if (target?.isConnected) target.focus()
  }, [flashAlert])

  const speak = useCallback(
    (text: string, interrupt: boolean) => {
      if (!('speechSynthesis' in window)) return
      if (interrupt) window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = prefs.voiceRate
      utterance.lang = document.documentElement.lang || 'en'
      window.speechSynthesis.speak(utterance)
    },
    [prefs.voiceRate],
  )

  const vibrate = useCallback((pattern: number[]) => {
    if ('vibrate' in navigator) navigator.vibrate(pattern)
  }, [])

  const announce = useCallback((text: string, urgent: boolean) => {
    const set = urgent ? setAssertive : setPolite
    // Empty the region first so the same text twice in a row is announced again.
    set('')
    window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => set(text), 120)
  }, [])

  /** Run every output this screen has enabled, ignoring the priority filter. */
  const present = useCallback(
    (alert: Alert) => {
      const urgent = alert.priority === 'urgent'
      if (prefs.announce) announce(alert.spoken, urgent)
      if (prefs.flash) {
        // Note the focused element now: the flash makes the page inert, and the browser moves
        // focus off inert content at the next frame, before any effect could read it.
        if (!returnFocus.current && document.activeElement instanceof HTMLElement) {
          returnFocus.current = document.activeElement
        }
        setFlashAlert(alert)
      }
      if (prefs.vibrate) vibrate(ALERT_STYLE[alert.kind].vibration)
      if (prefs.speak) speak(alert.spoken, urgent)
    },
    [prefs, announce, vibrate, speak],
  )

  const notify = useCallback(
    (alert: Alert) => {
      if (meetsPriority(alert.priority, prefs.minPriority)) present(alert)
    },
    [prefs.minPriority, present],
  )

  const arm = useCallback(() => {
    setArmed(true)
    if (prefs.speak) speak('Herald alerts are on.', true)
    if (prefs.vibrate) vibrate([80])
  }, [prefs.speak, prefs.vibrate, speak, vibrate])

  const dismissFlash = useCallback(() => setFlashAlert(null), [])

  return { armed, arm, notify, present, announce, flashAlert, dismissFlash, assertive, polite }
}
