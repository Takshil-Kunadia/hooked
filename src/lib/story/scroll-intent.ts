/**
 * A smooth scroll the story started itself (a step key or a rail button). Snapping waits for it:
 * on a slow device the page can go 160ms between scroll events mid-trip, and snapping to the beat it
 * just left would pull the page back and swallow the step.
 */
export interface ScrollIntent {
  readonly targetY: number;
  /** Time (ms, performance.now()) after which the scroll is assumed interrupted. */
  readonly deadlineMs: number;
}

/** How long a programmatic smooth scroll may take before snapping is allowed again. */
export const SCROLL_INTENT_MS = 2500;
/** Within this many pixels the page counts as arrived. */
const ARRIVED_PX = 2;

export function startIntent(targetY: number, nowMs: number): ScrollIntent {
  return { targetY, deadlineMs: nowMs + SCROLL_INTENT_MS };
}

/** True while the page is still travelling to the intent's target, within its time allowance. */
export function scrollInFlight(intent: ScrollIntent | null, scrollY: number, nowMs: number): boolean {
  return intent !== null && nowMs < intent.deadlineMs && Math.abs(scrollY - intent.targetY) > ARRIVED_PX;
}
