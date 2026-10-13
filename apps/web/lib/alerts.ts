import type { RingWebhookPayload } from 'ring-kit'

export type AlertKind = 'doorbell' | 'person' | 'package' | 'vehicle' | 'motion' | 'camera_offline' | 'camera_online'

/** urgent: always interrupts. normal: interrupts by default. info: logged; interrupts only if the user asks for everything. */
export type AlertPriority = 'urgent' | 'normal' | 'info'

export interface Alert {
  /** Ring's meta.request_id, unique per delivery. */
  id: string
  /** Ring's data.id, e.g. `<device_id>_button_press_<timestamp>`. */
  eventId: string
  kind: AlertKind
  priority: AlertPriority
  /** Short, front-loaded: the first word tells you what happened. */
  headline: string
  detail?: string
  /** What Herald says aloud and what screen readers announce. */
  spoken: string
  /** Scene description from the vision model, added after the alert is first sent. */
  description?: string
  deviceId: string
  /** Epoch ms when Ring saw the event. */
  occurredAt: number
  /** Epoch ms when Herald received the webhook. */
  receivedAt: number
  /** Sent by Herald's webhook simulator rather than a real Ring device. */
  simulated: boolean
}

const PRIORITY_RANK: Record<AlertPriority, number> = { info: 0, normal: 1, urgent: 2 }

export function meetsPriority(priority: AlertPriority, minimum: AlertPriority): boolean {
  return PRIORITY_RANK[priority] >= PRIORITY_RANK[minimum]
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type AlertText = Pick<Alert, 'kind' | 'priority' | 'headline' | 'detail' | 'spoken'>

function describeEvent(payload: RingWebhookPayload, door: string): AlertText | null {
  return describe(payload.data.type, payload.data.attributes.sub_type, door)
}

function describe(type: string, subType: unknown, door: string): AlertText | null {
  switch (type) {
    case 'button_press':
      return {
        kind: 'doorbell',
        priority: 'urgent',
        headline: 'Doorbell',
        detail: `Someone is at the ${door}.`,
        spoken: `Doorbell. Someone is at the ${door}.`,
      }
    case 'motion_detected':
      switch (subType) {
        case 'human':
          return { kind: 'person', priority: 'normal', headline: `Person at the ${door}`, spoken: `Person at the ${door}.` }
        case 'package_delivery':
          return {
            kind: 'package',
            priority: 'normal',
            headline: `Package delivery at the ${door}`,
            spoken: `Package delivery at the ${door}.`,
          }
        case 'vehicle':
          return { kind: 'vehicle', priority: 'info', headline: `Vehicle near the ${door}`, spoken: `Vehicle near the ${door}.` }
        default:
          // `motion` (Smart Alerts off), `other_motion`, or a value Ring adds later.
          return { kind: 'motion', priority: 'info', headline: `Movement at the ${door}`, spoken: `Movement at the ${door}.` }
      }
    case 'device_offline':
      return {
        kind: 'camera_offline',
        priority: 'urgent',
        headline: `${capitalize(door)} camera is offline`,
        detail: "Herald can't see the door until it reconnects.",
        spoken: `${capitalize(door)} camera is offline. Herald can't see the door until it reconnects.`,
      }
    case 'device_online':
      return {
        kind: 'camera_online',
        priority: 'info',
        headline: `${capitalize(door)} camera is back online`,
        spoken: `${capitalize(door)} camera is back online.`,
      }
    default:
      // Account and subscription lifecycle events are not about the door.
      return null
  }
}

/** What Herald says when someone turns alerts on. */
export const ARMED_PHRASE = 'Herald alerts are on.'

/** The alert behind "Try a test alert": a doorbell press that says it is a test in every output. */
export function testAlert(door: string, at: number): Alert {
  const press = describe('button_press', undefined, door)!
  return {
    ...press,
    id: `test-${at}`,
    eventId: `test-${at}`,
    detail: `This is a test. ${press.detail}`,
    spoken: `This is a test. ${press.spoken}`,
    deviceId: 'test',
    occurredAt: at,
    receivedAt: at,
    simulated: true,
  }
}

/** Every sentence Herald can say for this door. The speech route voices these and nothing else. */
export function spokenPhrases(door: string): string[] {
  const events: [string, string?][] = [
    ['button_press'],
    ['motion_detected', 'human'],
    ['motion_detected', 'package_delivery'],
    ['motion_detected', 'vehicle'],
    ['motion_detected', 'motion'],
    ['device_offline'],
    ['device_online'],
  ]
  return [...events.map(([type, subType]) => describe(type, subType, door)!.spoken), testAlert(door, 0).spoken, ARMED_PHRASE]
}

export function alertFromWebhook(
  payload: RingWebhookPayload,
  options: { doorLabel: string; simulated: boolean; receivedAt?: number },
): Alert | null {
  const text = describeEvent(payload, options.doorLabel)
  if (!text) return null
  const receivedAt = options.receivedAt ?? Date.now()
  const occurredAt = typeof payload.data.attributes.timestamp === 'number' ? payload.data.attributes.timestamp : receivedAt
  return {
    id: payload.meta.request_id,
    eventId: payload.data.id,
    ...text,
    deviceId: payload.data.attributes.source,
    occurredAt,
    receivedAt,
    simulated: options.simulated,
  }
}
