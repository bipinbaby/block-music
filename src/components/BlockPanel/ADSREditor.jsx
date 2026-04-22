import React from 'react';

const PARAMS = [
  { key: 'attack', label: 'A', min: 0.001, max: 2, step: 0.001 },
  { key: 'decay', label: 'D', min: 0.001, max: 2, step: 0.001 },
  { key: 'sustain', label: 'S', min: 0, max: 1, step: 0.01 },
  { key: 'release', label: 'R', min: 0.001, max: 4, step: 0.001 },
];

export default function ADSREditor({ envelope, onChange, color = '#6ee7b7' }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {PARAMS.map(({ key, label, min, max, step }) => (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={envelope[key]}
            onChange={e => onChange({ ...envelope, [key]: parseFloat(e.target.value) })}
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              height: 72,
              width: 18,
              accentColor: color,
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: 10, color: '#888', fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: 9, color: color, fontFamily: 'monospace' }}>
            {envelope[key].toFixed(key === 'sustain' ? 2 : 3)}
          </span>
        </div>
      ))}
    </div>
  );
}
