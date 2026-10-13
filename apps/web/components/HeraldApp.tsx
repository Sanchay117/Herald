'use client'

import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useAlertOutputs } from '@/hooks/useAlertOutputs'
import { useAlertStream } from '@/hooks/useAlertStream'
import { useNow } from '@/hooks/useNow'
import { usePrefs } from '@/hooks/usePrefs'
import { useRingStatus } from '@/hooks/useRingStatus'
import type { Alert } from '@/lib/alerts'
import { PROFILES, profilePatch, type Profile } from '@/lib/prefs'
import { AlertFeed } from './AlertFeed'
import { ArmBanner } from './ArmBanner'
import { FlashOverlay } from './FlashOverlay'
import { Icon } from './Icon'
import { LatestAlert } from './LatestAlert'
import { LiveRegions } from './LiveRegions'
import { LiveView } from './LiveView'
import { PrefsPanel } from './PrefsPanel'
import { SimulatorPanel } from './SimulatorPanel'
import { StatusBar } from './StatusBar'
import { Welcome } from './Welcome'

// When the control someone just used goes away, focus the door status instead of letting focus drop
// to the page body, which would send a screen reader back to the top of the page.
function focusDoorStatus() {
  document.getElementById('latest-heading')?.focus()
}

export function HeraldApp({ door, simulator }: { door: string; simulator: boolean }) {
  const { prefs, update, loaded } = usePrefs()
  const outputs = useAlertOutputs(prefs)
  const { alerts, connection } = useAlertStream(outputs.notify)
  const { status: ring } = useRingStatus()
  const now = useNow()
  const { arm, announce } = outputs

  const finishSetup = useCallback(
    (profile: Profile) => {
      flushSync(() => update(profilePatch(profile)))
      focusDoorStatus()
      announce(
        profile === 'custom'
          ? 'Herald is set up. Choose each output under Alerts on this screen.'
          : `Herald is set up. Profile: ${PROFILES[profile].title}.`,
        false,
      )
    },
    [update, announce],
  )

  const armFromBanner = useCallback(() => {
    flushSync(arm)
    focusDoorStatus()
  }, [arm])

  const testAlert = useCallback(() => {
    const at = Date.now()
    const test: Alert = {
      id: `test-${at}`,
      eventId: `test-${at}`,
      kind: 'doorbell',
      priority: 'urgent',
      headline: 'Doorbell',
      detail: `This is a test. Someone is at the ${door}.`,
      spoken: `This is a test. Doorbell. Someone is at the ${door}.`,
      deviceId: 'test',
      occurredAt: at,
      receivedAt: at,
      simulated: true,
    }
    outputs.present(test)
  }, [door, outputs])

  const needsArming = loaded && (prefs.speak || prefs.vibrate) && !outputs.armed

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* While the flash is up, everything else is inert so focus stays on Dismiss. */}
      <div inert={outputs.flashAlert !== null}>
        <a href="#alerts" className="skip-link">
          Skip to alert history
        </a>

        <header className="border-b-2 border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-accent p-2 text-accent-ink">
                <Icon name="bell" className="size-7" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight">Herald</h1>
                <p className="text-base text-muted">Your Ring doorbell, for every sense</p>
              </div>
            </div>
            <StatusBar ring={ring} connection={connection} />
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
          {needsArming && <ArmBanner onArm={armFromBanner} />}

          {loaded && prefs.profile === null && <Welcome onDone={finishSetup} />}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="min-w-0 space-y-6">
              <LatestAlert alert={alerts[0]} door={door} now={now} />
              <LiveView ring={ring} door={door} />
            </div>
            <div className="min-w-0 space-y-6">
              <AlertFeed alerts={alerts} now={now} />
              {simulator && <SimulatorPanel />}
              <PrefsPanel prefs={prefs} onChange={update} onTest={testAlert} />
            </div>
          </div>
        </main>
      </div>

      <LiveRegions assertive={outputs.assertive} polite={outputs.polite} />
      {outputs.flashAlert && <FlashOverlay alert={outputs.flashAlert} onDismiss={outputs.dismissFlash} />}
    </div>
  )
}
