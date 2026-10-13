# Herald demo video

The demo film for Herald, built in code: recordings of the real app, narration from Deepgram
Aura-2, music and sound effects synthesised in code, and motion graphics in
[Remotion](https://www.remotion.dev). It runs 2:42 at 1920x1080, 30 fps, with captions burned in
for every spoken word and every sound.

## Rebuilding

Everything generated (`public/`, `out/`) is ignored by git; the scripts recreate it in this order.

```bash
npm install
node record-live.mjs      # live view of the Playground camera (needs a valid Playground token)
node record.mjs           # the app itself, timed to the narration
node clips.mjs            # recordings to 30 fps clips, plus src/clips.json
node voice.mjs            # narration and word timings (reads the Deepgram key from apps/web/.env.local)
node timeline.mjs         # scene and line timing, src/timeline.json
node sfx.mjs              # sound effects
node music.mjs            # the score, fitted to the timeline
node levels.mjs           # loudness envelopes the picture reacts to
npm run render            # out/herald-demo.mp4
node master.mjs           # loudness pass to -16 LUFS, out/herald-demo-final.mp4 (the file to upload)
```

`npm run studio` opens the film in Remotion Studio. `node stills.mjs 300 1200` renders single
frames to `out/stills/` for checking layouts, and `node sheet.mjs` tiles them into a contact sheet.

## How it fits together

- `src/timeline.json` is the spine. Scenes, transitions, voice lines and captioned sounds all sit
  on it, and the music is composed to the same timeline.
- `src/voice.json` holds each line's word timings. Big on-screen type and the captions both follow
  the voice word by word.
- `src/Video.tsx` lays the twelve scenes in a TransitionSeries and puts the narration, sound
  effects and music on one timeline. The music ducks under every line.
- `src/scenes/` holds the scenes: `open.tsx` (cold open, title, why), `demo.tsx` (setup, the wall
  of screens, rhythms, priority, live view) and `build.tsx` (accessibility, architecture, ring-kit,
  outro).
- Clips are retimed frame by frame with `Clip`, so footage recorded before the simulator's latency
  fix lines up with the narration. The WebRTC handshake plays at 1.8x; in the keyboard-focus shot
  the server wait is cut and the half second with focus on Dismiss plays at about a third of real
  speed, to last as long as its line. Everything else runs at real speed.
- Alerts in the recordings are real (each one goes through `/api/simulate`, a signed webhook and
  Server-Sent Events). Ring's device list is replayed from a capture made while the 30-minute
  Playground token was valid, so the status chip reads as it did live.

The terminal output on screen is the real output of `npm test` and `npm run check:contrast`
(`out/test-output.txt`, `out/contrast-output.txt`), excerpted.
