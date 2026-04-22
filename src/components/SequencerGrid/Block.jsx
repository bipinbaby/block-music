import React, { memo, useCallback, useRef } from 'react';
import { useSequencerStore } from '../../store/sequencerStore';
import {
  blockColor, blockTopColor, blockSideColor,
  blockEmissiveColor, blockGlowColor, blockGlowColorOuter,
} from '../../utils/colorUtils';
import { audioEngine } from '../../audio/AudioEngine';

const FACE_DEPTH = 8;
const PERSPECTIVE = 700;

const Block = memo(function Block({ block, gridRef, cellW, cellH }) {
  const isSelected = useSequencerStore(s => s.selectedBlockId === block.id);
  const isPlaying = useSequencerStore(s => s.triggerSet.has(block.id));
  const selectBlock = useSequencerStore(s => s.selectBlock);
  const updateBlock = useSequencerStore(s => s.updateBlock);
  const removeBlock = useSequencerStore(s => s.removeBlock);
  const commitDrag = useSequencerStore(s => s.commitDrag);

  const dragState = useRef(null);

  const left = block.column * cellW;
  const top = block.row * cellH;
  const width = block.duration * cellW - 3;
  const height = cellH - 3;

  const frontColor = blockColor(block.octave);
  const topColor = blockTopColor(block.octave);
  const sideColor = blockSideColor(block.octave);
  const emissiveColor = blockEmissiveColor(block.octave);
  const glowInner = blockGlowColor(block.octave, isPlaying ? 0.95 : 0);
  const glowOuter = blockGlowColorOuter(block.octave, isPlaying ? 0.6 : 0);

  const boxShadow = [
    isPlaying ? `0 0 22px 8px ${glowInner}, 0 0 50px 18px ${glowOuter}` : '',
    isSelected ? `0 0 0 2px white, 0 0 12px 2px rgba(255,255,255,0.3)` : '',
  ].filter(Boolean).join(', ');

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.button === 2) { removeBlock(block.id); return; }

    selectBlock(block.id);
    if (audioEngine.initialized) audioEngine.previewBlock(block.id, block.note);

    const grid = gridRef.current;
    const rect = grid ? grid.getBoundingClientRect() : { left: 0, top: 0 };

    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origCol: block.column,
      origRow: block.row,
      dragging: false,
    };

    const onMove = (e2) => {
      const ds = dragState.current;
      if (!ds) return;
      const dx = e2.clientX - ds.startX;
      const dy = e2.clientY - ds.startY;
      if (!ds.dragging && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      ds.dragging = true;
      const newCol = Math.max(0, ds.origCol + Math.round(dx / cellW));
      const newRow = Math.max(0, ds.origRow + Math.round(dy / cellH));
      if (newCol !== block.column || newRow !== block.row) {
        updateBlock(block.id, { column: newCol, row: newRow });
      }
    };

    const onUp = () => {
      if (dragState.current?.dragging) commitDrag();
      dragState.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [block, selectBlock, updateBlock, removeBlock, commitDrag, gridRef]);

  const handleResizeDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const origDuration = block.duration;

    const onMove = (e2) => {
      const dx = e2.clientX - startX;
      const newDur = Math.max(1, origDuration + Math.round(dx / cellW));
      if (newDur !== block.duration) updateBlock(block.id, { duration: newDur });
    };
    const onUp = () => {
      commitDrag();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [block, updateBlock, commitDrag]);

  return (
    <div style={{
      position: 'absolute',
      left, top, width, height,
      perspective: PERSPECTIVE,
      perspectiveOrigin: '50% 50%',
      pointerEvents: 'none',
      zIndex: isSelected ? 20 : isPlaying ? 15 : 10,
    }}>
      <div
        onPointerDown={handlePointerDown}
        onContextMenu={e => e.preventDefault()}
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(14deg)',
          cursor: 'grab',
          pointerEvents: 'all',
          borderRadius: 6,
          boxShadow,
          transition: 'box-shadow 70ms ease-in',
        }}
      >
        {/* Front face */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: isPlaying ? emissiveColor : frontColor,
          borderRadius: 6,
          border: isSelected
            ? '2px solid rgba(255,255,255,0.95)'
            : '1px solid rgba(255,255,255,0.18)',
          transition: 'background 70ms ease-in',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 6,
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'rgba(0,0,0,0.6)',
            letterSpacing: '0.02em',
            pointerEvents: 'none',
            userSelect: 'none',
            fontFamily: 'monospace',
          }}>
            {block.note}
          </span>

          {/* Resize handle */}
          <div
            onPointerDown={handleResizeDown}
            style={{
              position: 'absolute',
              right: 0, top: 0, bottom: 0,
              width: 10,
              cursor: 'ew-resize',
              borderRadius: '0 6px 6px 0',
              background: 'rgba(0,0,0,0.18)',
            }}
          />
        </div>

        {/* Top face */}
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          height: FACE_DEPTH,
          background: isPlaying ? 'rgba(255,255,255,0.95)' : topColor,
          borderRadius: '6px 6px 0 0',
          transformOrigin: 'top center',
          transform: `rotateX(-90deg) translateY(-${FACE_DEPTH}px)`,
          backfaceVisibility: 'hidden',
          transition: 'background 70ms ease-in',
        }} />

        {/* Side face (right) */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0, right: 0,
          width: FACE_DEPTH,
          background: isPlaying ? emissiveColor : sideColor,
          borderRadius: '0 6px 6px 0',
          transformOrigin: 'right center',
          transform: `rotateY(90deg) translateX(${FACE_DEPTH}px)`,
          backfaceVisibility: 'hidden',
          transition: 'background 70ms ease-in',
        }} />
      </div>
    </div>
  );
});

export default Block;
