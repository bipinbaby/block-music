# BlockSynth — Full Code Documentation

This document explains every part of the project: what it does, how it works, and why
each piece of code is written the way it is. Written to be readable without being a
professional developer — if you know some Python and have used node-based tools like
TouchDesigner or Blender's shader editor, most concepts here will feel familiar.

---

## Table of Contents

1. [What the app does (big picture)](#1-what-the-app-does)
2. [Tech stack — what each library is for](#2-tech-stack)
3. [Project file structure](#3-project-file-structure)
4. [How data flows (the mental model)](#4-how-data-flows)
5. [The Store — sequencerStore.js](#5-the-store)
6. [The Audio Engine — AudioEngine.js](#6-the-audio-engine)
7. [The Audio Bridge — useAudioSync.js](#7-the-audio-bridge)
8. [The Grid — SequencerGrid.jsx](#8-the-sequencer-grid)
9. [The Block — Block.jsx](#9-the-block)
10. [The Piano Keys — PianoKeys.jsx](#10-the-piano-keys)
11. [The Block Panel — BlockPanel + sections](#11-the-block-panel)
12. [The Transport Bar — TransportBar.jsx](#12-the-transport-bar)
13. [The Visualizer — Visualizer.jsx (Three.js)](#13-the-visualizer)
14. [Utilities — noteUtils.js and colorUtils.js](#14-utilities)
15. [Keyboard shortcuts — App.jsx](#15-keyboard-shortcuts)
16. [Persistence — save, load, WAV export](#16-persistence)
17. [Deployment — netlify.toml](#17-deployment)

---

## 1. What the App Does

BlockSynth is a **browser-based music sequencer**. It works like this:

- You see a grid (called a **piano roll**). Each row is a musical pitch, each column
  is a point in time.
- You click a cell to place a **block**. That block is a note that plays when the
  sequencer reaches that column.
- Every block has its own **synthesizer** — you control the wave shape, filter,
  amplitude envelope, reverb, delay, and an LFO (a slow oscillator that modulates
  a parameter over time).
- On the right side there is a **3D visualizer**: a ring of blocks that rotates as
  music plays, with the current column always facing front. When a note fires, the
  corresponding block lights up with an emissive glow.
- You can **save/load** the composition as JSON, and **export to WAV** entirely
  inside the browser — no server involved.

---

## 2. Tech Stack

| Library | What it does |
|---------|-------------|
| **Vite + React 18** | Builds the app and handles the UI. React lets you describe what the screen should look like and re-renders only what changed. Vite is the build tool — `npm run dev` starts a fast local server. |
| **Zustand** | Stores all application state (blocks, playback, BPM…) in one place. Think of it like a shared Python dictionary that any component can read or write, and React automatically re-renders anything that uses a value when that value changes. |
| **Tone.js v14** | A Web Audio library. It wraps the browser's low-level audio API and gives you synthesizers, effects, a transport clock, and precise scheduling. Without it you'd have to deal with raw `AudioContext` nodes. |
| **Three.js** | A 3D rendering library. The visualizer uses it to draw a WebGL scene in a `<canvas>` element. You get 3D geometry, lights, materials, and a camera — like a minimal game engine in the browser. |
| **audiobuffer-to-wav** | One small helper that converts an `AudioBuffer` (Web Audio's in-memory audio format) into a WAV file binary so it can be downloaded. |
| **Tailwind CSS v4** | A utility CSS framework. Mostly the app uses inline styles, but Tailwind provides some reset rules and is available for quick class-based styling. |

---

## 3. Project File Structure

```
block-sequencer/
│
├── src/
│   ├── main.jsx                 Entry point — mounts the React app
│   ├── App.jsx                  Root layout + global keyboard shortcuts
│   ├── constants.js             CELL_W and CELL_H (fallback grid cell sizes)
│   │
│   ├── store/
│   │   └── sequencerStore.js    ALL application state lives here (Zustand)
│   │
│   ├── audio/
│   │   └── AudioEngine.js       All Tone.js nodes. The only place audio is created.
│   │
│   ├── hooks/
│   │   └── useAudioSync.js      Watches the store, calls AudioEngine reactively
│   │
│   ├── utils/
│   │   ├── noteUtils.js         Row index → note name (e.g. row 12 → "B4")
│   │   └── colorUtils.js        Octave number → HSL colour strings
│   │
│   └── components/
│       ├── TransportBar/
│       │   └── TransportBar.jsx  Play/pause/stop, BPM, volume, undo, save/load/WAV
│       │
│       ├── SequencerGrid/
│       │   ├── SequencerGrid.jsx  The piano roll grid, click-to-add, playhead
│       │   ├── Block.jsx          Individual 3D CSS block, drag, resize, glow
│       │   └── PianoKeys.jsx      Left-side note labels
│       │
│       ├── BlockPanel/
│       │   ├── BlockPanel.jsx     Bottom drawer, shown when a block is selected
│       │   ├── OscillatorSection.jsx
│       │   ├── FilterSection.jsx
│       │   ├── AmplifierSection.jsx
│       │   ├── FXSection.jsx
│       │   ├── LFOSection.jsx
│       │   └── ADSREditor.jsx     Reusable ADSR slider component
│       │
│       └── Visualizer/
│           └── Visualizer.jsx    Three.js 3D carousel
│
├── CLAUDE.md                    Project notes for the AI assistant
├── DOCS.md                      This file
├── netlify.toml                 Netlify deploy config
├── vite.config.js               Build config
└── index.html                   HTML shell
```

---

## 4. How Data Flows

This is the most important thing to understand before reading any individual file.

```
User clicks/types
      │
      ▼
  React component  ──► calls a store action (e.g. addBlock, setPlaybackState)
                                │
                                ▼
                         Zustand Store  ──► auto-saves to localStorage
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
            React re-renders          useAudioSync hook
            (UI updates)              (watches store changes)
                                           │
                                           ▼
                                      AudioEngine
                                   (Tone.js nodes)
                                           │
                                           ▼
                                    Browser audio output
```

**Key rule:** React components never create audio nodes. The audio engine never
touches the DOM. They communicate only through the store. This separation keeps
bugs isolated — audio problems are in `AudioEngine.js`, visual problems are in
the components.

---

## 5. The Store

**File:** `src/store/sequencerStore.js`

The store is the single source of truth for everything in the app. It is created
with Zustand's `create()` function, which returns a React hook (`useSequencerStore`)
that any component can call.

### What's stored

```js
{
  blocks: [],            // Array of all note blocks on the grid
  selectedBlockId: null, // Which block is currently selected (for the panel)
  playbackState: 'stopped', // 'playing' | 'paused' | 'stopped'
  currentStep: 0,        // Which column is currently playing (0-indexed)
  bpm: 120,              // Beats per minute
  masterVolume: -6,      // Master volume in decibels
  totalColumns: 16,      // How many time steps in one loop
  totalRows: 48,         // Fixed: 4 chromatic octaves (C2–B5)

  triggerSet: Set,       // IDs of blocks currently flashing (emissive glow)
  lastPlayedId: null,    // Most recently triggered block ID

  history: [],           // Stack of previous block arrays (for undo)
  future: [],            // Stack of undone arrays (for redo)
}
```

### How a block object looks

```js
{
  id: "block_3",
  column: 4,          // time position (0 = leftmost)
  row: 12,            // pitch position (0 = highest, 47 = lowest)
  duration: 2,        // how many columns wide (2 = two 16th notes)
  note: "B4",         // Tone.js note string, kept in sync with row
  octave: 4,          // 2–5, determines the block's colour

  oscillator: { type: 'sawtooth' },

  filter: {
    type: 'lowpass',
    frequency: 2000,  // cutoff in Hz
    Q: 1,             // resonance
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
    rate: 2,                       // Hz
    depth: 0.5,
    target: 'filter.frequency',   // what it modulates
    type: 'sine',
    tempoSynced: false
  }
}
```

### Key patterns in the store

**Why `new Set()` every time for triggerSet:**
```js
flashBlock(id) {
  set(s => ({
    triggerSet: new Set([...s.triggerSet, id]),  // ← new Set, not s.triggerSet.add(id)
  }));
},
```
Zustand uses shallow equality to decide if something changed. If you mutated the
existing Set with `.add()`, the reference would be the same object, Zustand would
think nothing changed, and the block would never re-render to show the glow.
Creating a new Set forces a reference change, which triggers re-renders.

**Why `updateBlock` doesn't push history:**
During a drag, `updateBlock` is called every few milliseconds as the block moves.
Pushing a history snapshot on every one of those calls would flood the undo stack
with 50 nearly-identical states. Instead, only `commitDrag()` pushes to history —
it is called once at `pointerup` when the drag ends.

**Undo/redo:**
Each history entry is a snapshot of the entire `blocks` array. Max 50 entries to
cap memory usage. `undo()` takes the top of `history`, applies it as the new
`blocks`, and pushes the current `blocks` onto `future`. `redo()` reverses that.

---

## 6. The Audio Engine

**File:** `src/audio/AudioEngine.js`

This is a plain JavaScript class (not React). It owns every Tone.js audio node in
the app. It is exported as a **singleton** — one instance shared across the whole app:

```js
export const audioEngine = new AudioEngine();
```

### The audio graph per block

Think of this like a node chain in TouchDesigner or a VST plugin chain in a DAW:

```
Tone.MonoSynth  (oscillator + built-in filter + envelopes)
      │
Tone.Gain       (volume / amplifier)
      │
Tone.Reverb     (always connected, wet=0 when disabled)
      │
Tone.FeedbackDelay (always connected, wet=0 when disabled)
      │
Tone.Volume     (master volume node)
      │
Tone.Destination (browser audio output)
```

### Voice lifecycle

- `createVoice(block)` — builds the full node chain for one block, stores it in
  `this.voices` (a Map of blockId → nodes). Called when a block is added.
- `updateVoice(block)` — re-applies all parameters from the block data onto the
  existing nodes. Called whenever the user changes a knob in the panel.
- `destroyVoice(blockId)` — disconnects and disposes all nodes for that block.
  Important: Web Audio nodes hold memory and CPU; they must be disposed explicitly.
- `pruneVoices(activeIds)` — destroys any voice whose block no longer exists in the store.

### Why `await reverb.ready`

`Tone.Reverb` generates its impulse response asynchronously (it runs an offline
audio process to build a realistic reverb tail). You must wait for it before
connecting downstream nodes, otherwise you'd connect to an uninitialised node.

### The transport scheduler

```js
startTransport(bpm, totalColumns, onStep) {
  Tone.getTransport().scheduleRepeat((time) => {
    const sixteenth = Tone.getTransport().ticks / (PPQ / 4);
    const step = Math.floor(sixteenth) % totalColumns;
    if (this._onStep) this._onStep(step, time);
  }, '16n');   // fires every 16th note
  Tone.getTransport().start();
}
```

`time` here is not wall-clock time — it is a precise Web Audio timestamp measured
from when the audio context started. You **must** pass this `time` value through to
`triggerAttackRelease` so notes fire at exactly the right sample, not with
JavaScript's imprecise setTimeout timing.

### WAV export (`renderToBuffer`)

`Tone.Offline()` creates a completely separate, headless audio context that runs
faster than real-time. You provide it a function that builds the audio graph and
schedules events, and it gives you back an `AudioBuffer` with the rendered audio.
The live audio nodes cannot be reused — the offline graph is built fresh inside
the callback.

---

## 7. The Audio Bridge

**File:** `src/hooks/useAudioSync.js`

This is a custom React hook (a function whose name starts with `use`). It is called
once in `App.jsx` and runs for the lifetime of the app.

Its job: watch the store for changes and call the audio engine imperatively.

```js
// When blocks change: create/update/destroy Tone.js voices
useEffect(() => {
  for (const block of blocks) {
    if (!audioEngine.hasVoice(block.id)) {
      await audioEngine.createVoice(block);
    } else {
      audioEngine.updateVoice(block);
    }
  }
  audioEngine.pruneVoices(blocks.map(b => b.id));
}, [blocks]);
```

### Why `Tone.getDraw().schedule()` for visual updates

Inside the transport callback, audio is running on a separate high-priority thread.
If you call `setCurrentStep()` directly from there, the visual update would fire
whenever the JavaScript engine has spare time — which might be milliseconds late,
causing the playhead to stutter or flash at the wrong moment.

`Tone.getDraw().schedule()` queues the visual update to fire at the exact audio
timestamp, but dispatches it on the main thread at the right visual frame. This
keeps the playhead and block glow perfectly in sync with what you hear.

```js
Tone.getDraw().schedule(() => {
  flashBlock(block.id);          // triggers glow in the store
  setTimeout(() => unflashBlock(block.id), 300); // removes glow after 300ms
}, time);  // ← fires at the exact audio timestamp
```

---

## 8. The Sequencer Grid

**File:** `src/components/SequencerGrid/SequencerGrid.jsx`

This component renders the piano roll — the main grid where blocks are placed.

### Dynamic cell sizing

Earlier versions had fixed pixel sizes (`CELL_W=76, CELL_H=34`), which meant the
grid was always taller and wider than the window, requiring scrollbars.

The current version uses a `ResizeObserver` to measure the available container size:

```js
const ro = new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  setArea({ w: width, h: height });
});
ro.observe(outerRef.current);
```

Then computes cells that exactly fill the space:

```js
const cellW = (area.w - KEY_WIDTH) / totalColumns;  // KEY_WIDTH = 58px for piano labels
const cellH = area.h / TOTAL_ROWS;                  // TOTAL_ROWS = 48
```

`ResizeObserver` fires whenever the container changes size — including when the
BlockPanel drawer opens/closes, shrinking the available height. The grid always
fills the window.

### Click to add a block

The entire grid background listens for pointer clicks. When the user clicks on an
empty spot (not an existing block), it calculates which column and row were clicked:

```js
const col = Math.floor(x / cellW);
const row = Math.floor(y / cellH);
addBlock(col, row);
```

The `if (e.target !== e.currentTarget) return` guard ensures clicks that land on
an existing block (which are child elements) don't also add a new block beneath it.

### The async guard around `audioEngine.initialize()`

```js
const target  = e.currentTarget;  // capture BEFORE the await
const clientX = e.clientX;
if (!audioEngine.initialized) await audioEngine.initialize();
const rect = target.getBoundingClientRect();
```

After an `await`, `e.currentTarget` is set to null by the browser (the synthetic
event is pooled and reused). We capture the values we need into local variables
before the await so they're still available after.

---

## 9. The Block

**File:** `src/components/SequencerGrid/Block.jsx`

Each block is a standalone React component. It reads only the slice of the store
it needs, so only it re-renders when its data changes — not the entire grid.

### CSS 3D effect

The block is made with `transform-style: preserve-3d` — this tells the browser to
render child elements in true 3D space, not flatten them. The wrapper is tilted:

```js
transform: 'rotateX(14deg)'
```

This gives it a slight overhead perspective so you see the top face. Three faces
are rendered as absolutely positioned divs:

- **Front face** — the main coloured rectangle you see head-on
- **Top face** — `transform: 'rotateX(-90deg) translateY(-FACE_DEPTH)'` — rotates
  a thin strip so it sticks up from the top edge of the front face, giving depth
- **Right side face** — same idea but `rotateY(90deg)` from the right edge

The key CSS concept: `transformOrigin` at the hinge edge + a single rotation,
rather than rotation + translation. If you also translate, you get doubles.

### Emissive glow when playing

Each block subscribes to a boolean selector:

```js
const isPlaying = useSequencerStore(s => s.triggerSet.has(block.id));
```

When `isPlaying` is true, the front face switches from its octave colour to the
near-white emissive colour, and a large `box-shadow` blooms outward:

```js
const boxShadow = isPlaying
  ? `0 0 22px 8px ${glowInner}, 0 0 50px 18px ${glowOuter}`
  : '';
```

This is the CSS equivalent of an emissive material in a 3D engine — the block
appears to emit light rather than reflect it.

### Drag

On `pointerdown`, the block records the starting position:

```js
dragState.current = {
  startX: e.clientX, startY: e.clientY,
  origCol: block.column, origRow: block.row,
};
```

On `pointermove`, it calculates how far the pointer moved in grid units:

```js
const newCol = origCol + Math.round(dx / cellW);
const newRow = origRow + Math.round(dy / cellH);
updateBlock(block.id, { column: newCol, row: newRow });
```

`updateBlock` updates the store without pushing history. On `pointerup`, `commitDrag()`
pushes one history snapshot.

### Resize

The right 10px of each block is a separate `<div>` with `cursor: ew-resize` (the
horizontal resize cursor). It works like the drag above but only modifies `duration`.

---

## 10. The Piano Keys

**File:** `src/components/SequencerGrid/PianoKeys.jsx`

A narrow column of 48 labelled rows on the left side. Each row is sized to `cellH`
(received as a prop from SequencerGrid) so it stays perfectly aligned with the grid.

Black keys get a darker background (`rgba(0,0,0,0.4)`). C notes get a brighter label
(`rgba(255,255,255,0.7)`) with bold weight to help musicians orient on the grid.
Other white key names are shown faintly; sharps show no text (just a dark row) to
keep it uncluttered.

---

## 11. The Block Panel

**Files:** `src/components/BlockPanel/`

The panel slides up from the bottom when a block is selected. It is `null` (renders
nothing) when `selectedBlockId` is null — this means it takes zero space when hidden,
so the grid gets the full height.

```js
if (!block) return null;
```

It has five tabs: **OSC, FILTER, AMP, FX, LFO**. Each tab renders a section component.
All sections call `updateBlock(id, patch)` on every change — a deep-merge patch —
which flows through `useAudioSync` to update the live Tone.js nodes in real time
while music plays.

### Sections at a glance

| Tab | Controls | What it changes |
|-----|----------|-----------------|
| OSC | Waveform (sine/square/saw/triangle) | `block.oscillator.type` → `synth.oscillator.type` |
| FILTER | Type, cutoff, Q, envelope ADSR + amount | `block.filter` → `synth.filter` + `synth.filterEnvelope` |
| AMP | Gain, ADSR | `block.amplifier` → `gain.gain` + `synth.envelope` |
| FX | Reverb toggle + room/wet, Delay toggle + time/feedback/wet | `block.fx` → `reverb.wet` / `delay.wet` |
| LFO | Rate, depth, target, waveform, tempo sync | `block.lfo` → recreates `Tone.LFO` and reconnects it |

### ADSREditor

A reusable component that renders 4 vertical sliders (Attack, Decay, Sustain, Release).
Vertical sliders are `input[type=range]` with `writing-mode: vertical-lr; direction: rtl`
which rotates the slider 90° so it reads bottom-to-top. Used in both FilterSection and
AmplifierSection.

---

## 12. The Transport Bar

**File:** `src/components/TransportBar/TransportBar.jsx`

The top bar that controls playback. Key parts:

**Play/Pause button:** calls `setPlaybackState('playing')` or `setPlaybackState('paused')`.
`useAudioSync` watches `playbackState` and calls `audioEngine.startTransport()` or
`audioEngine.pauseTransport()`.

**Stop button:** sets state to `'stopped'`, which causes `useAudioSync` to call
`audioEngine.stopTransport()` and reset `currentStep` to 0.

**BPM input:** `<input type="number">` that calls `setBpm()`. `useAudioSync` calls
`audioEngine.setBpm()` which sets `Tone.getTransport().bpm.value`.

**Volume slider:** `<input type="range">` from -40dB to 0dB. Updates
`audioEngine.setMasterVolume()` which sets the master `Tone.Volume` node.

**Save JSON:** serialises the store's `blocks`, `bpm`, `masterVolume`, `totalColumns`,
`totalRows` to a JSON string and triggers a browser download via a temporary `<a>` tag.

**Load JSON:** opens a hidden `<input type="file">`, reads the chosen file as text,
parses it, and calls `loadComposition()` in the store, which fully replaces all state.

**Export WAV:** calls `audioEngine.renderToBuffer()`, which uses `Tone.Offline()` to
render the composition faster-than-realtime. The resulting `AudioBuffer` is converted
to a WAV binary by `audiobuffer-to-wav` and downloaded. A spinner state (`exporting`)
disables the button during rendering to prevent double-clicks.

---

## 13. The Visualizer

**File:** `src/components/Visualizer/Visualizer.jsx`

The 3D carousel on the right side of the screen. Built with Three.js, rendered into
a `<canvas>` inside a `<div ref={mountRef}>`.

### Why Three.js instead of CSS 3D

CSS 3D (`transform-style: preserve-3d`) is limited:
- Overflow clipping breaks the perspective
- You can't easily do proper lighting across multiple objects
- Point lights and emissive glow are impossible

Three.js uses WebGL — real GPU-accelerated 3D rendering. You get full control over
geometry, materials, lights, and the render loop.

### Scene setup

```js
const scene    = new THREE.Scene();         // container for all 3D objects
const camera   = new THREE.PerspectiveCamera(52, aspect, 0.1, 200);
camera.position.set(0, 2.8, 11);           // slightly above and in front
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
container.appendChild(renderer.domElement); // attach <canvas> to the page
```

Three lights:
- `AmbientLight` — fills everything with a base brightness so nothing is pure black
- `DirectionalLight` (key light) — the main light from upper-right, creates shadows
- `DirectionalLight` (rim light) — a purple-tinted light from behind, gives the
  blocks a glow on their back edge

### Carousel structure

All blocks sit inside a `THREE.Group` called `carousel`. Rotating the group rotates
all blocks at once.

```
carousel (Group)
  ├── column 0 slot
  │     ├── octave 2 block (Mesh)
  │     ├── octave 3 block (Mesh)
  │     ├── octave 4 block (Mesh)
  │     └── octave 5 block (Mesh)
  ├── column 1 slot
  │     └── ...
  └── column 15 slot
        └── ...
```

Each column is positioned using trigonometry — `sin` and `cos` give you the X and Z
coordinates on a circle of a given radius:

```js
const angle = (col / totalColumns) * Math.PI * 2;  // e.g. col 4 of 16 = 90°
const x = Math.sin(angle) * radius;
const z = Math.cos(angle) * radius;
```

`mesh.lookAt(0, y, 0)` rotates each mesh to face the center of the ring, so all
blocks face inward.

Octave levels are stacked vertically:
```js
const y = ((N_LEVELS - 1 - lvl) - (N_LEVELS - 1) / 2) * (BH + GAP_H);
// lvl=0 (oct2, red) → top
// lvl=3 (oct5, green) → bottom
```

### Materials

Real blocks use `MeshStandardMaterial` — a physically-based material that responds
to lights realistically. It has two key emissive properties:
- `emissive` — an RGB colour that the material emits regardless of lighting
- `emissiveIntensity` — how bright that emission is (0 = off, 1 = full)

Filler blocks (empty octave slots) use a dark, semi-transparent material so you see
the ring shape even where there are no notes.

### Emissive flash — 3 layers

When a block triggers, three things happen together:

1. **Material emissive** — `mat.emissiveIntensity` ramps from 0 to 1.8 in 35ms, then
   fades over ~280ms. The block face glows from within.

2. **Glow sprite** — a `THREE.Sprite` (a flat quad that always faces the camera) using
   an additive radial gradient texture. Its opacity and scale pulse with the flash.
   Additive blending means it adds light to what's behind it, like a real light source.

3. **Point light** — a `THREE.PointLight` at the block's position with intensity 0
   normally, spiking to 3.5 on flash. This casts coloured light onto adjacent blocks
   in the ring — the neighbouring blocks briefly light up in the flashing block's colour,
   exactly like a real LED.

### Rotation

Rotation is driven by a `ref` (not React state) to avoid triggering React re-renders
on every frame:

```js
const rot = { current: 0, target: 0, playbackState: 'stopped' };
```

The store is subscribed to with `useSequencerStore.subscribe()` — a lower-level API
that fires a callback whenever state changes, without causing any React re-renders:

```js
useSequencerStore.subscribe((state, prev) => {
  if (state.playbackState === 'playing' && state.currentStep !== prev.currentStep) {
    // Compute the angle for this step and set rot.target
    const stepAngle = -(state.currentStep / state.totalColumns) * Math.PI * 2;
    // Shortest arc: find delta between -π and +π so it never spins the long way
    let delta = stepAngle - rot.target;
    while (delta >  Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    rot.target = rot.target + delta;
  }
});
```

In the animation loop, `rot.current` is smoothly lerped toward `rot.target`:

```js
rot.current += (rot.target - rot.current) * Math.min(1, lerpSpeed * dt);
carousel.rotation.y = rot.current;
```

Lerp (linear interpolation) means: each frame, move a fraction of the remaining
distance. This creates a smooth ease-out without needing a CSS transition.

- **Playing** — fast lerp (speed 9), snappy rotation per beat
- **Stopped** — target resets to 0, slow lerp (speed 3.5) eases back
- **Paused** — target unchanged, rotation freezes where it is

### Cleanup

All Three.js resources are disposed when the component unmounts:

```js
return () => {
  cancelAnimationFrame(rafId);
  unsub();             // unsubscribe from store
  ro.disconnect();     // stop ResizeObserver
  renderer.dispose();  // free WebGL resources
  container.removeChild(renderer.domElement);
};
```

WebGL contexts are a limited GPU resource. If you don't dispose them in development
(where React hot-reloads frequently), you'll hit the browser's maximum context limit.

---

## 14. Utilities

### noteUtils.js

The grid has 48 rows. Row 0 is the highest note (B5) and row 47 is the lowest (C2).
The mapping works by cycling through the 12 chromatic note names:

```js
const NOTES = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];

function rowToNote(row) {
  const noteIndex = row % 12;     // which of the 12 notes in the current octave
  const octave = 5 - Math.floor(row / 12);  // which octave (5 at top, 2 at bottom)
  return `${NOTES[noteIndex]}${octave}`;    // e.g. "C4"
}
```

`isBlackKey(row)` checks if the row index mod 12 lands on one of the 5 sharps/flats
in the NOTES array (indices 1, 3, 5, 8, 10 = A#, G#, F#, D#, C#). Used to darken
those rows in the grid.

### colorUtils.js

Maps octave number to a hue in degrees (red, orange, yellow, green for octaves 2–5),
then generates CSS `hsl()` strings at different lightness values:

```js
const OCTAVE_HUES = { 2: 0, 3: 30, 4: 60, 5: 120 };

blockColor(octave)      → hsl(H, 90%, 62%)   main face colour
blockTopColor(octave)   → hsl(H, 70%, 80%)   lighter top face
blockSideColor(octave)  → hsl(H, 90%, 38%)   darker side face
blockEmissiveColor(oct) → hsl(H, 100%, 92%)  near-white bright version
blockGlowColor(oct)     → hsla(H, 100%, 70%) for box-shadow bloom
```

HSL is more intuitive for this than RGB: `H` = hue (the colour wheel position),
`S` = saturation (how vivid), `L` = lightness (how bright/dark). Changing only `L`
gives you the same hue at different brightness levels, which is perfect for the
top/side face variations.

---

## 15. Keyboard Shortcuts

**File:** `src/App.jsx`

A single `keydown` listener on `window` handles all shortcuts:

```js
window.addEventListener('keydown', onKeyDown);
```

The handler skips if the focused element is an `<input>` or `<textarea>`, so typing
in the BPM field doesn't accidentally trigger undo or delete.

| Key | Action |
|-----|--------|
| `Space` | Toggle play/pause |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected block |
| `Escape` | Deselect block (closes the panel) |

---

## 16. Persistence

### Auto-save to localStorage

Whenever `blocks`, `bpm`, `masterVolume`, `totalColumns`, or `totalRows` change,
a debounced save fires 500ms later:

```js
function scheduleSave(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem('block-sequencer-v1', JSON.stringify({
      blocks, bpm, masterVolume, totalColumns, totalRows
    }));
  }, 500);
}
```

Debouncing means: if you move a block 100 pixels (triggering 100 rapid state changes),
only one save happens — 500ms after you stopped moving. Without debouncing, every
tiny drag frame would write to disk.

On app load, the store reads from localStorage as its initial state:

```js
const saved = loadFromStorage();
export const useSequencerStore = create((set, get) => ({
  blocks: saved?.blocks ?? [],
  bpm: saved?.bpm ?? 120,
  ...
}));
```

### JSON save/load

These let you keep compositions as files and share them. The save serialises the
store state to JSON and triggers a download. The load opens a file picker, reads
the file, and calls `loadComposition()` which resets the entire store.

`loadComposition` also resets `nextId` (the block ID counter) to avoid ID collisions
with newly added blocks after loading:

```js
const maxId = blocks.reduce((m, b) => Math.max(m, parseInt(b.id.replace('block_',''))), 0);
nextId = maxId + 1;
```

### WAV export

`Tone.Offline()` works like this:
1. You tell it how long the audio should be (in seconds)
2. You provide a callback where you build your entire audio graph and schedule events
3. It runs everything in a private `OfflineAudioContext` (no speaker output), faster
   than real-time
4. It returns an `AudioBuffer` — the rendered audio in memory

The `audiobuffer-to-wav` library converts that buffer to a WAV binary (PCM format)
which the browser can download.

---

## 17. Deployment

**File:** `netlify.toml`

```toml
[build]
  command = "npm run build"   # runs: vite build → outputs to dist/
  publish = "dist"            # Netlify serves files from this folder

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

The redirect rule is critical for single-page apps. If someone visits
`yoursite.netlify.app/some-path`, Netlify would normally look for a file at
`dist/some-path/index.html`, fail, and return a 404. The redirect rule catches
all paths and serves the main `index.html` instead, letting React handle routing
client-side.

### Deploying to Netlify

1. Push the repo to GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
3. Select the repo — Netlify reads `netlify.toml` automatically
4. Click **Deploy** — done. Every `git push` to `main` auto-redeploys.
