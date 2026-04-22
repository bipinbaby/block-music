import React, { memo } from 'react';
import { rowToNote, isBlackKey } from '../../utils/noteUtils';

const TOTAL_ROWS = 48;
const KEY_WIDTH = 58;

const PianoKeys = memo(function PianoKeys({ cellH }) {
  const rows = Array.from({ length: TOTAL_ROWS }, (_, i) => i);

  return (
    <div style={{
      width: KEY_WIDTH,
      flexShrink: 0,
      position: 'relative',
      background: '#18181f',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      overflowY: 'hidden',
    }}>
      <div style={{ position: 'relative' }}>
        {rows.map(row => {
          const note = rowToNote(row);
          const black = isBlackKey(row);
          const isC = note.startsWith('C') && !note.startsWith('C#');
          return (
            <div key={row} style={{
              height: cellH,
              display: 'flex',
              alignItems: 'center',
              paddingRight: 8,
              paddingLeft: black ? 18 : 10,
              background: black
                ? 'rgba(0,0,0,0.4)'
                : isC ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              justifyContent: 'flex-end',
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: isC ? 700 : 400,
                color: black
                  ? 'rgba(255,255,255,0.3)'
                  : isC ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                letterSpacing: '0.05em',
                fontFamily: 'monospace',
              }}>
                {isC ? note : (black ? '' : note.replace(/\d/, ''))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export { KEY_WIDTH };
export default PianoKeys;
