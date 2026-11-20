/**
 * Hover cards a pointer opens, made hoverable (WCAG 1.4.13): a card stays open while the pointer is
 * on what opened it (a copy word, a board row, a map object) or on the card itself, waits out a
 * grace period once the pointer is on neither (to cross the gap between them), and Esc dismisses it.
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

export interface HoverIntent {
  /** The card the pointer opened, or null. */
  readonly name: string | null;
  readonly onAnchor: boolean;
  readonly onCard: boolean;
}

export type HoverEvent =
  /** The pointer is over this anchor now, or (null) over none. */
  | { readonly type: "anchor"; readonly name: string | null }
  | { readonly type: "card"; readonly inside: boolean }
  /** The grace period ran out. */
  | { readonly type: "expire" }
  /** Esc. */
  | { readonly type: "dismiss" };

export const NO_HOVER: HoverIntent = { name: null, onAnchor: false, onCard: false };

export function nextHover(s: HoverIntent, e: HoverEvent): HoverIntent {
  switch (e.type) {
    case "anchor":
      if (e.name !== null) return { name: e.name, onAnchor: true, onCard: e.name === s.name && s.onCard };
      return s.onAnchor ? { ...s, onAnchor: false } : s;
    case "card":
      return s.name === null || s.onCard === e.inside ? s : { ...s, onCard: e.inside };
    case "expire":
      return s.onAnchor || s.onCard ? s : NO_HOVER;
    case "dismiss":
      return NO_HOVER;
  }
}

/** True while a card waits out its grace period: open, with the pointer on neither it nor its anchor. */
export const isLeaving = (s: HoverIntent): boolean => s.name !== null && !s.onAnchor && !s.onCard;

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
