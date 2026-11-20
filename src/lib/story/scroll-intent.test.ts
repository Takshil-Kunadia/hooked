import { describe, expect, it } from "vitest";
import { SCROLL_INTENT_MS, scrollInFlight, startIntent } from "./scroll-intent";

describe("scroll intent", () => {
  it("is not in flight without an intent", () => {
    expect(scrollInFlight(null, 100, 0)).toBe(false);
  });

  it("is in flight while the page is short of the target and the deadline is open", () => {
    const intent = startIntent(1000, 5000);
    expect(scrollInFlight(intent, 400, 5100)).toBe(true);
  });

  it("is done once the page reaches the target", () => {
    const intent = startIntent(1000, 5000);
    expect(scrollInFlight(intent, 999, 5100)).toBe(false);
    expect(scrollInFlight(intent, 1000, 5100)).toBe(false);
  });

  it("gives up after the deadline, so an interrupted scroll can still snap", () => {
    const intent = startIntent(1000, 5000);
    expect(scrollInFlight(intent, 400, 5000 + SCROLL_INTENT_MS - 1)).toBe(true);
    expect(scrollInFlight(intent, 400, 5000 + SCROLL_INTENT_MS)).toBe(false);
  });
});
