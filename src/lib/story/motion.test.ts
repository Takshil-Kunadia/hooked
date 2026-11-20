import { describe, expect, it } from "vitest";
import {
  ANNOUNCE_DELAY_S,
  TICKET_GAP_S,
  TWEEN,
  announced,
  arrivalS,
  retarget,
  ticketPhase,
  travelU,
  tweenDuration,
  type Travel,
} from "./motion";

describe("tweenDuration", () => {
  it("scales with distance between the min and max", () => {
    expect(TWEEN).toEqual({ minS: 0.9, maxS: 3.0, sPerUnit: 0.16 });
    expect(tweenDuration(1, false)).toBe(0.9);
    expect(tweenDuration(10, false)).toBeCloseTo(1.6);
    expect(tweenDuration(40, false)).toBe(3.0);
  });

  it("is zero with reduced motion", () => {
    expect(tweenDuration(10, true)).toBe(0);
  });

  it("treats a bad distance as the shortest tween", () => {
    expect(tweenDuration(Number.NaN, false)).toBe(0.9);
  });
});

describe("travelU", () => {
  const t: Travel = { from: 10, to: 30, start: 100, duration: 2 };

  it("holds the ends outside the tween and eases through it", () => {
    expect(travelU(t, 99)).toBe(10);
    expect(travelU(t, 100)).toBe(10);
    expect(travelU(t, 101)).toBeCloseTo(20);
    expect(travelU(t, 102)).toBe(30);
    expect(travelU(t, 500)).toBe(30);
  });

  it("jumps straight to the target when the duration is zero", () => {
    expect(travelU({ ...t, duration: 0 }, 100)).toBe(30);
  });

  it("starts slowly (ease-in)", () => {
    expect(travelU(t, 100.2) - 10).toBeLessThan(0.2 * 10);
  });
});

describe("retarget", () => {
  const t: Travel = { from: 0, to: 100, start: 0, duration: 2 };

  it("retargets from the current position", () => {
    const here = travelU(t, 1);
    const next = retarget(t, 1, 40, 200, false);
    expect(next.from).toBe(here);
    expect(next.to).toBe(40);
    expect(next.start).toBe(1);
    expect(next.duration).toBe(tweenDuration(Math.abs(40 - here) * 200, false));
    expect(travelU(next, 1)).toBe(here);
  });

  it("cuts straight to the target with reduced motion", () => {
    const next = retarget(t, 1, 40, 200, true);
    expect(next.duration).toBe(0);
    expect(travelU(next, 1)).toBe(40);
  });
});

describe("arrivalS", () => {
  it("is start plus duration", () => {
    expect(arrivalS({ from: 0, to: 1, start: 5, duration: 1.5 })).toBe(6.5);
  });
});

describe("ticket cascade", () => {
  const phases = (since: number | null, fromLater = false) => [0, 1, 2].map((i) => ticketPhase(i, since, fromLater));

  it("skipped beats fire nothing", () => {
    expect(announced(null, false)).toBe(false);
    expect(phases(null)).toEqual(["waiting", "waiting", "waiting"]);
  });

  it("waits for the announcement delay", () => {
    expect(ANNOUNCE_DELAY_S).toBe(0.6);
    expect(announced(ANNOUNCE_DELAY_S - 0.01, false)).toBe(false);
    expect(phases(ANNOUNCE_DELAY_S - 0.01)).toEqual(["waiting", "waiting", "waiting"]);
  });

  it("runs each ticket about half a second after the previous", () => {
    expect(TICKET_GAP_S).toBe(0.5);
    expect(announced(ANNOUNCE_DELAY_S, false)).toBe(true);
    expect(phases(ANNOUNCE_DELAY_S)).toEqual(["running", "waiting", "waiting"]);
    expect(phases(ANNOUNCE_DELAY_S + TICKET_GAP_S)).toEqual(["done", "running", "waiting"]);
    expect(phases(ANNOUNCE_DELAY_S + 3 * TICKET_GAP_S)).toEqual(["done", "done", "done"]);
  });

  it("entering from a later beat shows every ticket done", () => {
    expect(announced(0, true)).toBe(true);
    expect(phases(0, true)).toEqual(["done", "done", "done"]);
  });

  it("still waits while travelling backwards", () => {
    expect(announced(null, true)).toBe(false);
    expect(phases(null, true)).toEqual(["waiting", "waiting", "waiting"]);
  });
});
