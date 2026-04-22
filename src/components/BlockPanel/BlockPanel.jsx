import React, { useState } from 'react';
import { useSequencerStore } from '../../store/sequencerStore';
import OscillatorSection from './OscillatorSection';
import FilterSection from './FilterSection';
import AmplifierSection from './AmplifierSection';
import FXSection from './FXSection';
import LFOSection from './LFOSection';
import { blockColor } from '../../utils/colorUtils';

const TABS = ['OSC', 'FILTER', 'AMP', 'FX', 'LFO'];

export default function BlockPanel() {
  const selectedId = useSequencerStore(s => s.selectedBlockId);
  const block = useSequencerStore(s => s.blocks.find(b => b.id === selectedId));
  const updateBlock = useSequencerStore(s => s.updateBlock);
  const removeBlock = useSequencerStore(s => s.removeBlock);
  const deselectBlock = useSequencerStore(s => s.deselectBlock);

  const [activeTab, setActiveTab] = useState('OSC');

  if (!block) return null;

  const accentColor = blockColor(block.octave);

  function update(patch) {
    updateBlock(block.id, patch);
  }

  return (
    <div style={{
      background: '#13131f',
      borderTop: `2px solid ${accentColor}`,
      padding: '12px 20px',
      flexShrink: 0,
      maxHeight: 240,
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 12, height: 12, borderRadius: 3,
          background: accentColor,
          boxShadow: `0 0 8px 2px ${accentColor}88`,
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
          {block.note}
        </span>
        <span style={{ fontSize: 11, color: '#555' }}>col:{block.column} dur:{block.duration}</span>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? accentColor : 'rgba(255,255,255,0.06)',
                border: `1px solid ${activeTab === tab ? accentColor : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 700,
                color: activeTab === tab ? '#000' : '#888',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Close/delete */}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { removeBlock(block.id); }}
          style={{
            background: 'rgba(255,100,100,0.15)',
            border: '1px solid rgba(255,100,100,0.3)',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 10,
            fontWeight: 700,
            color: '#f87171',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
        <button
          onClick={deselectBlock}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 10,
            fontWeight: 700,
            color: '#888',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'OSC' && (
          <OscillatorSection
            oscillator={block.oscillator}
            onChange={osc => update({ oscillator: osc })}
          />
        )}
        {activeTab === 'FILTER' && (
          <FilterSection
            filter={block.filter}
            onChange={f => update({ filter: f })}
          />
        )}
        {activeTab === 'AMP' && (
          <AmplifierSection
            amplifier={block.amplifier}
            onChange={a => update({ amplifier: a })}
          />
        )}
        {activeTab === 'FX' && (
          <FXSection
            fx={block.fx}
            onChange={fx => update({ fx })}
          />
        )}
        {activeTab === 'LFO' && (
          <LFOSection
            lfo={block.lfo}
            onChange={lfo => update({ lfo })}
          />
        )}
      </div>
    </div>
  );
}
