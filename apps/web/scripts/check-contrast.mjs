// Checks WCAG contrast for every colour pair Herald uses, read straight from the source:
// theme tokens in app/globals.css and alert colours in lib/alert-style.ts.
// Text needs 7:1 (AAA). Borders and the focus ring need 3:1 (WCAG 1.4.11). Exits 1 on any failure.

import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, hex]) => [name, hex]))
}

const css = read('app/globals.css')
const lightBlock = css.match(/:root\s*{([^}]*)}/)?.[1]
const darkBlock = css.match(/prefers-color-scheme:\s*dark\)\s*{\s*:root\s*{([^}]*)}/)?.[1]
if (!lightBlock || !darkBlock) throw new Error('Could not find the light and dark :root blocks in globals.css')

const rows = []
for (const [theme, t] of [['light', tokens(lightBlock)], ['dark', tokens(darkBlock)]]) {
  for (const bg of ['canvas', 'surface']) {
    for (const fg of ['ink', 'muted', 'accent', 'ok', 'warn', 'bad']) rows.push([theme, `${fg} on ${bg}`, t[fg], t[bg], 7])
    rows.push([theme, `line on ${bg}`, t.line, t[bg], 3])
    rows.push([theme, `focus on ${bg}`, t.focus, t[bg], 3])
  }
  rows.push([theme, 'accent-ink on accent', t['accent-ink'], t.accent, 7])
}

// Alert text always sits on a solid panel of the alert colour (only the flash margins pulse).
const styles = read('lib/alert-style.ts')
for (const [, kind, flash, ink] of styles.matchAll(/(\w+):\s*{[^}]*?flash:\s*'(#[0-9a-f]{6})',\s*ink:\s*'(#[0-9a-f]{6})'/gi)) {
  rows.push(['alert', `${kind} ink on its colour`, ink, flash, 7])
}
if (!rows.some(([theme]) => theme === 'alert')) throw new Error('Could not read alert colours from lib/alert-style.ts')

let failures = 0
for (const [theme, pair, fg, bg, min] of rows) {
  if (!fg || !bg) throw new Error(`Missing colour for ${theme} ${pair}`)
  const ratio = contrast(fg, bg)
  const ok = ratio >= min
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${theme.padEnd(5)}  ${pair.padEnd(28)} ${ratio.toFixed(2).padStart(6)}:1  (min ${min})`)
}
console.log(failures ? `\n${failures} pair(s) below the minimum` : `\nAll ${rows.length} pairs pass`)
process.exit(failures ? 1 : 0)
