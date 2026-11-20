import { describe, expect, it } from "vitest";
import { isLinked, linkedCard } from "./linked";

describe("linkedCard", () => {
  it("is the pinned card, else the hovered one, else none", () => {
    expect(linkedCard({ pinned: "init", hovered: "wp_loaded" })).toBe("init");
    expect(linkedCard({ pinned: null, hovered: "wp_loaded" })).toBe("wp_loaded");
    expect(linkedCard({ pinned: null, hovered: null })).toBeNull();
  });
});

describe("isLinked", () => {
  it("links every word and board row showing the open card, wherever it was opened", () => {
    expect(isLinked("init", "init")).toBe(true);
    expect(isLinked("wp_initialize_site_preview_hooks", "wp_initialize_site_preview_hooks")).toBe(true);
  });

  it("links nothing else: names match exactly, and nothing links while no card is open", () => {
    expect(isLinked("init", "wp_loaded")).toBe(false);
    expect(isLinked("init", "INIT")).toBe(false);
    expect(isLinked("init", null)).toBe(false);
    expect(isLinked("", null)).toBe(false);
  });
});
