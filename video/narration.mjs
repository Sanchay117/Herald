// Every spoken line in the demo, in order. `text` is the caption shown on screen; `say` is what the
// voice reads when it has to differ (numbers spelled out, acronyms spelled for the TTS, pauses).
// The narrator is Deepgram Aura-2 Thalia. The "herald" voice plays the part of Herald's spoken alert.
import { createHash } from 'node:crypto'

export const VOICES = {
  narrator: 'aura-2-thalia-en',
  herald: 'aura-2-orion-en',
}

/** ffmpeg filters per voice: a gentle band limit makes Herald's voice sound like a device in the room. */
export const FILTERS = {
  narrator: [],
  herald: ['highpass=f=160', 'lowpass=f=8000'],
}

/** Cache key for a line's audio: changes whenever the model, wording or processing changes. */
export function cacheKey(line) {
  const voice = line.voice ?? 'narrator'
  const say = line.say ?? line.text
  return createHash('sha256').update(`${VOICES[voice]}|${voice}|${say}|${FILTERS[voice].join()}`).digest('hex').slice(0, 16)
}

export const LINES = [
  { id: 'cold-deaf', text: "If you're Deaf, this is what a doorbell sounds like.", say: "If you're Deaf... this is what a doorbell sounds like." },
  { id: 'cold-blind', text: "If you're blind, it sounds like this." },
  { id: 'cold-alert', voice: 'herald', text: 'Doorbell. Someone is at the front door.' },
  { id: 'cold-deafblind', text: "And if you're Deafblind, it feels like this.", say: "And if you're deaf-blind, it feels like this." },
  { id: 'title', text: 'This is Herald. Your Ring doorbell, for every sense.' },
  {
    id: 'why',
    text: '430 million people live with disabling hearing loss, and 43 million are blind. But a doorbell is made for ears, and a camera for eyes.',
    say: 'Four hundred and thirty million people live with disabling hearing loss, and forty-three million are blind. But a doorbell is made for ears, and a camera for eyes.',
  },
  { id: 'promise', text: 'This video works with the sound off, or with your eyes closed. So does Herald.' },
  {
    id: 'setup',
    text: 'Each screen in the home is set up for the person using it: Deaf or hard of hearing, blind or low vision, Deafblind, or a custom mix.',
    say: 'Each screen in the home is set up for the person using it: deaf or hard of hearing, blind or low vision, deaf-blind, or a custom mix.',
  },
  {
    id: 'wall',
    text: 'When someone rings, every open screen responds at once, each in its own way. The TV floods with amber. The laptop speaks. The phone pulses long, long, and its screen reader sends the words to a braille display.',
  },
  { id: 'rhythm', text: 'Every kind of event has its own colour and its own rhythm. A person is short, short. A package is short, long.' },
  { id: 'priority', text: 'And only what matters interrupts. A passing car slips quietly into history, but a package gets a green flash.' },
  {
    id: 'live',
    text: "To see who's there, live view streams straight from the Ring camera over WebRTC, and the Ring token never leaves Herald's server.",
    say: "To see who's there, live view streams straight from the Ring camera over web R T C, and the Ring token never leaves Herald's server.",
  },
  {
    id: 'safe',
    text: 'Accessibility is the spec, not polish. The flash pulses less than once a second, far below the safety limit of three, and holds steady if you reduce motion. Focus moves to Dismiss, then back to where you were. All text meets WCAG AAA contrast, and a script checks every colour pair.',
    say: 'Accessibility is the spec, not polish. The flash pulses less than once a second, far below the safety limit of three, and holds steady if you reduce motion. Focus moves to Dismiss, then back to where you were. All text meets W C A G triple-A contrast, and a script checks every colour pair.',
  },
  {
    id: 'tech',
    text: 'Under the hood, Ring signs every webhook. Herald verifies the HMAC signature on the raw bytes before parsing anything, drops duplicate deliveries, and streams each alert to every screen over server-sent events.',
  },
  {
    id: 'ringkit',
    text: "The Developer Playground can't send webhooks, so we built ring-kit: an open-source Ring client with a signed event simulator. Every test event takes Herald's real verification path. 52 tests back it up, and we logged 11 friction points for the Ring team.",
    say: "The Developer Playground can't send webhooks, so we built ring kit: an open-source Ring client with a signed event simulator. Every test event takes Herald's real verification path. Fifty-two tests back it up, and we logged eleven friction points for the Ring team.",
  },
  { id: 'outro', text: "Herald. Because everyone deserves to know who's at the door." },
]
