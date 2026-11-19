/**
 * Pure helpers for the scroll story: turning scroll progress into beats,
 * interpolating keyframes and easing the train between stops.
 *
 * Contract: non-finite progress (NaN) is treated as the start of the range, so a
 * bad measurement can never push the story into an undefined state.
 */

export type Keyframe = readonly [progress: number, value: number];

const finiteOr = (x: number, fallback: number): number => (Number.isFinite(x) ? x : fallback);

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, finiteOr(x, 0)));

/** Linear interpolation across sorted keyframes; holds the end values outside the range. */
export function piecewise(keys: ReadonlyArray<Keyframe>, progress: number): number {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) throw new RangeError("piecewise() needs at least one key");
  const p = finiteOr(progress, first[0]);
  if (p <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i += 1) {
    const [p1, v1] = keys[i]!;
    if (p <= p1) {
      const [p0, v0] = keys[i - 1]!;
      return v0 + (v1 - v0) * ((p - p0) / (p1 - p0));
    }
  }
  return last[1];
}

/** Index of the beat whose [edge, nextEdge) range contains p; edges must be ascending. */
export function beatAt(edges: ReadonlyArray<number>, progress: number): number {
  if (edges.length < 2) throw new RangeError("beatAt() needs at least two edges");
  for (let k = 1; k < edges.length; k += 1) {
    if (edges[k]! < edges[k - 1]!) throw new RangeError("beatAt() edges must be ascending");
  }
  const p = finiteOr(progress, edges[0]!);
  const lastBeat = edges.length - 2;
  let beat = 0;
  for (let k = 0; k <= lastBeat; k += 1) {
    if (p >= edges[k]!) beat = k;
  }
  return beat;
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
