/**
 * Hover cards a pointer opens, made hoverable (WCAG 1.4.13): a card stays open while the pointer is
 * on what opened it (a copy word, a board row, a map object) or on the card itself, waits out a
 * grace period once the pointer is on neither (to cross the gap between them), and Esc dismisses it.
 * On its way from a copy word to the word's card the pointer may cross the 3D map, so during that
 * grace period the map can't take over: the object under the pointer waits its turn (`held`).
 * Focus opens cards too, but directly through the store: this is for the pointer only.
 */
import type { Rect } from "./placement";
import { storyStore, type StoryStore } from "./store";

/** The grace period for a card right next to what opened it. */
export const HOVER_GRACE_MS = 300;
/** Never wait longer than this, however far away the card had to go. */
export const MAX_GRACE_MS = 900;
/** Extra grace per pixel between the anchor and the card: crossing at one pixel per millisecond. */
const GRACE_MS_PER_PX = 1;

/** Where an anchor is: in the page (a copy word, a board row) or on the 3D map. */
type AnchorSource = "page" | "map";

export interface HoverIntent {
  /** The card the pointer opened, or null. */
  readonly name: string | null;
  /** What kind of anchor opened it. */
  readonly source: AnchorSource | null;
  readonly onAnchor: boolean;
  readonly onCard: boolean;
  /** A map object under the pointer, waiting for a word's card to finish its grace period. */
  readonly held: string | null;
}

export type HoverEvent =
  /** The pointer is over this anchor now, or (null) over none of this source's anchors. */
  | { readonly type: "anchor"; readonly name: string | null; readonly from: AnchorSource }
  | { readonly type: "card"; readonly inside: boolean }
  /** The grace period ran out. */
  | { readonly type: "expire" }
  /** Esc. */
  | { readonly type: "dismiss" };

export const NO_HOVER: HoverIntent = { name: null, source: null, onAnchor: false, onCard: false, held: null };

const opened = (name: string, source: AnchorSource, onCard: boolean): HoverIntent => ({
  name,
  source,
  onAnchor: true,
  onCard,
  held: null,
});

function pointerLeft(s: HoverIntent, from: AnchorSource): HoverIntent {
  const held = from === "map" ? null : s.held;
  const onAnchor = s.onAnchor && s.source !== from;
  return held === s.held && onAnchor === s.onAnchor ? s : { ...s, held, onAnchor };
}

export function nextHover(s: HoverIntent, e: HoverEvent): HoverIntent {
  switch (e.type) {
    case "anchor":
      if (e.name === null) return pointerLeft(s, e.from);
      if (e.from === "map" && s.source === "page" && isLeaving(s))
        return s.held === e.name ? s : { ...s, held: e.name };
      return opened(e.name, e.from, e.name === s.name && s.onCard);
    case "card":
      if (s.name === null || (s.onCard === e.inside && (!e.inside || s.held === null))) return s;
      return { ...s, onCard: e.inside, held: e.inside ? null : s.held };
    case "expire":
      if (s.onAnchor || s.onCard) return s;
      return s.held === null ? NO_HOVER : opened(s.held, "map", false);
    case "dismiss":
      return NO_HOVER;
  }
}

/** True while a card waits out its grace period: open, with the pointer on neither it nor its anchor. */
export function isLeaving(s: HoverIntent): boolean {
  return s.name !== null && !s.onAnchor && !s.onCard;
}

/** How long a card waits for the pointer: longer the further it sits from what opened it. */
export function graceMs(anchor: Rect, card: Rect): number {
  const dx = Math.max(0, card.x - (anchor.x + anchor.w), anchor.x - (card.x + card.w));
  const dy = Math.max(0, card.y - (anchor.y + anchor.h), anchor.y - (card.y + card.h));
  const gap = Math.hypot(dx, dy);
  if (!Number.isFinite(gap)) return HOVER_GRACE_MS;
  return Math.min(MAX_GRACE_MS, HOVER_GRACE_MS + gap * GRACE_MS_PER_PX);
}

export interface Timers {
  set(fn: () => void, ms: number): number;
  clear(id: number): void;
}

export interface PointerHover {
  send(e: HoverEvent): void;
  /** The open card's grace period (`graceMs`); every new card starts with the short one. */
  setGrace(ms: number): void;
}

/** Runs the intent: `show(name, previous)` whenever the card it opens changes, plus the grace timer. */
export function createPointerHover(
  show: (name: string | null, previous: string | null) => void,
  timers: Timers,
): PointerHover {
  let state = NO_HOVER;
  let grace = HOVER_GRACE_MS;
  let timer: number | null = null;
  const stopTimer = (): void => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };
  const send = (e: HoverEvent): void => {
    const previous = state.name;
    state = nextHover(state, e);
    if (!isLeaving(state)) stopTimer();
    if (state.name !== previous) {
      grace = HOVER_GRACE_MS;
      show(state.name, previous);
    }
    if (isLeaving(state) && timer === null) {
      timer = timers.set(() => {
        timer = null;
        send({ type: "expire" });
      }, grace);
    }
  };
  return {
    send,
    setGrace: (ms) => {
      grace = ms;
    },
  };
}

/** Shows the pointer's card through the story store, never closing a card something else opened since. */
export const showInStore =
  (store: StoryStore) =>
  (name: string | null, previous: string | null): void => {
    const s = store.getState();
    if (name !== null) s.hover(name);
    else if (s.hovered === previous) s.hover(null);
  };

const WINDOW_TIMERS: Timers = {
  set: (fn, ms) => window.setTimeout(fn, ms),
  clear: (id) => window.clearTimeout(id),
};

/** The app-wide pointer hover, shared by the copy, the boards and 3D picking. */
export const pointerHover: PointerHover = createPointerHover(showInStore(storyStore), WINDOW_TIMERS);
