// Shapes shared by the API routes and the browser.

export interface DeviceSummary {
  id: string
  name: string
  imageUrl: string | null
  /** null when the status call failed. */
  online: boolean | null
}

export interface DevicesResponse {
  configured: boolean
  devices: DeviceSummary[]
  error?: string
  code?: string
  tokenProblem?: boolean
}

export const SIMULATED_EVENTS = ['doorbell', 'person', 'package', 'vehicle', 'motion', 'offline', 'online'] as const
export type SimulatedEventName = (typeof SIMULATED_EVENTS)[number]
