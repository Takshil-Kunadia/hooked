import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_QUERY, syncReducedMotion, type MediaLike } from "./reduced-motion";
import { createStoryStore } from "./store";

/** A stand-in for `matchMedia(REDUCED_MOTION_QUERY)` whose answer the test can flip. */
function fakeMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: initial,
    addEventListener: (_type: "change", fn: () => void) => void listeners.add(fn),
    removeEventListener: (_type: "change", fn: () => void) => void listeners.delete(fn),
  };
  const flip = (next: boolean): void => {
    media.matches = next;
    listeners.forEach((fn) => fn());
  };
  return { media: media as MediaLike, flip, listening: () => listeners.size };
}

describe("syncReducedMotion", () => {
  it("watches the reduced-motion media query", () => {
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
  });

  it("sets the store from the media query straight away", () => {
    const store = createStoryStore();
    syncReducedMotion(store, fakeMedia(true).media);
    expect(store.getState().reducedMotion).toBe(true);
  });

  it("follows the setting when it changes", () => {
    const store = createStoryStore();
    const { media, flip } = fakeMedia(false);
    syncReducedMotion(store, media);
    flip(true);
    expect(store.getState().reducedMotion).toBe(true);
    flip(false);
    expect(store.getState().reducedMotion).toBe(false);
  });

  it("doesn't wake subscribers when nothing changed", () => {
    const store = createStoryStore({ reducedMotion: true });
    let wakes = 0;
    store.subscribe(() => (wakes += 1));
    syncReducedMotion(store, fakeMedia(true).media);
    expect(wakes).toBe(0);
  });

  it("stops listening when cleaned up", () => {
    const store = createStoryStore();
    const fake = fakeMedia(false);
    const stop = syncReducedMotion(store, fake.media);
    stop();
    fake.flip(true);
    expect(fake.listening()).toBe(0);
    expect(store.getState().reducedMotion).toBe(false);
  });
});
