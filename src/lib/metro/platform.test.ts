import { describe, expect, it } from "vitest";
import { initPlatformLayout, TICKET_CARD_WIDTH } from "./platform";
import { FEEDER_LINES } from "./route";

const line = (id: string) => {
  const spec = FEEDER_LINES.find((l) => l.id === id);
  if (!spec?.points[0]) throw new Error(id);
  return { x: spec.points[0][0], half: spec.width / 2 };
};

describe("initPlatformLayout", () => {
  const theme = line("theme");
  const spur = line("depot");

  it("fits the slab between the drop-ins feeder and the depot spur, touching neither", () => {
    const p = initPlatformLayout(8);
    expect(p.x - p.width / 2).toBeGreaterThan(theme.x + theme.half);
    expect(p.x + p.width / 2).toBeLessThan(spur.x - spur.half);
    expect(p.z - p.depth / 2).toBeGreaterThan(0.5);
  });

  it("lays eight tickets in one row on the slab, in order, without overlapping", () => {
    const p = initPlatformLayout(8);
    const w = TICKET_CARD_WIDTH * p.ticketScale;
    expect(p.ticketX).toHaveLength(8);
    expect(p.ticketScale).toBeGreaterThan(0.6);
    expect(p.ticketScale).toBeLessThan(1);
    p.ticketX.slice(1).forEach((x, i) => expect(x - (p.ticketX[i] ?? Infinity)).toBeGreaterThan(w));
    expect((p.ticketX[0] ?? 0) - w / 2).toBeGreaterThanOrEqual(p.x - p.width / 2);
    expect((p.ticketX[7] ?? 0) + w / 2).toBeLessThanOrEqual(p.x + p.width / 2);
  });

  it("centres the row and never grows tickets past round 5's size", () => {
    const one = initPlatformLayout(1);
    expect(one.ticketScale).toBe(1);
    expect(one.ticketX[0]).toBeCloseTo(one.x);
    const few = initPlatformLayout(3);
    expect(few.ticketScale).toBe(1);
    expect(((few.ticketX[0] ?? 0) + (few.ticketX[2] ?? 0)) / 2).toBeCloseTo(few.x);
  });

  it("has no tickets for an empty or bad count", () => {
    expect(initPlatformLayout(0).ticketX).toEqual([]);
    expect(initPlatformLayout(Number.NaN).ticketX).toEqual([]);
  });
});
