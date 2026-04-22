import React from 'react';
import { SectionTitle } from './OscillatorSection';

export default function FXSection({ fx, onChange }) {
  const { reverb, delay } = fx;

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {/* Reverb */}
      <div>
        <SectionTitle>Reverb</SectionTitle>
        <Toggle
          enabled={reverb.enabled}
          color="#f9a8d4"
          onToggle={v => onChange({ ...fx, reverb: { ...reverb, enabled: v } })}
        />
        <Slider
          label="Room"
          value={reverb.roomSize}
          min={0} max={1} step={0.01}
          color="#f9a8d4"
          display={v => v.toFixed(2)}
          onChange={v => onChange({ ...fx, reverb: { ...reverb, roomSize: v } })}
          disabled={!reverb.enabled}
        />
        <Slider
          label="Wet"
          value={reverb.wet}
          min={0} max={1} step={0.01}
          color="#f9a8d4"
          display={v => v.toFixed(2)}
          onChange={v => onChange({ ...fx, reverb: { ...reverb, wet: v } })}
          disabled={!reverb.enabled}
        />
      </div>

      {/* Delay */}
      <div>
        <SectionTitle>Delay</SectionTitle>
        <Toggle
          enabled={delay.enabled}
          color="#fde68a"
          onToggle={v => onChange({ ...fx, delay: { ...delay, enabled: v } })}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {['16n', '8n', '4n', '2n'].map(t => (
            <button
              key={t}
              onClick={() => onChange({ ...fx, delay: { ...delay, time: t } })}
              disabled={!delay.enabled}
              style={{
                background: delay.time === t && delay.enabled ? '#fde68a' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${delay.time === t && delay.enabled ? '#fde68a' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 9,
                fontWeight: 700,
                color: delay.time === t && delay.enabled ? '#000' : '#666',
                cursor: delay.enabled ? 'pointer' : 'not-allowed',
                opacity: delay.enabled ? 1 : 0.4,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <Slider
          label="Feedback"
          value={delay.feedback}
          min={0} max={0.95} step={0.01}
          color="#fde68a"
          display={v => v.toFixed(2)}
          onChange={v => onChange({ ...fx, delay: { ...delay, feedback: v } })}
          disabled={!delay.enabled}
        />
        <Slider
          label="Wet"
          value={delay.wet}
          min={0} max={1} step={0.01}
          color="#fde68a"
          display={v => v.toFixed(2)}
          onChange={v => onChange({ ...fx, delay: { ...delay, wet: v } })}
          disabled={!delay.enabled}
        />
      </div>
    </div>
  );
}

function Toggle({ enabled, color, onToggle }) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      style={{
        background: enabled ? color : 'rgba(255,255,255,0.06)',
        border: `1px solid ${enabled ? color : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 6,
        padding: '3px 10px',
        fontSize: 10,
        fontWeight: 700,
        color: enabled ? '#000' : '#666',
        cursor: 'pointer',
        marginBottom: 8,
        letterSpacing: '0.05em',
      }}
    >
      {enabled ? 'ON' : 'OFF'}
    </button>
  );
}

function Slider({ label, value, min, max, step, color, display, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, opacity: disabled ? 0.35 : 1 }}>
      <span style={{ fontSize: 9, color: '#666', fontWeight: 700, width: 48, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => !disabled && onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{ width: 80, accentColor: color, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <span style={{ fontSize: 9, color, fontFamily: 'monospace', width: 30 }}>{display(value)}</span>
    </div>
  );
}
