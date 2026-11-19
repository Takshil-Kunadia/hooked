import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareVersions, readIndex, readTrace, versionDir } from "./files";

describe("compareVersions", () => {
  it("sorts newest first, comparing numbers rather than text", () => {
    expect(["7.9", "6.8", "7.10", "7.1"].sort(compareVersions)).toEqual(["7.10", "7.9", "7.1", "6.8"]);
  });
});

describe("path guards", () => {
  it("only accepts major.minor versions", () => {
    expect(versionDir("/data", "7.1")).toBe(path.join("/data", "7.1"));
    expect(() => versionDir("/data", "../7.1")).toThrow(/major version/);
    expect(() => versionDir("/data", "7.1.5")).toThrow(/major version/);
  });

  it("only accepts scenario ids", async () => {
    await expect(readTrace("/data", "7.1", "../../secrets")).rejects.toThrow(/scenario id/);
  });
});

describe("validated reads", () => {
  it("names the file when its contents do not match the schema", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "hooked-files-test-"));
    await writeFile(path.join(dir, "index.json"), JSON.stringify({ latest: "7.2", versions: ["7.1"] }));
    await expect(readIndex(dir)).rejects.toThrow(/index\.json is not valid/);
  });
});
