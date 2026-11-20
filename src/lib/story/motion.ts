/**
 * Train motion and the ticket cascade. Times are seconds on the
 * performance.now() / 1000 clock, passed in as `nowS`; nothing here reads a clock.
 */
import { clamp01, easeInOutCubic } from "./timeline";

export const TWEEN = { minS: 0.9, maxS: 3.0, sPerUnit: 0.16 } as const;
export const ANNOUNCE_DELAY_S = 0.6;
export const TICKET_GAP_S = 0.5;

export interface Travel {
  from: number;
  to: number;
  start: number;
  duration: number;
}

export type TicketPhase = "waiting" | "running" | "done";

/** Seconds to ride a distance in world units; reduced motion means no tween at all. */
export function tweenDuration(distanceUnits: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const d = Number.isFinite(distanceUnits) ? Math.abs(distanceUnits) : 0;
  return Math.min(TWEEN.maxS, Math.max(TWEEN.minS, d * TWEEN.sPerUnit));
}

/** Position along the line at `nowS`, eased in and out. */
export function travelU(t: Travel, nowS: number): number {
  if (t.duration <= 0) return t.to;
  const p = easeInOutCubic(clamp01((nowS - t.start) / t.duration));
  return t.from + (t.to - t.from) * p;
}

/** Aim at a new stop from wherever the train is now, never from the old endpoints. */
export function retarget(t: Travel, nowS: number, toU: number, lineLength: number, reducedMotion: boolean): Travel {
  const from = travelU(t, nowS);
  const duration = tweenDuration(Math.abs(toU - from) * lineLength, reducedMotion);
  return { from, to: toU, start: nowS, duration };
}

export const arrivalS = (t: Travel): number => t.start + t.duration;

/**
 * Where ticket `index` is in the cascade, `sinceArrivalS` seconds after the train
 * arrived (null while it is still travelling). Arriving from a later beat shows
 * every ticket already done.
 */
export function ticketPhase(index: number, sinceArrivalS: number | null, fromLater: boolean): TicketPhase {
  if (sinceArrivalS === null) return "waiting";
  if (fromLater) return "done";
  const startsAt = ANNOUNCE_DELAY_S + index * TICKET_GAP_S;
  if (sinceArrivalS < startsAt) return "waiting";
  return sinceArrivalS < startsAt + TICKET_GAP_S ? "running" : "done";
}

export function announced(sinceArrivalS: number | null, fromLater: boolean): boolean {
  if (sinceArrivalS === null) return false;
  return fromLater || sinceArrivalS >= ANNOUNCE_DELAY_S;
}
