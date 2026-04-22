import React, { useRef, useState } from 'react';
import { useSequencerStore } from '../../store/sequencerStore';
import { audioEngine } from '../../audio/AudioEngine';
import toWav from 'audiobuffer-to-wav';

export default function TransportBar() {
  const playbackState = useSequencerStore(s => s.playbackState);
  const bpm = useSequencerStore(s => s.bpm);
  const masterVolume = useSequencerStore(s => s.masterVolume);
  const canUndo = useSequencerStore(s => s.history.length > 0);
  const canRedo = useSequencerStore(s => s.future.length > 0);

  const setPlaybackState = useSequencerStore(s => s.setPlaybackState);
  const setBpm = useSequencerStore(s => s.setBpm);
  const setMasterVolume = useSequencerStore(s => s.setMasterVolume);
  const loadComposition = useSequencerStore(s => s.loadComposition);
  const clearBlocks = useSequencerStore(s => s.clearBlocks);
  const undo = useSequencerStore(s => s.undo);
  const redo = useSequencerStore(s => s.redo);

  const fileInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  async function ensureAudio() {
    if (!audioEngine.initialized) await audioEngine.initialize();
  }

  async function handlePlay() {
    await ensureAudio();
    setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing');
  }

  async function handleStop() {
    await ensureAudio();
    setPlaybackState('stopped');
  }

  function handleClearAll() {
    if (window.confirm('Clear all blocks?')) clearBlocks();
  }

  function handleSaveJSON() {
    const s = useSequencerStore.getState();
    const data = { blocks: s.blocks, bpm: s.bpm, masterVolume: s.masterVolume, totalColumns: s.totalColumns, totalRows: s.totalRows };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'composition.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadJSON() { fileInputRef.current?.click(); }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { loadComposition(JSON.parse(ev.target.result)); }
      catch { alert('Invalid composition file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleExportWav() {
    await ensureAudio();
    setExporting(true);
    try {
      const s = useSequencerStore.getState();
      const buffer = await audioEngine.renderToBuffer(s.blocks, s.bpm, s.totalColumns);
      const wav = toWav(buffer);
      const blob = new Blob([new DataView(wav)], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'composition.wav'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('WAV export failed:', err);
      alert('Export failed — check console.');
    } finally { setExporting(false); }
  }

  const isPlaying = playbackState === 'playing';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 20px',
      background: '#1a1a2e',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0,
      flexWrap: 'wrap',
      minHeight: 56,
    }}>
      {/* Title */}
      <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginRight: 6, letterSpacing: '0.08em' }}>
        🎵 BLOCKSYNTH
      </span>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

      {/* Transport */}
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn onClick={handlePlay} active={isPlaying} color="#6ee7b7" size={36}>
          {isPlaying ? '⏸' : '▶'}
        </Btn>
        <Btn onClick={handleStop} color="#fca5a5" size={36}>■</Btn>
      </div>

      {/* BPM */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#888', fontSize: 12, fontWeight: 600 }}>
        BPM
        <input
          type="number"
          min={30} max={300}
          value={bpm}
          onChange={e => setBpm(Number(e.target.value))}
          style={{
            width: 60,
            background: '#0d0d1a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            color: '#fff',
            padding: '5px 8px',
            fontSize: 15,
            fontWeight: 700,
          }}
        />
      </label>

      {/* Volume */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#888', fontSize: 12, fontWeight: 600 }}>
        VOL
        <input
          type="range" min={-40} max={0} step={1}
          value={masterVolume}
          onChange={e => setMasterVolume(Number(e.target.value))}
          style={{ width: 90, accentColor: '#6ee7b7' }}
        />
        <span style={{ color: '#aaa', fontSize: 12, width: 36 }}>{masterVolume}dB</span>
      </label>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

      {/* Undo / Redo */}
      <div style={{ display: 'flex', gap: 5 }}>
        <Btn onClick={undo} disabled={!canUndo} color="#cbd5e1" title="Undo (Ctrl+Z)">↩</Btn>
        <Btn onClick={redo} disabled={!canRedo} color="#cbd5e1" title="Redo (Ctrl+Y)">↪</Btn>
      </div>

      {/* Clear All */}
      <Btn onClick={handleClearAll} color="#f87171">Clear All</Btn>

      <div style={{ flex: 1 }} />

      {/* File actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn onClick={handleSaveJSON} color="#93c5fd" small>↓ Save</Btn>
        <Btn onClick={handleLoadJSON} color="#93c5fd" small>↑ Load</Btn>
        <Btn onClick={handleExportWav} color="#c4b5fd" small disabled={exporting}>
          {exporting ? '⏳ …' : '⬇ WAV'}
        </Btn>
      </div>

      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
}

function Btn({ onClick, children, active, color = '#fff', small, size, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: active ? color : 'rgba(255,255,255,0.07)',
        color: active ? '#000' : color,
        border: `1px solid ${color}44`,
        borderRadius: 8,
        padding: size ? 0 : small ? '5px 12px' : '6px 14px',
        width: size,
        height: size,
        fontSize: size ? 18 : small ? 12 : 14,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.12s, color 0.12s',
        opacity: disabled ? 0.35 : 1,
        letterSpacing: '0.03em',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
