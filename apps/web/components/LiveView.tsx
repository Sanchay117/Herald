'use client'

import { useEffect, useRef, useState } from 'react'
import { useWhepStream, type LiveState } from '@/hooks/useWhepStream'
import type { RingStatus } from '@/hooks/useRingStatus'
import { Icon } from './Icon'
import { TokenHelp } from './TokenHelp'

const STATE_TEXT: Record<LiveState, string> = {
  idle: 'Live view is off.',
  connecting: 'Connecting to the camera…',
  live: 'Live.',
  ended: 'The camera ended the stream.',
  error: 'Live view stopped.',
}

const PRIMARY = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-lg font-bold text-accent-ink disabled:opacity-50'
const SECONDARY = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface px-5 py-3 text-lg font-bold'

export function LiveView({ ring, door }: { ring: RingStatus; door: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { state, error, start, stop } = useWhepStream(videoRef)
  const devices = ring.state === 'ok' ? ring.devices : []
  const [deviceId, setDeviceId] = useState<string>('')

  useEffect(() => {
    if (!devices.some((d) => d.id === deviceId)) setDeviceId(devices[0]?.id ?? '')
  }, [devices, deviceId])

  const device = devices.find((d) => d.id === deviceId)
  const active = state === 'connecting' || state === 'live'

  return (
    <section aria-labelledby="live-heading" className="rounded-3xl border-2 border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="live-heading" className="text-xl font-bold">
          Live view
        </h2>
        {devices.length > 1 && (
          <label className="flex items-center gap-2 text-base">
            Camera
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              disabled={active}
              className="min-h-11 rounded-lg border-2 border-line bg-surface px-2"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {ring.state === 'unconfigured' || (ring.state === 'error' && ring.tokenProblem) ? (
        <div className="mt-4">
          <TokenHelp expired={ring.state === 'error'} />
        </div>
      ) : (
        <>
          <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label={`Live video from the ${door}${device ? ` (${device.name})` : ''}`}
              className="size-full object-contain"
            />
            {state !== 'live' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white">
                <Icon name={state === 'error' ? 'alert' : 'camera'} className="size-10" />
                <p className="text-lg">{STATE_TEXT[state]}</p>
              </div>
            )}
          </div>

          <p role="status" className="sr-only">
            {STATE_TEXT[state]}
          </p>
          {error && (
            <div className="mt-3 rounded-xl border-2 border-bad p-3 text-base">
              <p className="font-bold text-bad">{error.message}</p>
              {error.tokenProblem && (
                <div className="mt-2">
                  <TokenHelp expired />
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {active ? (
              <button type="button" onClick={stop} className={SECONDARY}>
                <Icon name="stop" className="size-5" />
                Stop live view
              </button>
            ) : (
              <button type="button" onClick={() => device && start(device.id)} disabled={!device} className={PRIMARY}>
                <Icon name="play" className="size-5" />
                Start live view
              </button>
            )}
          </div>

          {device?.name === 'Playground Device' && (
            <p className="mt-3 text-base text-muted">
              Ring Developer Playground: choose Package, Vehicle or Motion there first. The stream plays that clip.
            </p>
          )}
        </>
      )}
    </section>
  )
}
