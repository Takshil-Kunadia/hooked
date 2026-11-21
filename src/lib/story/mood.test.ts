import { describe, expect, it } from "vitest";
import { DARK_TEXT_FROM, beatMood, easeMood } from "./mood";

describe("the story's lighting", () => {
  it("is daylight at the browser and in the overviews, dusk at init, the core at the database", () => {
    expect(beatMood(null, false)).toBe(0);
    expect(beatMood({ station: "init", shot: "overview" }, false)).toBe(0);
    expect(beatMood({ station: "browser", shot: "station" }, false)).toBe(0);
    expect(beatMood({ station: "settings", shot: "feeders" }, false)).toBeLessThan(DARK_TEXT_FROM);
    expect(beatMood({ station: "init", shot: "platform" }, false)).toBe(0.5);
    expect(beatMood({ station: "php", shot: "depot" }, false)).toBeGreaterThan(0.8);
    expect(beatMood({ station: "query", shot: "station" }, false)).toBe(1);
    expect(beatMood({ station: "response", shot: "station" }, false)).toBe(0);
  });

  it("starts from Dusk in a dark colour scheme", () => {
    expect(beatMood(null, true)).toBe(0.5);
    expect(beatMood({ station: "query", shot: "station" }, true)).toBe(1);
  });

  it("eases towards the goal and shows it in steps", () => {
    const { value, shown } = easeMood(0, 1, 0.5, 0.1);
    expect(value).toBe(0.5);
    expect(shown).toBeCloseTo(0.5);
    expect(easeMood(0, 1, 0.33, 0.25).shown).toBe(0.25);
    expect(easeMood(0.2, 1, 5, 0.1).value).toBe(1);
  });
});
