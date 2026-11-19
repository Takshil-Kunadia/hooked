import { describe, expect, it } from "vitest";
import { isDemoName, SCENARIOS } from "./scenarios";
import { SCENARIO_ID } from "./schema";

describe("SCENARIOS", () => {
  it("have unique ids the tracer accepts", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SCENARIO_ID);
  });

  it("each prove they reached the part of WordPress they are about", () => {
    for (const s of SCENARIOS) expect(s.mustFire.length, s.id).toBeGreaterThan(0);
  });

  it("send a body only with POST", () => {
    for (const s of SCENARIOS) expect(s.body === undefined || s.method === "POST", s.id).toBe(true);
  });
});

describe("isDemoName", () => {
  it("recognises the fixtures' names and nothing from core", () => {
    expect(isDemoName("hooked_demo_cron")).toBe(true);
    expect(isDemoName("hooked_child_setup")).toBe(true);
    expect(isDemoName("init")).toBe(false);
  });
});
