'use client'

import { useId } from 'react'
import type { AlertKind, AlertPriority } from '@/lib/alerts'
import { ALERT_STYLE } from '@/lib/alert-style'
import { PROFILES, profilePatch, type Prefs } from '@/lib/prefs'
import { ProfileOptions } from './ProfileOptions'

type OutputKey = 'speak' | 'flash' | 'vibrate' | 'announce'

const OUTPUTS: { key: OutputKey; label: string; hint: string }[] = [
  { key: 'flash', label: 'Flash the screen', hint: 'Full-screen colour that stays until you dismiss it. Pulses gently; steady if your device is set to reduce motion.' },
  { key: 'vibrate', label: 'Vibrate', hint: 'A different rhythm for each kind of event. Android phones and tablets.' },
  { key: 'speak', label: 'Speak alerts', hint: 'Herald reads each alert aloud. If you use a screen reader, turn this off to avoid hearing alerts twice.' },
  { key: 'announce', label: 'Screen reader announcements', hint: 'Alerts are announced by VoiceOver, TalkBack, NVDA or JAWS, and shown on braille displays.' },
]

const PRIORITY_OPTIONS: { value: AlertPriority; label: string }[] = [
  { value: 'urgent', label: 'Doorbell and camera problems only' },
  { value: 'normal', label: 'Doorbell, people and packages (recommended)' },
  { value: 'info', label: 'Everything, including cars and movement' },
]

export function PrefsPanel({
  prefs,
  onChange,
  onTest,
}: {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onTest: () => void
}) {
  const id = useId()

  // Changing an output by hand makes this a custom setup.
  const setOutput = (key: OutputKey, value: boolean) => {
    const next = { ...prefs, [key]: value }
    const matchesProfile =
      prefs.profile && prefs.profile !== 'custom' && OUTPUTS.every(({ key: k }) => PROFILES[prefs.profile as keyof typeof PROFILES].outputs[k] === next[k])
    onChange({ [key]: value, profile: matchesProfile ? prefs.profile : 'custom' })
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-6 rounded-3xl border-2 border-line bg-surface p-6">
      <h2 id={`${id}-heading`} className="text-xl font-bold">
        Alerts on this screen
      </h2>

      <ProfileOptions value={prefs.profile} onSelect={(profile) => onChange(profilePatch(profile))} legend="Who uses this screen?" />

      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-bold">Outputs</legend>
        {OUTPUTS.map((output) => (
          <div key={output.key} className="flex gap-3">
            <input
              id={`${id}-${output.key}`}
              type="checkbox"
              checked={prefs[output.key]}
              onChange={(e) => setOutput(output.key, e.target.checked)}
              aria-describedby={`${id}-${output.key}-hint`}
              className="mt-0.5 size-6 shrink-0 accent-accent"
            />
            <div>
              <label htmlFor={`${id}-${output.key}`} className="text-lg font-bold">
                {output.label}
              </label>
              <p id={`${id}-${output.key}-hint`} className="text-base text-muted">
                {output.hint}
              </p>
            </div>
          </div>
        ))}
      </fieldset>

      <div className="space-y-2">
        <label htmlFor={`${id}-priority`} className="block text-lg font-bold">
          Interrupt me for
        </label>
        <select
          id={`${id}-priority`}
          value={prefs.minPriority}
          onChange={(e) => onChange({ minPriority: e.target.value as AlertPriority })}
          className="min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-base text-muted">Everything still appears in History.</p>
      </div>

      {prefs.speak && (
        <div className="space-y-2">
          <label htmlFor={`${id}-rate`} className="block text-lg font-bold">
            Voice speed: {prefs.voiceRate.toFixed(1)}×
          </label>
          <input
            id={`${id}-rate`}
            type="range"
            min={0.7}
            max={1.5}
            step={0.1}
            value={prefs.voiceRate}
            onChange={(e) => onChange({ voiceRate: Number(e.target.value) })}
            className="h-8 w-full accent-accent"
          />
        </div>
      )}

      <button
        type="button"
        onClick={onTest}
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 py-3 text-lg font-bold text-accent-ink"
      >
        Try a test alert
      </button>

      <details className="rounded-2xl border-2 border-line p-4">
        <summary className="cursor-pointer text-lg font-bold">Vibration rhythms</summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          {(Object.keys(ALERT_STYLE) as AlertKind[]).map((kind) => (
            <div key={kind} className="contents">
              <dt className="font-bold">{ALERT_STYLE[kind].label}</dt>
              <dd>{ALERT_STYLE[kind].rhythm}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}
