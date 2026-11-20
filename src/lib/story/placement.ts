/** Where a hover card goes: next to its anchor, inside the viewport, clear of the copy column. */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Size {
  readonly w: number;
  readonly h: number;
}

const GAP = 12;
const MARGIN = 16;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Tries below-right, below-left, above-right, then above-left of the anchor. Returns the first
 * spot that sits inside the viewport (16px margin) and overlaps nothing in `avoid`, else null.
 */
export function placeCard(
  anchor: Rect,
  card: Size,
  viewport: Size,
  avoid: ReadonlyArray<Rect>,
): { x: number; y: number } | null {
  const below = anchor.y + anchor.h + GAP;
  const above = anchor.y - GAP - card.h;
  const right = anchor.x;
  const left = anchor.x + anchor.w - card.w;
  const candidates = [
    { x: right, y: below },
    { x: left, y: below },
    { x: right, y: above },
    { x: left, y: above },
  ];
  const fits = ({ x, y }: { x: number; y: number }): boolean =>
    x >= MARGIN &&
    y >= MARGIN &&
    x + card.w <= viewport.w - MARGIN &&
    y + card.h <= viewport.h - MARGIN &&
    !avoid.some((r) => overlaps({ x, y, w: card.w, h: card.h }, r));
  return candidates.find(fits) ?? null;
}

/** How far the anchor's centre is from a box (0 when inside it). */
const distance = (r: Rect, a: Rect): number => {
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  return Math.hypot(Math.max(r.x - cx, 0, cx - r.x - r.w), Math.max(r.y - cy, 0, cy - r.y - r.h));
};

const clampTo = (value: number, size: number, limit: number): number =>
  Math.max(MARGIN, Math.min(value, limit - size - MARGIN));

/**
 * Thin anchors just outside a box, level with the anchor: to its right and left, then above and
 * below it, first lined up with the anchor and then slid inside the viewport (a card nearly as wide
 * as a phone can't line up with either end of a word).
 */
function sidesOf(box: Rect, anchor: Rect, card: Size, viewport: Size): ReadonlyArray<Rect> {
  const slid = clampTo(anchor.x, card.w, viewport.w);
  return [
    { x: box.x + box.w + GAP, y: anchor.y, w: 0, h: anchor.h },
    { x: box.x - GAP, y: anchor.y, w: 0, h: anchor.h },
    { x: anchor.x, y: box.y, w: anchor.w, h: 0 },
    { x: anchor.x, y: box.y + box.h, w: anchor.w, h: 0 },
    { x: slid, y: box.y, w: card.w, h: 0 },
    { x: slid, y: box.y + box.h, w: card.w, h: 0 },
  ];
}

/**
 * Like `placeCard`, but when no spot by the anchor is clear it steps outside the boxes it must avoid,
 * nearest first (the copy column holding a word, the board holding a row, a board beside the
 * pointer): to the box's right, its left, above it, then below it. If nothing is clear it settles
 * below-right of the anchor, kept inside the viewport.
 */
export function placeCardNear(
  anchor: Rect,
  card: Size,
  viewport: Size,
  avoid: ReadonlyArray<Rect>,
): { x: number; y: number } {
  const direct = placeCard(anchor, card, viewport, avoid);
  if (direct) return direct;
  const nearest = [...avoid].sort((a, b) => distance(a, anchor) - distance(b, anchor));
  for (const side of nearest.flatMap((box) => sidesOf(box, anchor, card, viewport))) {
    const spot = placeCard(side, card, viewport, avoid);
    if (spot) return spot;
  }
  return { x: clampTo(anchor.x, card.w, viewport.w), y: clampTo(anchor.y + anchor.h + GAP, card.h, viewport.h) };
}
