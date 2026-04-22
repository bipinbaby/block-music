import React from 'react';

const WAVEFORMS = [
  { type: 'sine', label: 'SIN', svg: 'M0,10 Q5,0 10,10 Q15,20 20,10' },
  { type: 'square', label: 'SQR', svg: 'M0,18 L0,2 L10,2 L10,18 L20,18 L20,2' },
  { type: 'sawtooth', label: 'SAW', svg: 'M0,18 L10,2 L10,18 L20,2' },
  { type: 'triangle', label: 'TRI', svg: 'M0,18 L5,2 L15,18 L20,2' },
];

export default function OscillatorSection({ oscillator, onChange }) {
  return (
    <div>
      <SectionTitle>Oscillator</SectionTitle>
      <div style={{ display: 'flex', gap: 8 }}>
        {WAVEFORMS.map(({ type, label, svg }) => {
          const active = oscillator.type === type;
          return (
            <button
              key={type}
              onClick={() => onChange({ ...oscillator, type })}
              style={{
                background: active ? '#a78bfa' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${active ? '#a78bfa' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'background 0.15s',
              }}
            >
              <svg width={20} height={20} style={{ display: 'block' }}>
                <path d={svg} fill="none" stroke={active ? '#fff' : '#888'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#fff' : '#666', letterSpacing: '0.05em' }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}
