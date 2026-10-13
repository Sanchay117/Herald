// Typed access to the generated timing files: the timeline (timeline.mjs), the narration with
// word timings (voice.mjs), the recorded clips (clips.mjs) and loudness envelopes (levels.mjs).
import clipsJson from './clips.json'
import levelsJson from './levels.json'
import timelineJson from './timeline.json'
import voiceJson from './voice.json'
import { FPS } from './theme'

export type SceneId = 'cold' | 'title' | 'why' | 'setup' | 'wall' | 'rhythm' | 'priority' | 'live' | 'safe' | 'tech' | 'ringkit' | 'outro'
export type Enter = 'cut' | 'fade' | 'slide' | 'iris' | 'push' | 'zoom'
export interface Part { kind: 'line' | 'sfx'; id: string; at: number; len: number; caption?: string }
export interface Scene { id: SceneId; enter: Enter; overlap: number; from: number; duration: number; parts: Part[] }
export interface Word { w: string; s: number; e: number }
export interface Line { id: string; voice: 'narrator' | 'herald'; text: string; duration: number; words: Word[] }
export interface ClipInfo { seconds: number; width: number; height: number; marks: { name: string; t: number }[] }

export const TIMELINE = timelineJson as { fps: number; total: number; scenes: Scene[] }
export const LINES = voiceJson as Line[]
export const CLIPS = clipsJson as Record<string, ClipInfo>
const LEVELS = levelsJson as { rate: number; levels: Record<string, number[]> }

export const sec = (s: number) => Math.round(s * FPS)

export function scene(id: SceneId): Scene {
  const s = TIMELINE.scenes.find((x) => x.id === id)
  if (!s) throw new Error(`no scene ${id}`)
  return s
}

export function line(id: string): Line {
  const l = LINES.find((x) => x.id === id)
  if (!l) throw new Error(`no line ${id}`)
  return l
}

/** The scene part that plays a line or sound (the nth one, when it plays more than once). */
export function part(sceneId: SceneId, id: string, nth = 0): Part {
  const p = scene(sceneId).parts.filter((x) => x.id === id)[nth]
  if (!p) throw new Error(`no part ${id} in ${sceneId}`)
  return p
}

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '')

/** Frame, inside the scene, when a narrated word starts (`nth` counts repeats of the word). */
export function wordAt(sceneId: SceneId, lineId: string, word: string, nth = 0): number {
  const p = part(sceneId, lineId)
  const hits = line(lineId).words.filter((x) => norm(x.w) === norm(word))
  const hit = hits[nth]
  if (!hit) throw new Error(`no "${word}" #${nth} in ${lineId}`)
  return p.at + sec(hit.s)
}

/** Frame, inside the scene, when a narrated word ends. */
export function wordEnd(sceneId: SceneId, lineId: string, word: string, nth = 0): number {
  const p = part(sceneId, lineId)
  const hit = line(lineId).words.filter((x) => norm(x.w) === norm(word))[nth]
  if (!hit) throw new Error(`no "${word}" #${nth} in ${lineId}`)
  return p.at + sec(hit.e)
}

/** Seconds into a clip at which a recorded mark happened. */
export function mark(clip: string, name: string, nth = 0): number {
  const m = CLIPS[clip].marks.filter((x) => x.name === name)[nth]
  if (!m) throw new Error(`no mark ${name} in ${clip}`)
  return m.t
}

/** Loudness (0 to 1) of a sound `seconds` after it starts. */
export function level(id: string, seconds: number): number {
  const values = LEVELS.levels[id]
  const i = seconds * LEVELS.rate
  if (i < 0 || i >= values.length - 1) return 0
  const k = Math.floor(i)
  return values[k] + (values[k + 1] - values[k]) * (i - k)
}
