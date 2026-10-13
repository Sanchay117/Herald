'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type LiveState = 'idle' | 'connecting' | 'live' | 'ended' | 'error'

export interface LiveError {
  message: string
  tokenProblem: boolean
}

interface StartResponse {
  sdpAnswer?: string
  sessionUrl?: string | null
  error?: string
  tokenProblem?: boolean
}

const ICE_TIMEOUT_MS = 3000
const DISCONNECT_GRACE_MS = 4000

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', check)
      resolve()
    }
    const check = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
    const timer = setTimeout(finish, ICE_TIMEOUT_MS)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

function endSession(sessionUrl: string) {
  void fetch('/api/ring/stream', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionUrl }),
    keepalive: true,
  }).catch(() => {})
}

/** Ring live view over WHEP. The browser makes the offer; /api/ring/stream adds the token and relays it. */
export function useWhepStream(videoRef: RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<LiveState>('idle')
  const [error, setError] = useState<LiveError | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const sessionUrlRef = useRef<string | null>(null)
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const teardown = useCallback(() => {
    clearTimeout(disconnectTimer.current)
    const pc = pcRef.current
    pcRef.current = null
    pc?.close()
    const sessionUrl = sessionUrlRef.current
    sessionUrlRef.current = null
    if (sessionUrl) endSession(sessionUrl)
    if (videoRef.current) videoRef.current.srcObject = null
  }, [videoRef])

  const stop = useCallback(() => {
    teardown()
    setError(null)
    setState('idle')
  }, [teardown])

  const start = useCallback(
    async (deviceId: string) => {
      teardown()
      setError(null)
      setState('connecting')

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      pcRef.current = pc
      const stale = () => pcRef.current !== pc

      const fail = (message: string, tokenProblem = false) => {
        if (stale()) return
        teardown()
        setError({ message, tokenProblem })
        setState('error')
      }
      const end = () => {
        if (stale()) return
        teardown()
        setState('ended')
      }

      // Ring sends video only, and documents a recvonly video transceiver with no audio.
      pc.addTransceiver('video', { direction: 'recvonly' })

      pc.addEventListener('track', (e) => {
        const video = videoRef.current
        if (stale() || !video) return
        video.srcObject = e.streams[0] ?? new MediaStream([e.track])
        void video.play().catch(() => {})
        e.track.addEventListener('ended', end)
        setState('live')
      })

      pc.addEventListener('connectionstatechange', () => {
        if (stale()) return
        clearTimeout(disconnectTimer.current)
        if (pc.connectionState === 'failed') fail('Lost the connection to the camera.')
        else if (pc.connectionState === 'closed') end()
        // "disconnected" can recover on its own; give it a moment before calling it over.
        else if (pc.connectionState === 'disconnected') disconnectTimer.current = setTimeout(end, DISCONNECT_GRACE_MS)
      })

      try {
        await pc.setLocalDescription(await pc.createOffer())
        await waitForIceGathering(pc)
        if (stale()) return

        const res = await fetch('/api/ring/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, sdpOffer: pc.localDescription?.sdp }),
        })
        const body = (await res.json().catch(() => ({}))) as StartResponse
        if (stale()) {
          if (body.sessionUrl) endSession(body.sessionUrl)
          return
        }
        if (!res.ok || !body.sdpAnswer) {
          fail(body.error ?? `Live view failed (HTTP ${res.status}).`, !!body.tokenProblem)
          return
        }
        sessionUrlRef.current = body.sessionUrl ?? null
        await pc.setRemoteDescription({ type: 'answer', sdp: body.sdpAnswer })
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Could not start live view.')
      }
    },
    [teardown, videoRef],
  )

  useEffect(() => teardown, [teardown])

  return { state, error, start, stop }
}
