/** Parse an `Authorization: Basic ...` header. Returns null when it is missing or malformed. */
export function parseBasicAuth(header: string | null): { user: string; password: string } | null {
  const match = header?.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i)
  if (!match) return null
  let decoded: string
  try {
    // Browsers send UTF-8 when the challenge says charset="UTF-8".
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0)))
  } catch {
    return null
  }
  const colon = decoded.indexOf(':')
  if (colon === -1) return null
  return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) }
}

/** Compare two secrets without revealing, through timing, how much of them matched. */
export async function secretsMatch(given: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [a, b] = await Promise.all([given, expected].map((s) => crypto.subtle.digest('SHA-256', encoder.encode(s))))
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}
