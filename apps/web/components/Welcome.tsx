'use client'

import { useState, type FormEvent } from 'react'
import type { Profile } from '@/lib/prefs'
import { ProfileOptions } from './ProfileOptions'

/**
 * First visit on this screen. The choice is confirmed with a button rather than saved on select:
 * arrow keys move through a radio group by selecting each option, so saving on select would close
 * this before a screen-reader user had heard every choice.
 */
export function Welcome({ onDone }: { onDone: (profile: Profile) => void }) {
  const [choice, setChoice] = useState<Profile | null>(null)

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (choice) onDone(choice)
  }

  // The radios are required, so submitting with nothing chosen gets the browser's own accessible prompt.
  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border-2 border-accent bg-surface p-6">
      <ProfileOptions value={choice} onSelect={setChoice} legend="Who will use Herald on this screen?" required />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 py-3 text-lg font-bold text-accent-ink"
        >
          Start using Herald
        </button>
        <p className="text-base text-muted">You can change this later under Alerts on this screen.</p>
      </div>
    </form>
  )
}
