import type {
  ApiErrorObject,
  ClipRequest,
  Device,
  DeviceCapabilities,
  DeviceConfigurations,
  DeviceStatus,
  Document,
  HistoryEvent,
  Location,
  MediaDownload,
  SnapshotRequest,
  User,
  WhepSession,
} from './types.ts'

export const RING_API_BASE = 'https://api.amazonvision.com'

export type TokenSource = string | (() => string | Promise<string>)

export interface RingClientOptions {
  /** A bearer token, or a function returning one (called before every request). */
  token: TokenSource
  baseUrl?: string
  fetch?: typeof fetch
}

export class RingApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly errors: ApiErrorObject[]

  constructor(status: number, errors: ApiErrorObject[], fallback: string) {
    const first = errors[0]
    super(first?.detail ? `${first.code ?? status}: ${first.detail}` : fallback)
    this.name = 'RingApiError'
    this.status = status
    this.code = first?.code
    this.errors = errors
  }

  /** True when the token is missing, malformed or expired. Playground tokens expire after 30 minutes. */
  get isAuthError(): boolean {
    return this.status === 401
  }

  static async fromResponse(res: Response): Promise<RingApiError> {
    const text = await res.text().catch(() => '')
    let errors: ApiErrorObject[] = []
    try {
      const body = JSON.parse(text)
      if (Array.isArray(body?.errors)) errors = body.errors
    } catch {
      // Not JSON; keep the raw text as the message.
    }
    return new RingApiError(res.status, errors, `Ring API ${res.status}: ${text.slice(0, 200) || res.statusText}`)
  }
}

export class RingClient {
  readonly #token: TokenSource
  readonly #baseUrl: string
  readonly #fetch: typeof fetch

  constructor(options: RingClientOptions) {
    this.#token = options.token
    this.#baseUrl = (options.baseUrl ?? RING_API_BASE).replace(/\/$/, '')
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async #authHeader(): Promise<string> {
    const token = typeof this.#token === 'function' ? await this.#token() : this.#token
    if (!token) throw new RingApiError(401, [], 'No Ring access token configured')
    return `Bearer ${token}`
  }

  async #request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('Authorization', await this.#authHeader())
    const res = await this.#fetch(`${this.#baseUrl}${path}`, { ...init, headers })
    if (!res.ok && res.status !== 303) throw await RingApiError.fromResponse(res)
    return res
  }

  async #get<T>(path: string): Promise<T> {
    const res = await this.#request(path, { headers: { Accept: 'application/vnd.api+json, application/json' } })
    const doc = (await res.json()) as Document<T>
    return doc.data
  }

  // Media downloads answer 303 with a pre-signed URL. Follow it ourselves so the
  // bearer token is never sent to the storage host.
  async #download(path: string, body: unknown): Promise<MediaDownload> {
    const res = await this.#request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'manual',
    })
    let media = res
    if (res.status === 303) {
      const location = res.headers.get('Location')
      if (!location) throw new RingApiError(502, [], 'Media download redirect had no Location header')
      media = await this.#fetch(location)
      if (!media.ok) throw await RingApiError.fromResponse(media)
    }
    return {
      bytes: new Uint8Array(await media.arrayBuffer()),
      contentType: media.headers.get('Content-Type') ?? 'application/octet-stream',
    }
  }

  listDevices(): Promise<Device[]> {
    return this.#get('/v1/devices')
  }

  getDevice(deviceId: string): Promise<Device> {
    return this.#get(`/v1/devices/${encodeURIComponent(deviceId)}`)
  }

  getStatus(deviceId: string): Promise<DeviceStatus> {
    return this.#get(`/v1/devices/${encodeURIComponent(deviceId)}/status`)
  }

  getCapabilities(deviceId: string): Promise<DeviceCapabilities> {
    return this.#get(`/v1/devices/${encodeURIComponent(deviceId)}/capabilities`)
  }

  getLocation(deviceId: string): Promise<Location> {
    return this.#get(`/v1/devices/${encodeURIComponent(deviceId)}/location`)
  }

  getConfigurations(deviceId: string): Promise<DeviceConfigurations> {
    return this.#get(`/v1/devices/${encodeURIComponent(deviceId)}/configurations`)
  }

  getEventHistory(deviceId: string, params: Record<string, string | number> = {}): Promise<HistoryEvent[]> {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
    return this.#get(`/v1/history/devices/${encodeURIComponent(deviceId)}/events${query ? `?${query}` : ''}`)
  }

  getMe(): Promise<User> {
    return this.#get('/v1/users/me')
  }

  downloadSnapshot(deviceId: string, request: SnapshotRequest): Promise<MediaDownload> {
    return this.#download(`/v1/devices/${encodeURIComponent(deviceId)}/media/image/download`, request)
  }

  downloadClip(deviceId: string, request: ClipRequest): Promise<MediaDownload> {
    return this.#download(`/v1/devices/${encodeURIComponent(deviceId)}/media/video/download`, request)
  }

  /** Start a WHEP live-view session. Ring streams video only; offer a recvonly video transceiver. */
  async startWhepSession(deviceId: string, sdpOffer: string): Promise<WhepSession> {
    const res = await this.#request(`/v1/devices/${encodeURIComponent(deviceId)}/media/streaming/whep/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: sdpOffer,
    })
    const location = res.headers.get('Location')
    return {
      sdpAnswer: await res.text(),
      sessionUrl: location ? new URL(location, this.#baseUrl).toString() : null,
    }
  }

  async stopWhepSession(sessionUrl: string): Promise<void> {
    const url = new URL(sessionUrl, this.#baseUrl)
    if (url.origin !== new URL(this.#baseUrl).origin) {
      throw new RingApiError(400, [], 'Refusing to send the Ring token to a non-Ring session URL')
    }
    await this.#request(url.pathname + url.search, { method: 'DELETE' })
  }
}
