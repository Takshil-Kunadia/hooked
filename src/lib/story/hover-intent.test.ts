import { describe, expect, it, vi } from "vitest";
import {
  HOVER_GRACE_MS,
  MAX_GRACE_MS,
  NO_HOVER,
  createPointerHover,
  graceMs,
  isLeaving,
  nextHover,
  showInStore,
  type HoverEvent,
  type HoverIntent,
} from "./hover-intent";
import { createStoryStore } from "./store";

const run = (events: ReadonlyArray<HoverEvent>, from: HoverIntent = NO_HOVER): HoverIntent =>
  events.reduce(nextHover, from);

describe("nextHover", () => {
  it("opens the card of the anchor the pointer enters", () => {
    expect(run([{ type: "anchor", name: "init" }])).toEqual({ name: "init", onAnchor: true, onCard: false });
  });

  it("keeps the card while the pointer crosses from its anchor onto the card", () => {
    const s = run([
      { type: "anchor", name: "init" },
      { type: "anchor", name: null },
      { type: "card", inside: true },
    ]);
    expect(s).toEqual({ name: "init", onAnchor: false, onCard: true });
    expect(isLeaving(s)).toBe(false);
  });

  it("waits out the grace period once the pointer is on neither the anchor nor the card", () => {
    const leftAnchor = run([
      { type: "anchor", name: "init" },
      { type: "anchor", name: null },
    ]);
    expect(isLeaving(leftAnchor)).toBe(true);
    const leftCard = run(
      [
        { type: "card", inside: true },
        { type: "card", inside: false },
      ],
      leftAnchor,
    );
    expect(isLeaving(leftCard)).toBe(true);
    expect(nextHover(leftCard, { type: "expire" })).toEqual(NO_HOVER);
  });

  it("ignores a stale expiry when the pointer came back in time", () => {
    const back = run([
      { type: "anchor", name: "init" },
      { type: "anchor", name: null },
      { type: "card", inside: true },
    ]);
    expect(nextHover(back, { type: "expire" })).toBe(back);
    const onWord = run([{ type: "anchor", name: "init" }]);
    expect(nextHover(onWord, { type: "expire" })).toBe(onWord);
  });

  it("switches at once to another anchor, and forgets the old card", () => {
    const s = run([
      { type: "anchor", name: "init" },
      { type: "anchor", name: null },
      { type: "card", inside: true },
      { type: "card", inside: false },
      { type: "anchor", name: "wp_loaded" },
    ]);
    expect(s).toEqual({ name: "wp_loaded", onAnchor: true, onCard: false });
  });

  it("dismisses on Esc, wherever the pointer is, until it enters an anchor again", () => {
    const shown = run([
      { type: "anchor", name: "init" },
      { type: "card", inside: true },
    ]);
    const dismissed = nextHover(shown, { type: "dismiss" });
    expect(dismissed).toEqual(NO_HOVER);
    expect(
      run(
        [
          { type: "anchor", name: null },
          { type: "card", inside: false },
        ],
        dismissed,
      ),
    ).toEqual(NO_HOVER);
    expect(run([{ type: "anchor", name: "init" }], dismissed).name).toBe("init");
  });

  it("does nothing for the card while none is shown, or when nothing changed", () => {
    expect(nextHover(NO_HOVER, { type: "card", inside: true })).toBe(NO_HOVER);
    expect(nextHover(NO_HOVER, { type: "anchor", name: null })).toBe(NO_HOVER);
    const onCard = run([
      { type: "anchor", name: "init" },
      { type: "card", inside: true },
    ]);
    expect(nextHover(onCard, { type: "card", inside: true })).toBe(onCard);
  });

  it("keeps the pointer on the card when its own anchor reports in again", () => {
    const s = run([
      { type: "anchor", name: "init" },
      { type: "card", inside: true },
      { type: "anchor", name: "init" },
    ]);
    expect(s).toEqual({ name: "init", onAnchor: true, onCard: true });
  });
});

describe("graceMs", () => {
  const word = { x: 200, y: 400, w: 80, h: 24 };

  it("is the short grace for a card right next to its anchor", () => {
    expect(graceMs(word, { x: 200, y: 436, w: 350, h: 200 })).toBe(HOVER_GRACE_MS + 12);
    expect(graceMs(word, { x: 150, y: 380, w: 350, h: 200 })).toBe(HOVER_GRACE_MS);
  });

  it("grows with the gap the pointer must cross to reach the card, up to a cap", () => {
    expect(graceMs(word, { x: 680, y: 400, w: 350, h: 200 })).toBe(HOVER_GRACE_MS + 400);
    expect(graceMs(word, { x: 1400, y: 900, w: 350, h: 200 })).toBe(MAX_GRACE_MS);
  });

  it("falls back to the short grace for a broken measurement", () => {
    expect(graceMs(word, { x: Number.NaN, y: 0, w: 0, h: 0 })).toBe(HOVER_GRACE_MS);
  });
});

describe("createPointerHover", () => {
  const setup = () => {
    let now = 0;
    const pending: Array<{ at: number; fn: () => void; id: number }> = [];
    let nextId = 1;
    const timers = {
      set: (fn: () => void, ms: number) => {
        const id = nextId++;
        pending.push({ at: now + ms, fn, id });
        return id;
      },
      clear: (id: number) => {
        const i = pending.findIndex((t) => t.id === id);
        if (i >= 0) pending.splice(i, 1);
      },
    };
    const advance = (ms: number) => {
      now += ms;
      for (const t of pending.filter((p) => p.at <= now)) {
        timers.clear(t.id);
        t.fn();
      }
    };
    const show = vi.fn();
    return { hover: createPointerHover(show, timers), show, advance, pending };
  };

  it("shows the card on entering an anchor and hides it after the grace period", () => {
    const { hover, show, advance } = setup();
    hover.send({ type: "anchor", name: "init" });
    expect(show).toHaveBeenLastCalledWith("init", null);
    hover.send({ type: "anchor", name: null });
    advance(HOVER_GRACE_MS - 1);
    expect(show).toHaveBeenCalledTimes(1);
    advance(1);
    expect(show).toHaveBeenLastCalledWith(null, "init");
  });

  it("keeps the card when the pointer reaches it within the grace period", () => {
    const { hover, show, advance, pending } = setup();
    hover.send({ type: "anchor", name: "init" });
    hover.send({ type: "anchor", name: null });
    advance(HOVER_GRACE_MS - 50);
    hover.send({ type: "card", inside: true });
    expect(pending).toHaveLength(0);
    advance(5000);
    expect(show).toHaveBeenCalledTimes(1);
    hover.send({ type: "card", inside: false });
    advance(HOVER_GRACE_MS);
    expect(show).toHaveBeenLastCalledWith(null, "init");
  });

  it("waits longer for a card further from its anchor", () => {
    const { hover, show, advance } = setup();
    hover.send({ type: "anchor", name: "init" });
    hover.setGrace(700);
    hover.send({ type: "anchor", name: null });
    advance(HOVER_GRACE_MS);
    expect(show).toHaveBeenCalledTimes(1);
    advance(400);
    expect(show).toHaveBeenLastCalledWith(null, "init");
  });

  it("goes back to the short grace for the next card", () => {
    const { hover, show, advance } = setup();
    hover.send({ type: "anchor", name: "init" });
    hover.setGrace(700);
    hover.send({ type: "anchor", name: "wp_loaded" });
    hover.send({ type: "anchor", name: null });
    advance(HOVER_GRACE_MS);
    expect(show).toHaveBeenLastCalledWith(null, "wp_loaded");
  });

  it("arms one timer per departure and drops it on Esc", () => {
    const { hover, show, advance, pending } = setup();
    hover.send({ type: "anchor", name: "init" });
    hover.send({ type: "anchor", name: null });
    hover.send({ type: "anchor", name: null });
    expect(pending).toHaveLength(1);
    hover.send({ type: "dismiss" });
    expect(show).toHaveBeenLastCalledWith(null, "init");
    expect(pending).toHaveLength(0);
    advance(5000);
    expect(show).toHaveBeenCalledTimes(2);
  });
});

describe("showInStore", () => {
  it("opens the pointer's card, and closes it only if it is still the one shown", () => {
    const store = createStoryStore();
    const show = showInStore(store);
    show("init", null);
    expect(store.getState().hovered).toBe("init");
    store.getState().hover("wp_loaded");
    show(null, "init");
    expect(store.getState().hovered).toBe("wp_loaded");
    show(null, "wp_loaded");
    expect(store.getState().hovered).toBeNull();
  });
});
