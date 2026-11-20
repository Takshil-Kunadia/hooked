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
