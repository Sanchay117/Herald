import { Icon } from './Icon'

/** Browsers block speech and vibration until the person has interacted with the page once. */
export function ArmBanner({ onArm }: { onArm: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-warn bg-surface p-5">
      <span className="text-warn">
        <Icon name="alert" className="size-8" />
      </span>
      <p className="min-w-0 flex-1 text-lg">
        <strong>Spoken and vibration alerts are paused.</strong> Browsers only allow them after you tap the page once.
      </p>
      <button
        type="button"
        onClick={onArm}
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 py-3 text-lg font-bold text-accent-ink"
      >
        Turn on alerts
      </button>
    </div>
  )
}
