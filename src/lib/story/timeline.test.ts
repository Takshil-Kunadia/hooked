import { describe, expect, it } from "vitest";
import { beatAt, clamp01, easeInOutCubic, piecewise } from "./timeline";

describe("clamp01", () => {
  it("keeps values inside 0..1", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(3)).toBe(1);
  });
});

describe("piecewise", () => {
  const keys: ReadonlyArray<readonly [number, number]> = [
    [0, 0.1],
    [0.5, 0.4],
    [1, 0.5],
  ];

  it("returns the first value before the first key", () => {
    expect(piecewise(keys, -1)).toBe(0.1);
  });

  it("interpolates linearly between keys", () => {
    expect(piecewise(keys, 0.25)).toBeCloseTo(0.25);
    expect(piecewise(keys, 0.75)).toBeCloseTo(0.45);
  });

  it("returns the last value after the last key", () => {
    expect(piecewise(keys, 2)).toBe(0.5);
  });

  it("rejects an empty key list", () => {
    expect(() => piecewise([], 0.5)).toThrow(/at least one key/);
  });
});

describe("beatAt", () => {
  const edges = [0, 0.34, 0.67, 1] as const;

  it("maps progress to the beat whose range contains it", () => {
    expect(beatAt(edges, 0)).toBe(0);
    expect(beatAt(edges, 0.33)).toBe(0);
    expect(beatAt(edges, 0.34)).toBe(1);
    expect(beatAt(edges, 0.9)).toBe(2);
  });

  it("clamps to the last beat at or past the end", () => {
    expect(beatAt(edges, 1)).toBe(2);
    expect(beatAt(edges, 5)).toBe(2);
  });

  it("clamps to the first beat before the start", () => {
    expect(beatAt(edges, -1)).toBe(0);
  });

  it("rejects edges that cannot form a beat", () => {
    expect(() => beatAt([0], 0.5)).toThrow(/at least two edges/);
  });
});

describe("easeInOutCubic", () => {
  it("starts at 0, ends at 1 and is symmetric around the middle", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1);
  });

  it("clamps out-of-range input", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
});

describe("timeline robustness", () => {
  it("treats NaN as the start of the range", () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(easeInOutCubic(Number.NaN)).toBe(0);
    expect(beatAt([0, 0.5, 1], Number.NaN)).toBe(0);
    expect(
      piecewise(
        [
          [0, 2],
          [1, 4],
        ],
        Number.NaN,
      ),
    ).toBe(2);
  });

  it("returns the only value of a single-key timeline", () => {
    expect(piecewise([[0.3, 7]], 0)).toBe(7);
    expect(piecewise([[0.3, 7]], 0.9)).toBe(7);
  });

  it("rejects edges that are not ascending", () => {
    expect(() => beatAt([0, 0.6, 0.4, 1], 0.5)).toThrow(/ascending/);
  });
});
