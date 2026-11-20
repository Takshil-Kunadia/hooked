/** The train's cargo pill: what it says at each beat, and where it may sit on screen. */
import type { BeatSpec } from "./chapter";
import type { StoryData } from "./facts";
import type { Rect } from "./placement";

export type PillKind = NonNullable<BeatSpec["pill"]>;

const REASONS: Readonly<Record<number, string>> = { 200: "OK", 301: "Moved Permanently", 404: "Not Found" };

/** The pill's text, with the request and status taken from the data. */
export function pillText(kind: PillKind, data: Pick<StoryData, "request" | "status">): string {
  if (kind === "request") return `${data.request.method} ${data.request.path}`;
  if (kind === "init") return "do_action( 'init' )";
  const reason = REASONS[data.status];
  return reason ? `${data.status} ${reason}` : String(data.status);
}

interface Size {
  readonly w: number;
  readonly h: number;
}

/** Gap between the train's roof point and the pill, as in round 5. */
const LIFT = 14;
const EDGE = 10;
/** The pill keeps this clear of the copy, boards and header. */
const BERTH = 20;

const near = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w + BERTH && b.x - BERTH < a.x + a.w && a.y < b.y + b.h + BERTH && b.y - BERTH < a.y + a.h;

/**
 * The pill's top-left corner: centred above the train's screen point and kept inside the viewport
 * horizontally. Null hides it: the train is out of view, or the pill would crowd something it must
 * never cover.
 */
export function pillSpot(
  train: { readonly x: number; readonly y: number; readonly visible: boolean },
  pill: Size,
  viewport: Size,
  avoid: ReadonlyArray<Rect>,
): { x: number; y: number } | null {
  if (!train.visible) return null;
  const centre = Math.max(pill.w / 2 + EDGE, Math.min(train.x, viewport.w - pill.w / 2 - EDGE));
  const box: Rect = { x: centre - pill.w / 2, y: train.y - LIFT - pill.h, w: pill.w, h: pill.h };
  if (box.y < 0 || box.y + box.h > viewport.h || avoid.some((r) => near(box, r))) return null;
  return { x: box.x, y: box.y };
}
