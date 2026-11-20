import { describe, expect, it } from "vitest";
import { createStoryStore } from "./store";

describe("story store", () => {
  it("starts at the hero with safe defaults", () => {
    expect(createStoryStore().getState()).toMatchObject({
      actId: "hero",
      beat: 0,
      enteredAt: 0,
      fromLater: false,
      layout: "desktop",
      reducedMotion: false,
      hovered: null,
      pinned: null,
    });
  });

  it("sets enteredAt only when the act or beat changes", () => {
    const s = createStoryStore();
    s.getState().goTo("init", 1, 3, 10);
    expect(s.getState().enteredAt).toBe(10);
    s.getState().goTo("init", 1, 3, 20);
    expect(s.getState().enteredAt).toBe(10);
    s.getState().goTo("init", 2, 4, 30);
    expect(s.getState().enteredAt).toBe(30);
    s.getState().goTo("query", 2, 5, 40);
    expect(s.getState().enteredAt).toBe(40);
  });

  it("fromLater follows the global index", () => {
    const s = createStoryStore();
    s.getState().goTo("init", 0, 5, 1);
    expect(s.getState().fromLater).toBe(false);
    s.getState().goTo("init", 0, 2, 2);
    expect(s.getState().fromLater).toBe(true);
    expect(s.getState().globalIndex).toBe(2);
    s.getState().goTo("init", 1, 3, 3);
    expect(s.getState().fromLater).toBe(false);
  });

  it("ignores hover while a card is pinned", () => {
    const s = createStoryStore();
    s.getState().hover("a");
    expect(s.getState().hovered).toBe("a");
    s.getState().pin("b");
    s.getState().hover("c");
    expect(s.getState().hovered).toBe("a");
    expect(s.getState().pinned).toBe("b");
  });

  it("pin(null) clears pinned and hovered", () => {
    const s = createStoryStore();
    s.getState().hover("a");
    s.getState().pin("b");
    s.getState().pin(null);
    expect(s.getState()).toMatchObject({ pinned: null, hovered: null });
  });

  it("stores layout and reduced motion, and accepts initial overrides", () => {
    const s = createStoryStore({ layout: "wide" });
    expect(s.getState().layout).toBe("wide");
    s.getState().setLayout("stacked");
    s.getState().setReducedMotion(true);
    expect(s.getState()).toMatchObject({ layout: "stacked", reducedMotion: true });
  });
});
