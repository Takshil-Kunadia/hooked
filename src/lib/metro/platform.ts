/**
 * The init platform: a slab in front of the init station where the ticket passes queue. Round 5
 * placed six passes on it; Chapter 1 shows eight, so the row scales down to fit between its
 * neighbours instead of overlapping them.
 */
import { FEEDER_LINES } from "./route";

/** Round 5's pass: 0.64 wide, with the next one 0.86 along (here a little tighter, to fit eight). */
export const TICKET_CARD_WIDTH = 0.64;
const PITCH_RATIO = 1.16;
/** Round 5's slab: 1.45 deep, its centre 1.9 in front of the line. */
const DEPTH = 1.45;
const Z = 1.9;
/** Air between the slab and the lines either side of it. */
const CLEARANCE = 0.1;
/** Air between the outer tickets and the slab's ends. */
const MARGIN = 0.1;

export interface PlatformLayout {
  /** The slab's centre and size on the floor. */
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  /** Ticket size relative to round 5's pass. */
  readonly ticketScale: number;
  /** Each ticket's centre, in run order from left to right. */
  readonly ticketX: ReadonlyArray<number>;
}

/** Where a line's straight stretch runs (its first point) and half its width. */
function lineEdge(id: string): { x: number; half: number } {
  const spec = FEEDER_LINES.find((l) => l.id === id);
  const start = spec?.points[0];
  if (!spec || !start) throw new RangeError(`Unknown line: ${id}`);
  return { x: start[0], half: spec.width / 2 };
}

/**
 * The slab fills the gap between the theme feeder (it bends away to the left as it nears the
 * main line, so its straight stretch is its closest point) and the depot spur.
 */
export function initPlatformLayout(count: number): PlatformLayout {
  const theme = lineEdge("theme");
  const spur = lineEdge("depot");
  const left = theme.x + theme.half + CLEARANCE;
  const right = spur.x - spur.half - CLEARANCE;
  const width = right - left;
  const x = (left + right) / 2;

  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const rowAtFullSize = ((n - 1) * PITCH_RATIO + 1) * TICKET_CARD_WIDTH;
  const ticketScale = n === 0 ? 1 : Math.min(1, (width - 2 * MARGIN) / rowAtFullSize);
  const pitch = PITCH_RATIO * TICKET_CARD_WIDTH * ticketScale;
  const first = x - ((n - 1) * pitch) / 2;
  return {
    x,
    z: Z,
    width,
    depth: DEPTH,
    ticketScale,
    ticketX: Array.from({ length: n }, (_, i) => first + i * pitch),
  };
}
