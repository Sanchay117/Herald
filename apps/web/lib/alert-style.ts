import type { AlertKind } from './alerts'

export interface AlertStyle {
  /** Name used in legends and settings. */
  label: string
  /** Full-screen flash background. No saturated red: WCAG 2.3.1 is strictest about red flashes. */
  flash: string
  /** Text colour on the flash background (contrast at least 7:1). */
  ink: string
  /** navigator.vibrate pattern in ms (on, off, on, ...). Each kind has its own rhythm so it can be felt, not seen. */
  vibration: number[]
  /** The rhythm in words, for the legend. */
  rhythm: string
}

export const ALERT_STYLE: Record<AlertKind, AlertStyle> = {
  doorbell: { label: 'Doorbell', flash: '#FFB020', ink: '#1A1200', vibration: [600, 200, 600], rhythm: 'long, long' },
  person: { label: 'Person', flash: '#5CC8FF', ink: '#001A29', vibration: [150, 120, 150], rhythm: 'short, short' },
  package: { label: 'Package', flash: '#4ADE80', ink: '#00210D', vibration: [150, 120, 600], rhythm: 'short, long' },
  vehicle: { label: 'Vehicle', flash: '#C4B5FD', ink: '#1E0B4B', vibration: [600, 200, 150], rhythm: 'long, short' },
  motion: { label: 'Movement', flash: '#E2E8F0', ink: '#0F172A', vibration: [120], rhythm: 'one tap' },
  camera_offline: {
    label: 'Camera offline',
    flash: '#FB923C',
    ink: '#1F0A00',
    vibration: [600, 200, 600, 200, 600],
    rhythm: 'long, long, long',
  },
  camera_online: {
    label: 'Camera back online',
    flash: '#E2E8F0',
    ink: '#0F172A',
    vibration: [120, 120, 120, 120, 120],
    rhythm: 'three taps',
  },
}
