import { NextResponse, type NextRequest } from 'next/server'
import { spokenPhrases } from '@/lib/alerts'
import { doorLabel } from '@/lib/server/config'
import { speech } from '@/lib/server/voice'

// Herald's voice. The browser sends the sentence it wants spoken and gets MP3 audio back. Only
// Herald's own alert sentences are accepted, so this can't be used to voice arbitrary text. Without
// a Deepgram key it answers 503, and the browser speaks with its built-in voice instead.

export async function POST(request: NextRequest) {
  if (!speech.configured()) {
    return NextResponse.json({ error: 'Herald has no voice configured (DEEPGRAM_API_KEY)' }, { status: 503 })
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const text = body?.text
  if (typeof text !== 'string' || !spokenPhrases(doorLabel()).includes(text)) {
    return NextResponse.json({ error: 'Herald only speaks its own alerts' }, { status: 400 })
  }
  try {
    const audio = await speech.speak(text)
    return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' } })
  } catch (err) {
    console.error('[herald] speech failed', err)
    return NextResponse.json({ error: 'Herald could not reach its voice' }, { status: 502 })
  }
}
