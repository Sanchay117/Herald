import type { AlertPriority } from './alerts'

export type Profile = 'deaf' | 'blind' | 'deafblind' | 'custom'

export interface Prefs {
  /** null until the person picks who this screen is for. */
  profile: Profile | null
  /** Herald reads alerts aloud (Web Speech). */
  speak: boolean
  /** Full-screen colour flash that stays until dismissed. */
  flash: boolean
  /** Vibration rhythm per event (Android phones and tablets). */
  vibrate: boolean
  /** Screen-reader announcements through ARIA live regions (and so braille displays). */
  announce: boolean
  /** Alerts below this priority are listed but don't interrupt. */
  minPriority: AlertPriority
  /** Speech rate, 0.7 to 1.5. */
  voiceRate: number
}

export const DEFAULT_PREFS: Prefs = {
  profile: null,
  speak: true,
  flash: true,
  vibrate: true,
  announce: true,
  minPriority: 'normal',
  voiceRate: 1,
}

type Outputs = Pick<Prefs, 'speak' | 'flash' | 'vibrate' | 'announce'>

export const PROFILES: Record<Exclude<Profile, 'custom'>, { title: string; summary: string; outputs: Outputs }> = {
  deaf: {
    title: 'Deaf or hard of hearing',
    summary: 'Full-screen flash, vibration and captions. No voice.',
    outputs: { speak: false, flash: true, vibrate: true, announce: true },
  },
  blind: {
    title: 'Blind or low vision',
    summary: 'Spoken alerts and screen-reader announcements. No flashing.',
    outputs: { speak: true, flash: false, vibrate: true, announce: true },
  },
  deafblind: {
    title: 'Deafblind',
    summary: 'A different vibration rhythm for each event, plus text your screen reader can send to a braille display.',
    outputs: { speak: false, flash: false, vibrate: true, announce: true },
  },
}

/** The settings change when someone picks a profile. "Choose myself" keeps the current outputs. */
export function profilePatch(profile: Profile): Partial<Prefs> {
  return profile === 'custom' ? { profile } : { profile, ...PROFILES[profile].outputs }
}

const PRIORITIES: AlertPriority[] = ['urgent', 'normal', 'info']
const PROFILE_VALUES: Profile[] = ['deaf', 'blind', 'deafblind', 'custom']

/** Accept only well-typed fields from storage, so a stale or hand-edited value can't break the app. */
export function sanitizePrefs(value: unknown): Prefs {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const bool = (key: keyof Prefs) => (typeof v[key] === 'boolean' ? (v[key] as boolean) : (DEFAULT_PREFS[key] as boolean))
  const rate = typeof v.voiceRate === 'number' && Number.isFinite(v.voiceRate) ? Math.min(1.5, Math.max(0.7, v.voiceRate)) : 1
  return {
    profile: PROFILE_VALUES.includes(v.profile as Profile) ? (v.profile as Profile) : null,
    speak: bool('speak'),
    flash: bool('flash'),
    vibrate: bool('vibrate'),
    announce: bool('announce'),
    minPriority: PRIORITIES.includes(v.minPriority as AlertPriority) ? (v.minPriority as AlertPriority) : 'normal',
    voiceRate: rate,
  }
}
