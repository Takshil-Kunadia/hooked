import { describe, expect, it } from "vitest";
import {
  BEAT_SPAN_VH,
  BREATHER_VH,
  actHeightVh,
  beatScrollY,
  positionAt,
  snapTarget,
  stepTarget,
  type MeasuredAct,
} from "./scroll";

const VH = 1000;
const heightOf = (beats: number): number => (actHeightVh(beats) / 100) * VH;
const BREATHER = (BREATHER_VH / 100) * VH;

// Act A: 3 beats, top 0. Act B: 2 beats, starts after A plus the breather.
const A: MeasuredAct = { id: "a", top: 0, height: heightOf(3), beats: 3 };
const B: MeasuredAct = { id: "b", top: A.height + BREATHER, height: heightOf(2), beats: 2 };
const acts: ReadonlyArray<MeasuredAct> = [A, B];

describe("actHeightVh", () => {
  it("is one viewport plus a span per beat", () => {
    expect(BEAT_SPAN_VH).toBe(70);
    expect(actHeightVh(3)).toBe(310);
    expect(actHeightVh(2)).toBe(240);
  });
});

describe("positionAt", () => {
  it("gives each beat at its centre", () => {
    const expected = [
      [A, 0],
      [A, 1],
      [A, 2],
      [B, 0],
      [B, 1],
    ] as const;
    for (const [act, beat] of expected) {
      expect(positionAt(acts, beatScrollY(act, beat, VH), VH)).toEqual({
        actIndex: acts.indexOf(act),
        beat,
        inBreather: false,
      });
    }
  });

  it("puts beat k of n in [k/n, (k+1)/n) of the pinned range", () => {
    const range = A.height - VH;
    expect(positionAt(acts, (range * 1) / 3 - 1, VH).beat).toBe(0);
    expect(positionAt(acts, (range * 1) / 3, VH).beat).toBe(1);
  });

  it("is in a breather between acts, showing the next act's first beat", () => {
    const y = A.top + A.height + BREATHER / 2;
    expect(positionAt(acts, y, VH)).toEqual({ actIndex: 1, beat: 0, inBreather: true });
  });

  it("holds the last beat while an act scrolls away", () => {
    const y = A.top + A.height - VH / 2;
    expect(positionAt(acts, y, VH)).toEqual({ actIndex: 0, beat: 2, inBreather: false });
  });

  it("is act 0 beat 0 above the first act and for NaN", () => {
    const first = { actIndex: 0, beat: 0, inBreather: false };
    expect(positionAt(acts, -500, VH)).toEqual(first);
    expect(positionAt(acts, Number.NaN, VH)).toEqual(first);
  });

  it("is the last beat past the end", () => {
    expect(positionAt(acts, B.top + B.height + 5000, VH)).toEqual({
      actIndex: 1,
      beat: 1,
      inBreather: false,
    });
  });

  it("copes with no acts and with acts shorter than the viewport", () => {
    expect(positionAt([], 100, VH)).toEqual({ actIndex: 0, beat: 0, inBreather: false });
    const tiny: MeasuredAct = { id: "t", top: 0, height: 500, beats: 2 };
    expect(positionAt([tiny], 100, VH)).toEqual({ actIndex: 0, beat: 0, inBreather: false });
  });
});

describe("beatScrollY", () => {
  it("is the centre of the beat's span and clamps the beat index", () => {
    const range = A.height - VH;
    expect(beatScrollY(A, 1, VH)).toBeCloseTo(A.top + range / 2);
    expect(beatScrollY(A, 99, VH)).toBe(beatScrollY(A, 2, VH));
    expect(beatScrollY(A, -3, VH)).toBe(beatScrollY(A, 0, VH));
  });
});

describe("snapTarget", () => {
  it("returns the centre of the beat just past", () => {
    const centre = beatScrollY(A, 1, VH);
    expect(snapTarget(acts, centre + 40, VH)).toBe(centre);
    expect(snapTarget(acts, centre - 40, VH)).toBe(centre);
  });

  it("snaps a breather to the next act's first beat, and NaN to the start", () => {
    expect(snapTarget(acts, A.top + A.height + 10, VH)).toBe(beatScrollY(B, 0, VH));
    expect(snapTarget(acts, Number.NaN, VH)).toBe(beatScrollY(A, 0, VH));
    expect(snapTarget([], 10, VH)).toBe(0);
  });
});

describe("stepTarget", () => {
  it("steps within an act", () => {
    expect(stepTarget(acts, beatScrollY(A, 0, VH), VH, 1)).toBe(beatScrollY(A, 1, VH));
    expect(stepTarget(acts, beatScrollY(A, 1, VH), VH, -1)).toBe(beatScrollY(A, 0, VH));
  });

  it("crosses the act boundary both ways", () => {
    expect(stepTarget(acts, beatScrollY(A, 2, VH), VH, 1)).toBe(beatScrollY(B, 0, VH));
    expect(stepTarget(acts, beatScrollY(B, 0, VH), VH, -1)).toBe(beatScrollY(A, 2, VH));
  });

  it("clamps at both ends", () => {
    expect(stepTarget(acts, beatScrollY(A, 0, VH), VH, -1)).toBe(beatScrollY(A, 0, VH));
    expect(stepTarget(acts, beatScrollY(B, 1, VH), VH, 1)).toBe(beatScrollY(B, 1, VH));
    expect(stepTarget([], 0, VH, 1)).toBe(0);
  });

  it("steps from a breather to the next act's first beat, or back to the last beat before it", () => {
    const y = A.top + A.height + BREATHER / 2;
    expect(stepTarget(acts, y, VH, 1)).toBe(beatScrollY(B, 0, VH));
    expect(stepTarget(acts, y, VH, -1)).toBe(beatScrollY(A, 2, VH));
  });
});
