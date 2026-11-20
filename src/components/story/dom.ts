/**
 * The story's few DOM reads, shared by its client islands. Each one forces layout at most once, so
 * callers read here first and write styles after.
 */
import { measureActs, type ActShape } from "@/lib/story/pins";
import type { Rect } from "@/lib/story/placement";
import type { MeasuredAct } from "@/lib/story/scroll";

/** Elements a hover card or the train pill must never cover: the copy, boards and header. */
const AVOID = "[data-card-avoid]";
/** Set on a pin whose copy is hidden (a breather, or another act). */
const HIDDEN = "[data-off]";

/** An element's top in document pixels: its offsetTop summed up the offsetParent chain. */
function documentTop(el: HTMLElement): number {
  let top = 0;
  for (let node: Element | null = el; node instanceof HTMLElement; node = node.offsetParent) top += node.offsetTop;
  return top;
}

/** Every act's box, found by its id (the page renders the first act, the hero). */
export function measureStory(shape: ReadonlyArray<ActShape>): MeasuredAct[] {
  return measureActs(shape, (id) => {
    const el = document.getElementById(id);
    return el ? { top: documentTop(el), height: el.offsetHeight } : null;
  });
}

/** One pin's height: 100svh in pixels, which stays put while a phone's URL bar slides. */
export function pinHeight(): number {
  return document.querySelector<HTMLElement>("[data-pin]")?.offsetHeight || window.innerHeight;
}

export function scrollToY(top: number, smooth: boolean): void {
  window.scrollTo({ top, behavior: smooth ? "smooth" : "instant" });
}

/** On-screen boxes of everything a card or the pill must keep clear of. */
export function avoidRects(): Rect[] {
  const rects: Rect[] = [];
  for (const el of document.querySelectorAll(AVOID)) {
    if (el.closest(HIDDEN)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) {
      rects.push({ x: r.left, y: r.top, w: r.width, h: r.height });
    }
  }
  return rects;
}
