import { NextResponse, type NextRequest } from 'next/server'
import { ring, ringConfigured } from '@/lib/server/ring'
import { noToken, ringErrorResponse } from '@/lib/server/http'

// GET /api/ring/snapshot?deviceId=...&since=<epoch ms>
// Latest snapshot in [since, now]. Ring caps the window at 24 hours; the default is the last 10 minutes.

const DAY_MS = 24 * 60 * 60_000

export async function GET(request: NextRequest) {
  if (!ringConfigured()) return noToken()
  const deviceId = request.nextUrl.searchParams.get('deviceId')
  if (!deviceId) return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })

  const now = Date.now()
  const requested = Number(request.nextUrl.searchParams.get('since'))
  const since = Number.isFinite(requested) && requested > 0 ? Math.max(requested, now - DAY_MS + 1000) : now - 10 * 60_000

  try {
    const snap = await ring.downloadSnapshot(deviceId, {
      type: 'latest_in_range',
      start_timestamp: since,
      end_timestamp: now,
      image_options: { format: 'jpeg' },
    })
    return new Response(snap.bytes, {
      headers: { 'Content-Type': snap.contentType, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return ringErrorResponse(err)
  }
}
