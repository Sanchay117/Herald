'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PREFS, sanitizePrefs, type Prefs } from '@/lib/prefs'

const STORAGE_KEY = 'herald.prefs.v1'

/** Per-screen preferences. A TV and a phone in the same home can be set up differently. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPrefs(sanitizePrefs(JSON.parse(raw)))
    } catch {
      // Storage blocked or corrupt: keep defaults.
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Private mode or storage disabled: preferences last for this visit only.
    }
  }, [prefs, loaded])

  const update = useCallback((patch: Partial<Prefs>) => setPrefs((prev) => ({ ...prev, ...patch })), [])

  return { prefs, update, loaded }
}
