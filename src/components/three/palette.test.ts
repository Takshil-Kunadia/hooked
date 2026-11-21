import { describe, expect, it } from "vitest";
import { mixPalettes, moodPalette, skyColours } from "./palette";

describe("the lighting narrative's palettes", () => {
  it("is Day at 0, Dusk at 0.5 and the dark core at 1", () => {
    expect(moodPalette(0).bg.toLowerCase()).toBe("#f5f5f7");
    expect(moodPalette(0.5).bg.toLowerCase()).toBe("#0e1117");
    expect(moodPalette(1).bg.toLowerCase()).toBe("#06070b");
    expect(moodPalette(-1).bg).toBe(moodPalette(0).bg);
    expect(moodPalette(2).bg).toBe(moodPalette(1).bg);
  });

  it("passes through a misty blue, not grey, on the way from Day to Dusk", () => {
    expect(moodPalette(0.25).bg.toLowerCase()).toBe("#cbd5e6");
  });

  it("only blooms once it is dark", () => {
    expect(moodPalette(0.3).bloom).toBe(false);
    expect(moodPalette(0.7).bloom).toBe(true);
  });

  it("blends numbers and colours, and clamps", () => {
    const a = moodPalette(0);
    const b = moodPalette(1);
    const mid = mixPalettes(a, b, 0.5);
    expect(mid.key).toBeCloseTo((a.key + b.key) / 2);
    expect(mixPalettes(a, b, 5).bg).toBe(b.bg);
    expect(mixPalettes(a, b, -5).bg).toBe(a.bg);
  });

  it("tints the sky towards the line colour lower down", () => {
    const [top, bottom] = skyColours(moodPalette(0));
    expect(top.toLowerCase()).toBe("#f5f5f7");
    expect(bottom).not.toBe(top);
  });
});
