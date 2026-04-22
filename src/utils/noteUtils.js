// Grid rows map to chromatic notes from top (highest) to bottom (lowest)
// totalRows = 48 → 4 octaves (C2 to B5)
const NOTES = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
const TOP_OCTAVE = 5; // row 0 starts at B5

/**
 * Convert a grid row index to a Tone.js note string
 * Row 0 = highest pitch (B5), row 47 = lowest (C2)
 */
export function rowToNote(row) {
  const noteIndex = row % 12;
  const octave = TOP_OCTAVE - Math.floor(row / 12);
  return `${NOTES[noteIndex]}${octave}`;
}

/**
 * Extract octave number from a row index
 */
export function rowToOctave(row) {
  return TOP_OCTAVE - Math.floor(row / 12);
}

/**
 * Convert a note string to its display label
 */
export function noteLabel(note) {
  return note;
}

/**
 * Returns true if a row corresponds to a black key on a piano
 */
export function isBlackKey(row) {
  const noteIndex = row % 12;
  // B A# A G# G F# F E D# D C# C
  // 0  1  2  3  4  5  6  7  8  9 10 11
  return [1, 3, 5, 8, 10].includes(noteIndex);
}
