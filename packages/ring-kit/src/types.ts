// Shapes returned by the Ring Partner API (https://api.amazonvision.com).
// The API follows JSON:API; only the fields we have seen documented or in live
// responses are typed, everything else stays open so new fields don't break callers.

export interface ResourceIdentifier {
  type: string
  id: string
}

export interface Relationship {
  data?: ResourceIdentifier | ResourceIdentifier[]
  links?: { related?: string; self?: string }
}

export interface Resource<TType extends string, TAttributes> {
  type: TType
  id: string
  attributes: TAttributes
  relationships?: Record<string, Relationship>
  meta?: Record<string, unknown>
}

export interface Document<TData> {
  data: TData
  meta?: { time?: string; [key: string]: unknown }
  links?: Record<string, string | null>
}

export interface DeviceAttributes {
  name: string
  image_url?: string
  [key: string]: unknown
}
export type Device = Resource<'devices', DeviceAttributes>

export interface DeviceStatusAttributes {
  online: boolean
  reported_at?: string
  state?: string | null
  audio?: { snooze?: { active: boolean | null; until: string | null } }
  [key: string]: unknown
}
export type DeviceStatus = Resource<'device-status', DeviceStatusAttributes>

export interface VideoCapability {
  codecs?: string[]
  ratio?: string
  max_resolution?: number
  supported_resolutions?: number[]
  configurations?: string[]
}

export interface DeviceCapabilitiesAttributes {
  video?: VideoCapability | null
  motion_detection?: { configurations?: string[] } | null
  image_enhancements?: { configurations?: string[] } | null
  audio?: { customizable_slots?: unknown; supported_actions?: unknown } | null
  contact_detection?: unknown
  battery_status?: unknown
  [key: string]: unknown
}
export type DeviceCapabilities = Resource<'device-capabilities', DeviceCapabilitiesAttributes>

export interface LocationAttributes {
  country?: string
  state?: string
  [key: string]: unknown
}
export type Location = Resource<'locations', LocationAttributes>

export type DeviceConfigurations = Resource<'device-configurations', Record<string, unknown>>

export interface UserAttributes {
  first_name?: string
  last_name?: string
  email?: string
  [key: string]: unknown
}
export type User = Resource<'users', UserAttributes>

export interface HistoryEventAttributes {
  /** e.g. `motion`, `ding`, `on_demand` (live view). Treat as open-ended. */
  event_type: string
  /** Epoch milliseconds. */
  start: number
  /** Epoch milliseconds. */
  end?: number
  is_third_party_reviewed?: boolean
  [key: string]: unknown
}
export type HistoryEvent = Resource<'history-events', HistoryEventAttributes>

export interface ImageOptions {
  format?: 'jpeg' | 'png'
  resolution?: { width?: number; height?: number }
}

export interface ComponentSelector {
  component_id: string
}

/** Body for `POST /v1/devices/{id}/media/image/download`. */
export type SnapshotRequest =
  | {
      type: 'at_timestamp'
      /** Epoch milliseconds, within the last 180 days. */
      timestamp: number
      image_options?: ImageOptions
      components?: [ComponentSelector]
    }
  | {
      type: 'latest_in_range'
      /** Epoch milliseconds, within the last 180 days. */
      start_timestamp: number
      /** Defaults to now. The window may be at most 24 hours. */
      end_timestamp?: number
      image_options?: ImageOptions
      components?: [ComponentSelector]
    }

/** Body for `POST /v1/devices/{id}/media/video/download`. */
export interface ClipRequest {
  /** Start time, epoch milliseconds. */
  timestamp: number
  /** Length in milliseconds, at most 900000 (15 minutes). */
  duration: number
  video_options?: {
    codec?: 'avc' | 'hevc'
    frame_rate?: number
    resolution?: { width?: number; height?: number }
  }
  audio_options?: { audio_enabled?: boolean }
  components?: [ComponentSelector]
}

export interface MediaDownload {
  bytes: Uint8Array<ArrayBuffer>
  contentType: string
}

export interface WhepSession {
  sdpAnswer: string
  /** Absolute URL of the session resource. DELETE it to end the stream. */
  sessionUrl: string | null
}

/** One entry of the JSON:API `errors` array Ring returns on failure. */
export interface ApiErrorObject {
  id?: string
  status?: string
  code?: string
  detail?: string
  meta?: Record<string, unknown>
}
