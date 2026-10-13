import type { Alert } from '@/lib/alerts'
import { ALERT_STYLE } from '@/lib/alert-style'
import { formatAgo, formatClock } from '@/lib/time'
import { AlertIcon, Icon } from './Icon'

/**
 * The big card: what is happening at the door right now. Its heading takes focus (tabIndex -1)
 * when the control someone just used goes away, so focus never drops to the page body.
 */
export function LatestAlert({ alert, door, now }: { alert: Alert | undefined; door: string; now: number }) {
  if (!alert) {
    return (
      <section aria-labelledby="latest-heading" className="rounded-3xl border-2 border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="rounded-2xl bg-canvas p-4 text-muted">
            <Icon name="bell" className="size-10" />
          </span>
          <div>
            <h2 id="latest-heading" tabIndex={-1} className="text-3xl font-bold">
              All quiet at the {door}
            </h2>
            <p className="mt-1 text-lg text-muted">Herald is listening for Ring events.</p>
          </div>
        </div>
      </section>
    )
  }

  const style = ALERT_STYLE[alert.kind]
  return (
    <section aria-labelledby="latest-heading" className="overflow-hidden rounded-3xl border-2 border-line bg-surface">
      <div className="alert-surface flex items-center gap-4 p-6 sm:p-8" style={{ background: style.flash, color: style.ink }}>
        <AlertIcon kind={alert.kind} className="size-14 shrink-0" />
        <div>
          <p className="text-base font-bold uppercase tracking-wide">Latest</p>
          <h2 id="latest-heading" tabIndex={-1} className="text-3xl font-bold text-balance sm:text-4xl">
            {alert.headline}
          </h2>
        </div>
      </div>
      <div className="space-y-2 p-6 sm:px-8">
        {alert.detail && <p className="text-xl">{alert.detail}</p>}
        {alert.description && <p className="text-xl">{alert.description}</p>}
        <p className="text-lg text-muted">
          <time dateTime={new Date(alert.occurredAt).toISOString()}>{formatClock(alert.occurredAt)}</time>
          {now > 0 && ` · ${formatAgo(alert.occurredAt, now)}`}
          {alert.simulated && ' · Simulated'}
        </p>
      </div>
    </section>
  )
}
