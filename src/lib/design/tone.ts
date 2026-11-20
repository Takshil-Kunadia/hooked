/**
 * Khronos PBR Neutral tone mapping, as three.js applies it (NeutralToneMapping, exposure 1),
 * and its inverse. The scene's post-processing tone-maps every pixel, so colours that must
 * come out exact (the page background, the ink printed on the map) are pre-compensated.
 */

/** A linear-light RGB triple. */
export type RGB = readonly [r: number, g: number, b: number];

const START_COMPRESSION = 0.8 - 0.04;
const DESATURATION = 0.15;
/** Round 5 used 60; near white the shoulder is flat and converges slowly, so iterate longer. */
const COMPENSATE_STEPS = 200;

/** Mirrors three.js's NeutralToneMapping GLSL. */
export function neutralToneMap([r, g, b]: RGB): RGB {
  const x = Math.min(r, g, b);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  const c: RGB = [r - offset, g - offset, b - offset];
  const peak = Math.max(...c);
  if (peak < START_COMPRESSION) return c;
  const d = 1 - START_COMPRESSION;
  const newPeak = 1 - (d * d) / (peak + d - START_COMPRESSION);
  const scaled = c.map((ch) => ch * (newPeak / peak));
  const mix = 1 - 1 / (DESATURATION * (peak - newPeak) + 1);
  const [sr = 0, sg = 0, sb = 0] = scaled.map((ch) => ch + (newPeak - ch) * mix);
  return [sr, sg, sb];
}

/**
 * The input that tone-maps to `goal`, found by fixed-point iteration, as round 5 does. With a
 * `ceiling` (1 for anything drawn on a 2D canvas), each step stays within it, so a channel that
 * can't reach its goal stops at the ceiling while the others still land: the hue holds, where
 * clipping afterwards would oversaturate it.
 */
export function toneCompensate(goal: RGB, ceiling = Infinity): RGB {
  const fit = (c: number): number => Math.min(ceiling, Math.max(0, c));
  let guess: RGB = goal;
  for (let i = 0; i < COMPENSATE_STEPS; i += 1) {
    const out = neutralToneMap(guess);
    guess = [
      fit(guess[0] + (goal[0] - out[0])),
      fit(guess[1] + (goal[1] - out[1])),
      fit(guess[2] + (goal[2] - out[2])),
    ];
  }
  return guess;
}
