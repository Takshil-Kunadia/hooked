import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LINE_COLOURS, ORIGIN_COLOURS } from "./tokens";

const css = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8").toLowerCase();

describe("design tokens", () => {
  it("keeps every origin colour in sync with tokens.css", () => {
    for (const [origin, hex] of Object.entries(ORIGIN_COLOURS)) {
      expect(css, `--${origin} should be ${hex}`).toContain(`--${origin}: ${hex.toLowerCase()}`);
    }
  });

  it("uses the WP blue accent for the main line", () => {
    expect(LINE_COLOURS.main.toLowerCase()).toBe("#3858e9");
    expect(css).toContain("#3858e9");
  });
});
