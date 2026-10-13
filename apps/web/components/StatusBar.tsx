import type { ReactNode } from 'react'
import type { RingStatus } from '@/hooks/useRingStatus'
import type { StreamConnection } from '@/hooks/useAlertStream'
import { Icon, type IconName } from './Icon'

type Tone = 'ok' | 'warn' | 'bad' | 'muted'

const TONE_CLASS: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  muted: 'text-muted',
}

// Status is never colour alone: each chip has an icon and words.
function Chip({ tone, icon, children }: { tone: Tone; icon: IconName; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-base">
      <span className={TONE_CLASS[tone]}>
        <Icon name={icon} className="size-5" />
      </span>
      <span>{children}</span>
    </li>
  )
}

function ringChip(status: RingStatus) {
  switch (status.state) {
    case 'loading':
      return <Chip tone="muted" icon="radio">Checking Ring…</Chip>
    case 'unconfigured':
      return <Chip tone="warn" icon="alert">Ring not connected</Chip>
    case 'error':
      return (
        <Chip tone="bad" icon="alert">
          {status.tokenProblem ? 'Ring token expired' : 'Ring unreachable'}
        </Chip>
      )
    case 'ok': {
      const device = status.devices[0]
      if (!device) return <Chip tone="warn" icon="alert">Ring connected, no devices</Chip>
      const offline = device.online === false
      return (
        <Chip tone={offline ? 'bad' : 'ok'} icon={offline ? 'cameraOff' : 'camera'}>
          {device.name}: {device.online === null ? 'status unknown' : offline ? 'offline' : 'online'}
          {status.devices.length > 1 && ` (+${status.devices.length - 1} more)`}
        </Chip>
      )
    }
  }
}

export function StatusBar({ ring, connection }: { ring: RingStatus; connection: StreamConnection }) {
  return (
    <ul aria-label="Connection status" className="flex flex-wrap gap-2">
      {ringChip(ring)}
      {connection === 'open' ? (
        <Chip tone="ok" icon="check">Receiving alerts</Chip>
      ) : (
        <Chip tone="warn" icon="radio">{connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</Chip>
      )}
    </ul>
  )
}
