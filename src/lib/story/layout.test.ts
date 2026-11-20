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
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  /** The media query a Tailwind custom variant wraps, in its shorthand or its block form. */
  const variantQuery = (mode: string): string | undefined =>
    css
      .match(new RegExp(`@custom-variant ${mode} (?:\\(@media (.+)\\);|\\{\\s*@media (.+?) \\{\\s*@slot;)`))
      ?.slice(1)
      .find(Boolean);

  it("css queries match LAYOUT_QUERIES", () => {
    for (const [mode, query] of Object.entries(LAYOUT_QUERIES)) expect(variantQuery(mode)).toBe(query);
  });

  it("uses the block form for a query list, since Tailwind's shorthand splits on commas", () => {
    for (const [mode, query] of Object.entries(LAYOUT_QUERIES)) {
      if (query.includes(",")) expect(css).not.toContain(`@custom-variant ${mode} (`);
    }
  });
});
