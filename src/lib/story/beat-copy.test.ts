import { describe, expect, it } from "vitest";
import { renderBeatCopy } from "./beat-copy";
import type { StoryData } from "./facts";

const DATA: StoryData = {
  version: "7.1",
  wp: "7.1.5",
  request: { method: "GET", path: "/hello-world/" },
  status: 200,
  tickets: { shown: [], hidden: 0, all: [] },
  bootAnnouncements: [],
  sources: {},
};

describe("renderBeatCopy", () => {
  it("keeps fixed copy as it is", () => {
    expect(renderBeatCopy("Fixed words.", DATA)).toBe("Fixed words.");
  });

  it("gives copy that quotes a fact the data", () => {
    expect(renderBeatCopy((d) => `Asks for ${d.request.path}`, DATA)).toBe("Asks for /hello-world/");
  });

  it("renders nothing for a beat without copy", () => {
    expect(renderBeatCopy(undefined, DATA)).toBeNull();
  });
});
