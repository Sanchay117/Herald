import { Composition } from 'remotion'
import { TIMELINE } from './data'
import { FPS, H, W } from './theme'
import { Demo } from './Video'

export function Root() {
  return <Composition id="Demo" component={Demo} durationInFrames={TIMELINE.total} fps={FPS} width={W} height={H} />
}
