const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatClock(ms: number): string {
  return clock.format(ms)
}

/** "just now", "3 minutes ago", "2 hours ago", "yesterday". */
export function formatAgo(ms: number, now: number): string {
  const seconds = Math.round((now - ms) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return relative.format(-seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return relative.format(-Math.round(hours / 24), 'day')
}
