// Renders chosen frames of the film as PNGs, bundling once, for checking layouts.
// usage: node stills.mjs [--scale=0.5] [--every=30] [frame...]   (writes out/stills/fNNNN.png)
import { mkdirSync } from 'node:fs'
import { bundle } from '@remotion/bundler'
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer'

const args = process.argv.slice(2)
const opt = (name, fallback) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback)
const scale = opt('scale', 1)
const every = opt('every', 0)
let frames = args.filter((a) => !a.startsWith('--')).map(Number)

mkdirSync('out/stills', { recursive: true })
const serveUrl = await bundle({ entryPoint: 'src/index.ts' })
const browser = await openBrowser('chrome')
const composition = await selectComposition({ serveUrl, id: 'Demo', puppeteerInstance: browser })
if (every > 0) frames = Array.from({ length: Math.ceil(composition.durationInFrames / every) }, (_, i) => i * every)

const queue = [...frames]
async function worker() {
  for (let f = queue.shift(); f !== undefined; f = queue.shift()) {
    const output = `out/stills/f${String(f).padStart(4, '0')}.png`
    await renderStill({ serveUrl, composition, frame: f, output, scale, puppeteerInstance: browser })
    console.log(output)
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
await browser.close({ silent: true })
