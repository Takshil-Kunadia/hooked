import { describe, expect, it } from "vitest";
import { isInteractive, stepDirection, type ElementLike, type KeyLike } from "./keys";

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

describe("isInteractive", () => {
  it("is true for form controls, summary, button and links", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY", "A"])
      expect(isInteractive(el(tag))).toBe(true);
  });

  it("is true for anything inside one of them, whatever the tag's case (SVG links are lowercase)", () => {
    expect(isInteractive(el("SPAN", el("BUTTON", el("NAV"))))).toBe(true);
    expect(isInteractive(el("text", el("a", el("svg"))))).toBe(true);
  });

  it("is true in editable content", () => {
    expect(isInteractive(el("P", el("DIV"), true))).toBe(true);
  });

  it("is false for copy text, a hover-card word and the page body", () => {
    expect(isInteractive(el("B", el("LI", el("OL"))))).toBe(false);
    expect(isInteractive(el("CODE", el("LI")))).toBe(false);
    expect(isInteractive(el("BODY"))).toBe(false);
    expect(isInteractive(null)).toBe(false);
  });
});
