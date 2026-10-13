import { loadFont as loadAtkinson } from '@remotion/google-fonts/AtkinsonHyperlegible'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'

// Herald's dark theme (apps/web/app/globals.css) and alert colours (apps/web/lib/alert-style.ts),
// so the video reads as the product.
export const C = {
  canvas: '#0b0c0f',
  surface: '#15171c',
  surface2: '#1d2027',
  ink: '#f5f5f4',
  muted: '#c7c7cf',
  line: '#6b7280',
  lineSoft: 'rgba(255,255,255,0.12)',
  accent: '#93c5fd',
  accentDeep: '#1e40af',
  focus: '#ffd166',
  ok: '#4ade80',
  bad: '#fca5a5',
}

export type Kind = 'doorbell' | 'person' | 'package' | 'vehicle' | 'motion' | 'camera_offline' | 'camera_online'

export const ALERT: Record<Kind, { label: string; flash: string; ink: string; vibration: number[]; rhythm: string; priority: 'Urgent' | 'Normal' | 'Info' }> = {
  doorbell: { label: 'Doorbell', flash: '#FFB020', ink: '#1A1200', vibration: [600, 200, 600], rhythm: 'long, long', priority: 'Urgent' },
  person: { label: 'Person', flash: '#5CC8FF', ink: '#001A29', vibration: [150, 120, 150], rhythm: 'short, short', priority: 'Normal' },
  package: { label: 'Package', flash: '#4ADE80', ink: '#00210D', vibration: [150, 120, 600], rhythm: 'short, long', priority: 'Normal' },
  vehicle: { label: 'Vehicle', flash: '#C4B5FD', ink: '#1E0B4B', vibration: [600, 200, 150], rhythm: 'long, short', priority: 'Info' },
  motion: { label: 'Movement', flash: '#E2E8F0', ink: '#0F172A', vibration: [120], rhythm: 'one tap', priority: 'Info' },
  camera_offline: { label: 'Camera offline', flash: '#FB923C', ink: '#1F0A00', vibration: [600, 200, 600, 200, 600], rhythm: 'long, long, long', priority: 'Urgent' },
  camera_online: { label: 'Camera back online', flash: '#E2E8F0', ink: '#0F172A', vibration: [120, 120, 120, 120, 120], rhythm: 'three taps', priority: 'Info' },
}

export const SANS = loadAtkinson('normal', { weights: ['400', '700'], subsets: ['latin'] }).fontFamily
loadAtkinson('italic', { weights: ['400'], subsets: ['latin'] }) // sound captions
export const MONO = loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily

export const FPS = 30
export const W = 1920
export const H = 1080
