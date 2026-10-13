import type { NextRequest } from 'next/server'
import { recentAlerts, subscribe, type BusMessage } from '@/lib/server/bus'
import { warmSpeech } from '@/lib/server/voice'

// Server-Sent Events: every open Herald screen (phone, laptop, TV) gets alerts the moment the webhook lands.
//   event: snapshot      data: Alert[]           (on connect; never re-triggers outputs)
//   event: alert         data: Alert
//   event: alert-update  data: { id, patch }

export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 15_000

export async function GET(request: NextRequest) {
  // A screen is listening, so it may need Herald's voice soon.
  warmSpeech()
  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk))
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

      write('retry: 3000\n\n')
      send('snapshot', recentAlerts())

      const unsubscribe = subscribe((message: BusMessage) => {
        if (message.type === 'alert') send('alert', message.alert)
        else send('alert-update', { id: message.id, patch: message.patch })
      })
      const heartbeat = setInterval(() => {
        try {
          write(': ping\n\n')
        } catch {
          cleanup()
        }
      }, HEARTBEAT_MS)

      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }
      request.signal.addEventListener('abort', () => {
        cleanup()
        try {
          controller.close()
        } catch {
          // Already closed.
        }
      })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
