import React from 'react';
import { SectionTitle } from './OscillatorSection';

const TARGETS = [
  { value: 'filter.frequency', label: 'Filter' },
  { value: 'amplifier.gain', label: 'Amp' },
  { value: 'oscillator.detune', label: 'Pitch' },
];

const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

export default function LFOSection({ lfo, onChange }) {
  return (
    <div>
      <SectionTitle>LFO</SectionTitle>

      {/* Enable toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <button
          onClick={() => onChange({ ...lfo, enabled: !lfo.enabled })}
          style={{
            background: lfo.enabled ? '#c4b5fd' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${lfo.enabled ? '#c4b5fd' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 10,
            fontWeight: 700,
            color: lfo.enabled ? '#000' : '#666',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          {lfo.enabled ? 'ON' : 'OFF'}
        </button>

        {/* Tempo sync */}
        <button
          onClick={() => onChange({ ...lfo, tempoSynced: !lfo.tempoSynced })}
          disabled={!lfo.enabled}
          style={{
            background: lfo.tempoSynced && lfo.enabled ? '#c4b5fd' : 'rgba(255,255,255,0.06)',
            border: `1px solid rgba(255,255,255,0.12)`,
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 10,
            fontWeight: 700,
            color: lfo.tempoSynced && lfo.enabled ? '#000' : '#666',
            cursor: lfo.enabled ? 'pointer' : 'not-allowed',
            opacity: lfo.enabled ? 1 : 0.4,
            letterSpacing: '0.05em',
          }}
        >
          SYNC
        </button>
      </div>

      <div style={{ opacity: lfo.enabled ? 1 : 0.35, pointerEvents: lfo.enabled ? 'all' : 'none' }}>
        {/* Target selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {TARGETS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ ...lfo, target: value })}
              style={{
                background: lfo.target === value ? '#c4b5fd' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${lfo.target === value ? '#c4b5fd' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 700,
                color: lfo.target === value ? '#000' : '#888',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Waveform */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {WAVEFORMS.map(w => (
            <button
              key={w}
              onClick={() => onChange({ ...lfo, type: w })}
              style={{
                background: lfo.type === w ? '#c4b5fd' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${lfo.type === w ? '#c4b5fd' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 9,
                fontWeight: 700,
                color: lfo.type === w ? '#000' : '#666',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {w.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Rate */}
        {!lfo.tempoSynced ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: '#666', fontWeight: 700, width: 32, textTransform: 'uppercase' }}>Rate</span>
            <input
              type="range"
              min={0.05}
              max={20}
              step={0.05}
              value={lfo.rate}
              onChange={e => onChange({ ...lfo, rate: parseFloat(e.target.value) })}
              style={{ width: 100, accentColor: '#c4b5fd' }}
            />
            <span style={{ fontSize: 9, color: '#c4b5fd', fontFamily: 'monospace', width: 40 }}>{lfo.rate.toFixed(2)}Hz</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {['32n', '16n', '8n', '4n', '2n', '1n'].map(t => (
              <button
                key={t}
                onClick={() => onChange({ ...lfo, rate: t })}
                style={{
                  background: lfo.rate === t ? '#c4b5fd' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${lfo.rate === t ? '#c4b5fd' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: lfo.rate === t ? '#000' : '#666',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Depth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#666', fontWeight: 700, width: 32, textTransform: 'uppercase' }}>Depth</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={lfo.depth}
            onChange={e => onChange({ ...lfo, depth: parseFloat(e.target.value) })}
            style={{ width: 100, accentColor: '#c4b5fd' }}
          />
          <span style={{ fontSize: 9, color: '#c4b5fd', fontFamily: 'monospace', width: 30 }}>{lfo.depth.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
