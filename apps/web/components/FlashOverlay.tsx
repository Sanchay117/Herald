'use client'

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { Alert } from '@/lib/alerts'
import { ALERT_STYLE } from '@/lib/alert-style'
import { formatClock } from '@/lib/time'
import { AlertIcon } from './Icon'

/**
 * Full-screen colour alert for people who can't hear the chime. The margins pulse slowly (well under
 * the WCAG 2.3.1 limit of three flashes a second) while the text stays on a solid panel; it holds
 * steady with "reduce motion" on, and stays up until dismissed so a glance from across the room still catches it.
 */
export function FlashOverlay({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const style = ALERT_STYLE[alert.kind]
  const dismissRef = useRef<HTMLButtonElement>(null)

  // Focus Dismiss before the browser paints, so focus never drops to the page body when the rest of
  // the page turns inert. useAlertOutputs puts focus back afterwards.
  useLayoutEffect(() => {
    dismissRef.current?.focus()
  }, [alert.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="flash-headline"
      aria-describedby={alert.detail ? 'flash-detail' : undefined}
      className="herald-flash alert-surface fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10"
      style={{ '--flash-bg': style.flash, color: style.ink } as CSSProperties}
    >
      <div className="herald-flash-panel flex w-full max-w-4xl flex-col items-center gap-6 rounded-[2rem] px-6 py-10 text-center">
        <AlertIcon kind={alert.kind} className="size-28 sm:size-36" />
        <h2 id="flash-headline" className="text-5xl font-bold text-balance sm:text-7xl">
          {alert.headline}
        </h2>
        {alert.detail && (
          <p id="flash-detail" className="max-w-3xl text-2xl text-balance sm:text-4xl">
            {alert.detail}
          </p>
        )}
        <p className="text-xl font-bold sm:text-2xl">
          {formatClock(alert.occurredAt)}
          {alert.simulated && ' · Simulated'}
        </p>
        <button
          ref={dismissRef}
          type="button"
          onClick={onDismiss}
          className="mt-4 min-h-14 rounded-2xl border-4 border-current px-10 py-3 text-2xl font-bold"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
