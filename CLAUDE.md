# BlockSynth — Claude Project Memory

## What This Is

A browser-based block music sequencer built with React + Vite. Users place colored 3D blocks on a piano roll grid to compose music. Each block is a note with its own full synthesis chain. A 3D carousel visualiser shows the composition rotating in sync with playback.

No backend. No TypeScript. Runs entirely in the browser.

---

## Tech Stack

| Layer | Library | Notes |
|---|---|---|
| Build | Vite + React 18 | `npm run dev` → localhost:5173 |
| Audio | Tone.js v14 | Transport, synths, FX, LFO, Offline render |
| State | Zustand | Single store, no reducers |
| Styling | Tailwind CSS v4 + inline styles | Tailwind via `@tailwindcss/vite` plugin |
| Audio export | `audiobuffer-to-wav` | WAV bounce via `Tone.Offline()` |
| Drag | Pointer Events API | Native, no library |

---

## Project Structure

```
src/
├── constants.js                  ← CELL_W=76, CELL_H=34 (shared grid cell size)
├── App.jsx                       ← Layout (TransportBar / Grid+Panel / Visualiser), global keys
├── main.jsx
├── index.css                     ← @import "tailwindcss" + body/root resets
│
├── store/
│   └── sequencerStore.js         ← All app state (Zustand). Source of truth.
│
├── audio/
│   └── AudioEngine.js            ← Tone.js node graph, scheduler, WAV renderer. Singleton.
│
├── hooks/
│   └── useAudioSync.js           ← Bridge: watches store → calls AudioEngine imperatively
│
├── utils/
│   ├── noteUtils.js              ← rowToNote(), rowToOctave(), isBlackKey()
│   └── colorUtils.js            ← blockColor(), blockTopColor(), blockSideColor() etc.
│
└── components/
    ├── TransportBar/
    │   └── TransportBar.jsx      ← Play/pause/stop, BPM, volume, undo/redo, clear, save/load/WAV
    ├── SequencerGrid/
    │   ├── SequencerGrid.jsx     ← Piano roll grid, click-to-add, playhead
    │   ├── Block.jsx             ← 3D CSS block, drag/resize, emissive glow on play
    │   └── PianoKeys.jsx        ← Left-side note labels, scrolls with grid
    ├── BlockPanel/
    │   ├── BlockPanel.jsx        ← Bottom drawer, tabbed (OSC/FILTER/AMP/FX/LFO)
    │   ├── OscillatorSection.jsx ← Waveform selector (sine/square/saw/tri)
    │   ├── FilterSection.jsx     ← LP/HP/BP, cutoff, resonance, env amount + ADSR
    │   ├── AmplifierSection.jsx  ← Gain + ADSR
    │   ├── FXSection.jsx         ← Reverb (room, wet) + Delay (time grid, feedback, wet)
    │   ├── LFOSection.jsx        ← Rate, depth, target, waveform, tempo sync
    │   └── ADSREditor.jsx        ← Reusable vertical ADSR slider component
    └── Visualizer/
        └── Visualizer.jsx        ← 3D CSS carousel, rotates per beat, filler blocks
```

---

## Data Model

### Block (stored in Zustand, plain JSON)

```js
{
  id: "block_1",
  column: 4,          // time step (0-indexed), horizontal position
  row: 7,             // pitch row (0=B5 highest, 47=C2 lowest)
  duration: 1,        // width in steps
  note: "C4",         // Tone.js note string, kept in sync with row
  octave: 4,          // 2-5, drives block colour

  oscillator: { type: 'sawtooth' },   // sine|square|sawtooth|triangle

  filter: {
    type: 'lowpass',                  // lowpass|highpass|bandpass
    frequency: 2000,
    Q: 1,
    envelope: { attack, decay, sustain, release, amount }
  },

  amplifier: {
    gain: 0.8,
    envelope: { attack, decay, sustain, release }
  },

  fx: {
    reverb: { enabled: false, roomSize: 0.5, wet: 0.3 },
    delay:  { enabled: false, time: '8n', feedback: 0.4, wet: 0.2 }
  },

  lfo: {
    enabled: false,
    rate: 2,                          // Hz or Tone.js time string if tempoSynced
    depth: 0.5,
    target: 'filter.frequency',       // filter.frequency|amplifier.gain|oscillator.detune
    type: 'sine',
    tempoSynced: false
  }
}
```

### Global store state

```js
blocks: [],           selectedBlockId: null,
playbackState: 'stopped',             // playing|paused|stopped
currentStep: 0,       bpm: 120,       masterVolume: -6,
totalColumns: 16,     totalRows: 48,  // 4 chromatic octaves (C2–B5)
triggerSet: Set,      lastPlayedId: null,
history: [],          future: [],     // undo/redo stacks (max 50 deep)
```

---

## Grid Layout

- **Rows**: 48 chromatic pitches, row 0 = B5 (top), row 47 = C2 (bottom)
- **Columns**: 16 time steps (16th notes), left to right
- **Cell size**: 76 × 34 px (defined in `src/constants.js`)
- **Black keys**: darker background rows (`isBlackKey(row)`)
- Piano key labels on the left sidebar, synced to scroll

---

## Octave → Colour Map

| Octave | Hue | Colour |
|--------|-----|--------|
| 2 | 0° | Red |
| 3 | 30° | Orange |
| 4 | 60° | Yellow |
| 5 | 120° | Green |
| 6 | 180° | Cyan |
| 7 | 240° | Blue |
| 8 | 280° | Purple |

All at `hsl(H, 90%, 62%)`. Top face lighter (~80% L), side face darker (~38% L).

---

## Audio Engine

### Voice graph per block
```
Tone.MonoSynth (osc + built-in filter)
    ↓
Tone.Gain (amplifier)
    ↓
Tone.Reverb (optional)
    ↓
Tone.FeedbackDelay (optional)
    ↓
Tone.Volume (master) → Tone.Destination
```

### Key rules
- **One voice per block** — created in `createVoice()`, destroyed in `destroyVoice()`
- **Never create Tone.js nodes inside React render** — `useAudioSync` hook is the only bridge
- **Always pass `time` arg** — inside `scheduleRepeat`, pass the `time` param to `triggerAttackRelease`. Never use `Date.now()`
- **Reverb is async** — `await reverb.ready` before chaining nodes
- **Audio context gate** — `await Tone.start()` must happen inside a user gesture handler
- **`Tone.getDraw().schedule()`** — used for all visual updates from the audio thread (flash, playhead) to keep them visually in sync with audio

### Scheduler loop (in `useAudioSync.js`)
```js
Tone.getTransport().scheduleRepeat((time) => {
  const step = Math.floor(ticks / (PPQ / 4)) % totalColumns;
  blocksAtStep.forEach(b => audioEngine.triggerBlock(b.id, b.note, b.duration, time));
  Tone.getDraw().schedule(() => {
    flashBlock(id);         // triggers emissive glow
    setCurrentStep(step);   // moves playhead + rotates carousel
  }, time);
}, '16n');
```

### WAV Export
Uses `Tone.Offline()` to rebuild the entire voice graph in an `OfflineAudioContext`, renders to `AudioBuffer`, then `audiobuffer-to-wav` encodes it. The offline graph is built fresh — live nodes cannot be reused.

---

## 3D Block Rendering (CSS)

Each block in the sequencer grid uses `transform-style: preserve-3d` with a `rotateX(14deg)` tilt on the wrapper. Three visible faces: front (full color), top (lighter), side (darker). Uses `transformOrigin` at each edge + a single rotate — no extra translation.

Emissive play effect:
- `triggerSet` (Set in store) tracks currently-playing block IDs
- `flashBlock(id)` adds to set; `unflashBlock(id)` removes after 300ms
- Block subscribes: `s => s.triggerSet.has(block.id)` — boolean selector, memoized
- When playing: front face → near-white, `box-shadow` blooms with octave glow color
- **Must always return `new Set()`** from store mutations — Zustand shallow equality won't detect mutation of the same Set instance

---

## Visualiser (3D Carousel)

- **16 column slots** arranged in a ring around the Y axis
- Each slot has **4 stacked levels** (octaves 2–5): lowest octave (oct 2, red) on top
- **Filler blocks**: empty octave levels shown as white ghost blocks (`rgba(255,255,255,0.06)`)
- Scene has `rotateX(18deg)` overhead tilt to reveal top faces
- Ring `rotateY` animates per beat to bring `currentStep` to front
- Shortest-path rotation: `delta = ((target - current) % 360 + 540) % 360 - 180`
- Idle drift: slow `requestAnimationFrame` spin when `playbackState === 'stopped'`
- Fullscreen via browser Fullscreen API (`requestFullscreen` / `exitFullscreen`)

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected block |
| `Escape` | Deselect block |

Global listener on `window` in `App.jsx`. Skips when an `<input>` is focused.

---

## Undo / Redo

History stored in Zustand: `history[]` and `future[]` arrays of block snapshots (max 50 each).

Actions that push history: `addBlock`, `removeBlock`, `clearBlocks`, `commitDrag` (called on `pointerup` after drag/resize).

`updateBlock` during drag does NOT push history — only `commitDrag` does at drag end.

---

## Persistence

- **Auto-save**: debounced 500ms to `localStorage` key `block-sequencer-v1` on every block mutation
- **Load on start**: reads from localStorage in store initializer
- **↓ Save JSON**: downloads `composition.json` (full store snapshot)
- **↑ Load JSON**: file picker, parses JSON, calls `loadComposition()` which resets the store
- **⬇ WAV**: renders via `Tone.Offline()` + `audiobuffer-to-wav`, downloads `composition.wav`

---

## Running the Project

```bash
cd "C:/Users/bipin/Desktop/04_2025 Work/block-sequencer"
npm run dev        # dev server → http://localhost:5173
npm run build      # production build → dist/
```

Dependencies: `tone`, `zustand`, `audiobuffer-to-wav`, `tailwindcss`, `@tailwindcss/vite`
