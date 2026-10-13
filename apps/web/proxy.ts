import { NextResponse, type NextRequest } from 'next/server'
import { parseBasicAuth, secretsMatch } from '@/lib/server/basic-auth'

/**
 * Optional password for a deployed Herald (HTTP Basic auth, any user name). Live video and snapshots
 * come from a real home's camera, so any instance reachable from the internet should set HERALD_PASSWORD.
 * Ring's webhook stays open: it proves itself with an HMAC signature instead.
 */
export async function proxy(request: NextRequest) {
  const password = process.env.HERALD_PASSWORD
  if (!password) return NextResponse.next()

  const credentials = parseBasicAuth(request.headers.get('authorization'))
  if (credentials && (await secretsMatch(credentials.password, password))) return NextResponse.next()

  return new NextResponse('Herald is password protected.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Herald", charset="UTF-8"' },
  })
}

export const config = {
  matcher: ['/((?!api/webhook|_next/static|_next/image).*)'],
}
