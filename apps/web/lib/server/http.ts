import { NextResponse } from 'next/server'
import { RingApiError } from 'ring-kit'

export interface ApiErrorBody {
  error: string
  code?: string
  /** True when the Ring token is missing or expired; the UI tells the user how to get a new one. */
  tokenProblem?: boolean
}

export function ringErrorResponse(err: unknown, extra: Record<string, unknown> = {}): NextResponse {
  if (err instanceof RingApiError) {
    const body: ApiErrorBody = { error: err.message, code: err.code, tokenProblem: err.isAuthError }
    // Ring 5xx and network trouble are upstream failures from the browser's point of view.
    const status = err.status >= 500 ? 502 : err.status
    return NextResponse.json({ ...extra, ...body }, { status })
  }
  console.error('[herald] unexpected error', err)
  const body: ApiErrorBody = { error: err instanceof Error ? err.message : 'Unexpected error' }
  return NextResponse.json({ ...extra, ...body }, { status: 500 })
}

export const noToken = (extra: Record<string, unknown> = {}) =>
  NextResponse.json(
    { ...extra, error: 'No Ring access token configured. Set RING_ACCESS_TOKEN in apps/web/.env.local.', tokenProblem: true },
    { status: 401 },
  )
