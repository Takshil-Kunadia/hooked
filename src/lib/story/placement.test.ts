import { describe, expect, it } from "vitest";
import { placeCard, type Rect } from "./placement";

const viewport = { w: 1000, h: 800 };
const card = { w: 200, h: 100 };
const anchor: Rect = { x: 300, y: 300, w: 80, h: 40 };

describe("placeCard", () => {
  it("picks below-right when it fits", () => {
    expect(placeCard(anchor, card, viewport, [])).toEqual({ x: 300, y: 352 });
  });

  it("flips to below-left at the right edge", () => {
    const right: Rect = { x: 850, y: 300, w: 80, h: 40 };
    expect(placeCard(right, card, viewport, [])).toEqual({ x: 730, y: 352 });
  });

  it("flips above at the bottom edge", () => {
    const bottom: Rect = { x: 300, y: 700, w: 80, h: 40 };
    expect(placeCard(bottom, card, viewport, [])).toEqual({ x: 300, y: 588 });
  });

  it("flips above-left at the bottom-right corner", () => {
    const corner: Rect = { x: 850, y: 700, w: 80, h: 40 };
    expect(placeCard(corner, card, viewport, [])).toEqual({ x: 730, y: 588 });
  });

  it("skips spots that overlap an avoid rect", () => {
    const avoid: Rect[] = [{ x: 290, y: 345, w: 100, h: 120 }];
    expect(placeCard(anchor, card, viewport, avoid)).toEqual({ x: 300, y: 188 });
  });

  it("returns null when the copy column covers every option", () => {
    expect(placeCard(anchor, card, viewport, [{ x: 0, y: 0, w: 1000, h: 800 }])).toBeNull();
  });

  it("returns null when the card cannot fit in the viewport at all", () => {
    expect(placeCard(anchor, { w: 2000, h: 100 }, viewport, [])).toBeNull();
  });
});
