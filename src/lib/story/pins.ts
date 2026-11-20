/**
 * How the pinned acts respond to scroll: measuring them, fading their copy, marking the active beat,
 * and where snapping, a key press or a `#act` link should take the page. Pure, so the controller
 * only reads the DOM, calls these, and writes the result.
 *
 * Contract: positions are document pixels; `viewportH` is the height of one pin (100svh).
 */
import { beatScrollY, positionAt, snapTarget, stepTarget, type MeasuredAct, type StoryPosition } from "./scroll";

/** What the controller knows about an act before measuring it. */
export interface ActShape {
  readonly id: string;
  readonly beats: number;
}

export interface Box {
  readonly top: number;
  readonly height: number;
}

/** Scroll idle time before the page settles on a beat. */
export const SNAP_IDLE_MS = 160;
/** Copy fades in and out over this share of a viewport at each end of its act's pinned range. */
const COPY_FADE = 0.1;
/** Snapping never moves the page further than this share of a viewport. */
const SNAP_REACH = 0.6;
/** Moves this small (px) count as "already there". */
const SETTLED_PX = 2;

/** Each act's measured box; a missing element becomes an empty act where the previous one ended. */
export function measureActs(shape: ReadonlyArray<ActShape>, boxOf: (id: string) => Box | null): MeasuredAct[] {
  const acts: MeasuredAct[] = [];
  for (const { id, beats } of shape) {
    const previous = acts[acts.length - 1];
    const box = boxOf(id) ?? { top: previous ? previous.top + previous.height : 0, height: 0 };
    acts.push({ id, top: box.top, height: box.height, beats });
  }
  return acts;
}

/**
 * How visible an act's copy is, 0–1: only while its pin is pinned, fading at both ends, so copy never
 * scrolls half off-screen and is hidden in breathers.
 */
export function copyVisibility(act: MeasuredAct, scrollY: number, viewportH: number): number {
  const range = act.height - viewportH;
  const into = scrollY - act.top;
  if (!Number.isFinite(into) || range <= 0 || into < 0 || into > range) return 0;
  const fade = Math.max(1, viewportH * COPY_FADE);
  return Math.min(1, into / fade, (range - into) / fade);
}

/** The highlighted beat of act `actIndex`: the current beat there, the last in passed acts, else the first. */
export function activeBeatOf(actIndex: number, beats: number, at: StoryPosition): number {
  if (actIndex === at.actIndex) return at.beat;
  return actIndex < at.actIndex ? Math.max(0, beats - 1) : 0;
}

/** The beat's position across the whole chapter. */
export function globalIndexOf(shape: ReadonlyArray<ActShape>, actIndex: number, beat: number): number {
  return shape.slice(0, actIndex).reduce((sum, act) => sum + act.beats, 0) + beat;
}

/** Where to snap after scrolling stops, or null when already there or the beat is too far to pull to. */
export function settleTarget(acts: ReadonlyArray<MeasuredAct>, scrollY: number, viewportH: number): number | null {
  const target = snapTarget(acts, scrollY, viewportH);
  const distance = Math.abs(target - scrollY);
  return distance > SETTLED_PX && distance < viewportH * SNAP_REACH ? target : null;
}

/**
 * Where a step key takes the page from `fromY`, or null to leave the key to the browser: when the step
 * wouldn't move (the first or last beat) or would go the other way (below the last beat's centre).
 */
export function keyTarget(
  acts: ReadonlyArray<MeasuredAct>,
  fromY: number,
  viewportH: number,
  direction: 1 | -1,
): number | null {
  const target = stepTarget(acts, fromY, viewportH, direction);
  return (target - fromY) * direction > SETTLED_PX ? target : null;
}

/**
 * For a `#act` link: that act's first beat. The browser's own jump lands on the act's top, where the
 * copy is still faded, so that moves on too; a page already past the first beat of that act stays.
 */
export function hashTarget(
  acts: ReadonlyArray<MeasuredAct>,
  hash: string,
  scrollY: number,
  viewportH: number,
): number | null {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  const index = id === "" ? -1 : acts.findIndex((a) => a.id === id);
  const act = acts[index];
  if (!act) return null;
  const at = positionAt(acts, scrollY, viewportH);
  const target = beatScrollY(act, 0, viewportH);
  if (at.actIndex === index && at.beat > 0) return null;
  return Math.abs(target - scrollY) > SETTLED_PX ? target : null;
}
