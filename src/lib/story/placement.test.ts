import { describe, expect, it } from "vitest";
import { placeCard, placeCardNear, type Rect } from "./placement";

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

describe("placeCardNear", () => {
  /* a copy column on the left and a board at the bottom right */
  const copy: Rect = { x: 100, y: 100, w: 400, h: 600 };
  const board: Rect = { x: 600, y: 500, w: 380, h: 280 };

  it("uses placeCard's spot when it is clear", () => {
    expect(placeCardNear(anchor, card, viewport, [])).toEqual({ x: 300, y: 352 });
  });

  it("steps out to the right of the copy column holding the anchor", () => {
    const word: Rect = { x: 150, y: 300, w: 80, h: 20 };
    expect(placeCardNear(word, card, viewport, [copy, board])).toEqual({ x: 512, y: 332 });
  });

  it("steps out to the left when the right has no room", () => {
    const column: Rect = { x: 600, y: 100, w: 380, h: 300 };
    const word: Rect = { x: 700, y: 200, w: 80, h: 20 };
    expect(placeCardNear(word, card, viewport, [column])).toEqual({ x: 388, y: 232 });
  });

  it("steps above a board whose row is the anchor", () => {
    const row: Rect = { x: 620, y: 600, w: 340, h: 24 };
    expect(placeCardNear(row, card, viewport, [copy, board])).toEqual({ x: 620, y: 388 });
  });

  it("steps outside the nearest box when the anchor sits beside it (a pointer over the scene)", () => {
    const nearBoard: Rect = { x: 540, y: 380, w: 440, h: 400 };
    const pointer: Rect = { x: 525, y: 440, w: 0, h: 0 };
    expect(placeCardNear(pointer, card, viewport, [copy, nearBoard])).toEqual({ x: 525, y: 268 });
  });

  it("slides a nearly full-width card along the box's edge on a phone (above the frosted sheet)", () => {
    const phone = { w: 390, h: 844 };
    const wide = { w: 350, h: 200 };
    const sheet: Rect = { x: 12, y: 420, w: 366, h: 412 };
    const board: Rect = { x: 24, y: 600, w: 342, h: 220 };
    const row: Rect = { x: 30, y: 700, w: 330, h: 20 };
    expect(placeCardNear(row, wide, phone, [sheet, board])).toEqual({ x: 24, y: 208 });
  });

  it("steps beside a nearly full-height column at its top when a board fills the space by the anchor", () => {
    /* an open "Under the hood" stretches the copy; its words sit low, level with the board */
    const tall: Rect = { x: 100, y: 20, w: 400, h: 760 };
    const word: Rect = { x: 140, y: 640, w: 120, h: 24 };
    expect(placeCardNear(word, card, viewport, [tall, board])).toEqual({ x: 512, y: 32 });
  });

  it("falls back to a spot by the anchor, inside the viewport, when nothing is clear", () => {
    const everything: Rect = { x: 0, y: 0, w: 1000, h: 800 };
    expect(placeCardNear(anchor, card, viewport, [everything])).toEqual({ x: 300, y: 352 });
    const corner: Rect = { x: 950, y: 780, w: 40, h: 10 };
    expect(placeCardNear(corner, card, viewport, [everything])).toEqual({ x: 784, y: 684 });
    const bands: Rect[] = [
      { x: 0, y: 0, w: 1000, h: 290 },
      { x: 0, y: 345, w: 1000, h: 455 },
    ];
    expect(placeCardNear(anchor, card, viewport, bands)).toEqual({ x: 300, y: 352 });
  });
});
