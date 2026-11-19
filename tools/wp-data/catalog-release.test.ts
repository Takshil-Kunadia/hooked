import { describe, expect, it } from "vitest";
import { coveredVersion, newestFirst } from "./catalog-release";

describe("newestFirst", () => {
  it("drops pre-releases and sorts by semver, not text", () => {
    const versions = ["1.9.0", "1.13.0", "1.10.2", "2.0.0-beta.1", "1.10.10"].map((version) => ({ version }));
    expect(newestFirst(versions).map((r) => r.version)).toEqual(["1.13.0", "1.10.10", "1.10.2", "1.9.0"]);
  });
});

describe("coveredVersion", () => {
  it("reads the WordPress version from the readme", () => {
    expect(coveredVersion("# Hooks\n\nLast updated for WordPress 7.1.\n")).toBe("7.1");
    expect(coveredVersion("nothing here")).toBeUndefined();
  });
});
