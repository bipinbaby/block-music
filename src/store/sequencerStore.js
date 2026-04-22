import { create } from 'zustand';
import { rowToNote, rowToOctave } from '../utils/noteUtils';

let nextId = 1;
function genId() {
  return `block_${nextId++}`;
}

export function createDefaultBlock(column, row) {
  return {
    id: genId(),
    column,
    row,
    duration: 1,
    note: rowToNote(row),
    octave: rowToOctave(row),
    oscillator: { type: 'sawtooth' },
    filter: {
      type: 'lowpass',
      frequency: 2000,
      Q: 1,
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3, amount: 800 },
    },
    amplifier: {
      gain: 0.8,
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.4 },
    },
    fx: {
      reverb: { enabled: false, roomSize: 0.5, wet: 0.3 },
      delay: { enabled: false, time: '8n', feedback: 0.4, wet: 0.2 },
    },
    lfo: {
      enabled: false,
      rate: 2,
      depth: 0.5,
      target: 'filter.frequency',
      type: 'sine',
      tempoSynced: false,
    },
  };
}

const STORAGE_KEY = 'block-sequencer-v1';
const MAX_HISTORY = 50;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

let saveTimer = null;
function scheduleSave(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { blocks, bpm, masterVolume, totalColumns, totalRows } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ blocks, bpm, masterVolume, totalColumns, totalRows }));
  }, 500);
}

const saved = loadFromStorage();

export const useSequencerStore = create((set, get) => ({
  blocks: saved?.blocks ?? [],
  selectedBlockId: null,
  playbackState: 'stopped',
  currentStep: 0,
  bpm: saved?.bpm ?? 120,
  masterVolume: saved?.masterVolume ?? -6,
  totalColumns: saved?.totalColumns ?? 16,
  totalRows: saved?.totalRows ?? 48,

  // Emissive flash state
  triggerSet: new Set(),
  lastPlayedId: null,

  // Undo / redo
  history: [],
  future: [],

  // ─── Block actions ───────────────────────────────────────────

  addBlock(column, row) {
    const block = createDefaultBlock(column, row);
    set(s => {
      const blocks = [...s.blocks, block];
      scheduleSave({ ...s, blocks });
      return {
        blocks,
        history: [...s.history.slice(-(MAX_HISTORY - 1)), s.blocks],
        future: [],
      };
    });
    return block.id;
  },

  updateBlock(id, patch) {
    set(s => {
      const blocks = s.blocks.map(b => {
        if (b.id !== id) return b;
        const updated = { ...b, ...patch };
        if (patch.row !== undefined) {
          updated.note = rowToNote(patch.row);
          updated.octave = rowToOctave(patch.row);
        }
        return updated;
      });
      scheduleSave({ ...s, blocks });
      return { blocks };
    });
  },

  // Called at end of drag to commit a history entry
  commitDrag() {
    set(s => ({
      history: [...s.history.slice(-(MAX_HISTORY - 1)), s.blocks],
      future: [],
    }));
  },

  removeBlock(id) {
    set(s => {
      const blocks = s.blocks.filter(b => b.id !== id);
      scheduleSave({ ...s, blocks });
      return {
        blocks,
        selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId,
        history: [...s.history.slice(-(MAX_HISTORY - 1)), s.blocks],
        future: [],
      };
    });
  },

  selectBlock(id) {
    set({ selectedBlockId: id });
  },

  deselectBlock() {
    set({ selectedBlockId: null });
  },

  clearBlocks() {
    set(s => {
      scheduleSave({ ...s, blocks: [] });
      return {
        blocks: [],
        selectedBlockId: null,
        history: [...s.history.slice(-(MAX_HISTORY - 1)), s.blocks],
        future: [],
      };
    });
  },

  // ─── Undo / Redo ─────────────────────────────────────────────

  undo() {
    set(s => {
      if (!s.history.length) return {};
      const prev = s.history[s.history.length - 1];
      scheduleSave({ ...s, blocks: prev });
      return {
        blocks: prev,
        history: s.history.slice(0, -1),
        future: [s.blocks, ...s.future.slice(0, MAX_HISTORY - 1)],
        selectedBlockId: null,
      };
    });
  },

  redo() {
    set(s => {
      if (!s.future.length) return {};
      const next = s.future[0];
      scheduleSave({ ...s, blocks: next });
      return {
        blocks: next,
        history: [...s.history.slice(-(MAX_HISTORY - 1)), s.blocks],
        future: s.future.slice(1),
        selectedBlockId: null,
      };
    });
  },

  // ─── Transport ───────────────────────────────────────────────

  setPlaybackState(state) {
    set({ playbackState: state });
  },

  setCurrentStep(step) {
    set({ currentStep: step });
  },

  setBpm(bpm) {
    set(s => { scheduleSave({ ...s, bpm }); return { bpm }; });
  },

  setMasterVolume(vol) {
    set(s => { scheduleSave({ ...s, masterVolume: vol }); return { masterVolume: vol }; });
  },

  // ─── Emissive flash ──────────────────────────────────────────

  flashBlock(id) {
    set(s => ({
      triggerSet: new Set([...s.triggerSet, id]),
      lastPlayedId: id,
    }));
  },

  unflashBlock(id) {
    set(s => {
      const t = new Set(s.triggerSet);
      t.delete(id);
      return { triggerSet: t };
    });
  },

  // ─── Persistence ─────────────────────────────────────────────

  loadComposition(data) {
    if (!data?.blocks) return;
    const blocks = data.blocks.map(b => ({ ...b }));
    const maxId = blocks.reduce((m, b) => {
      const n = parseInt(b.id.replace('block_', '')) || 0;
      return Math.max(m, n);
    }, 0);
    nextId = maxId + 1;
    set({
      blocks,
      bpm: data.bpm ?? 120,
      masterVolume: data.masterVolume ?? -6,
      totalColumns: data.totalColumns ?? 16,
      totalRows: data.totalRows ?? 48,
      selectedBlockId: null,
      playbackState: 'stopped',
      currentStep: 0,
      triggerSet: new Set(),
      lastPlayedId: null,
      history: [],
      future: [],
    });
  },

  getBlocksAtColumn(col) {
    return get().blocks.filter(b => b.column === col);
  },
}));
