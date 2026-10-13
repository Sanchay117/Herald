'use client'

import { useId } from 'react'
import { PROFILES, type Profile } from '@/lib/prefs'

const OPTIONS: { value: Profile; title: string; summary: string }[] = [
  ...Object.entries(PROFILES).map(([value, p]) => ({ value: value as Profile, title: p.title, summary: p.summary })),
  { value: 'custom', title: 'Choose myself', summary: 'Pick each output below.' },
]

/** Native radio buttons styled as cards, so keyboard and screen-reader behaviour comes for free. */
export function ProfileOptions({
  value,
  onSelect,
  legend,
  required = false,
}: {
  value: Profile | null
  onSelect: (profile: Profile) => void
  legend: string
  required?: boolean
}) {
  const name = useId()
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-xl font-bold">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const id = `${name}-${option.value}`
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex cursor-pointer gap-3 rounded-2xl border-2 border-line bg-surface p-4 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent"
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                required={required}
                checked={value === option.value}
                onChange={() => onSelect(option.value)}
                className="mt-0.5 size-6 shrink-0 accent-accent"
              />
              <span>
                <span className="block text-lg font-bold">{option.title}</span>
                <span className="block text-base text-muted">{option.summary}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
