import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useSequencerStore } from '../../store/sequencerStore';
import { audioEngine } from '../../audio/AudioEngine';
import Block from './Block';
import PianoKeys from './PianoKeys';
import { isBlackKey } from '../../utils/noteUtils';
import { KEY_WIDTH } from './PianoKeys';

const TOTAL_ROWS = 48;
const MIN_CELL_W = 22;
const MIN_CELL_H = 10;

export default function SequencerGrid() {
  const blocks        = useSequencerStore(s => s.blocks);
  const totalColumns  = useSequencerStore(s => s.totalColumns);
  const currentStep   = useSequencerStore(s => s.currentStep);
  const playbackState = useSequencerStore(s => s.playbackState);
  const addBlock      = useSequencerStore(s => s.addBlock);
  const deselectBlock = useSequencerStore(s => s.deselectBlock);

  const outerRef = useRef(null);
  const gridRef  = useRef(null);

  // Dynamic cell dimensions derived from container size
  const [area, setArea] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setArea({ w: width, h: height });
    });
    ro.observe(el);
    // Seed immediately
    setArea({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const cellW = area.w > 0
    ? Math.max(MIN_CELL_W, (area.w - KEY_WIDTH) / totalColumns)
    : 76;
  const cellH = area.h > 0
    ? Math.max(MIN_CELL_H, area.h / TOTAL_ROWS)
    : 34;

  const gridWidth  = totalColumns * cellW;
  const gridHeight = TOTAL_ROWS   * cellH;

  const handleGridPointerDown = useCallback(async (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;

    const target  = e.currentTarget;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (!audioEngine.initialized) await audioEngine.initialize();

    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left + target.scrollLeft;
    const y = clientY - rect.top  + target.scrollTop;

    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);

    if (col >= 0 && col < totalColumns && row >= 0 && row < TOTAL_ROWS) {
      addBlock(col, row);
      deselectBlock();
    }
  }, [totalColumns, addBlock, deselectBlock, cellW, cellH]);

  return (
    // outer — measured by ResizeObserver
    <div ref={outerRef} style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
      <PianoKeys cellH={cellH} />

      {/* Scroll container — overflow hidden because cells fill the space exactly */}
      <div
        ref={gridRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
      >
        <div
          onPointerDown={handleGridPointerDown}
          style={{ position: 'relative', width: gridWidth, height: gridHeight, cursor: 'crosshair' }}
        >
          <GridLines totalColumns={totalColumns} cellW={cellW} cellH={cellH} />

          {/* Playhead */}
          {playbackState !== 'stopped' && (
            <div style={{
              position: 'absolute',
              left: currentStep * cellW,
              top: 0, bottom: 0,
              width: cellW,
              background: 'rgba(255,255,255,0.06)',
              borderLeft: '2px solid rgba(255,255,255,0.55)',
              pointerEvents: 'none',
              zIndex: 30,
              transition: 'left 55ms linear',
            }} />
          )}

          {blocks.map(block => (
            <Block key={block.id} block={block} gridRef={gridRef} cellW={cellW} cellH={cellH} />
          ))}
        </div>
      </div>
    </div>
  );
}

const GridLines = React.memo(function GridLines({ totalColumns, cellW, cellH }) {
  const cols = Array.from({ length: totalColumns }, (_, i) => i);
  const rows = Array.from({ length: TOTAL_ROWS },   (_, i) => i);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {rows.map(row => (
        <div key={row} style={{
          position: 'absolute',
          left: 0, right: 0,
          top: row * cellH,
          height: cellH,
          background: isBlackKey(row) ? 'rgba(0,0,0,0.28)' : 'transparent',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }} />
      ))}
      {cols.map(col => (
        <div key={col} style={{
          position: 'absolute',
          left: col * cellW,
          top: 0, bottom: 0,
          width: cellW,
          borderRight: col % 4 === 3
            ? '1px solid rgba(255,255,255,0.14)'
            : '1px solid rgba(255,255,255,0.05)',
        }} />
      ))}
    </div>
  );
});
