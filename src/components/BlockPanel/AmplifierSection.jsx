import React from 'react';
import { SectionTitle } from './OscillatorSection';
import ADSREditor from './ADSREditor';

export default function AmplifierSection({ amplifier, onChange }) {
  return (
    <div>
      <SectionTitle>Amplifier</SectionTitle>

      <div style={{ display: 'flex', gap: 16, marginBottom: 10, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={amplifier.gain}
            onChange={e => onChange({ ...amplifier, gain: parseFloat(e.target.value) })}
            style={{ width: 80, accentColor: '#6ee7b7', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gain</span>
          <span style={{ fontSize: 9, color: '#6ee7b7', fontFamily: 'monospace' }}>{amplifier.gain.toFixed(2)}</span>
        </div>
      </div>

      <ADSREditor
        envelope={amplifier.envelope}
        onChange={env => onChange({ ...amplifier, envelope: env })}
        color="#6ee7b7"
      />
    </div>
  );
}
