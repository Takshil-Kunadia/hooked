import { describe, expect, it } from "vitest";
import { focusOwnsKey, stepDirection, type ElementLike, type KeyLike } from "./keys";

const key = (name: string, mods: Partial<Omit<KeyLike, "key">> = {}): KeyLike => ({
  key: name,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

const el = (tagName: string, parentElement: ElementLike | null = null, isContentEditable = false): ElementLike => ({
  tagName,
  parentElement,
  isContentEditable,
});

describe("stepDirection", () => {
  it("steps forward on ArrowDown, PageDown and Space", () => {
    for (const name of ["ArrowDown", "PageDown", " "]) expect(stepDirection(key(name))).toBe(1);
  });

  it("steps back on ArrowUp, PageUp and Shift+Space", () => {
    for (const name of ["ArrowUp", "PageUp"]) expect(stepDirection(key(name))).toBe(-1);
    expect(stepDirection(key(" ", { shiftKey: true }))).toBe(-1);
  });

  it("ignores every other key", () => {
    for (const name of ["Enter", "Home", "End", "ArrowLeft", "ArrowRight", "Tab", "a"]) {
      expect(stepDirection(key(name))).toBeNull();
    }
  });

  it("ignores Ctrl, Alt and Meta combinations", () => {
    expect(stepDirection(key("ArrowDown", { ctrlKey: true }))).toBeNull();
    expect(stepDirection(key("ArrowUp", { altKey: true }))).toBeNull();
    expect(stepDirection(key(" ", { metaKey: true }))).toBeNull();
  });

  it("ignores Shift with the arrow and page keys (it extends a text selection)", () => {
    expect(stepDirection(key("ArrowDown", { shiftKey: true }))).toBeNull();
    expect(stepDirection(key("PageUp", { shiftKey: true }))).toBeNull();
  });
});

describe("focusOwnsKey", () => {
  const ACTIVATORS = ["BUTTON", "SUMMARY", "A"];
  const TEXT_ENTRY = ["INPUT", "TEXTAREA", "SELECT"];
  const STEP_KEYS = ["ArrowDown", "ArrowUp", "PageDown", "PageUp"];

  it("leaves Space and Enter to a focused summary, button or link, which they activate", () => {
    for (const tag of ACTIVATORS) {
      expect(focusOwnsKey(el(tag), " "), tag).toBe(true);
      expect(focusOwnsKey(el(tag), "Enter"), tag).toBe(true);
    }
  });

  it("never leaves the arrow and page keys to a summary, button or link: they still step", () => {
    for (const tag of ACTIVATORS)
      for (const k of STEP_KEYS) expect(focusOwnsKey(el(tag), k), `${tag} ${k}`).toBe(false);
  });

  it("leaves every key to text entry: inputs, text areas, selects and editable content", () => {
    for (const tag of TEXT_ENTRY) for (const k of [" ", ...STEP_KEYS]) expect(focusOwnsKey(el(tag), k)).toBe(true);
    for (const k of [" ", ...STEP_KEYS]) expect(focusOwnsKey(el("P", el("DIV"), true), k)).toBe(true);
  });

  it("looks up the tree, whatever the tag's case (SVG links are lowercase)", () => {
    expect(focusOwnsKey(el("SPAN", el("BUTTON", el("NAV"))), " ")).toBe(true);
    expect(focusOwnsKey(el("text", el("a", el("svg"))), " ")).toBe(true);
    expect(focusOwnsKey(el("SPAN", el("BUTTON", el("NAV"))), "ArrowDown")).toBe(false);
    expect(focusOwnsKey(el("SPAN", el("LABEL", el("textarea"))), "PageUp")).toBe(true);
  });

  it("is false for copy text, a hover-card word and the page body", () => {
    for (const k of [" ", ...STEP_KEYS]) {
      expect(focusOwnsKey(el("B", el("LI", el("OL"))), k)).toBe(false);
      expect(focusOwnsKey(el("CODE", el("LI")), k)).toBe(false);
      expect(focusOwnsKey(el("BODY"), k)).toBe(false);
      expect(focusOwnsKey(null, k)).toBe(false);
    }
  });
});
