import type { Alert } from '@/lib/alerts'
import { ALERT_STYLE } from '@/lib/alert-style'
import { formatAgo, formatClock } from '@/lib/time'
import { AlertIcon } from './Icon'

export function AlertFeed({ alerts, now }: { alerts: Alert[]; now: number }) {
  return (
    <section id="alerts" aria-labelledby="history-heading" tabIndex={-1} className="rounded-3xl border-2 border-line bg-surface p-6">
      <h2 id="history-heading" className="text-xl font-bold">
        History
      </h2>
      {alerts.length === 0 ? (
        <p className="mt-3 text-base text-muted">No alerts yet.</p>
      ) : (
        // Focusable so keyboard users can scroll it in every browser, not only those that make scrollers focusable.
        <ol tabIndex={0} aria-labelledby="history-heading" className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {alerts.map((alert) => {
            const style = ALERT_STYLE[alert.kind]
            return (
              <li key={alert.id} className="flex gap-3 rounded-2xl border-2 border-line p-3">
                <span className="h-fit rounded-xl p-2" style={{ background: style.flash, color: style.ink }}>
                  <AlertIcon kind={alert.kind} className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-snug">{alert.headline}</p>
                  {alert.description && <p className="text-base">{alert.description}</p>}
                  <p className="text-base text-muted">
                    <time dateTime={new Date(alert.occurredAt).toISOString()}>{formatClock(alert.occurredAt)}</time>
                    {now > 0 && ` · ${formatAgo(alert.occurredAt, now)}`}
                    {alert.simulated && ' · Simulated'}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
