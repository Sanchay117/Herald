import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Audio, Easing, Freeze, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { CLIPS, line, part, sec, type SceneId } from './data'
import { C, FPS, MONO, SANS } from './theme'

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export const EASE = Easing.bezier(0.33, 0.7, 0.2, 1)
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1)

/** 0 to 1 spring that starts at `delay` frames. */
export function usePop(delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140, mass: 0.9, ...config } })
}

/** 0 to 1 eased progress between two frames. */
export function useProgress(from: number, to: number, easing = EASE) {
  const frame = useCurrentFrame()
  return interpolate(frame, [from, to], [0, 1], { ...clamp, easing })
}

/** 1 while `frame` is inside [from, to), with eased ramps of `ramp` frames on both sides. */
export function inside(frame: number, from: number, to: number, ramp = 8) {
  if (ramp <= 0) return frame >= from && frame < to ? 1 : 0
  return interpolate(frame, [from - ramp, from, to, to + ramp], [0, 1, 1, 0], { ...clamp, easing: EASE_IN_OUT })
}

/**
 * Shows its children from `from` to `to` (scene frames), fading over `fade` frames. Unlike a
 * Sequence it doesn't shift time, so children keep using the scene's own frame numbers.
 */
export function Show({ from, to, fade = 6, children, style }: { from: number; to: number; fade?: number; children: ReactNode; style?: CSSProperties }) {
  const frame = useCurrentFrame()
  const o = inside(frame, from, to, fade)
  if (o <= 0) return null
  return <AbsoluteFill style={{ opacity: o, ...style }}>{children}</AbsoluteFill>
}

/** A sound effect from public/sfx, starting at scene frame `at`. */
export function Sfx({ id, at, volume = 0.6 }: { id: string; at: number; volume?: number }) {
  return (
    <Sequence from={at} durationInFrames={160} layout="none">
      <Audio src={staticFile(`sfx/${id}.wav`)} volume={volume} />
    </Sequence>
  )
}

// ------------------------------------------------------------------------------------ backdrop

/** Herald's dark canvas: a slow dot grid, two drifting glows in `hue`, and a vignette. */
export function Backdrop({ hue = C.accent, hue2 = C.accentDeep, children, grid = true }: { hue?: string; hue2?: string; children?: ReactNode; grid?: boolean }) {
  const frame = useCurrentFrame()
  const a = frame / 100
  return (
    <AbsoluteFill style={{ background: C.canvas, fontFamily: SANS, color: C.ink, overflow: 'hidden' }}>
      {grid && (
        <AbsoluteFill
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.13) 1.3px, transparent 1.3px)',
            backgroundSize: '40px 40px',
            backgroundPosition: `${(frame * 0.3) % 40}px ${(frame * 0.18) % 40}px`,
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, black, transparent)',
          }}
        />
      )}
      <div style={{ position: 'absolute', width: 1300, height: 1300, left: 980 + Math.sin(a) * 140, top: -560 + Math.cos(a * 0.8) * 90, background: `radial-gradient(closest-side, ${hue}30, transparent)` }} />
      <div style={{ position: 'absolute', width: 1100, height: 1100, left: -420 + Math.cos(a * 0.7) * 120, top: 380 + Math.sin(a * 0.9) * 80, background: `radial-gradient(closest-side, ${hue2}40, transparent)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 95% 85% at 50% 50%, transparent 55%, rgba(0,0,0,0.6))' }} />
      {children}
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------ icons

// Stroke icons drawn on a 24-unit grid. Herald's own icons (bell, person, package, car, motion,
// camera) use Lucide's path data, as the app does; the rest follow the same style.
const PATHS: Record<string, ReactNode> = {
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  package: (
    <>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  car: (
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  motion: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  cameraOff: (
    <>
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
      <path d="m2 2 20 20" />
    </>
  ),
  camera: (
    <>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  ear: (
    <>
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
      <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />
    </>
  ),
  earOff: (
    <>
      <path d="M6 18.5a3.5 3.5 0 1 0 7 0c0-1.57.92-2.52 2.04-3.46" />
      <path d="M6 8.5c0-.75.13-1.47.36-2.14" />
      <path d="M8.8 3.15A6.5 6.5 0 0 1 19 8.5c0 1.63-.44 2.81-1.09 3.76" />
      <path d="M12.5 6A2.5 2.5 0 0 1 15 8.5M10 13a2 2 0 0 0 1.82-1.18" />
      <path d="m2 2 20 20" />
    </>
  ),
  eye: (
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </>
  ),
  eyeClosed: (
    <>
      <path d="m15 18-.722-3.25" />
      <path d="M2 8a10.645 10.645 0 0 0 20 0" />
      <path d="m20 15-1.726-2.05" />
      <path d="m4 15 1.726-2.05" />
      <path d="m9 18 .722-3.25" />
    </>
  ),
  hand: (
    <>
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </>
  ),
  volumeX: (
    <>
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="m22 9-6 6" />
      <path d="m16 9 6 6" />
    </>
  ),
  volume: (
    <>
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M2 14h4M10 8h4M18 16h4" />
    </>
  ),
  smartphone: (
    <>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </>
  ),
  tv: (
    <>
      <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
      <path d="m17 2-5 5-5-5" />
    </>
  ),
  laptop: <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />,
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  server: (
    <>
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <path d="M6 6h.01M6 18h.01" />
    </>
  ),
  cloud: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </>
  ),
  keyboard: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
    </>
  ),
  vibrate: (
    <>
      <path d="m2 8 2 2-2 2 2 2-2 2" />
      <path d="m22 8-2 2 2 2-2 2 2 2" />
      <rect width="8" height="14" x="8" y="5" rx="1" />
    </>
  ),
  fileText: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8M16 13H8M16 17H8" />
    </>
  ),
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  radio: (
    <>
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    </>
  ),
  play: <path d="M6 3l14 9-14 9V3z" />,
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  code: (
    <>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </>
  ),
  zap: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 48, color = 'currentColor', stroke = 2, style }: { name: IconName; size?: number; color?: string; stroke?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, overflow: 'visible', ...style }}>
      {PATHS[name]}
    </svg>
  )
}

export const KIND_ICON = { doorbell: 'bell', person: 'person', package: 'package', vehicle: 'car', motion: 'motion', camera_offline: 'cameraOff', camera_online: 'camera' } as const

/** Herald's app icon: a blue tile with a white bell (apps/web/app/icon.svg). */
export function Logo({ size = 160, glow = 0, ring = 0 }: { size?: number; glow?: number; ring?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${size * 0.25 * glow}px ${C.accent}aa)` : undefined }}>
      <defs>
        <linearGradient id="herald-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a55d4" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#herald-tile)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" transform={`translate(4 4) rotate(${ring * 14} 12 3)`}>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </g>
    </svg>
  )
}

// ------------------------------------------------------------------------------------ text

/** Small uppercase label above a headline. */
export function Kicker({ children, delay = 0, color = C.accent, style }: { children: ReactNode; delay?: number; color?: string; style?: CSSProperties }) {
  const p = usePop(delay)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontSize: 26, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color, opacity: p, transform: `translateY(${(1 - p) * 16}px)`, ...style }}>
      <span style={{ width: 11, height: 11, borderRadius: 99, background: color, boxShadow: `0 0 16px ${color}` }} />
      {children}
    </div>
  )
}

/** Words that rise and sharpen in one after another from `delay`. */
export function Words({ text, delay = 0, stagger = 3, size = 72, weight = 700, color = C.ink, accent = [], accentColor = C.focus, style }: { text: string; delay?: number; stagger?: number; size?: number; weight?: number; color?: string; accent?: string[]; accentColor?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{ fontSize: size, fontWeight: weight, lineHeight: 1.12, letterSpacing: '-0.01em', color, ...style }}>
      {text.split(' ').map((w, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 20, stiffness: 160 } })
        const key = w.toLowerCase().replace(/[^a-z0-9]/g, '')
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '0.26em', opacity: p, transform: `translateY(${(1 - p) * 0.4}em)`, filter: `blur(${(1 - p) * 8}px)`, color: accent.includes(key) ? accentColor : undefined }}>
            {w}
          </span>
        )
      })}
    </div>
  )
}

/**
 * A narrated line set in big type, each word appearing as it's spoken (word timings from the
 * voice file). Used where the words are the picture, in place of a caption.
 */
export function Spoken({ sceneId, lineId, size = 92, accent = [], accentColor = C.focus, style, align = 'center', first = 0, color = C.ink }: { sceneId: SceneId; lineId: string; size?: number; accent?: string[]; accentColor?: string; style?: CSSProperties; align?: 'center' | 'left'; first?: number; color?: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const at = part(sceneId, lineId).at
  const shown = line(lineId).text.split(' ')
  const words = line(lineId).words
  return (
    <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.14, letterSpacing: '-0.01em', textAlign: align, ...style }}>
      {shown.map((w, i) => {
        if (i < first) return null
        const start = at + sec(words[Math.min(i, words.length - 1)].s) - 2
        const p = spring({ frame: frame - start, fps, config: { damping: 22, stiffness: 190 } })
        const key = w.toLowerCase().replace(/[^a-z0-9]/g, '')
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '0.26em', opacity: p, transform: `translateY(${(1 - p) * 0.3}em) scale(${0.96 + 0.04 * p})`, filter: `blur(${(1 - p) * 10}px)`, color: accent.includes(key) ? accentColor : color }}>
            {w}
          </span>
        )
      })}
    </div>
  )
}

/** A number that counts up between two frames. */
export function Counter({ value, from, to, format = (n) => Math.round(n).toLocaleString('en-US'), style }: { value: number; from: number; to: number; format?: (n: number) => string; style?: CSSProperties }) {
  const p = useProgress(from, to, Easing.bezier(0.16, 1, 0.3, 1))
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{format(value * p)}</span>
}

/** Pill with a coloured dot, popping in at `delay`. */
export function Chip({ children, color, delay = 0, size = 28, style }: { children: ReactNode; color: string; delay?: number; size?: number; style?: CSSProperties }) {
  const p = usePop(delay, { damping: 14, stiffness: 180 })
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.45, padding: `${size * 0.38}px ${size * 0.7}px`, borderRadius: 999, border: `2px solid ${color}88`, background: `${color}1c`, fontSize: size, fontWeight: 700, color: C.ink, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 24}px) scale(${0.86 + 0.14 * p})`, whiteSpace: 'nowrap', ...style }}>
      <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: 99, background: color, boxShadow: `0 0 14px ${color}` }} />
      {children}
    </div>
  )
}

/** A keyboard key that dips when pressed at frame `pressAt`. */
export function Keycap({ label, pressAt, size = 64 }: { label: string; pressAt: number; size?: number }) {
  const frame = useCurrentFrame()
  const t = frame - pressAt
  const down = t >= 0 && t < 7 ? 1 - t / 7 : 0
  const lit = interpolate(t, [0, 2, 26], [0, 1, 0.35], clamp)
  return (
    <div style={{ minWidth: size * 1.6, height: size, padding: `0 ${size * 0.35}px`, borderRadius: size * 0.2, display: 'grid', placeItems: 'center', fontFamily: MONO, fontWeight: 700, fontSize: size * 0.36, color: t >= 0 ? C.canvas : C.ink, background: t >= 0 ? C.focus : C.surface2, border: `2px solid ${t >= 0 ? C.focus : C.line}`, boxShadow: `0 ${6 - down * 5}px 0 ${t >= 0 ? '#a8862f' : '#000'}, 0 0 ${40 * lit}px ${C.focus}`, transform: `translateY(${down * 5}px)` }}>
      {label}
    </div>
  )
}

// ------------------------------------------------------------------------------------ frames

/** A browser window around recorded footage of Herald. */
export function BrowserFrame({ width, height, url = 'localhost:3000', children, style }: { width: number; height: number; url?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ width, borderRadius: 20, overflow: 'hidden', border: `1.5px solid rgba(255,255,255,0.16)`, background: C.surface, boxShadow: '0 60px 140px -40px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)', ...style }}>
      <div style={{ height: 50, display: 'flex', alignItems: 'center', gap: 9, padding: '0 20px', background: C.surface2, borderBottom: `1px solid ${C.lineSoft}` }}>
        {['#6b7280', '#6b7280', '#6b7280'].map((c, i) => (
          <span key={i} style={{ width: 13, height: 13, borderRadius: 99, background: c, opacity: 0.7 }} />
        ))}
        <div style={{ marginLeft: 18, width: 520, height: 32, borderRadius: 9, background: C.canvas, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', fontFamily: MONO, fontSize: 17, color: C.muted }}>
          <Icon name="lock" size={15} color={C.muted} />
          {url}
        </div>
      </div>
      <div style={{ width, height, position: 'relative', overflow: 'hidden', background: C.canvas }}>{children}</div>
    </div>
  )
}

/** Wall TV: thin bezel and a stand. */
export function TV({ width, children, glow }: { width: number; children: ReactNode; glow?: string }) {
  const h = (width * 9) / 16
  return (
    <div style={{ position: 'relative', width: width + 24 }}>
      <div style={{ padding: 12, borderRadius: 14, background: '#050506', border: '1.5px solid #2a2d35', boxShadow: `0 40px 90px -30px #000${glow ? `, 0 0 120px -10px ${glow}` : ''}` }}>
        <div style={{ width, height: h, borderRadius: 4, overflow: 'hidden', position: 'relative', background: C.canvas }}>{children}</div>
      </div>
      <div style={{ margin: '0 auto', width: 90, height: 34, background: 'linear-gradient(#1a1c22, #0e0f13)' }} />
      <div style={{ margin: '0 auto', width: 300, height: 10, borderRadius: 6, background: '#1f2229' }} />
    </div>
  )
}

/** Laptop: screen with a bezel over a keyboard deck. */
export function Laptop({ width, ratio = 10 / 16, children, glow }: { width: number; ratio?: number; children: ReactNode; glow?: string }) {
  const h = width * ratio
  return (
    <div style={{ position: 'relative', width: width + 32, filter: glow ? `drop-shadow(0 0 60px ${glow})` : undefined }}>
      <div style={{ padding: 14, paddingBottom: 18, borderRadius: '18px 18px 6px 6px', background: '#0a0b0d', border: '1.5px solid #2a2d35' }}>
        <div style={{ width, height: h, borderRadius: 4, overflow: 'hidden', position: 'relative', background: C.canvas }}>{children}</div>
      </div>
      <div style={{ marginLeft: -36, width: width + 104, height: 20, borderRadius: '4px 4px 16px 16px', background: 'linear-gradient(#2b2e36, #16181d)', boxShadow: '0 30px 60px -20px #000' }}>
        <div style={{ margin: '0 auto', width: 150, height: 7, borderRadius: '0 0 8px 8px', background: '#0d0e11' }} />
      </div>
    </div>
  )
}

/** Phone: rounded body, thin bezel, a status bar with a camera pill above the screen content. */
export function Phone({ height, ratio = 1170 / 2532, children, glow, style }: { height: number; ratio?: number; children: ReactNode; glow?: string; style?: CSSProperties }) {
  const w = height * ratio
  const bar = Math.round(height * 0.08)
  return (
    <div style={{ position: 'relative', padding: 11, borderRadius: 50, background: '#08090b', border: '2px solid #30333c', boxShadow: `0 40px 90px -30px #000${glow ? `, 0 0 100px -10px ${glow}` : ''}`, ...style }}>
      <div style={{ width: w, height, borderRadius: 40, overflow: 'hidden', position: 'relative', background: C.canvas }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: bar, bottom: 0 }}>{children}</div>
        <div style={{ position: 'absolute', top: bar * 0.3, left: '50%', width: w * 0.3, height: bar * 0.48, marginLeft: -w * 0.15, borderRadius: 99, background: '#000' }} />
        <div style={{ position: 'absolute', top: bar * 0.3, left: w * 0.11, height: bar * 0.48, display: 'flex', alignItems: 'center', fontSize: bar * 0.36, fontWeight: 700, color: C.ink }}>17:33</div>
        <div style={{ position: 'absolute', top: bar * 0.42, right: w * 0.11, width: bar * 0.5, height: bar * 0.25, borderRadius: 3, border: `1.5px solid ${C.ink}`, padding: 1.5 }}>
          <div style={{ width: '80%', height: '100%', borderRadius: 1, background: C.ink }} />
        </div>
      </div>
    </div>
  )
}

/** A card on Herald's surface colour. */
export function Panel({ children, style, accent }: { children: ReactNode; style?: CSSProperties; accent?: string }) {
  return <div style={{ background: `${C.surface}f2`, border: `1.5px solid ${accent ? `${accent}88` : C.lineSoft}`, borderRadius: 24, boxShadow: '0 40px 100px -40px #000', ...style }}>{children}</div>
}

// ------------------------------------------------------------------------------------ footage

/**
 * One frame of a recorded clip. `time` maps this sequence's frame to a clip second, so a scene can
 * hold, skip or retime footage freely; it holds the last frame once the clip ends.
 */
export function Clip({ id, time, style }: { id: string; time: (frame: number) => number; style?: CSSProperties }) {
  const frame = useCurrentFrame()
  const last = Math.round(CLIPS[id].seconds * FPS) - 2
  const f = Math.max(0, Math.min(last, Math.round(time(frame) * FPS)))
  return (
    <Freeze frame={f}>
      <OffthreadVideo src={staticFile(`clips/${id}.mp4`)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }} />
    </Freeze>
  )
}

/** Clip time that starts at `from` seconds when the sequence starts and runs at real speed. */
export const straight = (from: number) => (frame: number) => from + frame / FPS

/**
 * A virtual camera over content of `width` x `height`: each key centres the point (x, y) at
 * zoom s from frame f on, easing between keys.
 */
export function Camera({ keys, width, height, children }: { keys: { f: number; x: number; y: number; s: number }[]; width: number; height: number; children: ReactNode }) {
  const frame = useCurrentFrame()
  const fs = keys.map((k) => k.f)
  const pick = (v: (k: (typeof keys)[number]) => number) => (keys.length === 1 ? v(keys[0]) : interpolate(frame, fs, keys.map(v), { ...clamp, easing: EASE_IN_OUT }))
  const s = pick((k) => k.s)
  // keep the view inside the content, so a zoomed shot never shows past its edges
  const x = Math.min(width - width / (2 * s), Math.max(width / (2 * s), pick((k) => k.x)))
  const y = Math.min(height - height / (2 * s), Math.max(height / (2 * s), pick((k) => k.y)))
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width, height, left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${width / 2 - x * s}px, ${height / 2 - y * s}px) scale(${s})` }}>{children}</div>
    </div>
  )
}

// ------------------------------------------------------------------------------------ senses

/** Whether a vibration pattern (ms on, off, on...) is buzzing `t` frames after it starts. */
export function buzzing(pattern: number[], t: number): boolean {
  let ms = (t / FPS) * 1000
  if (ms < 0) return false
  for (let k = 0; k < pattern.length; k++) {
    if (ms < pattern[k]) return k % 2 === 0
    ms -= pattern[k]
  }
  return false
}

/** Shakes its children while a vibration pattern plays from frame `at`. */
export function Buzz({ pattern, at, amount = 6, children }: { pattern: number[]; at: number; amount?: number; children: ReactNode }) {
  const frame = useCurrentFrame()
  const on = buzzing(pattern, frame - at)
  const dx = on ? Math.sin(frame * 2.9) * amount : 0
  const r = on ? Math.cos(frame * 3.7) * amount * 0.18 : 0
  return <div style={{ transform: `translateX(${dx}px) rotate(${r}deg)` }}>{children}</div>
}

/** Rings that ripple out from the centre once for every "on" pulse of a vibration pattern. */
export function Ripples({ pattern, at, color, size = 400, strong = 1 }: { pattern: number[]; at: number; color: string; size?: number; strong?: number }) {
  const frame = useCurrentFrame()
  const starts: number[] = []
  let t = 0
  pattern.forEach((ms, k) => {
    if (k % 2 === 0) starts.push(at + Math.round((t / 1000) * FPS))
    t += ms
  })
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
      {starts.flatMap((s, i) =>
        [0, 6].map((lag) => {
          const p = interpolate(frame - s - lag, [0, 34], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
          if (frame - s - lag < 0 || p >= 1) return null
          const d = size * (0.35 + p * 0.9)
          return <div key={`${i}-${lag}`} style={{ position: 'absolute', left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: '50%', border: `${4 - p * 3}px solid ${color}`, opacity: (1 - p) * 0.9 * strong * (lag ? 0.55 : 1) }} />
        }),
      )}
    </div>
  )
}

// Braille: Unified English Braille, uncontracted. Dots 1-2-3 run down the left column, 4-5-6 down
// the right. A capital letter is preceded by dot 6.
const BRAILLE: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6], '.': [2, 5, 6], ' ': [],
}

export function brailleCells(text: string): { dots: number[]; char: string }[] {
  const cells: { dots: number[]; char: string }[] = []
  for (const ch of text) {
    if (ch !== ch.toLowerCase()) cells.push({ dots: [6], char: '' })
    cells.push({ dots: BRAILLE[ch.toLowerCase()] ?? [], char: ch })
  }
  return cells
}

/** Braille cells whose pins rise one cell after another from frame `at`, like a refreshable display. */
export function Braille({ text, at, cell = 60, gap, color = C.ink, stagger = 2, labels = false }: { text: string; at: number; cell?: number; gap?: number; color?: string; stagger?: number; labels?: boolean }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const dot = cell * 0.26
  const cells = brailleCells(text)
  return (
    <div style={{ display: 'flex', gap: gap ?? cell * 0.4, alignItems: 'flex-start' }}>
      {cells.map((c, i) => {
        const p = spring({ frame: frame - at - i * stagger, fps, config: { damping: 12, stiffness: 220 } })
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: cell * 0.18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(2, ${dot}px)`, gridAutoFlow: 'column', gridTemplateRows: `repeat(3, ${dot}px)`, gap: `${cell * 0.16}px ${cell * 0.2}px` }}>
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const up = c.dots.includes(n)
                return <div key={n} style={{ width: dot, height: dot, borderRadius: '50%', background: up ? color : 'rgba(255,255,255,0.1)', transform: `scale(${up ? 0.5 + 0.5 * p : 0.55})`, boxShadow: up ? `0 0 ${dot * 0.8 * p}px ${color}88` : undefined, opacity: up ? Math.min(1, 0.25 + p) : 1 }} />
              })}
            </div>
            {labels && <div style={{ fontSize: cell * 0.42, fontWeight: 700, color: C.muted, height: cell * 0.5, opacity: p }}>{c.char}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** A voice waveform: bars that follow a sound's loudness, scrolling right to left. */
export function Waveform({ level, bars = 48, width = 900, height = 160, color = C.accent, quiet = 0.06 }: { level: (secondsAgo: number) => number; bars?: number; width?: number; height?: number; color?: string; quiet?: number }) {
  const bw = width / bars
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width, height }}>
      {Array.from({ length: bars }, (_, i) => {
        const ago = (bars - 1 - i) * 0.035
        const jitter = 0.65 + 0.35 * Math.abs(Math.sin(i * 12.9898))
        const v = Math.max(quiet, level(ago) * jitter)
        const fade = Math.min(1, (i + 1) / (bars * 0.35))
        return <div key={i} style={{ width: bw * 0.55, marginRight: bw * 0.45, height: Math.max(6, v * height), borderRadius: 99, background: color, opacity: 0.25 + 0.75 * fade }} />
      })}
    </div>
  )
}
