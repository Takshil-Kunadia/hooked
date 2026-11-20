import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAYOUT_QUERIES, layoutMode, type LayoutMode } from "./layout";

describe("layoutMode", () => {
  const cases: ReadonlyArray<readonly [number, number, LayoutMode]> = [
    [390, 844, "stacked"],
    [820, 1180, "stacked"],
    [760, 400, "stacked"],
    [1180, 820, "tablet"],
    [761, 500, "tablet"],
    [1440, 900, "desktop"],
    [1181, 1300, "desktop"],
    [1920, 1080, "wide"],
    [1800, 1000, "wide"],
  ];
  it.each(cases)("maps %ix%i to %s", (w, h, mode) => {
    expect(layoutMode(w, h)).toBe(mode);
  });

  it("falls back to desktop for non-finite sizes", () => {
    expect(layoutMode(Number.NaN, 900)).toBe("desktop");
  });
});

describe("LAYOUT_QUERIES", () => {
  it("css queries match LAYOUT_QUERIES", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    for (const [mode, query] of Object.entries(LAYOUT_QUERIES)) {
      expect(css).toContain(`@custom-variant ${mode} (@media ${query});`);
    }
  });
});
