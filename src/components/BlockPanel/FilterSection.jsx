import React from 'react';
import { SectionTitle } from './OscillatorSection';
import ADSREditor from './ADSREditor';

const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'];

export default function FilterSection({ filter, onChange }) {
  return (
    <div>
      <SectionTitle>Filter</SectionTitle>

      {/* Filter type */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {FILTER_TYPES.map(t => (
          <button
            key={t}
            onClick={() => onChange({ ...filter, type: t })}
            style={{
              background: filter.type === t ? '#38bdf8' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${filter.type === t ? '#38bdf8' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: filter.type === t ? '#000' : '#888',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {t === 'lowpass' ? 'LP' : t === 'highpass' ? 'HP' : 'BP'}
          </button>
        ))}
      </div>

      {/* Cutoff + Resonance */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <Knob
          label="Cutoff"
          value={filter.frequency}
          min={20}
          max={20000}
          step={1}
          color="#38bdf8"
          display={v => `${Math.round(v)}Hz`}
          onChange={v => onChange({ ...filter, frequency: v })}
        />
        <Knob
          label="Reso"
          value={filter.Q}
          min={0.1}
          max={20}
          step={0.1}
          color="#38bdf8"
          display={v => v.toFixed(1)}
          onChange={v => onChange({ ...filter, Q: v })}
        />
        <Knob
          label="Env Amt"
          value={filter.envelope.amount}
          min={0}
          max={8000}
          step={10}
          color="#38bdf8"
          display={v => `${Math.round(v)}`}
          onChange={v => onChange({ ...filter, envelope: { ...filter.envelope, amount: v } })}
        />
      </div>

      {/* Filter ADSR */}
      <ADSREditor
        envelope={filter.envelope}
        onChange={env => onChange({ ...filter, envelope: env })}
        color="#38bdf8"
      />
    </div>
  );
}

function Knob({ label, value, min, max, step, color, display, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: 64, accentColor: color, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 9, color, fontFamily: 'monospace' }}>{display(value)}</span>
    </div>
  );
}
