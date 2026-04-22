// Octave → hue mapping (bright, saturated, toy aesthetic)
const OCTAVE_HUES = {
  2: 0,    // red
  3: 30,   // orange
  4: 60,   // yellow
  5: 120,  // green
  6: 180,  // cyan
  7: 240,  // blue
  8: 280,  // purple
};

function getHue(octave) {
  return OCTAVE_HUES[Math.max(2, Math.min(8, octave))] ?? 200;
}

export function blockColor(octave) {
  const h = getHue(octave);
  return `hsl(${h}, 90%, 62%)`;
}

export function blockTopColor(octave) {
  const h = getHue(octave);
  return `hsl(${h}, 70%, 80%)`;
}

export function blockSideColor(octave) {
  const h = getHue(octave);
  return `hsl(${h}, 90%, 38%)`;
}

export function blockEmissiveColor(octave) {
  const h = getHue(octave);
  return `hsl(${h}, 100%, 92%)`;
}

export function blockGlowColor(octave, alpha = 0.9) {
  const h = getHue(octave);
  return `hsla(${h}, 100%, 70%, ${alpha})`;
}

export function blockGlowColorOuter(octave, alpha = 0.5) {
  const h = getHue(octave);
  return `hsla(${h}, 100%, 60%, ${alpha})`;
}
