// Packet timing of a video file: count, first and last timestamps, and the biggest gaps.
// usage: node probe.mjs <video>
import { execFileSync } from 'node:child_process'

const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', process.argv[2]], { maxBuffer: 1 << 26 })
const t = out.toString().trim().split('\n').map(Number).filter(Number.isFinite).sort((a, b) => a - b)
const gaps = t.slice(1).map((v, i) => ({ at: t[i], gap: v - t[i] })).sort((a, b) => b.gap - a.gap).slice(0, 5)
console.log(`${t.length} packets, ${t[0].toFixed(3)} .. ${t[t.length - 1].toFixed(3)} s`)
console.log('largest gaps:', gaps.map((g) => `${g.gap.toFixed(2)}s at ${g.at.toFixed(2)}`).join(', '))
