'use client'

import { useEffect, useState } from 'react'

/** Current time, refreshed on an interval, for "3 minutes ago" labels. 0 until mounted (avoids hydration mismatch). */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
