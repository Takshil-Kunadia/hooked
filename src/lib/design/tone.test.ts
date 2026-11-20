import { describe, expect, it } from "vitest";
import { neutralToneMap, toneCompensate, type RGB } from "./tone";

/** sRGB hex → linear RGB, the way three.js decodes colours. */
function linear(hex: string): RGB {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [channel(0), channel(1), channel(2)];
}

describe("neutralToneMap", () => {
  it("keeps black black", () => {
    expect(neutralToneMap([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("subtracts the 0.04 offset below the shoulder", () => {
    const [r, g, b] = neutralToneMap([0.5, 0.5, 0.5]);
    expect(r).toBeCloseTo(0.46, 6);
    expect(g).toBeCloseTo(0.46, 6);
    expect(b).toBeCloseTo(0.46, 6);
  });

  it("squares the darkest tones (the toe)", () => {
    const [r] = neutralToneMap([0.04, 0.04, 0.04]);
    expect(r).toBeCloseTo(6.25 * 0.04 * 0.04, 6);
  });

  it("compresses highlights below 1", () => {
    const out = neutralToneMap([4, 4, 4]);
    for (const c of out) {
      expect(c).toBeGreaterThan(0.9);
      expect(c).toBeLessThan(1);
    }
  });

  it("does not mutate its input", () => {
    const input: RGB = [0.9, 0.5, 0.1];
    neutralToneMap(input);
    expect(input).toEqual([0.9, 0.5, 0.1]);
  });
});

describe("toneCompensate", () => {
  /* Page backgrounds and label inks from both tiles, plus an origin colour. */
  const colours = ["#F5F5F7", "#0E1117", "#1D1D1F", "#6E6E73", "#E6E9EF", "#8F949D", "#B79CF2"];

  it.each(colours)("tone-maps back to %s", (hex) => {
    const goal = linear(hex);
    const out = neutralToneMap(toneCompensate(goal));
    out.forEach((c, i) => expect(c).toBeCloseTo(goal[i]!, 4));
  });

  it("stays within a ceiling, keeping the hue when a channel can't reach its goal", () => {
    /* the core origin colour needs blue above 1, which a canvas can't hold */
    const goal = linear("#8FA8FF");
    const input = toneCompensate(goal, 1);
    input.forEach((c) => expect(c).toBeLessThanOrEqual(1));
    const [r, g, b] = neutralToneMap(input);
    expect(r).toBeCloseTo(goal[0], 3);
    expect(g).toBeCloseTo(goal[1], 3);
    expect(b).toBeGreaterThan(0.85);
  });

  it("never returns a negative channel", () => {
    expect(Math.min(...toneCompensate([0, 0.001, 0.2]))).toBeGreaterThanOrEqual(0);
  });

  it("does not mutate its input", () => {
    const goal: RGB = [0.2, 0.3, 0.4];
    toneCompensate(goal);
    expect(goal).toEqual([0.2, 0.3, 0.4]);
  });
});
