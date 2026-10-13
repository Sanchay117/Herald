import { NextResponse, type NextRequest } from 'next/server'
import { ring, ringConfigured } from '@/lib/server/ring'
import { noToken, ringErrorResponse } from '@/lib/server/http'

// The browser creates the WebRTC offer; the server adds the Ring token and relays the WHEP exchange,
// so the token never reaches the client.

export async function POST(request: NextRequest) {
  if (!ringConfigured()) return noToken()
  const body = (await request.json().catch(() => null)) as { deviceId?: unknown; sdpOffer?: unknown } | null
  if (typeof body?.deviceId !== 'string' || typeof body.sdpOffer !== 'string' || !body.sdpOffer.startsWith('v=')) {
    return NextResponse.json({ error: 'Expected { deviceId, sdpOffer }' }, { status: 400 })
  }
  try {
    const session = await ring.startWhepSession(body.deviceId, body.sdpOffer)
    return NextResponse.json(session)
  } catch (err) {
    return ringErrorResponse(err)
  }
}

export async function DELETE(request: NextRequest) {
  if (!ringConfigured()) return noToken()
  const body = (await request.json().catch(() => null)) as { sessionUrl?: unknown } | null
  if (typeof body?.sessionUrl !== 'string') {
    return NextResponse.json({ error: 'Expected { sessionUrl }' }, { status: 400 })
  }
  try {
    await ring.stopWhepSession(body.sessionUrl)
    return NextResponse.json({ stopped: true })
  } catch (err) {
    return ringErrorResponse(err)
  }
}
