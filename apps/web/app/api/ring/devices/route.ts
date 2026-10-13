import { NextResponse } from 'next/server'
import type { DeviceSummary } from '@/lib/api-types'
import { ring, ringConfigured } from '@/lib/server/ring'
import { ringErrorResponse } from '@/lib/server/http'

export async function GET() {
  if (!ringConfigured()) return NextResponse.json({ configured: false, devices: [] })
  try {
    const devices = await ring.listDevices()
    const summaries: DeviceSummary[] = await Promise.all(
      devices.map(async (device) => {
        const status = await ring.getStatus(device.id).catch(() => null)
        return {
          id: device.id,
          name: device.attributes.name,
          imageUrl: device.attributes.image_url ?? null,
          online: status?.attributes.online ?? null,
        }
      }),
    )
    return NextResponse.json({ configured: true, devices: summaries })
  } catch (err) {
    return ringErrorResponse(err, { configured: true, devices: [] })
  }
}
