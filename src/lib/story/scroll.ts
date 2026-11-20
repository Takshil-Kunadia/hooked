/**
 * Scroll math for the story: where an act's beats sit on the page and which beat
 * a scroll position falls in. Pure functions over measured act geometry (px).
 *
 * Contract: a non-finite scroll position or viewport reads as the start of the page.
 */
import { beatAt, clamp01 } from "./timeline";

export const BEAT_SPAN_VH = 70;
export const BREATHER_VH = 40;

export interface MeasuredAct {
  id: string;
  top: number;
  height: number;
  beats: number;
}

export interface StoryPosition {
  actIndex: number;
  beat: number;
  inBreather: boolean;
}

export const actHeightVh = (beats: number): number => 100 + beats * BEAT_SPAN_VH;

const finiteOr = (x: number, fallback: number): number => (Number.isFinite(x) ? x : fallback);
const beatCount = (act: MeasuredAct): number => Math.max(1, Math.floor(act.beats));
const pinnedRange = (act: MeasuredAct, viewportH: number): number => Math.max(0, act.height - finiteOr(viewportH, 0));

function edgesFor(n: number): ReadonlyArray<number> {
  return Array.from({ length: n + 1 }, (_, k) => k / n);
}

function beatIn(act: MeasuredAct, scrollY: number, viewportH: number): number {
  const range = pinnedRange(act, viewportH);
  if (range === 0) return 0;
  return beatAt(edgesFor(beatCount(act)), clamp01((scrollY - act.top) / range));
}

export function positionAt(acts: ReadonlyArray<MeasuredAct>, scrollY: number, viewportH: number): StoryPosition {
  const start: StoryPosition = { actIndex: 0, beat: 0, inBreather: false };
  const first = acts[0];
  if (!first || !Number.isFinite(scrollY) || scrollY < first.top) return start;
  for (let i = 0; i < acts.length; i += 1) {
    const act = acts[i]!;
    const next = acts[i + 1];
    if (!next || scrollY < act.top + act.height) {
      return { actIndex: i, beat: beatIn(act, scrollY, viewportH), inBreather: false };
    }
    if (scrollY < next.top) return { actIndex: i + 1, beat: 0, inBreather: true };
  }
  return start;
}

/** Scroll position at the centre of a beat's span; the beat index is clamped to the act. */
export function beatScrollY(act: MeasuredAct, beat: number, viewportH: number): number {
  const n = beatCount(act);
  const k = Math.min(n - 1, Math.max(0, Math.floor(finiteOr(beat, 0))));
  return act.top + (pinnedRange(act, viewportH) * (k + 0.5)) / n;
}

function targetOf(acts: ReadonlyArray<MeasuredAct>, actIndex: number, beat: number, vh: number) {
  const act = acts[actIndex];
  return act ? beatScrollY(act, beat, vh) : 0;
}

export function snapTarget(acts: ReadonlyArray<MeasuredAct>, scrollY: number, viewportH: number): number {
  const { actIndex, beat } = positionAt(acts, scrollY, viewportH);
  return targetOf(acts, actIndex, beat, viewportH);
}

export function stepTarget(
  acts: ReadonlyArray<MeasuredAct>,
  scrollY: number,
  viewportH: number,
  direction: 1 | -1,
): number {
  const { actIndex, beat, inBreather } = positionAt(acts, scrollY, viewportH);
  if (inBreather) {
    if (direction === 1) return targetOf(acts, actIndex, 0, viewportH);
    return targetOf(acts, actIndex - 1, Number.MAX_SAFE_INTEGER, viewportH);
  }
  const next = beat + direction;
  if (next < 0) {
    return actIndex === 0
      ? targetOf(acts, 0, 0, viewportH)
      : targetOf(acts, actIndex - 1, Number.MAX_SAFE_INTEGER, viewportH);
  }
  const act = acts[actIndex];
  if (act && next >= beatCount(act)) {
    return actIndex + 1 >= acts.length
      ? targetOf(acts, actIndex, beat, viewportH)
      : targetOf(acts, actIndex + 1, 0, viewportH);
  }
  return targetOf(acts, actIndex, next, viewportH);
}
