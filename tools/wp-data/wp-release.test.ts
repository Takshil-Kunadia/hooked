import { describe, expect, it } from "vitest";
import { latestPatch } from "./wp-release";

describe("latestPatch", () => {
  const releases = ["6.9.12", "7.0", "7.0.1", "7.0.10", "7.0.9", "7.1", "7.1.5", "7.10.2", "7.0-RC1"];

  it("picks the newest patch, comparing numbers rather than text", () => {
    expect(latestPatch(releases, "7.0")).toBe("7.0.10");
    expect(latestPatch(releases, "7.1")).toBe("7.1.5");
  });

  it("does not confuse 7.1 with 7.10, and accepts a major with no patch release yet", () => {
    expect(latestPatch(releases, "7.10")).toBe("7.10.2");
    expect(latestPatch(["7.2"], "7.2")).toBe("7.2");
  });

  it("returns undefined when there is no stable release", () => {
    expect(latestPatch(releases, "7.2")).toBeUndefined();
    expect(latestPatch(["7.2-RC1"], "7.2")).toBeUndefined();
  });
});
