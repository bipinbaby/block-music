import React, { useEffect } from 'react';
import TransportBar from './components/TransportBar/TransportBar';
import SequencerGrid from './components/SequencerGrid/SequencerGrid';
import BlockPanel from './components/BlockPanel/BlockPanel';
import Visualizer from './components/Visualizer/Visualizer';
import { useAudioSync } from './hooks/useAudioSync';
import { useSequencerStore } from './store/sequencerStore';

export default function App() {
  useAudioSync();

  // Global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName;
      // Don't intercept when typing in inputs
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z') {
        e.preventDefault();
        useSequencerStore.getState().undo();
        return;
      }
      if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        useSequencerStore.getState().redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const { selectedBlockId, removeBlock } = useSequencerStore.getState();
        if (selectedBlockId) removeBlock(selectedBlockId);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        const { playbackState, setPlaybackState } = useSequencerStore.getState();
        setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing');
        return;
      }
      if (e.key === 'Escape') {
        useSequencerStore.getState().deselectBlock();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d1a', userSelect: 'none' }}>
      <TransportBar />

      {/* Main area: sequencer left, visualiser right */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sequencer — 58% */}
        <div style={{
          flex: '0 0 58%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}>
          <SequencerGrid />
          <BlockPanel />
        </div>

        {/* Visualiser — 42% */}
        <div style={{ flex: '0 0 42%', overflow: 'hidden' }}>
          <Visualizer />
        </div>
      </div>
    </div>
  );
}
